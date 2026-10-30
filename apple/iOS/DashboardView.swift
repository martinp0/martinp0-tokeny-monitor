import SwiftUI
import TokenyCore

struct DashboardView: View {
    @Environment(AppModel.self) private var model
    @State private var showingSettings = false

    var body: some View {
        NavigationStack {
            Group {
                if let summary = model.summary {
                    content(summary)
                } else if let error = model.lastError {
                    ContentUnavailableView {
                        Label("No data yet", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(error.message)
                    } actions: {
                        Button("Try again") { Task { await model.refresh() } }
                            .buttonStyle(.glass)
                    }
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Tokeny")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingSettings = true
                    } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                }
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
        }
    }

    private func content(_ s: UsageSummary) -> some View {
        let rate = s.usdToCZK
        let currency = model.currency
        return List {
            Section {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Today")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.secondary)
                            MoneyStack(usd: s.today.costUSD, currency: currency, rate: rate)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 4) {
                            Text("Tokens")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.secondary)
                            Text(Fmt.tokens(s.today.tokens))
                                .font(.title2.weight(.semibold))
                                .monospacedDigit()
                        }
                    }
                    Divider()
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("This month")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.secondary)
                            MoneyStack(
                                usd: s.month.costUSD, currency: currency, rate: rate, primaryFont: .title.weight(.semibold))
                        }
                        Spacer()
                        if let forecast = s.forecastMonthUSD {
                            VStack(alignment: .trailing, spacing: 4) {
                                Text("Forecast")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(.secondary)
                                Text(Fmt.money(forecast, currency, rate: rate))
                                    .font(.title3.weight(.semibold))
                                    .monospacedDigit()
                            }
                        }
                    }
                    if s.budget != nil {
                        BudgetBar(status: s.budgetStatus, currency: currency, rate: rate)
                    }
                }
                .padding(.vertical, 6)
            } footer: {
                if let cached = model.cached {
                    UpdatedLabel(cached: cached)
                }
            }

            if !s.daily.isEmpty {
                Section("Daily") {
                    DailyChart(days: s.daily, currency: currency, rate: rate)
                        .frame(height: 120)
                        .padding(.vertical, 6)
                }
            }

            if !s.providers.isEmpty {
                Section("Providers") {
                    ForEach(s.providers) { p in
                        ShareRow(title: p.name, usd: p.costUSD, totalUSD: s.month.costUSD, currency: currency, rate: rate)
                    }
                }
            }

            if !s.topModels.isEmpty {
                Section("Top models") {
                    ForEach(s.topModels) { m in
                        ShareRow(
                            title: Fmt.model(m.name), usd: m.costUSD, totalUSD: s.month.costUSD, currency: currency, rate: rate)
                    }
                }
            }

            if let previous = s.previousMonth {
                Section("Last month") {
                    LabeledContent("Spend") {
                        Text(Fmt.money(previous.costUSD, currency, rate: rate)).monospacedDigit()
                    }
                    LabeledContent("Tokens") {
                        Text(Fmt.tokens(previous.tokens)).monospacedDigit()
                    }
                }
            }

            if !s.isPro {
                Section {
                    ProUpsellCard(accountURL: model.config.accountURL)
                }
            }

            if s.providers.isEmpty && s.month.requests == 0 {
                Section {
                    Label("Connect an OpenAI, Anthropic or OpenRouter key on the web to see your spend.", systemImage: "key")
                        .font(.callout)
                    Link("Open tokeny.martinpohl.cz", destination: model.config.dashboardURL)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await model.refresh() }
        .safeAreaInset(edge: .bottom) {
            if let error = model.lastError {
                Label(error.message, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .glassEffect(.regular, in: .capsule)
                    .padding(.bottom, 8)
            }
        }
    }
}

#Preview {
    DashboardView()
        .environment(AppModel.shared)
}
