import { SITE_URL } from "@/config/site";

/**
 * Public URLs that users copy or that end up in other people's apps (MCP client configs, share
 * links) live on our own domain and are served by the single Vercel Function (api/index.ts),
 * so moving the database or auth provider never breaks a URL someone already saved.
 */
export const PUBLIC_API_PATHS = {
  mcp: "/api/mcp",
} as const;

/** MCP server URL shown in Settings. */
export function mcpServerUrl(site: string = SITE_URL): string {
  return `${site}${PUBLIC_API_PATHS.mcp}`;
}
