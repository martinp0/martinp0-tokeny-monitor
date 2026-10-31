#!/usr/bin/env node
// Creates (or refreshes) the App Review demo account with sample data. Idempotent.
//
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=...   # from the dashboard, only in your shell, never commit
//   DEMO_EMAIL=appreview@tokeny.martinpohl.cz DEMO_PASSWORD='<long random>' \
//   node scripts/app-review/seed-demo-user.mjs [--free] [--dry-run]
//
// --free     no Pro row (to show the Free plan)   --dry-run  print what would happen, touch nothing
// Prints no secrets. The demo has no provider API keys: all usage rows are sample data.
import { createClient } from "@supabase/supabase-js";
import { DEMO_PREFIX, demoActivityRows, demoSubscription } from "./demo-data.mjs";

const args = new Set(process.argv.slice(2));
const dry = args.has("--dry-run");
const pro = !args.has("--free");
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL, DEMO_PASSWORD } = process.env;

const rows = demoActivityRows();
if (dry) {
  console.log(`dry run: ${rows.length} activity rows, plan ${pro ? "Pro (no Stripe)" : "Free"}, email ${DEMO_EMAIL ? "set" : "MISSING"}`);
  process.exit(0);
}
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL, DEMO_PASSWORD })) {
  if (!v) {
    console.error(`missing env ${k}`);
    process.exit(2);
  }
}
if (DEMO_PASSWORD.length < 12) {
  console.error("DEMO_PASSWORD must be at least 12 characters");
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit || data.users.length < 200) return hit ?? null;
  }
  return null;
}

let user = await findUser(DEMO_EMAIL);
if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: DEMO_PASSWORD, email_confirm: true });
  if (error) throw error;
  console.log("demo user exists, password refreshed");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "App Review" },
  });
  if (error) throw error;
  user = data.user;
  console.log("demo user created");
}

const del = await admin.from("activity_rows").delete().eq("user_id", user.id).like("generation_id", `${DEMO_PREFIX}%`);
if (del.error) throw del.error;
for (let i = 0; i < rows.length; i += 500) {
  const batch = rows.slice(i, i + 500).map((r) => ({ ...r, user_id: user.id }));
  const { error } = await admin.from("activity_rows").upsert(batch, { onConflict: "user_id,generation_id" });
  if (error) throw error;
}
console.log(`${rows.length} sample rows written`);

if (pro) {
  const { error } = await admin.from("subscriptions").upsert(demoSubscription(user.id), { onConflict: "user_id" });
  if (error) throw error;
  console.log("plan: Pro (sample, not billed)");
} else {
  const { error } = await admin.from("subscriptions").delete().eq("user_id", user.id).eq("stripe_customer_id", "cus_demo_app_review");
  if (error) throw error;
  console.log("plan: Free");
}
