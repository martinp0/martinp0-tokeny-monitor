import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { mcpServerUrl, ogDashboardUrl } from "@/lib/public-urls";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string, root = ROOT) => readFileSync(path.join(root, rel), "utf8");

function backendRefs(root = ROOT) {
  const env = read(".env", root).match(/^VITE_SUPABASE_PROJECT_ID="?([a-z0-9]{20})"?/m)?.[1];
  const envUrl = read(".env", root).match(/^VITE_SUPABASE_URL="?https:\/\/([a-z0-9]{20})\.supabase\.co"?/m)?.[1];
  const toml = read("supabase/config.toml", root).match(/^project_id = "([a-z0-9]{20})"/m)?.[1];
  const xcconfig = read("apple/Config/Backend.xcconfig", root).match(/^TOKENY_SUPABASE_HOST = ([a-z0-9]{20})\.supabase\.co$/m)?.[1];
  const swift = read("apple/TokenyKit/Sources/TokenyCore/AppConfig.swift", root).match(/fallbackSupabaseHost = "([a-z0-9]{20})\.supabase\.co"/)?.[1];
  const vercel = JSON.parse(read("vercel.json", root)).rewrites
    .map((r: { destination: string }) => r.destination.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\//)?.[1])
    .filter(Boolean) as string[];
  return { env, envUrl, toml, xcconfig, swift, vercel };
}

describe("backend config", () => {
  it("every file points at the same Supabase project", () => {
    const r = backendRefs();
    expect(r.env).toBeTruthy();
    for (const v of [r.envUrl, r.toml, r.xcconfig, r.swift, ...r.vercel]) expect(v).toBe(r.env);
    expect(r.vercel.length).toBe(3);
  });

  it("the Apple xcconfig key matches the web publishable key", () => {
    const webKey = read(".env").match(/^VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\n]+)"?/m)?.[1];
    expect(read("apple/Config/Backend.xcconfig")).toContain(`TOKENY_SUPABASE_ANON_KEY = ${webKey}`);
  });

  it("no source, migration or function hardcodes a project ref outside those config files", () => {
    const allowed = new Set([
      ".env",
      "vercel.json",
      "supabase/config.toml",
      "apple/Config/Backend.xcconfig",
      "apple/TokenyKit/Sources/TokenyCore/AppConfig.swift",
      // Historical migration; its job is replaced by 20261030150000_cron_jobs_from_vault.sql.
      "supabase/migrations/20261030120400_auto_sync_cron.sql",
    ]);
    const walk = (dir: string): string[] =>
      readdirSync(path.join(ROOT, dir)).flatMap((n) => {
        const rel = path.join(dir, n);
        if (["node_modules", ".build", "test", "tests"].includes(n)) return [];
        return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
      });
    const files = ["src", "supabase", "apple", "scripts", "ci"].flatMap(walk).filter((f) => /\.(ts|tsx|sql|swift|toml|mjs|yml|xcconfig|json)$/.test(f));
    const offenders = files.filter((f) => !allowed.has(f) && /[a-z0-9]{20}\.supabase\.co/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("set-backend.mjs rewrites all of them consistently", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "tokeny-backend-"));
    for (const rel of [".env", "vercel.json", "supabase/config.toml", "apple/Config/Backend.xcconfig", "apple/TokenyKit/Sources/TokenyCore/AppConfig.swift", "scripts/set-backend.mjs"]) {
      mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
      cpSync(path.join(ROOT, rel), path.join(tmp, rel));
    }
    const ref = "abcdefghijklmnopqrst";
    execFileSync(process.execPath, [path.join(tmp, "scripts/set-backend.mjs"), ref, "sb_publishable_test123"], { stdio: "pipe" });
    const r = backendRefs(tmp);
    for (const v of [r.env, r.envUrl, r.toml, r.xcconfig, r.swift, ...r.vercel]) expect(v).toBe(ref);
    expect(read("apple/Config/Backend.xcconfig", tmp)).toContain("TOKENY_SUPABASE_ANON_KEY = sb_publishable_test123");
    expect(read(".env", tmp)).toContain('VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test123"');
  });

  it("set-backend.mjs refuses a secret key", () => {
    expect(() =>
      execFileSync(process.execPath, [path.join(ROOT, "scripts/set-backend.mjs"), "abcdefghijklmnopqrst", "sb_secret_abc"], { stdio: "pipe" }),
    ).toThrow();
  });
});

describe("public URLs on our own domain", () => {
  it("MCP and OG URLs use tokeny.martinpohl.cz and have matching rewrites", () => {
    expect(mcpServerUrl()).toBe("https://tokeny.martinpohl.cz/api/mcp");
    expect(ogDashboardUrl("a b")).toBe("https://tokeny.martinpohl.cz/api/og-dashboard?token=a%20b");
    const rewrites = JSON.parse(read("vercel.json")).rewrites as { source: string; destination: string }[];
    const dest = (src: string) => rewrites.find((r) => r.source === src)?.destination ?? "";
    expect(dest("/api/mcp")).toMatch(/\/functions\/v1\/mcp$/);
    expect(dest("/api/mcp/:path*")).toMatch(/\/functions\/v1\/mcp\/:path\*$/);
    expect(dest("/api/og-dashboard")).toMatch(/\/functions\/v1\/og-dashboard$/);
    // /api rewrites must come before the SPA rewrites.
    expect(rewrites.findIndex((r) => r.source === "/api/mcp")).toBe(0);
  });

  it("the UI no longer shows Supabase function URLs", () => {
    for (const f of ["src/pages/Settings.tsx", "src/components/dashboard/SharedDashboardsManager.tsx"]) {
      expect(read(f)).not.toMatch(/functions\/v1\/(mcp|og-dashboard)/);
    }
  });
});
