import { handleStubSync } from "../_shared/sync-stub.ts";
Deno.serve((req) => handleStubSync(req, "xai", "xAI (Grok)"));
