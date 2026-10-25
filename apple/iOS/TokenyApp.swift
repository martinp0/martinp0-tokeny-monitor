import SwiftUI
import Charts

/// Minimal iPhone companion. Its main job is to host the Apple Watch app and hand it the token;
/// it also shows the same summary as the Mac menu bar.
@main
struct TokenyApp: App {
    @StateObject private var model = SummaryModel()
    init() { ConfigSync.shared.activate() }

    var body: some Scene {
        WindowGroup {
            PhoneSummaryView().environmentObject(model).tint(.tokenyPrimary)
        }
    }
}

struct PhoneSummaryView: View {
    @EnvironmentObject private var model: SummaryModel
    @Environment(\.scenePhase) private var phase
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            List {
                if !model.configured {
                    Section {
                        Text("Vlož osobní token z tokeny.pohl.uk (Nastavení → MCP tokeny). Hodinky ho dostanou z telefonu.")
                        Button("Nastavit") { showSettings = true }
                    }
                } else if let s = model.summary {
                    Section {
                        row("Dnes", s.today.cost_usd, "\(Fmt.num(s.today.tokens)) tokenů")
                        row("Tento měsíc", s.month.cost_usd, "\(Fmt.num(s.month.requests)) requestů")
                        row("Odhad měsíce", s.forecast_month_usd, "minulý \(model.short(s.previous_month.cost_usd))")
                        BudgetBar(summary: s, model: model)
                    }
                    Section("Posledních 30 dní") {
                        Chart(s.daily) { d in
                            BarMark(x: .value("Den", d.date), y: .value("Náklady", model.currency == .CZK ? d.cost_usd * model.rate : d.cost_usd))
                                .foregroundStyle(Color.tokenyPrimary.gradient)
                        }
                        .chartXAxis(.hidden)
                        .frame(height: 120)
                    }
                    Section("Top modely (měsíc)") {
                        ForEach(s.top_models) { m in
                            HStack { Text(Fmt.model(m.name, max: 28)); Spacer(); Text(model.cost(m.cost_usd)).monospacedDigit() }
                        }
                    }
                    if let e = model.error { Text(e).foregroundStyle(.orange).font(.footnote) }
                } else if let e = model.error {
                    Text(e).foregroundStyle(.orange)
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Tokeny")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("Měna", selection: $model.currency) {
                        ForEach(Currency.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }.pickerStyle(.segmented).frame(width: 110)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showSettings = true } label: { Image(systemName: "gearshape") }.accessibilityLabel("Nastavení")
                }
            }
            .refreshable { await model.refresh() }
            .task(id: phase) { if phase == .active { await model.refresh() } }
            .onChange(of: model.currency) { _, _ in ConfigSync.shared.pushToWatch() }
            .sheet(isPresented: $showSettings) {
                NavigationStack {
                    TokenSettingsForm(onSave: {
                        showSettings = false
                        model.settingsChanged()
                        ConfigSync.shared.pushToWatch()
                    }, onCancel: { showSettings = false })
                    .navigationTitle("Nastavení")
                    .navigationBarTitleDisplayMode(.inline)
                }
            }
        }
    }

    private func row(_ title: String, _ usd: Double, _ sub: String) -> some View {
        HStack {
            VStack(alignment: .leading) { Text(title); Text(sub).font(.caption).foregroundStyle(.secondary) }
            Spacer()
            Text(model.cost(usd)).font(.headline).monospacedDigit()
        }
    }
}
