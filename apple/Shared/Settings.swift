import Foundation

enum Currency: String, Codable, CaseIterable, Sendable { case CZK, USD }

/// Non-secret settings. On iPhone/Watch they live in the App Group so the widget sees them.
enum TokenySettings {
    static let appGroup = "group.cz.martinpohl.tokeny"
    /// Public Supabase project URL of tokeny.pohl.uk (same as VITE_SUPABASE_URL; not a secret).
    static let defaultServer = URL(string: "https://cfjusewixhycahgxoylm.supabase.co")!

    static var defaults: UserDefaults {
        #if os(macOS)
        return .standard
        #else
        return UserDefaults(suiteName: appGroup) ?? .standard
        #endif
    }

    static var serverURL: URL {
        get { defaults.string(forKey: "serverURL").flatMap(URL.init(string:)) ?? defaultServer }
        set { defaults.set(newValue == defaultServer ? nil : newValue.absoluteString, forKey: "serverURL") }
    }

    static var currency: Currency {
        get { defaults.string(forKey: "currency").flatMap(Currency.init(rawValue:)) ?? .CZK }
        set { defaults.set(newValue.rawValue, forKey: "currency") }
    }

    static var lastSummary: UsageSummary? {
        get { defaults.data(forKey: "lastSummary").flatMap { try? JSONDecoder().decode(UsageSummary.self, from: $0) } }
        set { defaults.set(newValue.flatMap { try? JSONEncoder().encode($0) }, forKey: "lastSummary") }
    }

    static var isConfigured: Bool { Keychain.readToken() != nil }

    /// https only. Accepts "xyz.supabase.co" or a full URL; strips a trailing "/functions/v1".
    static func normalize(_ input: String) -> URL? {
        var s = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return nil }
        if !s.contains("://") { s = "https://" + s }
        while s.hasSuffix("/") { s.removeLast() }
        if s.hasSuffix("/functions/v1") { s.removeLast("/functions/v1".count) }
        guard let url = URL(string: s), url.scheme?.lowercased() == "https", url.host != nil else { return nil }
        return url
    }
}
