// @vitest-environment node
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { maskKey, validateKeyShape, ALLOWED_PROVIDERS } from "../../server/lib/credential-keys";
import { decryptSecret, encryptSecret, EncryptionKeyError, loadKey } from "../../server/crypto";

describe("maskKey", () => {
  it("shows only the last 4 characters", () => {
    expect(maskKey("sk-or-v1-abcdefghijklmnop1234")).toBe("••••1234");
    expect(maskKey("  sk-ant-admin01-xyz-9876  ")).toBe("••••9876");
  });
  it("hides short keys completely and handles empty input", () => {
    expect(maskKey("short-key")).toBe("••••");
    expect(maskKey("   ")).toBe("");
  });
  it("never contains the key prefix", () => {
    expect(maskKey("sk-proj-secretsecretsecret-ABCD")).not.toContain("sk-");
  });
});

describe("validateKeyShape", () => {
  it("accepts the documented prefixes and rejects others", () => {
    expect(validateKeyShape("openrouter", "sk-or-v1-0123456789abcdef")).toBeNull();
    expect(validateKeyShape("anthropic", "sk-ant-admin01-0123456789")).toBeNull();
    expect(validateKeyShape("openai", "sk-admin-0123456789abcdef")).toBeNull();
    expect(validateKeyShape("anthropic", "sk-or-v1-0123456789abcdef")).not.toBeNull();
    expect(validateKeyShape("openai", "")).not.toBeNull();
    expect([...ALLOWED_PROVIDERS].sort()).toEqual(["anthropic", "openai", "openrouter"]);
  });
});

describe("credential encryption (AES-256-GCM)", () => {
  const key = randomBytes(32);
  const user = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";

  it("round-trips and never stores the plaintext", () => {
    const ct = encryptSecret("sk-or-v1-supersecretvalue", user, key);
    expect(ct.startsWith("v1:")).toBe(true);
    expect(ct).not.toContain("supersecret");
    expect(decryptSecret(ct, user, key)).toBe("sk-or-v1-supersecretvalue");
  });
  it("uses a fresh IV every time", () => {
    expect(encryptSecret("same", user, key)).not.toBe(encryptSecret("same", user, key));
  });
  it("is bound to the owner: another user's id cannot decrypt it", () => {
    const ct = encryptSecret("sk-or-v1-supersecretvalue", user, key);
    expect(() => decryptSecret(ct, other, key)).toThrow();
  });
  it("detects tampering and a wrong key", () => {
    const ct = encryptSecret("sk-or-v1-supersecretvalue", user, key);
    const parts = ct.split(":");
    const flipped = Buffer.from(parts[2], "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([parts[0], parts[1], flipped.toString("base64")].join(":"), user, key)).toThrow();
    expect(() => decryptSecret(ct, user, randomBytes(32))).toThrow();
  });
  it("requires a 32-byte key in the environment", () => {
    const prev = process.env.CREDENTIALS_ENCRYPTION_KEY;
    try {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      expect(() => loadKey()).toThrow(EncryptionKeyError);
      process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(16).toString("base64");
      expect(() => loadKey()).toThrow(EncryptionKeyError);
    } finally {
      if (prev === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      else process.env.CREDENTIALS_ENCRYPTION_KEY = prev;
    }
  });
});

describe("provider key access guards", () => {
  const root = path.resolve(__dirname, "../..");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });

  it("the browser bundle never touches the ciphertext or the encryption key", () => {
    const offenders = walk(path.join(root, "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${path.sep}test${path.sep}`))
      .filter((f) => /api_key_ciphertext|CREDENTIALS_ENCRYPTION_KEY/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("only repo.ts reads the ciphertext column", () => {
    const offenders = walk(path.join(root, "server"))
      .filter((f) => f.endsWith(".ts") && !f.endsWith(`${path.sep}repo.ts`))
      .filter((f) => /api_key_ciphertext/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
