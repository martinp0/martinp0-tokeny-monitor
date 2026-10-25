import SwiftUI
#if canImport(WidgetKit)
import WidgetKit
#endif

extension Color {
    /// --primary in src/index.css (hsl 270 95% 65%).
    static let tokenyPrimary = Color(red: 0xA6 / 255, green: 0x51 / 255, blue: 0xFA / 255)
    /// --accent (hsl 175 85% 55%).
    static let tokenyAccent = Color(red: 0x2D / 255, green: 0xED / 255, blue: 0xDB / 255)
}

@MainActor
final class SummaryModel: ObservableObject {
    @Published private(set) var summary: UsageSummary? = TokenySettings.lastSummary
    @Published private(set) var error: String?
    @Published private(set) var loading = false
    @Published private(set) var configured = TokenySettings.isConfigured
    @Published var currency: Currency = TokenySettings.currency {
        didSet { TokenySettings.currency = currency; reloadWidgets() }
    }

    var rate: Double { Fmt.rate(summary) }
    func cost(_ usd: Double, decimals: Int = 2) -> String { Fmt.cost(usd, currency, rate: rate, decimals: decimals) }
    func short(_ usd: Double) -> String { Fmt.short(usd, currency, rate: rate) }

    func refresh() async {
        configured = TokenySettings.isConfigured
        guard configured else { return }
        loading = true
        defer { loading = false }
        do {
            let old = summary
            summary = try await TokenyAPI.refresh()
            error = nil
            if old != summary { reloadWidgets() }
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }

    func settingsChanged() {
        configured = TokenySettings.isConfigured
        currency = TokenySettings.currency
        summary = nil
        TokenySettings.lastSummary = nil
        reloadWidgets()
        Task { await refresh() }
    }

    private func reloadWidgets() {
        #if canImport(WidgetKit) && !os(macOS)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }
}
