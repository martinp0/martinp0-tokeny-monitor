import { describe, it, expect, vi } from "vitest";
import {
  USER_TABLES,
  deleteAccount,
  endBilling,
  isStripeGone,
  type BillingDeps,
  type DeletionDeps,
  type StripeSubLite,
} from "../../supabase/functions/_shared/account-deletion.ts";

const USER = "11111111-2222-4333-8444-555555555555";
const missing = () => Object.assign(new Error("No such customer: 'cus_x'"), { code: "resource_missing", statusCode: 404 });

function billing(subs: StripeSubLite[] = [], over: Partial<BillingDeps> = {}): BillingDeps {
  return {
    listSubscriptions: vi.fn(async () => subs),
    cancelSubscription: vi.fn(async () => {}),
    markCustomerDeleted: vi.fn(async () => {}),
    ...over,
  };
}

function deps(over: Partial<DeletionDeps> = {}): DeletionDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    customerIdFor: vi.fn(async () => "cus_1"),
    billing: billing([{ id: "sub_1", status: "active" }]),
    deleteRows: vi.fn(async (t: string) => void calls.push(`rows:${t}`)),
    deleteAuthUser: vi.fn(async () => void calls.push("auth")),
    ...over,
  };
}

describe("isStripeGone", () => {
  it("recognises missing / already-canceled errors only", () => {
    expect(isStripeGone(missing())).toBe(true);
    expect(isStripeGone({ raw: { code: "resource_missing" } })).toBe(true);
    expect(isStripeGone(new Error("This subscription has already been canceled"))).toBe(true);
    expect(isStripeGone(new Error("No such subscription: 'sub_x'"))).toBe(true);
    expect(isStripeGone(new Error("Rate limit"))).toBe(false);
    expect(isStripeGone(null)).toBe(false);
  });
});

describe("endBilling", () => {
  it("does nothing without a customer", async () => {
    const b = billing();
    expect(await endBilling(null, b)).toEqual({ customerId: null, canceled: [], alreadyEnded: [], customerMissing: false });
    expect(b.listSubscriptions).not.toHaveBeenCalled();
  });

  it("cancels every live subscription and skips ended ones", async () => {
    const b = billing([
      { id: "sub_a", status: "active" },
      { id: "sub_t", status: "trialing" },
      { id: "sub_p", status: "past_due" },
      { id: "sub_c", status: "canceled" },
      { id: "sub_e", status: "incomplete_expired" },
    ]);
    const out = await endBilling("cus_1", b);
    expect(out.canceled).toEqual(["sub_a", "sub_t", "sub_p"]);
    expect(out.alreadyEnded).toEqual(["sub_c", "sub_e"]);
    expect(b.cancelSubscription).toHaveBeenCalledTimes(3);
    expect(b.markCustomerDeleted).toHaveBeenCalledWith("cus_1");
  });

  it("treats a missing customer as done", async () => {
    const b = billing([], { listSubscriptions: vi.fn(async () => Promise.reject(missing())) });
    const out = await endBilling("cus_gone", b);
    expect(out.customerMissing).toBe(true);
    expect(b.cancelSubscription).not.toHaveBeenCalled();
    expect(b.markCustomerDeleted).not.toHaveBeenCalled();
  });

  it("is idempotent: a subscription canceled in the meantime is fine", async () => {
    const b = billing([{ id: "sub_1", status: "active" }], {
      cancelSubscription: vi.fn(async () => Promise.reject(new Error("This subscription has already been canceled"))),
      markCustomerDeleted: vi.fn(async () => Promise.reject(missing())),
    });
    const out = await endBilling("cus_1", b);
    expect(out).toMatchObject({ canceled: [], alreadyEnded: ["sub_1"], customerMissing: true });
  });

  it("rethrows real Stripe errors", async () => {
    const b = billing([{ id: "sub_1", status: "active" }], {
      cancelSubscription: vi.fn(async () => Promise.reject(new Error("api_connection_error"))),
    });
    await expect(endBilling("cus_1", b)).rejects.toThrow("api_connection_error");
  });
});

describe("deleteAccount", () => {
  it("cancels Stripe first, then deletes rows and the auth user", async () => {
    const order: string[] = [];
    const b = billing([{ id: "sub_1", status: "active" }], {
      cancelSubscription: vi.fn(async () => void order.push("cancel")),
    });
    const d = deps({
      billing: b,
      deleteRows: vi.fn(async (t: string) => void order.push(`rows:${t}`)),
      deleteAuthUser: vi.fn(async () => void order.push("auth")),
    });
    const res = await deleteAccount(USER, d);
    expect(res).toMatchObject({ ok: true, billing: { canceled: ["sub_1"] } });
    expect(order).toEqual(["cancel", ...USER_TABLES.map((t) => `rows:${t}`), "auth"]);
  });

  it("works for users who never paid (no customer, Stripe not even configured)", async () => {
    const d = deps({ customerIdFor: vi.fn(async () => null), billing: null });
    const res = await deleteAccount(USER, d);
    expect(res.ok).toBe(true);
    expect(d.deleteAuthUser).toHaveBeenCalledWith(USER);
  });

  it("refuses to delete a paying user when Stripe isn't configured", async () => {
    const d = deps({ billing: null });
    expect(await deleteAccount(USER, d)).toEqual({ ok: false, error: "billing_unavailable" });
    expect(d.deleteRows).not.toHaveBeenCalled();
    expect(d.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("keeps the account when Stripe fails, so a retry can finish the job", async () => {
    const d = deps({
      billing: billing([{ id: "sub_1", status: "active" }], {
        cancelSubscription: vi.fn(async () => Promise.reject(new Error("timeout"))),
      }),
    });
    expect(await deleteAccount(USER, d)).toEqual({ ok: false, error: "billing_failed" });
    expect(d.deleteRows).not.toHaveBeenCalled();
    expect(d.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("still deletes when the Stripe customer no longer exists", async () => {
    const d = deps({ billing: billing([], { listSubscriptions: vi.fn(async () => Promise.reject(missing())) }) });
    const res = await deleteAccount(USER, d);
    expect(res).toMatchObject({ ok: true, billing: { customerMissing: true } });
    expect(d.deleteAuthUser).toHaveBeenCalled();
  });

  it("reports a data deletion failure", async () => {
    const d = deps({ deleteAuthUser: vi.fn(async () => Promise.reject(new Error("db down"))) });
    expect(await deleteAccount(USER, d)).toEqual({ ok: false, error: "delete_failed" });
  });
});
