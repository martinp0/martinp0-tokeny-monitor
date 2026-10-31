import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { mcpServerUrl } from "@/lib/public-urls";
import { shareUrl } from "@/lib/share";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const vercel = () =>
  JSON.parse(read("vercel.json")) as {
    rewrites: { source: string; destination: string }[];
    crons?: { path: string; schedule: string }[];
    functions?: Record<string, unknown>;
  };

const walk = (dir: string): string[] =>
  existsSync(path.join(ROOT, dir))
    ? readdirSync(path.join(ROOT, dir)).flatMap((n) => {
        const rel = path.join(dir, n);
        if (["node_modules", ".build", "fixtures"].includes(n)) return [];
        return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
      })
    : [];

describe("backend config (Neon + Vercel Functions)", () => {
  it("Supabase is gone from the app, server and native code", () => {
    expect(existsSync(path.join(ROOT, "supabase"))).toBe(false);
    expect(existsSync(path.join(ROOT, "src/integrations/supabase"))).toBe(false);
    const pkg = JSON.parse(read("package.json"));
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => d.includes("supabase"))).toEqual([]);
    const files = ["src", "server", "api", "apple/TokenyKit/Sources", "apple/SharedUI", "apple/Config"]
      .flatMap(walk)
      .filter((f) => /\.(ts|tsx|swift|xcconfig)$/.test(f) && !f.includes(`${path.sep}test${path.sep}`));
    const offenders = files.filter((f) => /supabase\.co|supabase-js|from "@supabase|import Auth$/m.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("the server reads DATABASE_URL, never the marketplace POSTGRES_URL", () => {
    const server = walk("server").concat(walk("api")).filter((f) => /\.ts$/.test(f));
    expect(server.some((f) => read(f).includes("DATABASE_URL"))).toBe(true);
    expect(server.filter((f) => /POSTGRES_URL/.test(read(f)))).toEqual([]);
  });

  it("Hobby limits: one catch-all function, a daily cron", () => {
    const v = vercel();
    expect(Object.keys(v.functions ?? {})).toEqual(["api/index.ts"]);
    const apiFiles = walk("api").filter((f) => /\.(ts|js|mjs)$/.test(f));
    expect(apiFiles).toEqual([path.join("api", "index.ts")]);
    expect(v.crons?.length).toBe(1);
    // Hobby crons run at most once a day: minute and hour fixed, the rest "*".
    expect(v.crons?.[0].schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });

  it("the /api rewrite comes first so SPA rewrites never swallow API calls", () => {
    const r = vercel().rewrites;
    expect(r[0]).toEqual({ source: "/api/:path*", destination: "/api?__path=:path*" });
    expect(r.filter((x) => /supabase\.co/.test(x.destination))).toEqual([]);
  });

  it("the Apple apps point at the web origin only", () => {
    const xc = read("apple/Config/Backend.xcconfig");
    expect(xc).toMatch(/^TOKENY_WEB_HOST = tokeny\.martinpohl\.cz$/m);
    expect(xc).not.toMatch(/SUPABASE|ANON_KEY|eyJ/);
    expect(read("apple/project.yml")).not.toMatch(/TokenySupabase/);
  });
});

describe("public URLs on our own domain", () => {
  it("MCP and share URLs use tokeny.martinpohl.cz", () => {
    expect(mcpServerUrl()).toBe("https://tokeny.martinpohl.cz/api/mcp");
    expect(shareUrl("abc", "https://tokeny.martinpohl.cz")).toBe("https://tokeny.martinpohl.cz/s/abc");
  });

  it("the UI no longer shows Supabase function URLs", () => {
    for (const f of ["src/pages/Settings.tsx", "src/components/settings/ShareLinksSettings.tsx"]) {
      expect(read(f)).not.toMatch(/functions\/v1\//);
    }
  });
});
