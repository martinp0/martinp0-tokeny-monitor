import Foundation
import TokenyCore
import UserNotifications

/// Local budget notifications: at the alert threshold and again at 100 %, once per month each.
///
/// They fire when the app refreshes (foreground, background app refresh, a widget-triggered
/// refresh on the Mac). Server-side pushes would also cover days the app is never opened:
/// TODO(apns): register for remote notifications, send the device token to a `register-device`
/// edge function and let `check-budget` push via APNs; then drop the local path for those users.
struct BudgetNotifier: Sendable {
    func requestAuthorization() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .notDetermined else { return }
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    func evaluate(_ summary: UsageSummary, store: SummaryStore) async {
        let status = summary.budgetStatus
        let monthKey = summary.month.key ?? String(summary.generatedAt.prefix(7))
        guard
            let level = BudgetAlertPolicy.levelToNotify(
                status: status, monthKey: monthKey, last: store.lastBudgetAlert
            )
        else { return }

        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }

        let spent = Fmt.money(status.spentUSD, store.currency, rate: summary.usdToCZK)
        let limit = Fmt.money(status.limitUSD ?? 0, store.currency, rate: summary.usdToCZK)
        let percent = Fmt.percent(status.percent ?? 0)

        let content = UNMutableNotificationContent()
        if level == .over {
            content.title = String(localized: "AI budget exceeded")
            content.body = String(localized: "You've spent \(spent) of \(limit) this month.")
        } else {
            content.title = String(localized: "\(percent) of your AI budget used")
            content.body = String(localized: "You've spent \(spent) of \(limit) this month.")
        }
        content.sound = .default
        content.threadIdentifier = "budget"

        let request = UNNotificationRequest(identifier: "budget-\(monthKey)-\(level)", content: content, trigger: nil)
        do {
            try await center.add(request)
            store.lastBudgetAlert = BudgetAlertRecord(monthKey: monthKey, level: level)
        } catch {
            // Not recorded, so the next refresh tries again.
        }
    }
}
