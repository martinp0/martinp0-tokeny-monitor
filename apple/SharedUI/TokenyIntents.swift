import AppIntents
#if canImport(WidgetKit) && !os(macOS)
import WidgetKit
#endif

/// „Kolik jsem dnes protokenoval?“ ze Zkratek, Spotlightu, tlačítka Akce nebo Siri (v podporovaném
/// jazyce; čeština zatím ne). Na Macu i iPhonu, bez otevření appky.
struct UsageTodayIntent: AppIntent {
    static var title: LocalizedStringResource = "Útrata za AI dnes"
    static var description = IntentDescription("Řekne dnešní a měsíční útratu za AI tokeny, odhad na konec měsíce a čerpání rozpočtu.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let summary: UsageSummary
        do {
            summary = try await TokenyAPI.refresh()
            #if canImport(WidgetKit) && !os(macOS)
            WidgetCenter.shared.reloadAllTimelines()
            #endif
        } catch {
            guard let cached = TokenySettings.lastSummary else { throw error }
            summary = cached
        }
        let text = Self.text(summary, currency: TokenySettings.currency)
        return .result(value: text, dialog: "\(text)")
    }

    static func text(_ s: UsageSummary, currency: Currency) -> String {
        let rate = Fmt.rate(s)
        let c: (Double) -> String = { Fmt.cost($0, currency, rate: rate) }
        var parts = [
            "Dnes \(c(s.today.cost_usd)) (\(Fmt.num(s.today.tokens)) tokenů)",
            "tento měsíc \(c(s.month.cost_usd))",
            "odhad \(c(s.forecast_month_usd))",
        ]
        if let f = s.budgetFraction { parts.append("rozpočet \(Int((f * 100).rounded())) %") }
        return parts.joined(separator: ", ") + "."
    }
}

/// Jen ověří, jestli měsíční útrata nepřekročila práh rozpočtu (vrací Bool pro automatizace).
struct BudgetCheckIntent: AppIntent {
    static var title: LocalizedStringResource = "Je rozpočet na AI v pořádku?"
    static var description = IntentDescription("Vrátí Ano, když je měsíční útrata pod prahem rozpočtu. Hodí se do automatizací ve Zkratkách.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ReturnsValue<Bool> & ProvidesDialog {
        let s = (try? await TokenyAPI.refresh()) ?? TokenySettings.lastSummary
        guard let s else { throw TokenyAPI.APIError.notConfigured }
        let ok = !s.overThreshold
        let pct = s.budgetFraction.map { "\(Int(($0 * 100).rounded())) %" } ?? "bez rozpočtu"
        let message: String = ok ? "V pořádku, vyčerpáno \(pct)." : "Pozor, vyčerpáno \(pct)."
        return .result(value: ok, dialog: "\(message)")
    }
}

struct TokenyShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: UsageTodayIntent(),
            phrases: [
                "How much did I spend today in \(.applicationName)",
                "\(.applicationName) usage",
                "Check \(.applicationName)",
            ],
            shortTitle: "Útrata dnes",
            systemImageName: "chart.bar.fill"
        )
        AppShortcut(
            intent: BudgetCheckIntent(),
            phrases: ["Is my AI budget OK in \(.applicationName)"],
            shortTitle: "Rozpočet",
            systemImageName: "gauge.with.dots.needle.67percent"
        )
    }

    static var shortcutTileColor: ShortcutTileColor = .purple
}
