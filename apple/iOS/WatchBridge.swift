import Foundation
import TokenyCore
import WatchConnectivity

/// iPhone side of WatchConnectivity. Sends the latest summary (never a token) to the Watch and
/// refreshes when the Watch asks.
@MainActor
final class WatchBridge {
    private let delegate = Delegate()
    private weak var model: AppModel?

    func activate(model: AppModel) {
        guard WCSession.isSupported() else { return }
        self.model = model
        delegate.onEvent = { [weak self] event in
            Task { @MainActor in
                guard let self, let model = self.model else { return }
                if event == .refreshRequested { await model.refresh() }
                self.push(from: model)
            }
        }
        WCSession.default.delegate = delegate
        WCSession.default.activate()
    }

    func push(from model: AppModel) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
        let payload = WatchPayload(cached: model.cached, currency: model.currency, signedIn: model.auth.isSignedIn)
        guard let data = try? payload.encoded() else { return }
        try? session.updateApplicationContext([WatchPayload.contextKey: data])
    }

    /// WCSessionDelegate callbacks arrive on a background queue; only Sendable values leave it.
    private final class Delegate: NSObject, WCSessionDelegate, @unchecked Sendable {
        enum Event: Sendable { case activated, refreshRequested }

        /// Set once before `activate()`.
        var onEvent: (@Sendable (Event) -> Void)?

        func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: (any Error)?) {
            if state == .activated { onEvent?(.activated) }
        }

        func sessionDidBecomeInactive(_ session: WCSession) {}

        func sessionDidDeactivate(_ session: WCSession) {
            session.activate()
        }

        func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
            if message[WatchPayload.refreshRequestKey] != nil { onEvent?(.refreshRequested) }
        }
    }
}
