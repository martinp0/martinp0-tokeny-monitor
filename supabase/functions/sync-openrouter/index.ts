// Sync usage for one of the caller's stored openrouter credentials (see _shared/user-sync.ts).
import { handleUserSync } from "../_shared/user-sync.ts";

Deno.serve((req) => handleUserSync(req, "openrouter"));
