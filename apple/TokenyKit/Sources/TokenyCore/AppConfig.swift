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

    public static let production = AppConfig(
        supabaseURL: URL(string: "https://cfjusewixhycahgxoylm.supabase.co")!,
        anonKey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanVzZXdpeGh5Y2FoZ3hveWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjU4NjYsImV4cCI6MjA5MDU0MTg2Nn0.1AD8jt0ZUoXBtQWyiO2BDn3Bycgmy_RxhMsR-_6cQp8",
        webURL: URL(string: "https://tokeny.martinpohl.cz")!,
        appGroup: "group.cz.martinpohl.tokeny"
    )

    public var authURL: URL { supabaseURL.appending(path: "auth/v1") }
    public var functionsURL: URL { supabaseURL.appending(path: "functions/v1") }

    /// Web account page: plan, billing, provider keys. The apps never sell anything themselves.
    public var accountURL: URL { webURL.appending(path: "settings") }
    public var dashboardURL: URL { webURL.appending(path: "dashboard") }
    /// Where Supabase sends e-mail confirmation / password reset links.
    public var authCallbackURL: URL { webURL.appending(path: "auth/callback") }
}
