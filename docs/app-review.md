# App Review: Tokeny for iPhone, Mac and Apple Watch

Status: prepared, **not submitted**. Rules quoted from the
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), which were
last updated on Oct 16, 2026 (read on Oct 30, 2026). Anything marked *(unverified)* still needs
checking against App Store Connect.

## 1. Payments: how we comply

**Approach: a free companion app with no in-app purchase. Pro is sold only on the web, and the
app mentions it only on the US storefront.**

| Storefront | What the app shows a Free user | Guideline |
|---|---|---|
| **United States** (`Storefront.countryCode == "USA"`) | A "Tokeny Pro" card plus an **Upgrade on the web** button. "Manage account on the web" opens `/settings`, which has the checkout. | 3.1.1(a): entitlements "are not required for developers to include buttons, external links, or other calls to action in their United States storefront apps". |
| **Everywhere else, the EU included** | **No upsell**: no price, no "upgrade" and no purchase link. Pro-only sections don't appear. "Manage account on the web" opens `/profile` (email, password, export, delete). Nothing can be bought there. | Outside the US, linking to purchase needs a StoreKit External Purchase Link entitlement (3.1.1(a)), and Apple's terms for that entitlement apply. We don't use it. |
| Unknown storefront (nil, offline) | Same as "everywhere else" (fails closed). | |

Code:
- `apple/TokenyKit/Sources/TokenyCore/PurchaseLinkPolicy.swift` holds the rules, unit-tested in
  `PurchaseLinkPolicyTests`.
- `AppModel.observeStorefront()` reads StoreKit `Storefront.current` and `Storefront.updates`. No
  entitlement and no IAP products are needed for that.
- The card renders only when `!isPro && model.allowsPurchaseLinks`, in `DashboardView` (iOS) and
  `MenuPanel` (macOS). The Watch shows no upsell.

Why not the other options:
- **IAP / StoreKit subscriptions.** Apple's commission, plus a second billing system to keep in
  sync with Stripe. Possible later.
- **EU External Purchase Link entitlement.** You have to apply, follow Apple's link-out UI rules
  and pay Apple's commission on linked purchases *(exact EU fee terms unverified; they changed in
  2025)*. Too much for v1.
- **3.1.3(a) "Reader" app.** That category is only for magazines, newspapers, books, audio, music
  and video. Tokeny isn't one of those.

**Remaining risk (judgement call, not a rule):** users with a Pro account bought on the web see
their Pro features in the app. That is the usual "multiplatform service / account" pattern. Strictly
read, 3.1.3(b) wants those items "also available as in-app purchases". If a reviewer cites 3.1.3(b),
the fallback is StoreKit subscriptions with the same price. The rest of the code doesn't change for
that, and `PurchaseLinkPolicy` stays.

