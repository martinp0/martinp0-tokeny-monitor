import Foundation

/// A summary plus when this device fetched it.
public struct CachedSummary: Codable, Equatable, Sendable {
    public var summary: UsageSummary
    public var fetchedAt: Date

    public init(summary: UsageSummary, fetchedAt: Date) {
        self.summary = summary
        self.fetchedAt = fetchedAt
    }

    public func isStale(now: Date = Date(), maxAge: TimeInterval = 30 * 60) -> Bool {
        now.timeIntervalSince(fetchedAt) > maxAge
    }
}

/// Non-secret shared state in the App Group (`UserDefaults(suiteName:)`): the last summary for
/// widgets and complications, the display currency and the last budget alert. Tokens never go
/// here; the Supabase session lives in the Keychain (see TokenyAuth).
public struct SummaryStore: Sendable {
    /// nil = `UserDefaults.standard` (tests, or a target without the App Group).
    public let suiteName: String?

    public init(suiteName: String?) {
        self.suiteName = suiteName
    }

    public static let shared = SummaryStore(suiteName: AppConfig.production.appGroup)

    private enum Key {
        static let summary = "tokeny.summary.v1"
        static let currency = "tokeny.currency"
        static let budgetAlert = "tokeny.budgetAlert.v1"
        static let alertsEnabled = "tokeny.budgetAlertsEnabled"
    }

    private var defaults: UserDefaults {
        suiteName.flatMap(UserDefaults.init(suiteName:)) ?? .standard
    }

    public func load() -> CachedSummary? {
        decode(CachedSummary.self, Key.summary)
    }

    public func save(_ summary: UsageSummary, fetchedAt: Date = Date()) {
        encode(CachedSummary(summary: summary, fetchedAt: fetchedAt), Key.summary)
    }

    /// Call on sign-out so widgets stop showing the previous account.
    public func clear() {
        for key in [Key.summary, Key.budgetAlert] { defaults.removeObject(forKey: key) }
    }

    public var currency: Currency {
        get { defaults.string(forKey: Key.currency).flatMap(Currency.init(rawValue:)) ?? .czk }
        nonmutating set { defaults.set(newValue.rawValue, forKey: Key.currency) }
    }

    /// Local budget notifications (on by default; the system permission is asked separately).
    public var budgetAlertsEnabled: Bool {
        get { defaults.object(forKey: Key.alertsEnabled) as? Bool ?? true }
        nonmutating set { defaults.set(newValue, forKey: Key.alertsEnabled) }
    }

    public var lastBudgetAlert: BudgetAlertRecord? {
        get { decode(BudgetAlertRecord.self, Key.budgetAlert) }
        nonmutating set {
            if let newValue { encode(newValue, Key.budgetAlert) } else { defaults.removeObject(forKey: Key.budgetAlert) }
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, _ key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    private func encode<T: Encodable>(_ value: T, _ key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        defaults.set(data, forKey: key)
    }
}
