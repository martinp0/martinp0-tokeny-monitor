import ServiceManagement
import SwiftUI
import TokenyCore
import UserNotifications

/// Menu bar app (no Dock icon): this month's spend in the menu bar, details in the panel.
@main
struct TokenyMenuBarApp: App {
    @NSApplicationDelegateAdaptor(MacAppDelegate.self) private var appDelegate
    @State private var model = AppModel.shared

    init() {
        // The panel's view only exists while it is open, so background work starts here.
        let model = AppModel.shared
        Task { await model.auth.observe() }
        Task { await model.autoRefresh() }
        Task { await model.observeStorefront() }
    }

    var body: some Scene {
        MenuBarExtra {
            MenuPanel()
                .environment(model)
        } label: {
            MenuBarLabel(model: model)
        }
        .menuBarExtraStyle(.window)

        Settings {
            MacSettingsView()
                .environment(model)
        }
    }
}

/// Lets budget notifications show while the app runs (a menu bar app is always "active").
final class MacAppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        UNUserNotificationCenter.current().delegate = self
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}

extension AppModel {
    /// Keeps the menu bar figure fresh while the app runs.
    func autoRefresh(every interval: Duration = .seconds(15 * 60)) async {
        while !Task.isCancelled {
            await refreshIfStale(maxAge: 60)
            try? await Task.sleep(for: interval)
        }
    }
}

struct MenuBarLabel: View {
    let model: AppModel

    var body: some View {
        if let s = model.summary {
            let status = s.budgetStatus
            Label {
                Text(Fmt.money(s.month.costUSD, model.currency, rate: s.usdToCZK, style: .compact))
                    .monospacedDigit()
            } icon: {
                Image(systemName: status.level >= .warning ? "exclamationmark.triangle.fill" : "chart.bar.fill")
            }
            .labelStyle(.titleAndIcon)
        } else {
            Image(systemName: "chart.bar")
                .accessibilityLabel("Tokeny")
        }
    }
}

struct MenuPanel: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @Environment(\.openSettings) private var openSettings
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            switch model.auth.state {
            case .unknown:
                ProgressView().frame(maxWidth: .infinity)
            case .signedOut:
                SignInView()
                    .frame(height: 560)
            case .signedIn:
                if let s = model.summary {
                    summary(s)
                } else if let error = model.lastError {
                    Text(error.message).foregroundStyle(.secondary)
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
            Divider()
            toolbar
        }
        .padding(16)
        .frame(width: 340)
    }

    @ViewBuilder
    private func summary(_ s: UsageSummary) -> some View {
        let rate = s.usdToCZK
        let currency = model.currency
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("This month").font(.caption.weight(.medium)).foregroundStyle(.secondary)
                MoneyStack(
                    usd: s.month.costUSD, currency: currency, rate: rate,
                    primaryFont: .system(.title, design: .rounded, weight: .semibold))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("Today").font(.caption.weight(.medium)).foregroundStyle(.secondary)
                MoneyStack(
                    usd: s.today.costUSD, currency: currency, rate: rate, primaryFont: .title3.weight(.semibold),
                    alignment: .trailing)
            }
        }
        if let forecast = s.forecastMonthUSD {
            LabeledContent("Forecast") {
                Text(Fmt.money(forecast, currency, rate: rate)).monospacedDigit()
            }
            .font(.callout)
        }
        if s.budget != nil {
            BudgetBar(status: s.budgetStatus, currency: currency, rate: rate)
        }
        if !s.daily.isEmpty {
            DailyChart(days: s.daily, currency: currency, rate: rate).frame(height: 60)
        }
        if !s.providers.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(s.providers) { p in
                    ShareRow(title: p.name, usd: p.costUSD, totalUSD: s.month.costUSD, currency: currency, rate: rate)
                }
                ForEach(s.topModels.prefix(3)) { m in
                    ShareRow(title: Fmt.model(m.name), usd: m.costUSD, totalUSD: s.month.costUSD, currency: currency, rate: rate)
                }
            }
        }
        if !s.isPro && model.allowsPurchaseLinks {
            ProUpsellCard(accountURL: model.accountURL)
        }
        if let cached = model.cached {
            UpdatedLabel(cached: cached)
        }
        if let error = model.lastError {
            Label(error.message, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.secondary)
        }
    }

    private var toolbar: some View {
        GlassEffectContainer(spacing: 8) {
            HStack(spacing: 8) {
                Button {
                    Task { await model.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .help("Refresh (⌘R)")
                .keyboardShortcut("r", modifiers: .command)
                .disabled(model.isRefreshing || !model.auth.isSignedIn)

                Button("Dashboard") { openURL(model.config.dashboardURL) }
                    .help("Open the web dashboard")

                Button {
                    NSApplication.shared.activate()
                    openSettings()
                } label: {
                    Image(systemName: "gearshape")
                }
                .help("Settings (⌘,)")
                .keyboardShortcut(",", modifiers: .command)

                Spacer()

                Toggle("Open at login", isOn: $launchAtLogin)
                    .toggleStyle(.checkbox)
                    .font(.caption)
                    .onChange(of: launchAtLogin) { _, on in
                        do {
                            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
                        } catch {
                            launchAtLogin = SMAppService.mainApp.status == .enabled
                        }
                    }

                Button("Quit") { NSApplication.shared.terminate(nil) }
                    .help("Quit (⌘Q)")
                    .keyboardShortcut("q", modifiers: .command)
            }
            .buttonStyle(.glass)
            .controlSize(.small)
        }
    }
}

struct MacSettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmingDelete = false
    @State private var deleteError: String?

    var body: some View {
        @Bindable var model = model
        Form {
            Section("Account") {
                if let email = model.auth.email {
                    LabeledContent("Signed in as", value: email)
                    if let summary = model.summary {
                        LabeledContent("Plan", value: summary.isPro ? "Pro" : String(localized: "Free"))
                    }
                    Link("Manage account on the web", destination: model.accountURL)
                    HStack {
                        Button("Sign out") { Task { await model.signOut() } }
                        Button("Delete account…", role: .destructive) { confirmingDelete = true }
                    }
                    if let deleteError {
                        Text(deleteError).foregroundStyle(.red).font(.caption)
                    }
                } else {
                    Text("Not signed in. Sign in from the menu bar.").foregroundStyle(.secondary)
                }
            }
            Section {
                Picker("Main currency", selection: $model.currency) {
                    Text("Czech koruna (Kč)").tag(Currency.czk)
                    Text("US dollar ($)").tag(Currency.usd)
                }
                Toggle("Budget alerts", isOn: $model.budgetAlertsEnabled)
            } header: {
                Text("Display")
            } footer: {
                Text(
                    "Tokeny notifies you once when you reach your alert threshold and once at 100 % of your monthly budget. Set the budget on the web."
                )
            }
            Section {
                Link("Privacy", destination: model.config.webURL.appending(path: "privacy"))
                LabeledContent("Version", value: Bundle.main.versionString)
            }
        }
        .formStyle(.grouped)
        .frame(width: 440)
        .confirmationDialog("Delete your Tokeny account?", isPresented: $confirmingDelete) {
            Button("Delete account and data", role: .destructive) {
                Task {
                    do {
                        try await model.deleteAccount()
                    } catch let error as UsageAPIError {
                        deleteError = error.message
                    } catch {
                        deleteError = UsageAPIError.offline.message
                    }
                }
            }
        } message: {
            Text(
                "This permanently deletes your account, provider keys and usage history. If you have Pro, cancel the subscription on the web first."
            )
        }
    }
}
