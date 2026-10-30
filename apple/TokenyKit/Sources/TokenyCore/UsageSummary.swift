import Foundation

/// Response of the `usage-summary` edge function (supabase/functions/usage-summary/index.ts).
/// All money values are USD as stored by the providers; convert with ``usdToCZK``.
public struct UsageSummary: Codable, Equatable, Sendable {
    public enum Plan: String, Codable, Sendable {
        case free, pro
    }

    public struct Bucket: Codable, Equatable, Sendable {
        public var costUSD: Double
        public var tokens: Int
        public var requests: Int
        /// "YYYY-MM" for month buckets.
        public var key: String?

        public init(costUSD: Double, tokens: Int, requests: Int, key: String? = nil) {
            self.costUSD = costUSD
            self.tokens = tokens
            self.requests = requests
            self.key = key
        }

        enum CodingKeys: String, CodingKey {
            case costUSD = "cost_usd", tokens, requests, key
        }
    }

    public struct Budget: Codable, Equatable, Sendable {
        public var monthlyUSD: Double
        /// Alert threshold in percent of ``monthlyUSD`` (e.g. 80).
        public var thresholdPercent: Double
        /// Whether alerts are switched on (the budget is still shown when off).
        public var enabled: Bool

        public init(monthlyUSD: Double, thresholdPercent: Double, enabled: Bool) {
            self.monthlyUSD = monthlyUSD
            self.thresholdPercent = thresholdPercent
            self.enabled = enabled
        }

        enum CodingKeys: String, CodingKey {
            case monthlyUSD = "monthly_usd", thresholdPercent = "threshold_pct", enabled
        }
    }

    public struct ExchangeRate: Codable, Equatable, Sendable {
        public var rate: Double
        public var date: String?

        public init(rate: Double, date: String? = nil) {
            self.rate = rate
            self.date = date
        }
    }

    public struct Day: Codable, Equatable, Sendable, Identifiable {
        /// "YYYY-MM-DD" in the summary's time zone.
        public var date: String
        public var costUSD: Double
        public var id: String { date }

        public init(date: String, costUSD: Double) {
            self.date = date
            self.costUSD = costUSD
        }

        enum CodingKeys: String, CodingKey {
            case date, costUSD = "cost_usd"
        }
    }

    /// A model or provider with its spend this month.
    public struct Share: Codable, Equatable, Sendable, Identifiable {
        public var name: String
        public var costUSD: Double
        public var id: String { name }

        public init(name: String, costUSD: Double) {
            self.name = name
            self.costUSD = costUSD
        }

        enum CodingKeys: String, CodingKey {
            case name, costUSD = "cost_usd"
        }
    }

    public var version: Int
    public var plan: Plan
    public var generatedAt: String
    public var timeZone: String
    public var today: Bucket
    public var month: Bucket
    /// Pro only (outside the free history window).
    public var previousMonth: Bucket?
    /// Pro only.
    public var forecastMonthUSD: Double?
    public var budget: Budget?
    public var usdCZK: ExchangeRate?
    public var daily: [Day]
    public var topModels: [Share]
    public var providers: [Share]
    public var lastActivityAt: String?

    enum CodingKeys: String, CodingKey {
        case version, plan
        case generatedAt = "generated_at"
        case timeZone = "tz"
        case today, month
        case previousMonth = "previous_month"
        case forecastMonthUSD = "forecast_month_usd"
        case budget
        case usdCZK = "usd_czk"
        case daily
        case topModels = "top_models"
        case providers
        case lastActivityAt = "last_activity_at"
    }

