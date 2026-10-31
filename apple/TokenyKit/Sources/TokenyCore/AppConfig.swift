import Foundation

/// Public endpoints and identifiers shared by every target. Nothing here is a secret.
///
/// Since the move to Neon the apps talk only to the web origin: the API lives at `/api/*` and
/// sign-in goes through the same-origin Neon Auth proxy at `/api/auth/*` (see server/auth.ts).
public struct AppConfig: Sendable, Equatable {
    public var webURL: URL
    /// App Group shared by the iPhone app and its widgets (and, separately, the Watch app and its
    /// complication). Holds only non-secret data: the cached summary and preferences.
    public var appGroup: String

    public init(webURL: URL, appGroup: String) {
        self.webURL = webURL
        self.appGroup = appGroup
    }

    /// Built-in fallback, used by SwiftPM tests and when a bundle carries no `TokenyWebHost` key.
    public static let fallbackWebHost = "tokeny.martinpohl.cz"

    /// The origin comes from the `TokenyWebHost` Info.plist key, which Xcode fills from
    /// `apple/Config/Backend.xcconfig`. Moving the backend is a config change, not a code change.
    public static let production = AppConfig.fromInfo(Bundle.main.infoDictionary ?? [:])

    /// Builds the config from Info.plist values, falling back to the built-in origin when the key
    /// is missing, empty, or still an unexpanded `$(…)` build setting.
    public static func fromInfo(_ info: [String: Any]) -> AppConfig {
        var host = (info["TokenyWebHost"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if host.isEmpty || host.hasPrefix("$(") { host = fallbackWebHost }
        if let range = host.range(of: "://") { host = String(host[range.upperBound...]) }
        while host.hasSuffix("/") { host.removeLast() }
        let url = URL(string: "https://\(host)") ?? URL(string: "https://\(fallbackWebHost)")!
        return AppConfig(webURL: url, appGroup: "group.cz.martinpohl.tokeny")
    }

    /// Tokeny API (one Vercel Function, `api/index.ts`).
    public var apiURL: URL { webURL.appending(path: "api") }
    /// Neon Auth (Better Auth) through the same-origin proxy.
    public var authURL: URL { apiURL.appending(path: "auth") }

    /// Web account page: plan, billing, provider keys. The apps never sell anything themselves.
    public var accountURL: URL { webURL.appending(path: "settings") }
    /// Account page without anything to buy (see ``PurchaseLinkPolicy``).
    public var profileURL: URL { webURL.appending(path: "profile") }
    public var dashboardURL: URL { webURL.appending(path: "dashboard") }
    /// Where the web finishes OAuth sign-ins.
    public var authCallbackURL: URL { webURL.appending(path: "auth/callback") }
    /// Web page where the user enters the e-mailed reset code and a new password.
    public func resetPasswordURL(email: String) -> URL {
        var comps = URLComponents(url: webURL.appending(path: "reset-password"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "email", value: email)]
        return comps.url!
    }
}
