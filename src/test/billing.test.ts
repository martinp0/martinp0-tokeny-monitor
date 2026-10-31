import { describe, it, expect, vi } from "vitest";
import {
  HANDLED_EVENTS,
  handleStripeEvent,
  invoiceSubscriptionId,
  TERMS_VERSION,
  parseCheckoutConsent,
  parseInterval,
  portalSessionParams,
  safeAppUrl,
  shouldWriteSubscription,
  subscriptionPeriod,
  toSubscriptionRow,
  trialDaysFor,
  type StripeEventLike,
  type StripeSubscriptionLike,
  type WebhookDeps,
} from "../../server/lib/billing";

const USER = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const T0 = 1_790_000_000; // 2026-09-21
const T1 = T0 + 30 * 86_400;
const iso = (s: number) => new Date(s * 1000).toISOString();

function sub(over: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    metadata: { supabase_user_id: USER },
    cancel_at_period_end: false,
    items: { data: [{ price: { id: "price_m" }, current_period_start: T0, current_period_end: T1 }] },
    ...over,
  };
}

function deps(over: Partial<WebhookDeps> = {}, stripeSub: StripeSubscriptionLike = sub()) {
  const d = {
    retrieveSubscription: vi.fn(async () => stripeSub),
    customerUserId: vi.fn(async () => null as string | null),
    userIdByCustomer: vi.fn(async () => null as string | null),
    getExisting: vi.fn(async () => null),
    upsert: vi.fn(async () => {}),
    log: vi.fn(),
    ...over,
  };
  return d;
}

const ev = (type: string, object: Record<string, unknown>): StripeEventLike => ({ id: "evt_1", type, data: { object } });

describe("subscriptionPeriod", () => {
  it("reads the legacy top-level fields", () => {
    const s = sub({ current_period_start: T0, current_period_end: T1, items: { data: [{ price: { id: "p" } }] } });
    expect(subscriptionPeriod(s)).toEqual({ start: iso(T0), end: iso(T1) });
  });

  it("reads the new item-level fields (basil API)", () => {
    const s = sub({
      items: {
        data: [
          { price: { id: "a" }, current_period_start: T0 + 10, current_period_end: T1 },
          { price: { id: "b" }, current_period_start: T0, current_period_end: T1 + 50 },
        ],
      },
    });
    expect(subscriptionPeriod(s)).toEqual({ start: iso(T0), end: iso(T1 + 50) });
  });

  it("falls back to trial_end and to null", () => {
    expect(subscriptionPeriod(sub({ items: { data: [] }, trial_end: T1 })).end).toBe(iso(T1));
    expect(subscriptionPeriod(sub({ items: null }))).toEqual({ start: null, end: null });
  });
});

