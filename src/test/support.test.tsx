import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import i18n from "@/i18n";
import cs from "@/i18n/cs.json";
import en from "@/i18n/en.json";
import SupportCard from "@/components/SupportCard";
import BlogPostLayout from "@/components/BlogPostLayout";
import { isNativeAppSurface, SUPPORT_PAGE, supportHref } from "@/lib/support";

const ROOT = path.resolve(__dirname, "../..");

type ShellWindow = Window & {
  __TOKENY_NATIVE__?: boolean;
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
};

const shell = window as ShellWindow;

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const rel = path.join(dir, name);
    if (name === "node_modules" || name === ".build") return [];
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

afterEach(() => {
  cleanup();
  delete shell.__TOKENY_NATIVE__;
  delete shell.Capacitor;
});

describe("support links", () => {
  it("uses martinp0, with a placement tag on the card and the blog line", () => {
    expect(SUPPORT_PAGE).toBe("https://buymeacoffee.com/martinp0");
    expect(supportHref("landing")).toBe(
      "https://buymeacoffee.com/martinp0?utm_source=tokeny.martinpohl.cz&utm_medium=landing&utm_campaign=support_card",
    );
    expect(supportHref("calculator")).toContain("utm_medium=calculator");
    expect(supportHref("blog")).toBe(
      "https://buymeacoffee.com/martinp0?utm_source=tokeny.martinpohl.cz&utm_medium=blog&utm_campaign=support_line",
    );
    expect(supportHref("blog")).not.toContain("martinpohlp");
  });

  it("keeps the blog line copy exact, in both languages, without a long dash", () => {
    expect(`${cs.blogSupport.lead} ${cs.blogSupport.link}`).toBe(
      "Psal jsem to po večerech. Pokud ti článek pomohl, podpoř mě kafem ☕",
    );
    expect(`${en.blogSupport.lead} ${en.blogSupport.link}`).toBe(
      "Written after hours. If this helped, support my work with a coffee ☕",
    );
    const copy = [cs.blogSupport.lead, cs.blogSupport.link, en.blogSupport.lead, en.blogSupport.link, cs.support.desc, en.support.desc].join("\n");
    expect(copy).not.toMatch(/[—–]/);
    expect(copy).not.toMatch(/Profi Správce|SVJ Monitor/);
  });

  it("lists martinp0 in GitHub funding", () => {
    expect(readFileSync(path.join(ROOT, ".github/FUNDING.yml"), "utf8").trim()).toBe("buy_me_a_coffee: martinp0");
  });

  it("is hidden for a native build, Capacitor, or a Tokeny webview", () => {
    expect(isNativeAppSurface()).toBe(false);
    expect(isNativeAppSurface("true")).toBe(true);
    expect(isNativeAppSurface("false")).toBe(false);

    shell.__TOKENY_NATIVE__ = true;
    expect(isNativeAppSurface()).toBe(true);
    delete shell.__TOKENY_NATIVE__;

    shell.Capacitor = { isNativePlatform: () => true };
    expect(isNativeAppSurface()).toBe(true);
    shell.Capacitor = { getPlatform: () => "ios" };
    expect(isNativeAppSurface()).toBe(true);
    shell.Capacitor = { isNativePlatform: () => false, getPlatform: () => "web" };
    expect(isNativeAppSurface()).toBe(false);
    delete shell.Capacitor;

    const original = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", { value: "TokenyNative/1.0", configurable: true });
    expect(isNativeAppSurface()).toBe(true);
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      configurable: true,
    });
    expect(isNativeAppSurface()).toBe(false);
    Object.defineProperty(navigator, "userAgent", { value: original, configurable: true });
  });

  it("renders the card on the web and omits the link in a native shell", async () => {
    await i18n.changeLanguage("cs");
    render(<SupportCard placement="landing" />);
    const link = screen.getByRole("link", { name: /Podpořit kafem/ });
    expect(link).toHaveAttribute("href", supportHref("landing"));
    expect(screen.getByTestId("support-card")).toBeInTheDocument();

    cleanup();
    shell.__TOKENY_NATIVE__ = true;
    render(<SupportCard placement="landing" />);
    expect(screen.queryByTestId("support-card")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("puts one support line under the closing share buttons of a blog post", async () => {
    await i18n.changeLanguage("en");
    render(
      <HelmetProvider>
        <MemoryRouter>
          <BlogPostLayout title="Title" description="Description" slug="example" date="2026-05-01" tag="AI" keywords="ai">
            <p>Body</p>
          </BlogPostLayout>
        </MemoryRouter>
      </HelmetProvider>,
    );
    const line = screen.getByTestId("blog-support-line");
    expect(line).toHaveTextContent("Written after hours. If this helped, support my work with a coffee ☕");
    expect(line.querySelector("a")).toHaveAttribute("href", supportHref("blog"));
    expect(screen.getAllByTestId("blog-support-line")).toHaveLength(1);

    cleanup();
    shell.__TOKENY_NATIVE__ = true;
    render(
      <HelmetProvider>
        <MemoryRouter>
          <BlogPostLayout title="Title" description="Description" slug="example" date="2026-05-01" tag="AI" keywords="ai">
            <p>Body</p>
          </BlogPostLayout>
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(screen.queryByTestId("blog-support-line")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /coffee/i })).not.toBeInTheDocument();
  });

  it("does not put a coffee link in the native apps", () => {
    const files = walk("apple").filter((file) => /\.(swift|md|plist|xcstrings|yml)$/.test(file));
    const hits = files.filter((file) => /buymeacoffee|Buy Me a Coffee|martinpohlp/i.test(readFileSync(path.join(ROOT, file), "utf8")));
    expect(hits).toEqual([]);
  });
});
