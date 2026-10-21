import "./i18n";
import { renderToString } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { StaticRouter } from "react-router-dom/server";
import { AppProviders, AppRoutes } from "./App";

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
