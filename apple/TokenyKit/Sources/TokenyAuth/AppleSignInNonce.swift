import Crypto
import Foundation

/// Nonce for Sign in with Apple: Apple gets the SHA-256 (in `ASAuthorizationAppleIDRequest.nonce`),
/// Supabase gets the raw value and checks that it matches the `nonce` claim of the ID token.
public struct AppleSignInNonce: Sendable, Equatable {
    public let raw: String
    public var sha256: String { Self.sha256Hex(raw) }

    public init(raw: String) {
        self.raw = raw
    }

    public static func random(length: Int = 32) -> AppleSignInNonce {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var rng = SystemRandomNumberGenerator()
        let raw = String((0..<max(16, length)).map { _ in charset[Int(rng.next(upperBound: UInt32(charset.count)))] })
        return AppleSignInNonce(raw: raw)
    }

    public static func sha256Hex(_ string: String) -> String {
        SHA256.hash(data: Data(string.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
