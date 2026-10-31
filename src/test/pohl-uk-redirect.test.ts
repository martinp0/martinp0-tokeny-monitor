import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { disable, enable, isEnabled, loadRedirect } from "../../scripts/pohl-uk-redirect.mjs";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

/** Minimal Vercel-style matcher for our one rule: host match + `/:path*` → destination (query kept). */
function apply(rule: { source: string; destination: string; has: { value: string }[] }, url: string) {
  const u = new URL(url);
  if (u.host !== rule.has[0].value || rule.source !== "/:path*") return null;
  return rule.destination.replace("/:path*", u.pathname) + u.search;
}

describe("tokeny.pohl.uk → tokeny.martinpohl.cz redirect", () => {
  it("is NOT active in vercel.json yet (gate: login must be verified on the new domain first)", () => {
    expect(isEnabled(vercel)).toBe(false);
  });

  it("is a host-only 301 that keeps path and query", () => {
    const r = loadRedirect();
    expect(r).toMatchObject({ statusCode: 301, has: [{ type: "host", value: "tokeny.pohl.uk" }] });
    expect(r).not.toHaveProperty("permanent"); // permanent:true would be a 308
    expect(apply(r, "https://tokeny.pohl.uk/auth/callback?next=%2Fsettings&code=x")).toBe(
      "https://tokeny.martinpohl.cz/auth/callback?next=%2Fsettings&code=x",
    );
    expect(apply(r, "https://tokeny.martinpohl.cz/dashboard")).toBeNull();
  });

  it("enable/disable are idempotent and keep every other rule", () => {
    const on = enable(enable(vercel, loadRedirect()), loadRedirect());
    expect(on.redirects).toHaveLength(1);
    expect(on.redirects[0].destination).toBe("https://tokeny.martinpohl.cz/:path*");
    expect(on.rewrites).toEqual(vercel.rewrites);
    expect(on.headers).toEqual(vercel.headers);
    expect(isEnabled(on)).toBe(true);
    expect(disable(on)).toEqual(vercel);
  });
});
