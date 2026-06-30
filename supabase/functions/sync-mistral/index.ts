import { handleStubSync } from "../_shared/sync-stub.ts";
Deno.serve((req) => handleStubSync(req, "mistral", "Mistral AI"));
