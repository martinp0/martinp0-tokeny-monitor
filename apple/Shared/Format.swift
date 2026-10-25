import Foundation

/// Same rules as src/lib/format.ts (fmtCost, fmtNumShort, shortModel).
enum Fmt {
    static let fallbackRate = 23.5 // FALLBACK_RATE in src/lib/format.ts

    static func rate(_ s: UsageSummary?) -> Double { s?.usd_czk?.rate ?? fallbackRate }

    static func cost(_ usd: Double, _ currency: Currency, rate: Double, decimals: Int = 2) -> String {
        switch currency {
        case .CZK:
            return (usd * rate).formatted(.number.precision(.fractionLength(decimals)).locale(Locale(identifier: "cs_CZ"))) + " Kč"
        case .USD:
            return "$" + usd.formatted(.number.precision(.fractionLength(decimals)).locale(Locale(identifier: "en_US")))
        }
    }

    /// Compact, for the menu bar and complications: "892 Kč", "$38".
    static func short(_ usd: Double, _ currency: Currency, rate: Double) -> String {
        let v = currency == .CZK ? usd * rate : usd
        let d = v < 10 ? 1 : 0
        return cost(usd, currency, rate: rate, decimals: d)
    }

    static func num(_ n: Int) -> String {
        let fmt: (Double) -> String = { $0.formatted(.number.precision(.fractionLength(0...1)).locale(Locale(identifier: "cs_CZ"))) }
        if n >= 1_000_000 { return fmt(Double(n) / 1e6) + "M" }
        if n >= 1_000 { return fmt(Double(n) / 1e3) + "K" }
        return "\(n)"
    }

    static func model(_ name: String, max: Int = 22) -> String {
        var s = name.split(separator: "/").last.map(String.init) ?? name
        s = s.replacingOccurrences(of: #"-(20\d{2})-?(\d{2})-?(\d{2})(?=(-|$))"#, with: "", options: .regularExpression)
        return s.count > max ? String(s.prefix(max - 1)) + "…" : s
    }

    static func updated(_ iso: String?) -> String {
        guard let iso, let d = ISO8601DateFormatter.flexible(iso) else { return "–" }
        return d.formatted(.relative(presentation: .named).locale(Locale(identifier: "cs_CZ")))
    }
}

extension ISO8601DateFormatter {
    static func flexible(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
}
