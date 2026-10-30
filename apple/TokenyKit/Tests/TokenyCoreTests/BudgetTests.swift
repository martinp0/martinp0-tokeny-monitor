import Testing

@testable import TokenyCore

@Suite("Budget")
struct BudgetTests {
    let budget = UsageSummary.Budget(monthlyUSD: 50, thresholdPercent: 80, enabled: true)

    @Test func noBudget() {
        let s = BudgetStatus(spentUSD: 10, budget: nil)
        #expect(s.level == .none)
        #expect(s.fraction == nil)
        #expect(s.percent == nil)
        #expect(s.progress == 0)
        #expect(BudgetStatus(spentUSD: 10, budget: .init(monthlyUSD: 0, thresholdPercent: 80, enabled: true)).level == .none)
    }

    @Test func levels() {
        #expect(BudgetStatus(spentUSD: 10, budget: budget).level == .ok)
        #expect(BudgetStatus(spentUSD: 40, budget: budget).level == .warning)
        #expect(BudgetStatus(spentUSD: 50, budget: budget).level == .over)
        #expect(BudgetStatus(spentUSD: 75, budget: budget).percent == 150)
        #expect(BudgetStatus(spentUSD: 75, budget: budget).progress == 1)
    }

    @Test func disabledAlertsNeverWarnButStillShowOver() {
        let off = UsageSummary.Budget(monthlyUSD: 50, thresholdPercent: 80, enabled: false)
        #expect(BudgetStatus(spentUSD: 45, budget: off).level == .ok)
        #expect(BudgetStatus(spentUSD: 55, budget: off).level == .over)
    }

    @Test func alertFiresOncePerLevelPerMonth() {
        let warn = BudgetStatus(spentUSD: 42, budget: budget)
        let over = BudgetStatus(spentUSD: 51, budget: budget)
        let ok = BudgetStatus(spentUSD: 5, budget: budget)

        #expect(BudgetAlertPolicy.levelToNotify(status: ok, monthKey: "2026-10", last: nil) == nil)
        #expect(BudgetAlertPolicy.levelToNotify(status: warn, monthKey: "2026-10", last: nil) == .warning)

        let warned = BudgetAlertRecord(monthKey: "2026-10", level: .warning)
        #expect(BudgetAlertPolicy.levelToNotify(status: warn, monthKey: "2026-10", last: warned) == nil)
        #expect(BudgetAlertPolicy.levelToNotify(status: over, monthKey: "2026-10", last: warned) == .over)

        let wentOver = BudgetAlertRecord(monthKey: "2026-10", level: .over)
        #expect(BudgetAlertPolicy.levelToNotify(status: over, monthKey: "2026-10", last: wentOver) == nil)
        // New month starts over.
        #expect(BudgetAlertPolicy.levelToNotify(status: warn, monthKey: "2026-11", last: wentOver) == .warning)
    }

    @Test func summaryStatusUsesMonth() {
        let s = UsageSummary.preview
        #expect(s.budgetStatus.spentUSD == s.month.costUSD)
        #expect(s.budgetStatus.level == .ok)  // 38.2 of 50 = 76 % < 80 %
    }
}
