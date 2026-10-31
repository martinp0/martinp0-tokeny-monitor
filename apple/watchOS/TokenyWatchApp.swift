import SwiftUI
import TokenyCore
import WatchConnectivity
import WidgetKit

@main
struct TokenyWatchApp: App {
    @State private var phone = PhoneBridge()

    var body: some Scene {
        WindowGroup {
            WatchDashboard()
                .environment(phone)
                .task { phone.activate() }
        }
    }
}

/// Watch state: whatever the iPhone last sent. The Watch holds no credentials.
@MainActor
@Observable
final class PhoneBridge {
    private(set) var payload: WatchPayload?
    private(set) var isRequesting = false
    private let store = SummaryStore.shared
    private let delegate = Delegate()

    init() {
        if let cached = store.load() {
            payload = WatchPayload(cached: cached, currency: store.currency, signedIn: true)
        }
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        delegate.onPayload = { [weak self] data in
            Task { @MainActor in self?.receive(data) }
        }
        WCSession.default.delegate = delegate
        WCSession.default.activate()
    }

    /// Asks the iPhone to fetch fresh data; the answer arrives as a new application context.
    func requestRefresh() {
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return }
        isRequesting = true
        session.sendMessage([WatchPayload.refreshRequestKey: true], replyHandler: nil) { [weak self] _ in
            Task { @MainActor in self?.isRequesting = false }
        }
        Task {
            try? await Task.sleep(for: .seconds(15))
            isRequesting = false
        }
    }

    private func receive(_ data: Data) {
        guard let payload = WatchPayload.decode(data) else { return }
        self.payload = payload
        isRequesting = false
        store.currency = payload.currency
        if payload.signedIn, let cached = payload.cached {
            store.save(cached.summary, fetchedAt: cached.fetchedAt)
        } else {
            store.clear()
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    private final class Delegate: NSObject, WCSessionDelegate, @unchecked Sendable {
        /// Set once before `activate()`.
        var onPayload: (@Sendable (Data) -> Void)?

        func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: (any Error)?) {
            if let data = session.receivedApplicationContext[WatchPayload.contextKey] as? Data {
                onPayload?(data)
            }
        }

        func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
            if let data = context[WatchPayload.contextKey] as? Data {
                onPayload?(data)
            }
        }
    }
}

struct WatchDashboard: View {
    @Environment(PhoneBridge.self) private var phone

    var body: some View {
        NavigationStack {
            Group {
                if let payload = phone.payload, payload.signedIn, let cached = payload.cached {
                    summary(cached, currency: payload.currency)
                } else {
                    ContentUnavailableView {
                        Label("Tokeny", systemImage: "iphone")
                    } description: {
                        Text("Sign in to Tokeny on your iPhone. Your spend shows up here.")
                    }
                }
            }
            .navigationTitle("Tokeny")
        }
    }

    private func summary(_ cached: CachedSummary, currency: Currency) -> some View {
        let s = cached.summary
        let rate = s.usdToCZK
        return List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text("This month").font(.caption).foregroundStyle(.secondary)
                    MoneyStack(
                        usd: s.month.costUSD, currency: currency, rate: rate,
                        primaryFont: .system(.title2, design: .rounded, weight: .semibold))
                    Text("Today \(Fmt.money(s.today.costUSD, currency, rate: rate))")
                        .font(.footnote)
                        .monospacedDigit()
                }
                if s.budget != nil {
                    BudgetBar(status: s.budgetStatus, currency: currency, rate: rate)
                }
            } footer: {
                UpdatedLabel(cached: cached)
            }

            if !s.providers.isEmpty {
                Section("Providers") {
                    ForEach(s.providers) { p in
                        ShareRow(title: p.name, usd: p.costUSD, totalUSD: s.month.costUSD, currency: currency, rate: rate)
                    }
                }
            }

            Section {
                Button {
                    phone.requestRefresh()
                } label: {
                    if phone.isRequesting {
                        ProgressView()
                    } else {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                }
                .buttonStyle(.glass)
            }
        }
    }
}
