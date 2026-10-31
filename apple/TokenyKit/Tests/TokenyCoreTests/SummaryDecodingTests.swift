import Foundation
import Testing

@testable import TokenyCore

@Suite("UsageSummary decoding")
struct SummaryDecodingTests {
    @Test func decodesProSummary() throws {
        let s = try UsageAPI.decodeSummary(Fixtures.proSummary)
        #expect(s.plan == .pro)
        #expect(s.isPro)
        #expect(s.timeZone == "Europe/Prague")
        #expect(s.today.costUSD == 1.8421)
        #expect(s.today.tokens == 412_000)
        #expect(s.month.key == "2026-10")
        #expect(s.previousMonth?.requests == 2311)
        #expect(s.forecastMonthUSD == 39.47)
        #expect(s.budget == .init(monthlyUSD: 50, thresholdPercent: 80, enabled: true))
        #expect(s.usdToCZK == 23.41)
        #expect(s.daily.map(\.date) == ["2026-10-29", "2026-10-30"])
        #expect(s.topModels.first?.name == "anthropic/claude-sonnet-4-20250514")
        #expect(s.providers.count == 2)
        #expect(s.generatedDate != nil)
        #expect(s.lastActivityDate != nil)
    }

    @Test func decodesFreeSummaryWithNulls() throws {
        let s = try UsageAPI.decodeSummary(Fixtures.freeSummary)
        #expect(s.plan == .free)
        #expect(!s.isPro)
        #expect(s.previousMonth == nil)
        #expect(s.forecastMonthUSD == nil)
        #expect(s.budget == nil)
        #expect(s.usdToCZK == UsageSummary.fallbackUSDCZK)
        #expect(s.lastActivityDate == nil)
        #expect(s.budgetStatus.level == .none)
    }

    @Test func legacyResponseWithoutPlanIsPro() throws {
        let s = try UsageAPI.decodeSummary(Fixtures.legacySummary)
        #expect(s.plan == .pro)
        #expect(s.usdCZK?.date == nil)
        #expect(s.usdToCZK == 24)
    }

    @Test func unknownPlanFallsBackToPro() throws {
        var json = String(decoding: Fixtures.freeSummary, as: UTF8.self)
        json = json.replacingOccurrences(of: #""plan": "free""#, with: #""plan": "team""#)
        let s = try UsageAPI.decodeSummary(Data(json.utf8))
        #expect(s.plan == .pro)
    }

    @Test func garbageIsBadResponse() {
        #expect(throws: UsageAPIError.badResponse) { try UsageAPI.decodeSummary(Data("<html>".utf8)) }
        #expect(throws: UsageAPIError.badResponse) { try UsageAPI.decodeSummary(Data(#"{"version":1}"#.utf8)) }
    }

    @Test func roundTripsThroughCache() throws {
        let cached = CachedSummary(summary: .preview, fetchedAt: Date(timeIntervalSince1970: 1_800_000_000))
        let data = try JSONEncoder().encode(cached)
        let back = try JSONDecoder().decode(CachedSummary.self, from: data)
        #expect(back == cached)
    }

    @Test func zeroRateUsesFallback() {
        var s = UsageSummary.preview
        s.usdCZK = .init(rate: 0)
        #expect(s.usdToCZK == UsageSummary.fallbackUSDCZK)
    }

    @Test func iso8601WithAndWithoutFraction() {
        #expect(ISO8601.date(from: "2026-10-30T06:52:11.482Z") != nil)
        #expect(ISO8601.date(from: "2026-10-30T06:52:11Z") != nil)
        #expect(ISO8601.date(from: "2026-10-30T06:40:00+00:00") != nil)
        #expect(ISO8601.date(from: "yesterday") == nil)
    }
}
