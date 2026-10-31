import Foundation

/// Public endpoints and identifiers shared by every target. Nothing here is a secret: the Supabase
/// URL and the publishable (anon) key are the same values the web app ships in its JS bundle.
public struct AppConfig: Sendable, Equatable {
    public var supabaseURL: URL
    public var anonKey: String
    public var webURL: URL
    /// App Group shared by the iPhone app and its widgets (and, separately, the Watch app and its
    /// complication). Holds only non-secret data: the cached summary and preferences.
    public var appGroup: String

    public init(supabaseURL: URL, anonKey: String, webURL: URL, appGroup: String) {
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
        self.webURL = webURL
        self.appGroup = appGroup
    }

    /// Built-in fallback, used by SwiftPM tests and when a bundle carries no backend keys.
    public static let fallbackSupabaseHost = "cfjusewixhycahgxoylm.supabase.co"
    public static let fallbackAnonKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanVzZXdpeGh5Y2FoZ3hveWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjU4NjYsImV4cCI6MjA5MDU0MTg2Nn0.1AD8jt0ZUoXBtQWyiO2BDn3Bycgmy_RxhMsR-_6cQp8"

    /// The backend comes from the `TokenySupabaseHost` / `TokenySupabaseAnonKey` Info.plist keys,
    /// which Xcode fills from `apple/Config/Backend.xcconfig`. Moving the backend is a config
    /// change, not a code change.
    public static let production = AppConfig.fromInfo(Bundle.main.infoDictionary ?? [:])

    /// Builds the config from Info.plist values, falling back to the built-in backend for any key
    /// that is missing, empty, or still an unexpanded `$(…)` build setting.
    public static func fromInfo(_ info: [String: Any]) -> AppConfig {
        func value(_ key: String) -> String? {
            guard let raw = (info[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !raw.isEmpty, !raw.hasPrefix("$(") else { return nil }
            return raw
        }
        var host = value("TokenySupabaseHost") ?? fallbackSupabaseHost
        if let range = host.range(of: "://") { host = String(host[range.upperBound...]) }
        while host.hasSuffix("/") { host.removeLast() }
        let url = URL(string: "https://\(host)") ?? URL(string: "https://\(fallbackSupabaseHost)")!
        return AppConfig(
            supabaseURL: url,
            anonKey: value("TokenySupabaseAnonKey") ?? fallbackAnonKey,
            webURL: URL(string: "https://tokeny.martinpohl.cz")!,
            appGroup: "group.cz.martinpohl.tokeny"
        )
    }

    public var authURL: URL { supabaseURL.appending(path: "auth/v1") }
    public var functionsURL: URL { supabaseURL.appending(path: "functions/v1") }

    /// Web account page: plan, billing, provider keys. The apps never sell anything themselves.
    public var accountURL: URL { webURL.appending(path: "settings") }
    /// Account page without anything to buy (see ``PurchaseLinkPolicy``).
    public var profileURL: URL { webURL.appending(path: "profile") }
    public var dashboardURL: URL { webURL.appending(path: "dashboard") }
    /// Where Supabase sends e-mail confirmation / password reset links.
    public var authCallbackURL: URL { webURL.appending(path: "auth/callback") }
}
