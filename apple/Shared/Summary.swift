import Foundation

/// Response of the `usage-summary` edge function (supabase/functions/usage-summary).
struct UsageSummary: Codable, Equatable, Sendable {
    struct Bucket: Codable, Equatable, Sendable {
        var cost_usd: Double
        var tokens: Int
        var requests: Int
        var key: String?
    }
    struct Budget: Codable, Equatable, Sendable {
        var monthly_usd: Double
        var threshold_pct: Double
        var enabled: Bool
    }
    struct Rate: Codable, Equatable, Sendable {
        var rate: Double
        var date: String?
    }
    struct Day: Codable, Equatable, Sendable, Identifiable {
        var date: String
        var cost_usd: Double
        var id: String { date }
    }
    struct Named: Codable, Equatable, Sendable, Identifiable {
        var name: String
        var cost_usd: Double
        var id: String { name }
    }

    var version: Int
    var generated_at: String
    var tz: String
    var today: Bucket
    var month: Bucket
    var previous_month: Bucket
    var forecast_month_usd: Double
    var budget: Budget?
    var usd_czk: Rate?
    var daily: [Day]
    var top_models: [Named]
    var providers: [Named]
    var last_activity_at: String?

    /// Share of the monthly budget spent, 0…∞, or nil without a budget.
    var budgetFraction: Double? {
        guard let b = budget, b.monthly_usd > 0 else { return nil }
        return month.cost_usd / b.monthly_usd
    }

    var overThreshold: Bool {
        guard let b = budget, b.enabled, let f = budgetFraction else { return false }
        return f * 100 >= b.threshold_pct
    }

    static let preview = UsageSummary(
        version: 1, generated_at: "2026-10-25T10:00:00Z", tz: "Europe/Prague",
        today: Bucket(cost_usd: 1.84, tokens: 412_000, requests: 96, key: nil),
        month: Bucket(cost_usd: 38.2, tokens: 9_800_000, requests: 2140, key: "2026-10"),
        previous_month: Bucket(cost_usd: 41.7, tokens: 10_100_000, requests: 2311, key: "2026-09"),
        forecast_month_usd: 47.4,
        budget: Budget(monthly_usd: 50, threshold_pct: 80, enabled: true),
        usd_czk: Rate(rate: 23.4, date: "2026-10-24"),
        daily: (0..<30).map { Day(date: String(format: "2026-10-%02d", $0 + 1), cost_usd: Double(($0 * 37) % 23) / 10) },
        top_models: [Named(name: "anthropic/claude-sonnet-4", cost_usd: 21.3), Named(name: "openai/gpt-5-mini", cost_usd: 9.1)],
        providers: [Named(name: "Anthropic", cost_usd: 24.0), Named(name: "OpenAI", cost_usd: 14.2)],
        last_activity_at: "2026-10-25T09:58:00Z"
    )
}
