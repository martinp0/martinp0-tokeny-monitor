import Foundation
import Testing

@testable import TokenyCore

private let nbsp = "\u{00A0}"

@Suite("Formatting")
struct FormattingTests {
    @Test(arguments: [
        (0.0, "0\(nbsp)Kč"),
        (1.0, "23,50\(nbsp)Kč"),
        (4.0, "94,00\(nbsp)Kč"),
        (38.2, "898\(nbsp)Kč"),
        (100.0, "2\(nbsp)350\(nbsp)Kč"),
    ])
    func czkStandard(usd: Double, expected: String) {
        #expect(Fmt.money(usd, .czk, rate: 23.5) == expected)
    }

    @Test(arguments: [
        (0.0, "$0.00"),
        (0.004, "$0.00"),
        (38.2, "$38.20"),
        (1234.5, "$1,234.50"),
        (-2.5, "-$2.50"),
    ])
    func usdStandard(usd: Double, expected: String) {
        #expect(Fmt.money(usd, .usd, rate: 23.5) == expected)
    }

    @Test func compact() {
        #expect(Fmt.money(0.2, .czk, rate: 23.5, style: .compact) == "4,7\(nbsp)Kč")
        #expect(Fmt.money(38.2, .czk, rate: 23.5, style: .compact) == "898\(nbsp)Kč")
        #expect(Fmt.money(3.456, .usd, rate: 23.5, style: .compact) == "$3.46")
        #expect(Fmt.money(38.2, .usd, rate: 23.5, style: .compact) == "$38")
    }

    @Test func pairPutsPrimaryFirst() {
        let p = Fmt.moneyPair(10, primary: .usd, rate: 20)
        #expect(p.primary == "$10.00")
        #expect(p.secondary == "200\(nbsp)Kč")
        let q = Fmt.moneyPair(10, primary: .czk, rate: 20)
        #expect(q.primary == "200\(nbsp)Kč")
        #expect(q.secondary == "$10.00")
    }

    @Test func tokens() {
        let en = Locale(identifier: "en_US")
        let cs = Locale(identifier: "cs_CZ")
        #expect(Fmt.tokens(412, locale: en) == "412")
        #expect(Fmt.tokens(412_000, locale: en) == "412K")
        #expect(Fmt.tokens(9_800_000, locale: en) == "9.8M")
        #expect(Fmt.tokens(9_800_000, locale: cs) == "9,8M")
        #expect(Fmt.tokens(1_250_000_000, locale: en) == "1.2B" || Fmt.tokens(1_250_000_000, locale: en) == "1.3B")
    }

    @Test func integers() {
        #expect(Fmt.integer(2140, locale: Locale(identifier: "en_US")) == "2,140")
        #expect(Fmt.integer(2140, locale: Locale(identifier: "cs_CZ")) == "2\(nbsp)140")
    }

    @Test(arguments: [
        ("anthropic/claude-sonnet-4-20250514", "claude-sonnet-4"),
        ("openai/gpt-5-mini-2025-08-07", "gpt-5-mini"),
        ("google/gemini-2.5-flash-preview-05-20", "gemini-2.5-flash-prev-05-20"),
        ("deepseek/deepseek-r1-thinking", "deepseek-r1-think"),
        ("gpt-4o", "gpt-4o"),
        ("meta-llama/llama-3.3-70b-instruct", "llama-3.3-70b-ins"),
    ])
    func modelNames(input: String, expected: String) {
        #expect(Fmt.model(input) == expected)
    }

    @Test func modelTruncation() {
        #expect(Fmt.model("a/abcdefghijklmnop", maxLength: 8) == "abcdefg…")
    }

    @Test func percent() {
        #expect(Fmt.percent(82, locale: Locale(identifier: "cs_CZ")) == "82\(nbsp)%")
        #expect(Fmt.percent(82, locale: Locale(identifier: "en_US")) == "82%")
    }
}
