import Foundation
import Testing

@testable import TokenyCore

@Suite("SummaryStore and WatchPayload", .serialized)
struct StoreTests {
    let store = SummaryStore(suiteName: "tokeny.tests.\(UUID().uuidString)")

    @Test func savesLoadsAndClears() {
        #expect(store.load() == nil)
        let at = Date(timeIntervalSince1970: 1_800_000_000)
        store.save(.preview, fetchedAt: at)
        #expect(store.load() == CachedSummary(summary: .preview, fetchedAt: at))
        store.lastBudgetAlert = BudgetAlertRecord(monthKey: "2026-10", level: .warning)
        store.clear()
        #expect(store.load() == nil)
        #expect(store.lastBudgetAlert == nil)
    }

    @Test func preferences() {
        #expect(store.currency == .czk)
        store.currency = .usd
        #expect(store.currency == .usd)
        #expect(store.budgetAlertsEnabled)
        store.budgetAlertsEnabled = false
        #expect(!store.budgetAlertsEnabled)
    }

    @Test func staleness() {
        let c = CachedSummary(summary: .preview, fetchedAt: Date(timeIntervalSince1970: 0))
        #expect(c.isStale(now: Date(timeIntervalSince1970: 31 * 60)))
        #expect(!c.isStale(now: Date(timeIntervalSince1970: 29 * 60)))
    }

    @Test func watchPayloadRoundTrip() throws {
        let p = WatchPayload(
            cached: .init(summary: .preview, fetchedAt: Date(timeIntervalSince1970: 5)), currency: .usd, signedIn: true)
        #expect(WatchPayload.decode(try p.encoded()) == p)
        #expect(WatchPayload.decode(Data("nope".utf8)) == nil)
    }
}
