# Tokeny for iPhone, Mac and Apple Watch

Native SwiftUI apps for [tokeny.martinpohl.cz](https://tokeny.martinpohl.cz): AI spend today and this
month in Kč and dollars, the monthly budget, and the providers and models behind it.

| Target | Platform | What it does |
| --- | --- | --- |
| `Tokeny` | iOS 26 | Dashboard, settings (currency, budget alerts, sign-out, account deletion), App Intents, background refresh, hosts the widgets and the Watch app |
| `TokenyWidgets` | iOS 26 | Home Screen (small, medium) and Lock Screen (circular, rectangular, inline) widgets |
| `TokenyMac` | macOS 26 | Menu bar app: month figure in the menu bar, details in the panel, ⌘R / ⌘, / ⌘Q, open at login |
| `TokenyWatch` | watchOS 26 | Month, today, budget and providers sent from the iPhone |
| `TokenyWatchWidgets` | watchOS 26 | Complications (circular, rectangular, inline, corner) |
| `TokenyKit` (SwiftPM) | all | `TokenyCore`: models, formatting, budget rules, API client, App Group cache. `TokenyAuth`: Supabase Auth, Sign in with Apple nonce |

## How it works

- **Sign-in.** Sign in with Apple (native sheet, ID token + nonce to Supabase) or e-mail and password,
  against the same Supabase project as the web. The session lives in the Keychain, in an access group
  shared with the widget extension.
- **Data.** One `GET functions/v1/usage-summary?tz=…` with the user's access token. The function
  returns aggregates only. Free accounts get the same limits as the web (last 30 days, no forecast, no
  previous month); `plan` in the response decides what the app shows. Pro is bought and managed on the
  web; the app links there (see "App Review" below).
- **Widgets** read the summary the app cached in the App Group (`group.cz.martinpohl.tokeny`). If it is
  older than 30 minutes and the stored access token is still valid, the iPhone widget fetches once by
  itself. Widgets never refresh the session (refresh tokens rotate; only the app does that).
- **Apple Watch** holds no credentials. The iPhone sends the cached summary over WatchConnectivity
  (application context); the Watch's Refresh button asks the iPhone to fetch.
- **Budget alerts** are local notifications, once at the alert threshold and once at 100 % per month,
  evaluated whenever the app refreshes (foreground, background app refresh, Mac auto-refresh). Remote
  pushes via APNs are stubbed (`TODO(apns)` in `iOS/AppDelegate.swift` and `SharedUI/BudgetNotifier.swift`).
- **Shortcuts / Siri / Spotlight:** "Kolik jsem dnes utratil za AI?" (`SpendTodayIntent`) and
  "Je rozpočet na AI v pořádku?" (`BudgetCheckIntent`, returns a Bool for automations).

## Layout

```
apple/
├── project.yml           XcodeGen spec (the .xcodeproj is generated, not committed)
├── ci_scripts/           Xcode Cloud: generate the project, stamp the build number
├── TokenyKit/            Swift package, builds and tests on macOS and Linux
├── SharedUI/             iPhone + Mac: AppModel, sign-in, intents, notifications, String Catalogs
├── Components/           SwiftUI pieces shared by all apps and widgets
├── Widgets/              WidgetKit code for both the iPhone widgets and the Watch complications
├── Resources/            PrivacyInfo.xcprivacy
├── iOS/ macOS/ watchOS/  App entry points, platform UI, asset catalogs
└── scripts/              gen_xcstrings.py: regenerates Localizable/AppShortcuts.xcstrings (en + cs)
```

## Build locally

```sh
brew install xcodegen
cd apple
xcodegen generate
open Tokeny.xcodeproj
```

Needs Xcode 26 or newer. Pick the **Tokeny** scheme for iPhone (+ Watch), **TokenyMac** for the menu
bar app. Unit tests (Swift Testing) run from either scheme, or without Xcode:

```sh
cd apple/TokenyKit && swift test
```

After changing UI text, run `python3 apple/scripts/gen_xcstrings.py` (it fails if a Czech
translation is missing).

## One-time setup

1. **Apple Developer → Identifiers** (team `GR59NF57R2`): App IDs `cz.martinpohl.tokeny`,
   `cz.martinpohl.tokeny.widgets`, `cz.martinpohl.tokeny.watchkitapp`,
   `cz.martinpohl.tokeny.watchkitapp.widgets`, `cz.martinpohl.tokeny.mac`. Capabilities:
   App Groups `group.cz.martinpohl.tokeny` (all but the Mac app), Sign in with Apple (`tokeny` and
   `tokeny.mac`). Xcode's automatic signing creates these on the first build if you let it.
2. **Supabase → Authentication → Providers → Apple:** add `cz.martinpohl.tokeny` and
   `cz.martinpohl.tokeny.mac` to *Client IDs* (comma-separated, next to the web Services ID). Native
   sign-in sends Apple's ID token directly, so no secret key is needed for these two.
3. **Supabase → Authentication → URL Configuration:** keep `https://tokeny.martinpohl.cz/auth/callback`
   and `https://tokeny.martinpohl.cz/reset-password` in *Redirect URLs* (e-mail confirmation and
   password reset links open on the web).
4. **Deploy** the updated `usage-summary` function (`supabase functions deploy usage-summary`). Until
   then the apps get 401 for signed-in users.

Xcode Cloud and TestFlight: see [docs/xcode-cloud.md](../docs/xcode-cloud.md).

## App Review notes

- **4.2 Minimum functionality:** fully native (no web view), with widgets, complications, a menu bar
  app and App Intents. The old Capacitor wrapper of the web app is gone.
- **5.1.1(v) Account deletion:** account creation happens in the app, so Settings has *Delete
  account…* (calls the `delete-account` edge function). It does not cancel a Stripe subscription
  yet; the dialog tells the user to cancel on the web first.
- **3.1.1 / 3.1.3 Payments:** no in-app purchase. Free users see what Pro adds and a *Manage plan on
  the web* button. Linking out is allowed on the US storefront since 2025; elsewhere (including the
  EU, which uses the StoreKit External Purchase Link entitlement) it is not. Before submitting,
  either release in the US only, set `ProUpsellPolicy.showsWebLink = false` (the card then just
  describes Pro), or add StoreKit subscriptions.
- **Privacy:** `PrivacyInfo.xcprivacy` declares e-mail and user ID (linked, app functionality, no
  tracking) and the UserDefaults reason codes. App Store Connect also needs a privacy policy URL; the
  app links to `https://tokeny.martinpohl.cz/privacy` (`src/pages/Privacy.tsx`, cs + en); use that URL.
- **Review account:** give App Review a demo login with some data (a Pro account shows every screen).