describe("invoiceSubscriptionId", () => {
  it("handles every invoice shape", () => {
    expect(invoiceSubscriptionId({ subscription: "sub_a" })).toBe("sub_a");
    expect(invoiceSubscriptionId({ subscription: { id: "sub_b" } })).toBe("sub_b");
    expect(invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_c" } } })).toBe("sub_c");
    expect(
      invoiceSubscriptionId({ lines: { data: [{ parent: { subscription_item_details: { subscription: "sub_d" } } }] } }),
    ).toBe("sub_d");
    expect(invoiceSubscriptionId({ lines: { data: [{ subscription: "sub_e" }] } })).toBe("sub_e");
    expect(invoiceSubscriptionId({})).toBeNull();
  });
});

describe("toSubscriptionRow", () => {
  it("maps a subscription to the DB row", () => {
    expect(toSubscriptionRow(sub({ customer: { id: "cus_x" }, cancel_at_period_end: true }), USER)).toEqual({
      user_id: USER,
      stripe_customer_id: "cus_x",
      stripe_subscription_id: "sub_1",
      price_id: "price_m",
      status: "active",
      current_period_start: iso(T0),
      current_period_end: iso(T1),
      cancel_at_period_end: true,
    });
  });
});

describe("handleStripeEvent", () => {
  it("handles exactly the five configured events", () => {
    expect([...HANDLED_EVENTS].sort()).toEqual(
      [
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.deleted",
        "customer.subscription.updated",
        "invoice.payment_failed",
      ].sort(),
    );
  });

  it("ignores other events without calling Stripe", async () => {
    const d = deps();
    expect(await handleStripeEvent(ev("charge.succeeded", {}), d)).toEqual({ action: "ignored", reason: "unhandled_type" });
    expect(d.retrieveSubscription).not.toHaveBeenCalled();
  });

  it("skips (no retry, no write) events for a deleted account", async () => {
    const d = deps({ userExists: vi.fn(async () => false) });
    const r = await handleStripeEvent(ev("customer.subscription.deleted", { id: "sub_1", object: "subscription" }), d);
    expect(r).toEqual({ action: "skipped", reason: "user_deleted", subscriptionId: "sub_1" });
    expect(d.upsert).not.toHaveBeenCalled();
  });

  it("writes normally when the user still exists", async () => {
    const d = deps({ userExists: vi.fn(async () => true) });
    const r = await handleStripeEvent(ev("customer.subscription.updated", { id: "sub_1", object: "subscription" }), d);
    expect(r).toMatchObject({ action: "upserted", userId: USER });
  });

  it("ignores one-off checkout sessions", async () => {
    const d = deps();
    const r = await handleStripeEvent(ev("checkout.session.completed", { mode: "payment", subscription: null }), d);
    expect(r).toEqual({ action: "ignored", reason: "no_subscription" });
  });

  it("checkout.session.completed → upserts the re-fetched subscription", async () => {
    const d = deps();
    const r = await handleStripeEvent(
      ev("checkout.session.completed", { mode: "subscription", subscription: "sub_1", client_reference_id: USER }),
      d,
    );
    expect(r).toEqual({ action: "upserted", userId: USER, subscriptionId: "sub_1", status: "active" });
    expect(d.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(d.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: USER, current_period_end: iso(T1) }));
  });

  it("checkout uses client_reference_id when the subscription has no metadata", async () => {
    const d = deps({}, sub({ metadata: {} }));
    const r = await handleStripeEvent(
      ev("checkout.session.completed", { mode: "subscription", subscription: { id: "sub_1" }, client_reference_id: USER }),
      d,
    );
    expect(r).toMatchObject({ action: "upserted", userId: USER });
  });

  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"])(
    "%s → upserts current state",
    async (type) => {
      const status = type.endsWith("deleted") ? "canceled" : "active";
      const d = deps({}, sub({ status }));
      const r = await handleStripeEvent(ev(type, { id: "sub_1", status: "stale" }), d);
      expect(r).toEqual({ action: "upserted", userId: USER, subscriptionId: "sub_1", status });
      expect(d.upsert).toHaveBeenCalledWith(expect.objectContaining({ status }));
    },
  );

  it("invoice.payment_failed (new API shape) → stores past_due and logs", async () => {
    const d = deps({}, sub({ status: "past_due" }));
    const r = await handleStripeEvent(
      ev("invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_1" } } }),
      d,
    );
    expect(r).toMatchObject({ action: "upserted", status: "past_due" });
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining("payment failed"), expect.anything());
  });

  it("resolves the user via customer metadata, then via existing DB row", async () => {
    const viaCustomer = deps({ customerUserId: vi.fn(async () => USER) }, sub({ metadata: {} }));
    expect(await handleStripeEvent(ev("customer.subscription.updated", { id: "sub_1" }), viaCustomer)).toMatchObject({
      userId: USER,
    });

    const viaDb = deps({ userIdByCustomer: vi.fn(async () => OTHER) }, sub({ metadata: {} }));
    expect(await handleStripeEvent(ev("customer.subscription.updated", { id: "sub_1" }), viaDb)).toMatchObject({
      userId: OTHER,
    });
  });

  it("skips (200, no retry) when no user can be resolved; rejects non-UUID metadata", async () => {
    const d = deps({}, sub({ metadata: { supabase_user_id: "not-a-uuid" } }));
    const r = await handleStripeEvent(ev("customer.subscription.updated", { id: "sub_1" }), d);
    expect(r).toEqual({ action: "skipped", reason: "no_user", subscriptionId: "sub_1" });
    expect(d.upsert).not.toHaveBeenCalled();
  });

  it("a late event for an old canceled subscription does not clobber a newer active one", async () => {
    const d = deps(
      {
        getExisting: vi.fn(async () => ({
          stripe_subscription_id: "sub_new",
          status: "active",
          current_period_end: "2999-01-01T00:00:00Z",
        })),
      },
      sub({ id: "sub_old", status: "canceled" }),
    );
    const r = await handleStripeEvent(ev("customer.subscription.deleted", { id: "sub_old" }), d);
    expect(r).toEqual({ action: "skipped", reason: "older_subscription", subscriptionId: "sub_old" });
    expect(d.upsert).not.toHaveBeenCalled();
  });

  it("propagates DB / Stripe errors so the endpoint returns 500 and Stripe retries", async () => {
    const d = deps({ upsert: vi.fn(async () => { throw new Error("db down"); }) });
    await expect(handleStripeEvent(ev("customer.subscription.updated", { id: "sub_1" }), d)).rejects.toThrow("db down");
  });
});

