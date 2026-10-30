import "./i18n";
import { Writable } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { StaticRouter } from "react-router-dom/server";
import { AppProviders, AppRoutes } from "./App";

export type RenderResult = { html: string; head: string; htmlAttributes: string };

/**
 * Render one public route to static HTML (used by scripts/prerender.mjs).
 * Uses the streaming renderer and waits for `onAllReady`, so lazy route chunks
 * are resolved instead of leaving the Suspense fallback in the output.
 */
export function render(url: string): Promise<RenderResult> {
  const helmetContext: { helmet?: HelmetServerState } = {};
  return new Promise((resolve, reject) => {
    let html = "";
    const sink = new Writable({
      write(chunk, _enc, cb) {
        html += chunk.toString();
        cb();
      },
    });
    sink.on("finish", () => {
      const h = helmetContext.helmet;
      const head = h
        ? [h.title, h.meta, h.link, h.script].map((part) => part.toString()).filter(Boolean).join("\n    ")
        : "";
      resolve({ html, head, htmlAttributes: h ? h.htmlAttributes.toString() : "" });
    });
    const stream = renderToPipeableStream(
      <HelmetProvider context={helmetContext}>
        <StaticRouter location={url}>
          <AppProviders>
            <AppRoutes />
          </AppProviders>
        </StaticRouter>
      </HelmetProvider>,
      {
        onAllReady() {
          stream.pipe(sink);
        },
        onShellError: reject,
        onError(err) {
          reject(err);
        },
      },
    );
  });
}
