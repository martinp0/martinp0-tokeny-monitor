import Foundation
import Security

/// The personal API token lives only in the Keychain: never in UserDefaults, files, logs or git.
/// iPhone/Watch: shared access group with the widget (Info.plist key TokenyKeychainGroup, filled by
/// XcodeGen from $(AppIdentifierPrefix)). macOS: the app's own login-keychain item.
enum Keychain {
    private static let service = "cz.martinpohl.tokeny.api"
    private static let account = "api-token"

    private static var accessGroup: String? {
        guard let g = Bundle.main.object(forInfoDictionaryKey: "TokenyKeychainGroup") as? String,
              !g.isEmpty, !g.hasPrefix("$(") else { return nil }
        return g
    }

    private static func baseQuery() -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        if let accessGroup { q[kSecAttrAccessGroup as String] = accessGroup }
        return q
    }

    static func readToken() -> String? {
        var q = baseQuery()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    static func saveToken(_ token: String?) -> Bool {
        SecItemDelete(baseQuery() as CFDictionary)
        guard let token, !token.isEmpty else { return true }
        var q = baseQuery()
        q[kSecValueData as String] = Data(token.utf8)
        #if !os(macOS)
        // Widgets refresh in the background; never synced to iCloud.
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        #endif
        return SecItemAdd(q as CFDictionary, nil) == errSecSuccess
    }
}
