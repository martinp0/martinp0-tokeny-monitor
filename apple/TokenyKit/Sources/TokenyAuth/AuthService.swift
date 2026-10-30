import Auth
import Foundation
import Observation
import TokenyCore

/// Sign-in state for the apps. Wraps the shared Supabase ``AuthClient``.
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
        /// Supabase sent a confirmation e-mail; the user signs in after confirming.
        case confirmEmail
    }

    public private(set) var state: State = .unknown

    public let client: AuthClient
    private let api: UsageAPI
    private var observing = false

    public init(client: AuthClient = TokenyAuthClient.shared, api: UsageAPI = UsageAPI()) {
        self.client = client
        self.api = api
        if let session = client.currentSession {
            state = .signedIn(userID: session.user.id.uuidString, email: session.user.email)
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

    /// Follows sign-in, sign-out and token refreshes. Call once from the app's root `.task`.
    public func observe() async {
        guard !observing else { return }
        observing = true
        defer { observing = false }
        for await change in client.authStateChanges {
            apply(change.session)
        }
    }

    public func signIn(email: String, password: String) async throws {
        let session = try await client.signIn(email: normalized(email), password: password)
        apply(session)
    }

    public func signUp(email: String, password: String) async throws -> SignUpResult {
        let response = try await client.signUp(
            email: normalized(email), password: password, redirectTo: api.config.authCallbackURL
        )
        switch response {
        case .session(let session):
            apply(session)
            return .signedIn
        case .user:
            return .confirmEmail
        }
    }

    public func sendPasswordReset(email: String) async throws {
        try await client.resetPasswordForEmail(normalized(email), redirectTo: api.config.webURL.appending(path: "reset-password"))
    }

    /// Native Sign in with Apple: pass the identity token from `ASAuthorizationAppleIDCredential`
    /// and the raw nonce whose SHA-256 was put in the Apple request.
    public func signInWithApple(idToken: String, nonce: AppleSignInNonce) async throws {
        let session = try await client.signInWithIdToken(
            credentials: OpenIDConnectCredentials(provider: .apple, idToken: idToken, nonce: nonce.raw)
        )
        apply(session)
    }

    public func signOut() async {
        // Local sign-out even if the network call fails (e.g. offline).
        try? await client.signOut(scope: .local)
        apply(nil)
    }

    /// A valid access token, refreshing the session if needed.
    public func accessToken() async throws -> String {
        do {
            return try await client.session.accessToken
        } catch {
            if client.currentSession == nil { apply(nil) }
            throw UsageAPIError.unauthorized
        }
    }

    /// Deletes the account on the server, then signs out locally.
    public func deleteAccount() async throws {
        try await api.deleteAccount(accessToken: accessToken())
        await signOut()
    }

    private func apply(_ session: Session?) {
        if let session {
            state = .signedIn(userID: session.user.id.uuidString, email: session.user.email)
        } else {
            state = .signedOut
        }
    }

    private func normalized(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