describe("shouldWriteSubscription", () => {
  const row = toSubscriptionRow(sub(), USER);
  it("writes when there is no row or it is the same subscription", () => {
    expect(shouldWriteSubscription(null, row)).toBe(true);
    expect(shouldWriteSubscription({ stripe_subscription_id: "sub_1", status: "canceled", current_period_end: null }, row)).toBe(true);
  });
  it("replaces an old, inactive subscription with a new one", () => {
    expect(shouldWriteSubscription({ stripe_subscription_id: "sub_0", status: "canceled", current_period_end: null }, row)).toBe(true);
  });
});

describe("checkout helpers", () => {
  it("parseInterval", () => {
    expect(parseInterval("month")).toBe("month");
    expect(parseInterval("monthly")).toBe("month");
    expect(parseInterval("year")).toBe("year");
    expect(parseInterval("yearly")).toBe("year");
    expect(parseInterval("weekly")).toBeNull();
    expect(parseInterval(undefined)).toBeNull();
  });

  it("trialDaysFor: only first-time subscribers, sane bounds", () => {
    expect(trialDaysFor("14", false)).toBe(14);
    expect(trialDaysFor("14", true)).toBe(0);
    expect(trialDaysFor(undefined, false)).toBe(0);
    expect(trialDaysFor("0", false)).toBe(0);
    expect(trialDaysFor("abc", false)).toBe(0);
    expect(trialDaysFor("9999", false)).toBe(730);
  });

  it("safeAppUrl only redirects to allowed origins", () => {
    const allowed = ["https://tokeny.martinpohl.cz", "https://tokeny.pohl.uk"];
    expect(safeAppUrl("https://tokeny.pohl.uk", allowed, "https://tokeny.martinpohl.cz/")).toBe("https://tokeny.pohl.uk");
    expect(safeAppUrl("https://evil.example", allowed, "https://tokeny.martinpohl.cz/")).toBe("https://tokeny.martinpohl.cz");
    expect(safeAppUrl(null, allowed, "https://tokeny.martinpohl.cz")).toBe("https://tokeny.martinpohl.cz");
  });
});

describe("portalSessionParams", () => {
  const ret = "https://tokeny.martinpohl.cz/settings";
  it("pins the Tokeny portal configuration when set", () => {
    expect(portalSessionParams("cus_1", ret, "bpc_1UWWl56jFD9ux2ZIFNMakNRR")).toEqual({
      customer: "cus_1", return_url: ret, configuration: "bpc_1UWWl56jFD9ux2ZIFNMakNRR",
    });
    expect(portalSessionParams("cus_1", ret, "  bpc_abc \n").configuration).toBe("bpc_abc");
  });
  it("falls back to the account default when unset or malformed", () => {
    expect(portalSessionParams("cus_1", ret, undefined)).toEqual({ customer: "cus_1", return_url: ret });
    expect(portalSessionParams("cus_1", ret, "")).not.toHaveProperty("configuration");
    expect(portalSessionParams("cus_1", ret, "price_123")).not.toHaveProperty("configuration");
  });
});

describe("parseCheckoutConsent", () => {
  const now = new Date("2026-10-31T10:00:00.000Z");
  it("requires both the terms and the immediate-start consent", () => {
    expect(parseCheckoutConsent(undefined, now)).toBeNull();
    expect(parseCheckoutConsent({ terms: true }, now)).toBeNull();
    expect(parseCheckoutConsent({ immediateStart: true }, now)).toBeNull();
    expect(parseCheckoutConsent({ terms: "true", immediateStart: true }, now)).toBeNull();
  });
  it("records the server time, terms version and a normalised client time", () => {
    expect(parseCheckoutConsent({ terms: true, immediateStart: true, at: "2026-10-31T09:59:58Z" }, now)).toEqual({
      terms_version: TERMS_VERSION,
      consent_at: "2026-10-31T10:00:00.000Z",
      consent_client_at: "2026-10-31T09:59:58.000Z",
      immediate_start: "true",
    });
  });
  it("ignores an invalid client time", () => {
    expect(parseCheckoutConsent({ terms: true, immediateStart: true, at: "nope" }, now)?.consent_client_at).toBe("");
  });
});
