import Foundation

/// Where this month's spend stands against the user's monthly budget.
public struct BudgetStatus: Equatable, Sendable {
    public enum Level: Int, Codable, Comparable, Sendable {
        /// No budget set.
        case none
        /// Under the alert threshold (or alerts are off and the budget is not exceeded).
        case ok
        /// At or above the alert threshold.
        case warning
        /// At or above 100 %.
        case over

        public static func < (a: Level, b: Level) -> Bool { a.rawValue < b.rawValue }
    }

    public var level: Level
    /// Spent / limit, 0…∞; nil without a budget.
    public var fraction: Double?
    public var limitUSD: Double?
    public var spentUSD: Double

    public init(level: Level, fraction: Double?, limitUSD: Double?, spentUSD: Double) {
        self.level = level
        self.fraction = fraction
        self.limitUSD = limitUSD
        self.spentUSD = spentUSD
    }

    public init(summary: UsageSummary) {
        self.init(spentUSD: summary.month.costUSD, budget: summary.budget)
    }

    public init(spentUSD: Double, budget: UsageSummary.Budget?) {
        self.spentUSD = spentUSD
        guard let budget, budget.monthlyUSD > 0 else {
            self.level = .none
            self.fraction = nil
            self.limitUSD = nil
            return
        }
        let f = max(0, spentUSD) / budget.monthlyUSD
        self.fraction = f
        self.limitUSD = budget.monthlyUSD
        if f >= 1 {
            self.level = .over
        } else if budget.enabled, f * 100 >= budget.thresholdPercent {
            self.level = .warning
        } else {
            self.level = .ok
        }
    }

    /// Rounded percentage for display ("82 %"), nil without a budget.
    public var percent: Int? { fraction.map { Int(($0 * 100).rounded()) } }

    /// Fraction clamped to 0…1 for progress views and gauges.
    public var progress: Double { min(max(fraction ?? 0, 0), 1) }
}

/// The last budget notification we showed, so each level fires at most once per month.
public struct BudgetAlertRecord: Codable, Equatable, Sendable {
    public var monthKey: String
    public var level: BudgetStatus.Level

    public init(monthKey: String, level: BudgetStatus.Level) {
        self.monthKey = monthKey
        self.level = level
    }
}

public enum BudgetAlertPolicy {
    /// The level to notify about now, or nil. Fires when the month first reaches `.warning`, and
    /// again when it reaches `.over`; resets every month.
    public static func levelToNotify(
        status: BudgetStatus, monthKey: String, last: BudgetAlertRecord?
    ) -> BudgetStatus.Level? {
        guard status.level >= .warning else { return nil }
        if let last, last.monthKey == monthKey, last.level >= status.level { return nil }
        return status.level
    }
}
