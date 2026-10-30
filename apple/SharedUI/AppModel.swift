import Foundation
import Observation
import TokenyAuth
import TokenyCore

#if canImport(WidgetKit)
    import WidgetKit
#endif

/// App state shared by the iPhone and Mac apps: sign-in, the latest summary and preferences.
/// One instance per process (``shared``) so App Intents running in the app see the same session.
@MainActor
@Observable
final class AppModel {
    static let shared = AppModel()

    let auth: AuthService
    private let api: UsageAPI
    private let store: SummaryStore
    private let notifier: BudgetNotifier

    private(set) var cached: CachedSummary?
    private(set) var isRefreshing = false
    private(set) var lastError: UsageAPIError?

    /// Called after every successful refresh or sign-out (the iPhone forwards it to the Watch).
    @ObservationIgnored var onChange: (@MainActor () -> Void)?

    var currency: Currency {
        didSet {
            store.currency = currency
            reloadWidgets()
            onChange?()
        }
    }

    var budgetAlertsEnabled: Bool {
        didSet {
            store.budgetAlertsEnabled = budgetAlertsEnabled
            if budgetAlertsEnabled { Task { await notifier.requestAuthorization() } }
        }
    }

    init(
        auth: AuthService = AuthService(),
        api: UsageAPI = UsageAPI(),
        store: SummaryStore = .shared,
        notifier: BudgetNotifier = BudgetNotifier()
    ) {
        self.auth = auth
        self.api = api
        self.store = store
        self.notifier = notifier
        self.cached = auth.isSignedIn ? store.load() : nil
        self.currency = store.currency
        self.budgetAlertsEnabled = store.budgetAlertsEnabled
    }

    var summary: UsageSummary? { cached?.summary }
    var config: AppConfig { api.config }

    /// Fetches a fresh summary. Errors land in ``lastError``; the cached summary stays on screen.
    func refresh() async {
        guard auth.isSignedIn, !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            let token = try await auth.accessToken()
            let summary = try await api.fetchSummary(accessToken: token)
            let fresh = CachedSummary(summary: summary, fetchedAt: Date())
            store.save(fresh.summary, fetchedAt: fresh.fetchedAt)
            cached = fresh
            lastError = nil
            reloadWidgets()
            onChange?()
            if budgetAlertsEnabled { await notifier.evaluate(summary, store: store) }
        } catch is CancellationError {
            return
        } catch let error as UsageAPIError {
            lastError = error
            if error == .unauthorized { await signOut() }
        } catch {
            lastError = .offline
        }
    }

    /// Refreshes only when the cache is older than `maxAge` (app launch, returning to foreground).
    func refreshIfStale(maxAge: TimeInterval = 5 * 60) async {
        if let cached, !cached.isStale(maxAge: maxAge) { return }
        await refresh()
    }

    func didSignIn() async {
        if budgetAlertsEnabled { await notifier.requestAuthorization() }
        await refresh()
    }

    func signOut() async {
        await auth.signOut()
        clearLocalData()
    }

    func deleteAccount() async throws {
        try await auth.deleteAccount()
        clearLocalData()
    }

    private func clearLocalData() {
        store.clear()
        cached = nil
        reloadWidgets()
        onChange?()
    }

    private func reloadWidgets() {
        #if canImport(WidgetKit) && os(iOS)
            WidgetCenter.shared.reloadAllTimelines()
        #endif
    }
}
