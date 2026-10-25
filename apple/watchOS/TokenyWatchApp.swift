import SwiftUI

@main
struct TokenyWatchApp: App {
    @StateObject private var model = SummaryModel()
    init() { ConfigSync.shared.activate() }

    var body: some Scene {
        WindowGroup { WatchSummaryView().environmentObject(model) }
    }
}

struct WatchSummaryView: View {
    @EnvironmentObject private var model: SummaryModel
    @Environment(\.scenePhase) private var phase

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    if !model.configured {
                        Text("Nastav token v appce Tokeny na iPhonu.").font(.footnote)
                    } else if let s = model.summary {
                        kpi("Dnes", s.today.cost_usd)
                        kpi("Měsíc", s.month.cost_usd)
                        if let f = s.budgetFraction {
                            Gauge(value: min(f, 1)) { Text("Rozpočet") } currentValueLabel: { Text("\(Int((f * 100).rounded())) %") }
                                .tint(f >= 1 ? .red : s.overThreshold ? .orange : Color.tokenyPrimary)
                        }
                        Text("Odhad \(model.short(s.forecast_month_usd))").font(.footnote).foregroundStyle(.secondary)
                        if let top = s.top_models.first {
                            Text("Top: \(Fmt.model(top.name, max: 18))").font(.footnote).foregroundStyle(.secondary)
                        }
                        if let e = model.error { Text(e).font(.caption2).foregroundStyle(.orange) }
                    } else if let e = model.error {
                        Text(e).font(.footnote)
                    } else {
                        ProgressView()
                    }
                }
            }
            .navigationTitle("Tokeny")
        }
        .task(id: phase) { if phase == .active { await model.refresh() } }
        .onReceive(NotificationCenter.default.publisher(for: .tokenyConfigChanged)) { _ in model.settingsChanged() }
    }

    private func kpi(_ title: String, _ usd: Double) -> some View {
        VStack(alignment: .leading) {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            Text(model.short(usd)).font(.title3.bold()).foregroundStyle(Color.tokenyPrimary)
        }
    }
}
