import { describe, it, expect } from "vitest";
import { authCallbackUrl, readAuthError, sanitizeNext } from "@/lib/auth-redirect";

describe("auth redirects", () => {
  it("builds the callback URL from the current origin", () => {
    expect(authCallbackUrl("https://tokeny.martinpohl.cz")).toBe("https://tokeny.martinpohl.cz/auth/callback");
    expect(authCallbackUrl("https://tokeny.pohl.uk", "/settings")).toBe("https://tokeny.pohl.uk/auth/callback?next=%2Fsettings");
    expect(authCallbackUrl("http://localhost:8080")).toBe("http://localhost:8080/auth/callback");
  });

  it("rejects open redirects in ?next=", () => {
    expect(sanitizeNext("/profile")).toBe("/profile");
    expect(sanitizeNext("https://evil.example")).toBe("/dashboard");
    expect(sanitizeNext("//evil.example")).toBe("/dashboard");
    expect(sanitizeNext("/\\evil.example")).toBe("/dashboard");
    expect(sanitizeNext(null)).toBe("/dashboard");
  });

  it("reads provider errors from query or fragment", () => {
    expect(readAuthError("?error=access_denied&error_description=User+cancelled", "")).toBe("User cancelled");
    expect(readAuthError("", "#error=server_error")).toBe("server_error");
    expect(readAuthError("?code=abc", "#access_token=x")).toBeNull();
  });
});