**Account deletion (5.1.1(v))** is in Settings → *Delete account…*. It calls `delete-account`, which
(after PR #20) also cancels a Stripe subscription immediately.

## 2. Review notes (paste into App Store Connect → App Review Information → Notes)

> Tokeny shows how much a user spends on AI APIs (OpenAI, Anthropic, OpenRouter). The app is a
> free, read-only companion to the web service at tokeny.martinpohl.cz: users connect their
> provider API keys on the web; the app shows totals, widgets, an Apple Watch complication and a
> Mac menu bar extra.
>
> Demo account (has ~75 days of sample data and the Pro plan):
>   Email: <DEMO_EMAIL>   Password: <DEMO_PASSWORD>
> Sign in with "Email" on the first screen. No API keys are needed; the data is sample data.
>
> Purchases: the app contains no in-app purchases and, outside the United States storefront, no
> links or calls to action to buy anything. On the US storefront, Free users see an "Upgrade on the
> web" link as permitted by guideline 3.1.1(a).
>
> Account deletion: Settings → Delete account… (removes the account and all data, and cancels any
> subscription).
>
> Privacy policy: https://tokeny.martinpohl.cz/privacy

Fill in `<DEMO_EMAIL>` and `<DEMO_PASSWORD>` only in App Store Connect. Never put them in the repo.

## 3. Demo account

`scripts/app-review/seed-demo-user.mjs` creates or refreshes the account. It's idempotent, prints
no secrets, and the sample data comes from `scripts/app-review/demo-data.mjs`, tested in
`src/test/demo-seed.test.ts`.

```bash
# Run locally against the production Supabase project (the one the apps use):
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...        # paste in the shell only; never in .env or the repo
export DEMO_EMAIL=appreview@tokeny.martinpohl.cz
export DEMO_PASSWORD="$(openssl rand -base64 24)"; echo "$DEMO_PASSWORD" | pbcopy  # → App Store Connect
node scripts/app-review/seed-demo-user.mjs --dry-run   # 375 rows, Pro
node scripts/app-review/seed-demo-user.mjs             # or --free for a Free-plan account
unset SUPABASE_SERVICE_ROLE_KEY DEMO_PASSWORD
```

What it creates:
- A confirmed email/password user.
- 375 `activity_rows` (5 models × 75 days, ids `demo-app-review-*`).
- A Pro `subscriptions` row with the fake customer `cus_demo_app_review` and no Stripe subscription,
  valid for a year.
- No provider keys.

If the reviewer deletes the account, `delete-account` treats the fake customer as "missing" and
deletes normally. Re-run the script before the next submission. The demo mailbox address doesn't
need to receive mail. To change the password, re-run the script with a new `DEMO_PASSWORD`.

## 4. App Privacy ("nutrition label") answers

These are based on what the **apps** send: Sign in with Apple requests `.email` only; email/password
sign-in; usage totals are *read* from our API; there are no analytics or crash SDKs and no ads. They
match `apple/Resources/PrivacyInfo.xcprivacy`. If the web or the apps ever add analytics or crash
reporting, update both.

- **Do you or your third-party partners collect data from this app?** Yes.
- **Contact Info → Email Address:** collected. Linked to the user: yes. Tracking: no. Purpose: App
  Functionality.
- **Identifiers → User ID:** collected (Supabase account id). Linked: yes. Tracking: no. Purpose:
  App Functionality.
- **Everything else** (Name, Phone, Location, Contacts, Health, Financial Info, Purchases, Usage Data
  / Product Interaction, Diagnostics, Browsing/Search History, User Content, Sensitive Info): **not
  collected by the app.** Notes:
  - *Purchases:* the app doesn't take payments. Stripe data is collected by the **website**, which is
    outside the app's label.
  - *Phone:* SMS login exists on the web only, not in the apps.
  - *Financial Info / User Content:* AI spend and provider keys are entered on the web. The app only
    displays totals. *(Unverified: if you'd rather be conservative, declaring "Other User Content →
    App Functionality, linked, no tracking" for the displayed usage data is harmless.)*
- **Tracking (ATT):** none, so no `NSUserTrackingUsageDescription` is needed.
- **Privacy policy URL:** `https://tokeny.martinpohl.cz/privacy`. It returns 404 today because
  `main` has no `vercel.json` (see `docs/domain-redirect.md`). **Deploy the stack first, or the URL
  check will fail.**

## 5. Before you submit (Martin)

1. Deploy the web stack so that `/privacy`, `/profile` and `/auth/callback` load on
   tokeny.martinpohl.cz.
2. Run the demo seed (section 3) and put the credentials in App Store Connect.
3. Pick storefronts. Listing in the EU is fine: no links are shown there.
4. Build in Xcode Cloud and test on TestFlight:
   - with a US sandbox/TestFlight account (card plus link visible),
   - with a CZ account (no card, account link goes to `/profile`).
   *(Unverified on a device: on Linux I could only unit-test the policy, not compile the SwiftUI
   targets.)*
5. Fill in the privacy answers from section 4 and paste the notes from section 2.
