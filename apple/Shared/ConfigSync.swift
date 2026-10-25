#if os(iOS) || os(watchOS)
import Foundation
import WatchConnectivity
import WidgetKit

/// iPhone → Watch: server URL, currency and token over WatchConnectivity (encrypted between the
/// paired devices). The Watch stores the token in its own Keychain for the app and complication.
final class ConfigSync: NSObject, WCSessionDelegate {
    static let shared = ConfigSync()

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    #if os(iOS)
    func pushToWatch() {
        let s = WCSession.default
        guard WCSession.isSupported(), s.activationState == .activated, s.isPaired, s.isWatchAppInstalled else { return }
        var ctx: [String: Any] = [
            "serverURL": TokenySettings.serverURL.absoluteString,
            "currency": TokenySettings.currency.rawValue,
        ]
        if let t = Keychain.readToken() { ctx["token"] = t }
        try? s.updateApplicationContext(ctx)
    }
    #endif

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        #if os(iOS)
        pushToWatch()
        #else
        apply(session.receivedApplicationContext)
        #endif
    }

    #if os(iOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
    func sessionWatchStateDidChange(_ session: WCSession) { pushToWatch() }
    #else
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }

    private func apply(_ ctx: [String: Any]) {
        guard !ctx.isEmpty else { return }
        if let s = ctx["serverURL"] as? String, let u = TokenySettings.normalize(s) { TokenySettings.serverURL = u }
        if let c = (ctx["currency"] as? String).flatMap(Currency.init(rawValue:)) { TokenySettings.currency = c }
        Keychain.saveToken(ctx["token"] as? String)
        TokenySettings.lastSummary = nil
        WidgetCenter.shared.reloadAllTimelines()
        DispatchQueue.main.async { NotificationCenter.default.post(name: .tokenyConfigChanged, object: nil) }
    }
    #endif
}

extension Notification.Name {
    static let tokenyConfigChanged = Notification.Name("tokenyConfigChanged")
}
#endif
