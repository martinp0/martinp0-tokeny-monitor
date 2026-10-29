# Tokeny Monitor pro Mac a Apple Watch

| Target | Bundle ID | Co dělá |
|---|---|---|
| `TokenyMac` (macOS 14) | `cz.martinpohl.tokeny.mac` | Menu bar (MenuBarExtra): útrata tento měsíc přímo v liště. Po kliknutí dnes / měsíc / odhad, rozpočet, graf 30 dní, top modely, CZK/USD, spuštění po přihlášení |
| `Tokeny` (iOS 17) | `cz.martinpohl.tokeny` | Malá companion appka: souhrn a nastavení tokenu. Hodinky potřebují iPhone appku jako kontejner |
| `TokenyWatch` (watchOS 10) | `cz.martinpohl.tokeny.watchkitapp` | Dnes, měsíc, rozpočet (gauge), odhad |
| `TokenyWatchWidget` | `cz.martinpohl.tokeny.watchkitapp.widget` | Komplikace circular (rozpočet), rectangular, inline, corner |

## Odkud jsou data

Ze stejných tabulek jako web (`activity_rows`, `budget_alerts`, `exchange_rates`). Čte je nová read-only edge funkce
[`usage-summary`](../supabase/functions/usage-summary/index.ts): `GET`, jen agregace, žádné řádky requestů ani klíče.
Autentizace: **osobní token** ze stránky Nastavení → MCP tokeny (`orm_…`). Server zná jen jeho sha256
(`mcp_tokens`). Pro každé zařízení si vytvoř vlastní token (např. „Mac“, „iPhone“). Odvolat ho jde smazáním v Nastavení.

```bash
supabase functions deploy usage-summary --no-verify-jwt   # verify_jwt=false je i v supabase/config.toml
```

## Token

- Mac: menu bar → ⚙︎ → vložit token → **Ověřit připojení** → **Uložit**. Uloží se do Klíčenky (login keychain, položka `cz.martinpohl.tokeny.api`).
- iPhone: ⚙︎ → totéž. Token se uloží do Klíčenky (`AfterFirstUnlockThisDeviceOnly`) a přes WatchConnectivity se pošle na hodinky.
- Token nikdy nejde do UserDefaults, souborů, logů ani do gitu. Adresa serveru je veřejná URL Supabase projektu (stejná jako `VITE_SUPABASE_URL`) a v nastavení jde změnit, třeba pro self-host.

## Sestavení

```bash
brew install xcodegen
cd apple && xcodegen generate && open Tokeny.xcodeproj
```

Ve všech targetech nastav Team. Capabilities jsou v `project.yml`: App Groups `group.cz.martinpohl.tokeny`,
Keychain Sharing `cz.martinpohl.tokeny.shared` a na Macu App Sandbox s Outgoing Connections.

## Zkratky, Spotlight a tlačítko Akce (App Intents)

`SharedUI/TokenyIntents.swift` (iPhone i Mac): **Útrata za AI dnes** (dnes, měsíc, odhad, rozpočet) a **Je rozpočet na AI v pořádku?** (vrací Ano/Ne pro automatizace). Jsou to App Shortcuts, takže se samy objeví ve Zkratkách, ve Spotlightu a pro tlačítko Akce. Siri anglicky („How much did I spend today in Tokeny“), cs/sk názvy v `SharedUI/AppShortcuts.xcstrings`.

`Shared/PrivacyInfo.xcprivacy`: privacy manifest pro všechny cíle (UserDefaults v App Group: CA92.1, 1C8F.1; žádný tracking ani sběr dat).
