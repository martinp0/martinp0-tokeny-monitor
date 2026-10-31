// The only Vercel Function (Hobby plan): vercel.json rewrites /api/* here, the Hono app routes.
import { createApp } from "../server/app.js";

const app = createApp();

/** vercel.json rewrites `/api/:path*` → `/api?__path=:path*`; restore the original path for routing. */
export function restoreUrl(req: Request): Request {
  const url = new URL(req.url);
  const forwarded = url.searchParams.get("__path");
  if (forwarded === null) return req;
  url.searchParams.delete("__path");
  if (url.pathname === "/api" || url.pathname === "/api/" || url.pathname === "/api/index") {
    url.pathname = `/api/${forwarded.replace(/^\/+/, "")}`;
  }
  return new Request(url, req);
}

const handle = (req: Request) => app.fetch(restoreUrl(req));

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
