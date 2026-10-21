import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";
import { AppProviders, AppRoutes } from "./App.tsx";
import "./i18n";
import "./fonts.css";
import "./index.css";

const rootEl = document.getElementById("root")!;

const tree = (
  <HelmetProvider>
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  </HelmetProvider>
);

// Non-home routes are served the prerendered landing shell. A head script hides
// it and clears #root before this module runs; drop the class so the real route paints.
document.documentElement.classList.remove("spa-shell");

if (rootEl.childNodes.length > 0) {
  hydrateRoot(rootEl, tree);
} else {
  createRoot(rootEl).render(tree);
}
