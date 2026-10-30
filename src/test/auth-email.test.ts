import { describe, it, expect } from "vitest";
import {
  buildVerifyUrl,
  planAuthEmails,
  signStandardWebhook,
  verifyStandardWebhook,
} from "../../supabase/functions/_shared/auth-email.ts";

const SECRET = `v1,whsec_${Buffer.from("super-secret-test-key-0123456789").toString("base64")}`;
const SUPA = "https://cfjusewixhycahgxoylm.supabase.co";
const NOW = new Date("2026-10-30T12:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));

function headers(h: Record<string, string>) {
  return new Headers(h);
}

describe("Standard Webhooks signature", () => {
  const body = JSON.stringify({ hello: "world" });

  it("accepts a valid signature", async () => {
    const sig = await signStandardWebhook(SECRET, "msg_1", TS, body);
    const r = await verifyStandardWebhook(
      SECRET,
      headers({ "webhook-id": "msg_1", "webhook-timestamp": TS, "webhook-signature": `v1,bogus ${sig}` }),
      body,
      NOW,
    );
    expect(r).toEqual({ ok: true });
  });

  it("rejects tampered body, wrong secret, stale timestamp, missing headers", async () => {
    const sig = await signStandardWebhook(SECRET, "msg_1", TS, body);
    const h = headers({ "webhook-id": "msg_1", "webhook-timestamp": TS, "webhook-signature": sig });
    expect((await verifyStandardWebhook(SECRET, h, body + " ", NOW)).ok).toBe(false);
    const other = `v1,whsec_${Buffer.from("another-secret-key-0000000000000").toString("base64")}`;
    expect((await verifyStandardWebhook(other, h, body, NOW)).ok).toBe(false);
    const later = new Date(NOW.getTime() + 10 * 60 * 1000);
    expect(await verifyStandardWebhook(SECRET, h, body, later)).toEqual({ ok: false, reason: "timestamp_out_of_tolerance" });
    expect(await verifyStandardWebhook(SECRET, headers({}), body, NOW)).toEqual({ ok: false, reason: "missing_headers" });
    expect(await verifyStandardWebhook(undefined, h, body, NOW)).toEqual({ ok: false, reason: "secret_not_configured" });
  });

  it("the old Authorization-header scheme is not accepted", async () => {
    const r = await verifyStandardWebhook(SECRET, headers({ authorization: "Bearer abc" }), body, NOW);
    expect(r.ok).toBe(false);
  });
});

describe("confirmation links", () => {
  it("build a GoTrue verify URL that carries the token hash", () => {
    const url = new URL(buildVerifyUrl(SUPA + "/", "pkce_abc", "signup", "https://tokeny.martinpohl.cz/auth/callback"));
    expect(url.origin + url.pathname).toBe(`${SUPA}/auth/v1/verify`);
    expect(url.searchParams.get("token")).toBe("pkce_abc");
    expect(url.searchParams.get("type")).toBe("signup");
    expect(url.searchParams.get("redirect_to")).toBe("https://tokeny.martinpohl.cz/auth/callback");
  });

  it.each(["signup", "recovery", "magiclink", "invite"])("%s email links contain the token (regression)", (type) => {
    const mails = planAuthEmails(
      {
        user: { email: "a@example.com" },
        email_data: { email_action_type: type, token: "123456", token_hash: "hash_1", redirect_to: "https://tokeny.martinpohl.cz/reset-password" },
      },
      SUPA,
      "https://tokeny.martinpohl.cz/",
    );
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("a@example.com");
    expect(mails[0].confirmationUrl).toContain("token=hash_1");
    expect(mails[0].confirmationUrl).toContain(`type=${type}`);
    expect(mails[0].confirmationUrl).not.toBe("https://tokeny.martinpohl.cz/reset-password");
  });

  it("secure email change sends two mails with the (reversed) hash mapping", () => {
    const mails = planAuthEmails(
      {
        user: { email: "old@example.com", new_email: "new@example.com" },
        email_data: {
          email_action_type: "email_change",
          token: "111111",
          token_hash: "hash_for_new",
          token_new: "222222",
          token_hash_new: "hash_for_current",
          redirect_to: "",
        },
      },
      SUPA,
      "https://tokeny.martinpohl.cz/",
    );
    expect(mails.map((m) => [m.to, new URL(m.confirmationUrl).searchParams.get("token"), m.token])).toEqual([
      ["old@example.com", "hash_for_current", "111111"],
      ["new@example.com", "hash_for_new", "222222"],
    ]);
    expect(new URL(mails[0].confirmationUrl).searchParams.get("redirect_to")).toBe("https://tokeny.martinpohl.cz/");
  });

  it("non-secure email change sends one mail to the new address", () => {
    const mails = planAuthEmails(
      {
        user: { email: "old@example.com", new_email: "new@example.com" },
        email_data: { email_action_type: "email_change", token: "111111", token_hash: "h", token_hash_new: "", redirect_to: "x" },
      },
      SUPA,
      "",
    );
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("new@example.com");
  });

  it("reauthentication sends the OTP; notification types send nothing", () => {
    const re = planAuthEmails({ user: { email: "a@b.c" }, email_data: { email_action_type: "reauthentication", token: "654321" } }, SUPA, "");
    expect(re).toEqual([expect.objectContaining({ to: "a@b.c", token: "654321", confirmationUrl: "" })]);
    expect(planAuthEmails({ user: { email: "a@b.c" }, email_data: { email_action_type: "password_changed_notification" } }, SUPA, "")).toEqual([]);
  });
});
