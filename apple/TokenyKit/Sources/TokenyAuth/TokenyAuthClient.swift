import Foundation
import TokenyCore

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif
#if canImport(Security)
    import Security
#endif

/// The signed-in Neon Auth (Better Auth) session as the apps keep it in the Keychain.
/// `cookieName=cookieValue` is the session-token cookie our `/api/auth/*` proxy sets; the apps send
/// it by hand (never through URLSession's cookie jar) to `/api/*`.
public struct StoredSession: Codable, Sendable, Equatable {
    public var cookieName: String
    public var cookieValue: String
    public var userID: String
    public var email: String?
    /// When the session cookie stops being valid (Better Auth extends it while in use).
    public var expiresAt: Date?

    public init(cookieName: String, cookieValue: String, userID: String, email: String?, expiresAt: Date?) {
        self.cookieName = cookieName
        self.cookieValue = cookieValue
        self.userID = userID
        self.email = email
        self.expiresAt = expiresAt
    }

    /// Value for the `Cookie` request header.
    public var cookieHeader: String { "\(cookieName)=\(cookieValue)" }
}

/// Where the session lives. Keychain on Apple platforms, memory in tests and on Linux.
public protocol AuthSessionStorage: Sendable {
    func load() -> StoredSession?
    func save(_ session: StoredSession?)
}

/// Session storage for tests and platforms without a Keychain.
public final class InMemoryAuthStorage: AuthSessionStorage, @unchecked Sendable {
    private let lock = NSLock()
    private var session: StoredSession?

    public init(_ session: StoredSession? = nil) { self.session = session }

    public func load() -> StoredSession? { lock.withLock { session } }
    public func save(_ session: StoredSession?) { lock.withLock { self.session = session } }
}

#if canImport(Security)
    /// Generic-password Keychain item, optionally in the access group shared with the widgets.
    public struct KeychainAuthStorage: AuthSessionStorage {
        public let service: String
        public let account: String
        public let accessGroup: String?

        public init(service: String = "cz.martinpohl.tokeny.auth", account: String = "tokeny.auth.session", accessGroup: String?) {
            self.service = service
            self.account = account
            self.accessGroup = accessGroup
        }

        private var baseQuery: [String: Any] {
            var q: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
            ]
            if let accessGroup { q[kSecAttrAccessGroup as String] = accessGroup }
            return q
        }

        public func load() -> StoredSession? {
            var q = baseQuery
            q[kSecReturnData as String] = true
            q[kSecMatchLimit as String] = kSecMatchLimitOne
            var out: CFTypeRef?
            guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
            return try? JSONDecoder().decode(StoredSession.self, from: data)
        }

        public func save(_ session: StoredSession?) {
            SecItemDelete(baseQuery as CFDictionary)
            guard let session, let data = try? JSONEncoder().encode(session) else { return }
            var q = baseQuery
            q[kSecValueData as String] = data
            // Widgets refresh in the background, so the item must be readable after first unlock.
            q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(q as CFDictionary, nil)
        }
    }
#endif

public enum TokenyAuthClient {
    /// Info.plist key with the Keychain access group shared by the iPhone app and its widgets,
    /// filled in by XcodeGen as `$(AppIdentifierPrefix)cz.martinpohl.tokeny.shared`.
    public static let keychainGroupInfoKey = "TokenyKeychainGroup"

    /// One client per process. The app signs in and refreshes with it; App Intents in the app
    /// process reuse it.
    public static let shared = NeonAuthClient(storage: defaultStorage())

    /// For app extensions (widgets): reads the session the app stored.
    public static func readOnly() -> NeonAuthClient { NeonAuthClient(storage: defaultStorage()) }

    static func defaultStorage() -> any AuthSessionStorage {
        #if canImport(Security)
            return KeychainAuthStorage(accessGroup: keychainAccessGroup)
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
