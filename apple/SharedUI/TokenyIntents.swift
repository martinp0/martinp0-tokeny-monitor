import AppIntents
import Foundation
import TokenyCore

/// "Kolik jsem dnes utratil za AI?" from Shortcuts, Spotlight, the Action button or Siri.
/// Runs inside the app process (no UI), so it shares the signed-in session with the app.
struct SpendTodayIntent: AppIntent {
    static let title: LocalizedStringResource = "How much did I spend on AI today?"
    static let description = IntentDescription("Tells you today's and this month's AI spend and how much of your budget is used.")

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let model = AppModel.shared
        guard model.auth.isSignedIn else { throw TokenyIntentError.signedOut }
        await model.refresh()
        guard let summary = model.summary else { throw TokenyIntentError.noData }
        let text = SpendSentence.make(summary, currency: model.currency)
        return .result(value: text, dialog: IntentDialog(stringLiteral: text))
    }
}

/// True while this month's spend is under the budget alert threshold. For automations.
struct BudgetCheckIntent: AppIntent {
    static let title: LocalizedStringResource = "Is my AI budget OK?"
    static let description = IntentDescription("Returns true while this month's AI spend is below your budget alert threshold.")

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<Bool> & ProvidesDialog {
        let model = AppModel.shared
        guard model.auth.isSignedIn else { throw TokenyIntentError.signedOut }
        await model.refresh()
        guard let summary = model.summary else { throw TokenyIntentError.noData }
        let status = summary.budgetStatus
        let message: String
        switch status.level {
        case .none:
            message = String(localized: "You haven't set a monthly budget. Set one on the web.")
        case .ok:
            message = String(localized: "All good, \(Fmt.percent(status.percent ?? 0)) of your budget used.")
        case .warning, .over:
            message = String(localized: "Careful, \(Fmt.percent(status.percent ?? 0)) of your budget used.")
        }
        return .result(value: status.level <= .ok, dialog: IntentDialog(stringLiteral: message))
    }
}

enum TokenyIntentError: Error, CustomLocalizedStringResourceConvertible {
    case signedOut, noData

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .signedOut: "Open Tokeny and sign in first."
        case .noData: "Couldn't load your spend. Try again in a moment."
        }
    }
}

enum SpendSentence {
    static func make(_ s: UsageSummary, currency: Currency) -> String {
        let rate = s.usdToCZK
        let today = Fmt.money(s.today.costUSD, currency, rate: rate)
        let month = Fmt.money(s.month.costUSD, currency, rate: rate)
        var text = String(localized: "Today \(today), this month \(month).")
        if let forecast = s.forecastMonthUSD {
            text += " " + String(localized: "Forecast for the month \(Fmt.money(forecast, currency, rate: rate)).")
        }
        if let percent = s.budgetStatus.percent {
            text += " " + String(localized: "Budget \(Fmt.percent(percent)) used.")
        }
        return text
    }
}

struct TokenyShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SpendTodayIntent(),
            phrases: [
                "How much did I spend on AI today in \(.applicationName)",
                "\(.applicationName) spend today",
                "Check \(.applicationName)",
            ],
            shortTitle: "Spend today",
            systemImageName: "chart.bar.fill"
        )
        AppShortcut(
            intent: BudgetCheckIntent(),
            phrases: [
                "Is my AI budget OK in \(.applicationName)",
                "\(.applicationName) budget",
            ],
            shortTitle: "Budget",
            systemImageName: "gauge.with.dots.needle.67percent"
        )
    }

    static let shortcutTileColor: ShortcutTileColor = .blue
}
