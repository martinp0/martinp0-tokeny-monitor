#!/usr/bin/env node
// Creates (or refreshes) the App Review demo account with sample data. Idempotent.
//
//   SITE_URL=https://tokeny.martinpohl.cz \
//   DATABASE_URL='postgresql://…'      # Neon connection string, only in your shell, never commit
//   DEMO_EMAIL=appreview@tokeny.martinpohl.cz DEMO_PASSWORD='<long random>' \
//   node scripts/app-review/seed-demo-user.mjs [--free] [--dry-run]
//
// --free     no Pro row (to show the Free plan)   --dry-run  print what would happen, touch nothing
// The account is created through the public sign-up (/api/auth, Neon Auth); sample rows and the
// demo plan are written with DATABASE_URL. Prints no secrets. The demo has no provider API keys.
import pg from "pg";
import { DEMO_PREFIX, demoActivityRows, demoSubscription } from "./demo-data.mjs";

const args = new Set(process.argv.slice(2));
const dry = args.has("--dry-run");
const pro = !args.has("--free");
const { SITE_URL = "https://tokeny.martinpohl.cz", DATABASE_URL, DEMO_EMAIL, DEMO_PASSWORD } = process.env;

const rows = demoActivityRows();
if (dry) {
  console.log(`dry run: ${rows.length} activity rows, plan ${pro ? "Pro (no Stripe)" : "Free"}, email ${DEMO_EMAIL ? "set" : "MISSING"}`);
  process.exit(0);
}
for (const [k, v] of Object.entries({ DATABASE_URL, DEMO_EMAIL, DEMO_PASSWORD })) {
  if (!v) {
    console.error(`missing env ${k}`);
    process.exit(2);
  }
}
if (DEMO_PASSWORD.length < 12) {
  console.error("DEMO_PASSWORD must be at least 12 characters");
  process.exit(2);
}

async function auth(path, body) {
  const res = await fetch(`${SITE_URL}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: SITE_URL },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

let r = await auth("sign-in/email", { email: DEMO_EMAIL, password: DEMO_PASSWORD });
if (r.status !== 200) {
  r = await auth("sign-up/email", { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "App Review" });
  if (r.status !== 200) {
    console.error(`sign-up failed (HTTP ${r.status}${r.json?.code ? `, ${r.json.code}` : ""}). If the account exists, reset its password on /auth first.`);
    process.exit(1);
  }
  console.log("demo user created");
} else {
  console.log("demo user exists");
}
const userId = r.json?.user?.id;
if (!userId) {
  console.error("auth response had no user id");
  process.exit(1);
}

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();
try {
  await db.query("delete from activity_rows where user_id = $1 and generation_id like $2", [userId, `${DEMO_PREFIX}%`]);
  for (const row of rows) {
    const cols = Object.keys(row);
    await db.query(
      `insert into activity_rows (user_id, ${cols.map((c) => `"${c}"`).join(",")})
       values ($1, ${cols.map((_, i) => `$${i + 2}`).join(",")})
       on conflict (user_id, generation_id) do nothing`,
      [userId, ...cols.map((c) => row[c])],
    );
  }
  console.log(`${rows.length} sample rows written`);
  if (pro) {
    const s = demoSubscription(userId);
    await db.query(
      `insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id) do update set stripe_customer_id = $2, status = $4, current_period_end = $5, updated_at = now()`,
      [s.user_id, s.stripe_customer_id, s.stripe_subscription_id, s.status, s.current_period_end],
    );
    console.log("plan: Pro (sample, not billed)");
  } else {
    await db.query("delete from subscriptions where user_id = $1 and stripe_customer_id = 'cus_demo_app_review'", [userId]);
    console.log("plan: Free");
  }
} finally {
  await db.end();
}
