import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  deleteCredentials,
  loadCredentialKey,
  maskKey,
  MissingKeyError,
  saveCredentialKey,
  type RpcClient,
} from "../../supabase/functions/_shared/credential-keys";

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn(async () => result);
  return { client: { rpc } as unknown as RpcClient, rpc };
}

describe("maskKey (mirrors public.mask_provider_key)", () => {
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

describe("saveCredentialKey", () => {
  it("calls save_provider_credential with the service-role argument names", async () => {
    const row = { id: "c1", provider: "openai", label: "Default", key_preview: "••••ABCD", enabled: true, organization_id: null, last_synced_at: null };
    const { client, rpc } = fakeClient({ data: [row], error: null });
    const saved = await saveCredentialKey(client, {
      userId: "u1",
      provider: "openai",
      label: "Default",
      apiKey: "sk-admin-0000ABCD",
      organizationId: null,
    });
    expect(rpc).toHaveBeenCalledWith("save_provider_credential", {
      p_user_id: "u1",
      p_provider: "openai",
      p_label: "Default",
      p_api_key: "sk-admin-0000ABCD",
      p_organization_id: null,
    });
    expect(saved).toEqual(row);
    expect(JSON.stringify(saved)).not.toContain("sk-admin");
  });
  it("throws on RPC errors and empty results", async () => {
    await expect(saveCredentialKey(fakeClient({ data: null, error: { message: "boom" } }).client, {
      userId: "u1", provider: "openai", label: "x", apiKey: "k", organizationId: null,
    })).rejects.toThrow(/boom/);
    await expect(saveCredentialKey(fakeClient({ data: [], error: null }).client, {
      userId: "u1", provider: "openai", label: "x", apiKey: "k", organizationId: null,
    })).rejects.toThrow(/no row/);
  });
});

describe("loadCredentialKey", () => {
  it("returns the decrypted key", async () => {
    const { client, rpc } = fakeClient({ data: "sk-ant-admin01-key", error: null });
    await expect(loadCredentialKey(client, "c1")).resolves.toBe("sk-ant-admin01-key");
    expect(rpc).toHaveBeenCalledWith("get_provider_credential_key", { p_credential_id: "c1" });
  });
  it("throws MissingKeyError when no key is stored", async () => {
    await expect(loadCredentialKey(fakeClient({ data: null, error: null }).client, "c1")).rejects.toBeInstanceOf(MissingKeyError);
    await expect(loadCredentialKey(fakeClient({ data: "", error: null }).client, "c1")).rejects.toBeInstanceOf(MissingKeyError);
  });
  it("does not put the key into error messages", async () => {
    await expect(loadCredentialKey(fakeClient({ data: null, error: { message: "permission denied" } }).client, "c1"))
      .rejects.toThrow("get_provider_credential_key failed: permission denied");
  });
});

describe("deleteCredentials", () => {
  it("deletes all of a user's credentials when no id is given", async () => {
    const { client, rpc } = fakeClient({ data: 2, error: null });
    await expect(deleteCredentials(client, "u1")).resolves.toBe(2);
    expect(rpc).toHaveBeenCalledWith("delete_provider_credentials", { p_user_id: "u1", p_credential_id: null });
  });
  it("throws on error", async () => {
    await expect(deleteCredentials(fakeClient({ data: null, error: { message: "nope" } }).client, "u1")).rejects.toThrow(/nope/);
  });
});

// ---- Static guards: the plaintext column is gone, so nothing may read or write it any more. ----
const ROOT = path.resolve(__dirname, "../..");
function files(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : files(full, exts);
    return exts.some((e) => name.endsWith(e)) ? [full] : [];
  });
}

describe("provider key access guards", () => {
  const sources = [
    ...files(path.join(ROOT, "supabase/functions"), [".ts"]),
    ...files(path.join(ROOT, "src"), [".ts", ".tsx"]).filter((f) => !f.includes(`${path.sep}test${path.sep}`)),
  ];

  it("no code selects or writes the plaintext api_key column", () => {
    const offenders = sources.filter((f) => {
      const s = readFileSync(f, "utf8");
      // A select list or row literal mentioning the bare column (api_key_name / api_key_id / api_key_secret_id are fine).
      return /\.select\([^)]*\bapi_key\b(?!_)/.test(s) || /\.(insert|upsert|update)\(\{[^}]*\bapi_key\s*:/.test(s);
    });
    expect(offenders).toEqual([]);
  });

  it("only the shared helper calls the key RPCs", () => {
    const callers = sources
      .filter((f) => /rpc\(\s*["'](get_provider_credential_key|save_provider_credential|delete_provider_credentials)["']/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(callers).toEqual(["supabase/functions/_shared/credential-keys.ts"]);
  });

  it("the browser never asks for the secret reference", () => {
    const browser = files(path.join(ROOT, "src"), [".ts", ".tsx"]).filter((f) => !f.includes("integrations/supabase/types.ts") && !f.includes(`${path.sep}test${path.sep}`));
    expect(browser.filter((f) => readFileSync(f, "utf8").includes("api_key_secret_id"))).toEqual([]);
  });

  it("the Vault migration grants key functions to service_role only", () => {
    const sql = readFileSync(path.join(ROOT, "supabase/migrations/20261030140000_provider_keys_vault.sql"), "utf8");
    for (const fn of ["save_provider_credential", "get_provider_credential_key", "delete_provider_credentials", "auto_sync_due_credentials"]) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated`));
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role;`));
      expect(sql).not.toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO [^;]*authenticated`));
    }
    expect(sql).toMatch(/DROP COLUMN api_key;/);
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
  });
});
