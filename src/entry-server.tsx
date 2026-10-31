import "./i18n";
import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { StaticRouter } from "react-router-dom/server";
import { AppProviders, AppRoutes } from "./App";
import Blog from "./pages/Blog";
import BlogAiAgentCosts from "./pages/BlogAiAgentCosts";
import BlogAiCostSaving from "./pages/BlogAiCostSaving";
import BlogPromptOptimization from "./pages/BlogPromptOptimization";
import BlogTokenWindow from "./pages/BlogTokenWindow";
import BlogModelComparison from "./pages/BlogModelComparison";
import BlogMonitoringAiCosts from "./pages/BlogMonitoringAiCosts";
import BlogMultiProvider from "./pages/BlogMultiProvider";
import BlogGrokTokens from "./pages/BlogGrokTokens";

/** Render the public landing to HTML. Other routes stay client-rendered. */
export function render(url: string) {
  return renderToString(
    <HelmetProvider>
      <StaticRouter location={url}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </StaticRouter>
    </HelmetProvider>,
  );
}

/**
 * Static blog pages prerendered to their own HTML file (dist/<path>/index.html) so crawlers and
 * link previews get the right <title>, canonical and OG tags. The client still renders them itself
 * (index.html's spa-shell script clears #root on non-home URLs), so there is no hydration mismatch.
 */
export const PRERENDER_PAGES: Record<string, ComponentType> = {
  "/blog": Blog,
  "/blog/kolik-stoji-ai-agenti": BlogAiAgentCosts,
  "/blog/ai-cost-saving": BlogAiCostSaving,
  "/blog/prompt-optimization": BlogPromptOptimization,
  "/blog/token-window": BlogTokenWindow,
  "/blog/gpt-vs-claude-vs-gemini": BlogModelComparison,
  "/blog/monitoring-ai-costs": BlogMonitoringAiCosts,
  "/blog/multi-provider-monitoring": BlogMultiProvider,
  "/blog/grok-token-optimization": BlogGrokTokens,
};

export function renderPage(url: string): { html: string; head: string } {
  const Page = PRERENDER_PAGES[url];
  if (!Page) throw new Error(`no prerender page for ${url}`);
  const ctx: { helmet?: HelmetServerState } = {};
  const html = renderToString(
    <HelmetProvider context={ctx}>
      <StaticRouter location={url}>
        <AppProviders>
          <Page />
        </AppProviders>
      </StaticRouter>
    </HelmetProvider>,
  );
  const h = ctx.helmet;
  const head = h ? [h.title, h.meta, h.link, h.script].map((t) => t.toString()).filter(Boolean).join("\n    ") : "";
  return { html, head };
}
