import SwiftUI
import Charts
import ServiceManagement

@main
struct TokenyMenuBarApp: App {
    @StateObject private var model: SummaryModel

    init() {
        let m = SummaryModel()
        _model = StateObject(wrappedValue: m)
        Task { await m.pollForever() }
    }

    var body: some Scene {
        MenuBarExtra {
            MenuContent().environmentObject(model)
        } label: {
            // The text next to the icon: this month's spend.
            HStack(spacing: 3) {
                Image(systemName: model.summary?.overThreshold == true ? "exclamationmark.triangle.fill" : "dollarsign.circle")
                if let s = model.summary { Text(model.short(s.month.cost_usd)) }
            }
        }
        .menuBarExtraStyle(.window)

        Settings {
            TokenSettingsForm(onSave: { model.settingsChanged() })
                .formStyle(.grouped)
                .frame(width: 440)
                .padding()
        }
    }
}

extension SummaryModel {
    /// Refresh every 10 minutes (the server syncs providers once a day; CSV/MCP uploads anytime).
    func pollForever() async {
        while !Task.isCancelled {
            await refresh()
            try? await Task.sleep(for: .seconds(600))
        }
    }
}

struct MenuContent: View {
    @EnvironmentObject private var model: SummaryModel
    @Environment(\.openURL) private var openURL
    @State private var showSettings = false
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Tokeny Monitor").font(.headline)
                Spacer()
                Picker("", selection: $model.currency) {
                    ForEach(Currency.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented).labelsHidden().frame(width: 100)
            }

            if showSettings || !model.configured {
                TokenSettingsForm(onSave: { showSettings = false; model.settingsChanged() },
                                  onCancel: model.configured ? { showSettings = false } : nil)
                    .formStyle(.grouped)
                    .frame(height: 380)
            } else if let s = model.summary {
                summary(s)
            } else if let e = model.error {
                Label(e, systemImage: "exclamationmark.triangle").foregroundStyle(.orange)
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }

            if let e = model.error, model.summary != nil {
                Label(e, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange)
            }

            Divider()
            HStack {
                Button { Task { await model.refresh() } } label: { Image(systemName: "arrow.clockwise") }
                    .disabled(model.loading).help("Obnovit (⌘R)")
                    .keyboardShortcut("r", modifiers: .command)
                Button("Dashboard") { openURL(URL(string: "https://tokeny.pohl.uk/dashboard")!) }
                Button { showSettings.toggle() } label: { Image(systemName: "gearshape") }.help("Nastavení (⌘,)")
                    .keyboardShortcut(",", modifiers: .command)
                Spacer()
                Toggle("Po přihlášení", isOn: $launchAtLogin)
                    .toggleStyle(.checkbox).font(.caption)
                    .onChange(of: launchAtLogin) { _, on in
                        do { if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() } }
                        catch { launchAtLogin = SMAppService.mainApp.status == .enabled }
                    }
                Button("Konec") { NSApplication.shared.terminate(nil) }
                    .keyboardShortcut("q", modifiers: .command)
            }
        }
        .padding(14)
        .frame(width: 360)
    }

    @ViewBuilder
    private func summary(_ s: UsageSummary) -> some View {
        HStack(alignment: .top) {
            kpi("Dnes", s.today.cost_usd, sub: "\(Fmt.num(s.today.tokens)) tokenů")
            kpi("Tento měsíc", s.month.cost_usd, sub: "\(Fmt.num(s.month.requests)) requestů")
            kpi("Odhad", s.forecast_month_usd, sub: "minulý \(model.short(s.previous_month.cost_usd))")
        }
        BudgetBar(summary: s, model: model)

        Chart(s.daily) { d in
            BarMark(x: .value("Den", d.date), y: .value("Náklady", model.currency == .CZK ? d.cost_usd * model.rate : d.cost_usd))
                .foregroundStyle(Color.tokenyPrimary.gradient)
        }
        .chartXAxis(.hidden)
        .frame(height: 70)

        if !s.top_models.isEmpty {
            VStack(alignment: .leading, spacing: 3) {
                Text("Top modely (měsíc)").font(.caption).foregroundStyle(.secondary)
                ForEach(s.top_models) { m in
                    HStack { Text(Fmt.model(m.name, max: 30)).lineLimit(1); Spacer(); Text(model.cost(m.cost_usd)).monospacedDigit() }
                        .font(.callout)
                }
            }
        }
        Text("Poslední aktivita \(Fmt.updated(s.last_activity_at))").font(.caption2).foregroundStyle(.tertiary)
    }

    private func kpi(_ title: String, _ usd: Double, sub: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(model.short(usd)).font(.title3.bold()).monospacedDigit()
            Text(sub).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
