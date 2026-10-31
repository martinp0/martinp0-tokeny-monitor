import Foundation

public enum Currency: String, Codable, CaseIterable, Sendable, Identifiable {
    case czk = "CZK"
    case usd = "USD"

    public var id: String { rawValue }
    public var symbol: String { self == .czk ? "Kč" : "$" }
}

/// Money, token and model-name formatting shared by every target.
/// Mirrors src/lib/format.ts on the web, so numbers match the dashboard.
public enum Fmt {
    public enum Style: Sendable {
        /// Dashboard: CZK without decimals from 100 Kč, USD always with cents.
        case standard
        /// Widgets, menu bar, complications: as short as possible.
        case compact
    }

    /// "1 234 Kč", "38,40 Kč", "$38.20". CZK always uses Czech number formatting and USD US
    /// formatting, independent of the device language, the way people write these currencies.
    public static func money(_ usd: Double, _ currency: Currency, rate: Double, style: Style = .standard) -> String {
        let value = currency == .czk ? usd * rate : usd
        let digits: Int
        switch (currency, style) {
        case (.czk, .standard): digits = abs(value) >= 100 || value == 0 ? 0 : 2
        case (.czk, .compact): digits = abs(value) >= 10 || value == 0 ? 0 : 1
        case (.usd, .standard): digits = 2
        case (.usd, .compact): digits = abs(value) >= 10 ? 0 : 2
        }
        switch currency {
        case .czk:
            return number(value, digits: digits, locale: czech) + "\u{00A0}Kč"
        case .usd:
            let s = number(abs(value), digits: digits, locale: english)
            return (value < 0 ? "-$" : "$") + s
        }
    }

    /// Both currencies, primary first: "892 Kč · $38.20".
    public static func moneyPair(_ usd: Double, primary: Currency, rate: Double) -> (primary: String, secondary: String) {
        let other: Currency = primary == .czk ? .usd : .czk
        return (money(usd, primary, rate: rate), money(usd, other, rate: rate))
    }

    /// "412", "9,8K", "9,8M" (decimal separator follows `locale`).
    public static func tokens(_ n: Int, locale: Locale = .current) -> String {
        let v = Double(n)
        if abs(v) >= 1_000_000_000 { return number(v / 1e9, digits: 0...1, locale: locale) + "B" }
        if abs(v) >= 1_000_000 { return number(v / 1e6, digits: 0...1, locale: locale) + "M" }
        if abs(v) >= 1_000 { return number(v / 1e3, digits: 0...1, locale: locale) + "K" }
        return "\(n)"
    }

    /// Integer with grouping in `locale`: "2 140" (cs) / "2,140" (en).
    public static func integer(_ n: Int, locale: Locale = .current) -> String {
        number(Double(n), digits: 0, locale: locale)
    }

    /// "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4" (same as shortModel on the web).
    public static func model(_ name: String, maxLength: Int = 28) -> String {
        var s = name.split(separator: "/").last.map(String.init) ?? name
        // ISO date suffix: -YYYY-MM-DD or -YYYYMMDD (optionally followed by e.g. -preview).
        s = s.replacingOccurrences(of: #"-(20\d{2})-?(\d{2})-?(\d{2})(?=(-|$))"#, with: "", options: .regularExpression)
        for (long, short) in [("preview", "prev"), ("experimental", "exp"), ("instruct", "ins"), ("thinking", "think")] {
            s = s.replacingOccurrences(of: "-\(long)\\b", with: "-\(short)", options: [.regularExpression, .caseInsensitive])
        }
        guard maxLength > 1, s.count > maxLength else { return s }
        return String(s.prefix(maxLength - 1)) + "…"
    }

    /// "82 %" (cs) / "82%" (en).
    public static func percent(_ value: Int, locale: Locale = .current) -> String {
        locale.language.languageCode?.identifier == "cs" ? "\(value)\u{00A0}%" : "\(value)%"
    }

    static let czech = Locale(identifier: "cs_CZ")
    static let english = Locale(identifier: "en_US")

    static func number(_ v: Double, digits: Int, locale: Locale) -> String {
        number(v, digits: digits...digits, locale: locale)
    }

    static func number(_ v: Double, digits: ClosedRange<Int>, locale: Locale) -> String {
        v.formatted(.number.precision(.fractionLength(digits)).locale(locale))
    }
}