    public init(
        version: Int = 1, plan: Plan, generatedAt: String, timeZone: String,
        today: Bucket, month: Bucket, previousMonth: Bucket?, forecastMonthUSD: Double?,
        budget: Budget?, usdCZK: ExchangeRate?, daily: [Day], topModels: [Share], providers: [Share],
        lastActivityAt: String?
    ) {
        self.version = version
        self.plan = plan
        self.generatedAt = generatedAt
        self.timeZone = timeZone
        self.today = today
        self.month = month
        self.previousMonth = previousMonth
        self.forecastMonthUSD = forecastMonthUSD
        self.budget = budget
        self.usdCZK = usdCZK
        self.daily = daily
        self.topModels = topModels
        self.providers = providers
        self.lastActivityAt = lastActivityAt
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = try c.decodeIfPresent(Int.self, forKey: .version) ?? 1
        // Older servers answered only personal-token (Pro) requests and had no `plan` field.
        plan = (try? c.decodeIfPresent(Plan.self, forKey: .plan)) ?? .pro
        generatedAt = try c.decode(String.self, forKey: .generatedAt)
        timeZone = try c.decodeIfPresent(String.self, forKey: .timeZone) ?? "Europe/Prague"
        today = try c.decode(Bucket.self, forKey: .today)
        month = try c.decode(Bucket.self, forKey: .month)
        previousMonth = try c.decodeIfPresent(Bucket.self, forKey: .previousMonth)
        forecastMonthUSD = try c.decodeIfPresent(Double.self, forKey: .forecastMonthUSD)
        budget = try c.decodeIfPresent(Budget.self, forKey: .budget)
        usdCZK = try c.decodeIfPresent(ExchangeRate.self, forKey: .usdCZK)
        daily = try c.decodeIfPresent([Day].self, forKey: .daily) ?? []
        topModels = try c.decodeIfPresent([Share].self, forKey: .topModels) ?? []
        providers = try c.decodeIfPresent([Share].self, forKey: .providers) ?? []
        lastActivityAt = try c.decodeIfPresent(String.self, forKey: .lastActivityAt)
    }

    /// Same fallback as FALLBACK_RATE in src/lib/format.ts, used until the server sends a rate.
    public static let fallbackUSDCZK = 23.5

    public var usdToCZK: Double {
        guard let r = usdCZK?.rate, r > 0 else { return Self.fallbackUSDCZK }
        return r
    }

    public var isPro: Bool { plan == .pro }

    public var budgetStatus: BudgetStatus { BudgetStatus(summary: self) }

    /// When the server built this summary (nil if the timestamp is malformed).
    public var generatedDate: Date? { ISO8601.date(from: generatedAt) }
    public var lastActivityDate: Date? { lastActivityAt.flatMap(ISO8601.date(from:)) }
}

extension UsageSummary {
    /// Sample data for previews, widget placeholders and tests.
    public static let preview = UsageSummary(
        plan: .pro, generatedAt: "2026-10-25T10:00:00.000Z", timeZone: "Europe/Prague",
        today: Bucket(costUSD: 1.84, tokens: 412_000, requests: 96),
        month: Bucket(costUSD: 38.2, tokens: 9_800_000, requests: 2140, key: "2026-10"),
        previousMonth: Bucket(costUSD: 41.7, tokens: 10_100_000, requests: 2311, key: "2026-09"),
        forecastMonthUSD: 47.4,
        budget: Budget(monthlyUSD: 50, thresholdPercent: 80, enabled: true),
        usdCZK: ExchangeRate(rate: 23.4, date: "2026-10-24"),
        daily: (1...30).map { Day(date: String(format: "2026-10-%02d", $0), costUSD: Double(($0 * 37) % 23) / 10) },
        topModels: [
            Share(name: "anthropic/claude-sonnet-4.5", costUSD: 21.3),
            Share(name: "openai/gpt-5-mini-2025-08-07", costUSD: 9.1),
            Share(name: "google/gemini-2.5-flash", costUSD: 4.2),
        ],
        providers: [
            Share(name: "Anthropic", costUSD: 24.0),
            Share(name: "OpenAI", costUSD: 14.2),
        ],
        lastActivityAt: "2026-10-25T09:58:00Z"
    )
}

/// ISO 8601 parsing with or without fractional seconds (Postgres and JS both appear).
public enum ISO8601 {
    public static func date(from string: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: string) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: string)
    }
}
