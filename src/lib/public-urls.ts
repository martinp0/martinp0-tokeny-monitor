import { SITE_URL } from "@/config/site";

/**
 * Public URLs that users copy or that end up in other people's apps (MCP client configs, link
 * previews) live on our own domain. vercel.json rewrites them to the Supabase edge functions, so
 * moving the backend (e.g. off Lovable Cloud) never breaks a URL someone already saved.
 */
export const PUBLIC_API_PATHS = {
  mcp: "/api/mcp",
  ogDashboard: "/api/og-dashboard",
} as const;

/** MCP server URL shown in Settings. */
export function mcpServerUrl(site: string = SITE_URL): string {
  return `${site}${PUBLIC_API_PATHS.mcp}`;
}

/** Link-preview image for a shared dashboard. */
export function ogDashboardUrl(token: string, site: string = SITE_URL): string {
  return `${site}${PUBLIC_API_PATHS.ogDashboard}?token=${encodeURIComponent(token)}`;
}
