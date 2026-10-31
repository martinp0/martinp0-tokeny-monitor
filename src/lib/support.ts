/** Public Buy Me a Coffee page. Username only; never the old martinpohlp URL. */
export const SUPPORT_PAGE = "https://buymeacoffee.com/martinp0";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

/**
 * True when these pages are running inside the iOS/macOS app.
 * App Store guideline 3.1.1 forbids external tip links there.
 *
 * The shipping apps are SwiftUI and do not render this site. This still
 * covers a native web build (`VITE_NATIVE_APP=true`) and a webview shell
 * (Capacitor, `window.__TOKENY_NATIVE__`, or a TokenyNative user agent).
 * Mobile Safari is not matched.
 */
export function isNativeAppSurface(nativeBuild: string | undefined = import.meta.env.VITE_NATIVE_APP): boolean {
  if (nativeBuild === "true") return true;
  if (typeof window === "undefined") return false;

  const shell = window as Window & {
    Capacitor?: CapacitorGlobal;
    __TOKENY_NATIVE__?: boolean;
  };
  if (shell.__TOKENY_NATIVE__ === true) return true;
  if (capacitorNative(shell.Capacitor)) return true;
  return /TokenyNative/i.test(navigator.userAgent || "");
}

function capacitorNative(cap: CapacitorGlobal | undefined): boolean {
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) return true;
    const platform = typeof cap.getPlatform === "function" ? cap.getPlatform() : undefined;
    return Boolean(platform && platform !== "web");
  } catch {
    return false;
  }
}

/** Tracked support link. The footer uses {@link SUPPORT_PAGE} without parameters. */
export function supportHref(placement: "landing" | "calculator" | "blog"): string {
  const campaign = placement === "blog" ? "support_line" : "support_card";
  return `${SUPPORT_PAGE}?utm_source=tokeny.martinpohl.cz&utm_medium=${placement}&utm_campaign=${campaign}`;
}
