import Foundation
import Observation
import TokenyCore

/// Sign-in state for the apps. Wraps the shared ``NeonAuthClient``.
@MainActor
@Observable
public final class AuthService {
    public enum State: Equatable, Sendable {
        case unknown
        case signedOut
        case signedIn(userID: String, email: String?)
    }

    public enum SignUpResult: Equatable, Sendable {
        case signedIn
        /// The account needs its e-mail confirmed before the first sign-in.
        case confirmEmail
    }

    public private(set) var state: State = .unknown

    public let client: NeonAuthClient
    private let api: UsageAPI
    private var observing = false

    public init(client: NeonAuthClient = TokenyAuthClient.shared, api: UsageAPI = UsageAPI()) {
        self.client = client
        self.api = api
        if let session = client.currentSession {
            state = .signedIn(userID: session.userID, email: session.email)
        }
    }

    public var isSignedIn: Bool {
        if case .signedIn = state { return true }
        return false
    }

    public var email: String? {
        if case .signedIn(_, let email) = state { return email }
        return nil
    }

    /// Follows sign-in, sign-out and refreshes. Call once from the app's root `.task`.
    /// Also re-checks the stored session with the server once (offline keeps it).
    public func observe() async {
        guard !observing else { return }
        observing = true
        defer { observing = false }
        Task { _ = try? await client.refresh() }
        for await session in client.authStateChanges {
            apply(session)
        }
    }

    public func signIn(email: String, password: String) async throws {
        apply(try await client.signIn(email: normalized(email), password: password))
    }

    public func signUp(email: String, password: String) async throws -> SignUpResult {
        if let session = try await client.signUp(email: normalized(email), password: password) {
            apply(session)
            return .signedIn
        }
        return .confirmEmail
    }

    /// E-mails a reset code; the user sets the new password on the web
    /// (``AppConfig/resetPasswordURL(email:)``).
    public func sendPasswordReset(email: String) async throws {
        try await client.requestPasswordReset(email: normalized(email))
    }

    /// Native Sign in with Apple: pass the identity token from `ASAuthorizationAppleIDCredential`
    /// and the raw nonce whose SHA-256 was put in the Apple request.
    public func signInWithApple(idToken: String, nonce: AppleSignInNonce) async throws {
        apply(try await client.signInWithApple(idToken: idToken, rawNonce: nonce.raw))
    }

    public func signOut() async {
        await client.signOut()
        apply(nil)
    }

    /// Credential for ``UsageAPI`` (the session cookie). Throws `.unauthorized` when signed out
    /// or the session has expired.
    public func accessToken() async throws -> String {
        if let token = client.storedAccessToken() { return token }
        if client.currentSession != nil, let refreshed = try? await client.refresh() {
            return refreshed.cookieHeader
        }
        client.clearLocalSession()
        apply(nil)
        throw UsageAPIError.unauthorized
    }

    /// Deletes the account on the server, then signs out locally.
    public func deleteAccount() async throws {
        try await api.deleteAccount(accessToken: accessToken())
        client.clearLocalSession()
        apply(nil)
    }

    private func apply(_ session: StoredSession?) {
        if let session {
            state = .signedIn(userID: session.userID, email: session.email)
        } else {
            state = .signedOut
        }
    }

    private func normalized(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
