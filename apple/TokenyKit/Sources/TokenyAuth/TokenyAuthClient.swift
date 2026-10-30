import Auth
import Foundation
import TokenyCore

public enum TokenyAuthClient {
    /// Info.plist key with the Keychain access group shared by the iPhone app and its widgets,
    /// filled in by XcodeGen as `$(AppIdentifierPrefix)cz.martinpohl.tokeny.shared`.
    public static let keychainGroupInfoKey = "TokenyKeychainGroup"

    /// One client per process. The app uses it to sign in and refresh the session; App Intents
    /// running in the app process reuse it, so two clients never race to rotate the refresh token.
    public static let shared: AuthClient = make(autoRefreshToken: true)

    /// For app extensions (widgets): reads the session the app stored, never refreshes it.
    /// Refresh tokens rotate, so only the app process may use them.
    public static func readOnly() -> AuthClient { make(autoRefreshToken: false) }

    static func make(config: AppConfig = .production, autoRefreshToken: Bool) -> AuthClient {
        AuthClient(
            url: config.authURL,
            headers: ["apikey": config.anonKey],
            flowType: .pkce,
            redirectToURL: config.authCallbackURL,
            storageKey: "tokeny.auth.session",
            localStorage: defaultStorage(),
            autoRefreshToken: autoRefreshToken,
            emitLocalSessionAsInitialSession: true
        )
    }

    static func defaultStorage() -> any AuthLocalStorage {
        #if canImport(Security)
            return KeychainLocalStorage(accessGroup: keychainAccessGroup)
        #else
            return InMemoryAuthStorage()
        #endif
    }

    static var keychainAccessGroup: String? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: keychainGroupInfoKey) as? String,
            !group.isEmpty, !group.hasPrefix("$(")
        else { return nil }
        return group
    }
}

/// Session storage for tests and platforms without a Keychain.
public final class InMemoryAuthStorage: AuthLocalStorage, @unchecked Sendable {
    private let lock = NSLock()
    private var items: [String: Data] = [:]

    public init() {}

    public func store(key: String, value: Data) throws {
        lock.withLock { items[key] = value }
    }

    public func retrieve(key: String) throws -> Data? {
        lock.withLock { items[key] }
    }

    public func remove(key: String) throws {
        lock.withLock { _ = items.removeValue(forKey: key) }
    }
}

extension AuthClient {
    /// Access token of the stored session if it is still valid for at least `margin` seconds,
    /// without refreshing. For widgets and other extensions.
    nonisolated public func storedAccessToken(margin: TimeInterval = 60, now: Date = Date()) -> String? {
        guard let session = currentSession else { return nil }
        guard session.expiresAt - margin > now.timeIntervalSince1970 else { return nil }
        return session.accessToken
    }
}
