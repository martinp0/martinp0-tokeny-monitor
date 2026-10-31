import Foundation
import TokenyCore

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// Error from Neon Auth (Better Auth). `code` is Better Auth's error code, e.g.
/// `INVALID_EMAIL_OR_PASSWORD`, `USER_ALREADY_EXISTS`, `PASSWORD_TOO_SHORT`, `EMAIL_NOT_VERIFIED`.
public struct NeonAuthError: Error, Equatable, Sendable, CustomStringConvertible {
    public var status: Int
    public var code: String?
    public var message: String?

    public init(status: Int, code: String?, message: String?) {
        self.status = status
        self.code = code
        self.message = message
    }

    public var description: String { "NeonAuthError(\(status), \(code ?? "-"), \(message ?? "-"))" }
}

/// Minimal Better Auth client for the apps, over the same-origin proxy at `<web>/api/auth/*`.
/// Foundation only. The session-token cookie from the sign-in response is kept in
/// ``AuthSessionStorage`` and sent by hand as `Cookie` to `/api/*`.
public final class NeonAuthClient: @unchecked Sendable {
    public typealias Transport = @Sendable (URLRequest) async throws -> (Data, URLResponse)

    /// Better Auth's session cookie ends in `session_token` (`__Secure-neon-auth.session_token`).
    static let sessionCookieSuffix = "session_token"

    public let config: AppConfig
    private let storage: any AuthSessionStorage
    private let transport: Transport
    private let lock = NSLock()
    private var continuations: [UUID: AsyncStream<StoredSession?>.Continuation] = [:]

    public init(config: AppConfig = .production, storage: any AuthSessionStorage, transport: Transport? = nil) {
        self.config = config
        self.storage = storage
        self.transport = transport ?? { request in try await URLSession.shared.data(for: request) }
    }

    // MARK: State

    public var currentSession: StoredSession? { storage.load() }

    /// Emits the current session first, then every change (sign-in, refresh, sign-out).
    public var authStateChanges: AsyncStream<StoredSession?> {
        AsyncStream { continuation in
            let id = UUID()
            lock.withLock { continuations[id] = continuation }
            continuation.yield(storage.load())
            continuation.onTermination = { [weak self] _ in
                guard let self else { return }
                _ = self.lock.withLock { self.continuations.removeValue(forKey: id) }
            }
        }
    }

    /// Credential for `/api/*` if the stored session is still valid for at least `margin` seconds.
    /// No network. For widgets and other extensions.
    public func storedAccessToken(margin: TimeInterval = 60, now: Date = Date()) -> String? {
        guard let s = storage.load() else { return nil }
        if let exp = s.expiresAt, exp.timeIntervalSince(now) <= margin { return nil }
        return s.cookieHeader
    }

    // MARK: Sign-in

    @discardableResult
    public func signIn(email: String, password: String) async throws -> StoredSession {
        try await authenticate(path: "sign-in/email", body: ["email": email, "password": password])
    }

    /// Returns nil when the account was created but needs e-mail verification before sign-in.
    @discardableResult
    public func signUp(email: String, password: String, name: String? = nil) async throws -> StoredSession? {
        let display = name ?? String(email.split(separator: "@").first ?? "")
        do {
            return try await authenticate(path: "sign-up/email", body: ["email": email, "password": password, "name": display])
        } catch NeonAuthClientInternal.noSessionCookie {
            return nil
        }
    }

    /// Native Sign in with Apple: the identity token and the raw nonce (Better Auth checks it).
    @discardableResult
    public func signInWithApple(idToken: String, rawNonce: String) async throws -> StoredSession {
        try await authenticate(
            path: "sign-in/social",
            body: ["provider": "apple", "idToken": ["token": idToken, "nonce": rawNonce]]
        )
    }

    /// Sends a reset code by e-mail. The user finishes on the web (`/reset-password`).
    public func requestPasswordReset(email: String) async throws {
        let (status, data, _) = try await post("email-otp/request-password-reset", body: ["email": email], cookie: nil)
        if status == 404 {
            // Older Better Auth releases name the endpoint differently.
            let (s2, d2, _) = try await post("forget-password/email-otp", body: ["email": email], cookie: nil)
            try Self.check(status: s2, data: d2)
            return
        }
        try Self.check(status: status, data: data)
    }

    /// Re-reads the session from the server. Clears it locally when the server says it is gone;
    /// keeps it when offline.
    @discardableResult
    public func refresh() async throws -> StoredSession? {
        guard let s = storage.load() else { return nil }
        var req = request("get-session")
        req.httpMethod = "GET"
        req.setValue(s.cookieHeader, forHTTPHeaderField: "Cookie")
        let (data, response) = try await transport(req)
        guard let http = response as? HTTPURLResponse else { throw NeonAuthError(status: 0, code: nil, message: "bad response") }
        if http.statusCode == 401 { update(nil); return nil }
        try Self.check(status: http.statusCode, data: data)
        guard let info = Self.sessionInfo(data) else { update(nil); return nil }
        var next = s
        if let c = Self.sessionCookie(from: http) {
            next.cookieName = c.name
            next.cookieValue = c.value
            next.expiresAt = c.expiresDate ?? next.expiresAt
        }
        next.userID = info.userID
        next.email = info.email
        if let exp = info.expiresAt { next.expiresAt = exp }
        update(next)
        return next
    }

    /// Signs out on the server (best effort) and always locally.
    public func signOut() async {
        if let s = storage.load() {
            _ = try? await post("sign-out", body: [:], cookie: s.cookieHeader)
        }
        update(nil)
    }

    public func clearLocalSession() { update(nil) }

    // MARK: Internals

    private func authenticate(path: String, body: [String: Any]) async throws -> StoredSession {
        let (status, data, http) = try await post(path, body: body, cookie: nil)
        try Self.check(status: status, data: data)
        guard let cookie = Self.sessionCookie(from: http) else { throw NeonAuthClientInternal.noSessionCookie }
        let info = Self.sessionInfo(data)
        guard let userID = info?.userID else { throw NeonAuthError(status: status, code: "NO_USER", message: nil) }
        let session = StoredSession(
            cookieName: cookie.name, cookieValue: cookie.value, userID: userID,
            email: info?.email, expiresAt: cookie.expiresDate ?? info?.expiresAt
        )
        update(session)
        return session
    }

    private func update(_ session: StoredSession?) {
        storage.save(session)
        let conts = lock.withLock { Array(continuations.values) }
        for c in conts { c.yield(session) }
    }

    func request(_ path: String) -> URLRequest {
        var req = URLRequest(url: config.authURL.appending(path: path))
        req.timeoutInterval = 20
        req.httpShouldHandleCookies = false
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        return req
    }

    private func post(_ path: String, body: [String: Any], cookie: String?) async throws -> (Int, Data, HTTPURLResponse) {
        var req = request(path)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Better Auth checks Origin on POSTs; our proxy also falls back to its own origin.
        req.setValue(config.webURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forHTTPHeaderField: "Origin")
        if let cookie { req.setValue(cookie, forHTTPHeaderField: "Cookie") }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await transport(req)
        guard let http = response as? HTTPURLResponse else { throw NeonAuthError(status: 0, code: nil, message: "bad response") }
        return (http.statusCode, data, http)
    }

    static func check(status: Int, data: Data) throws {
        guard !(200..<300).contains(status) else { return }
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        throw NeonAuthError(status: status, code: obj?["code"] as? String, message: obj?["message"] as? String)
    }

    struct SessionInfo: Equatable {
        var userID: String
        var email: String?
        var expiresAt: Date?
    }

    /// `{user:{id,email}, session?:{expiresAt}}` (sign-in, sign-up, get-session).
    static func sessionInfo(_ data: Data) -> SessionInfo? {
        guard let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
            let user = obj["user"] as? [String: Any], let id = user["id"] as? String, !id.isEmpty
        else { return nil }
        var exp: Date?
        if let s = (obj["session"] as? [String: Any])?["expiresAt"] as? String {
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            exp = f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
        }
        return SessionInfo(userID: id, email: user["email"] as? String, expiresAt: exp)
    }

    /// The session-token cookie from a response's `Set-Cookie` headers (nil if absent or cleared).
    static func sessionCookie(from http: HTTPURLResponse) -> HTTPCookie? {
        var fields: [String: String] = [:]
        for (k, v) in http.allHeaderFields {
            if let k = k as? String, let v = v as? String { fields[k] = v }
        }
        let url = http.url ?? URL(string: "https://localhost")!
        return HTTPCookie.cookies(withResponseHeaderFields: fields, for: url)
            .first { $0.name.hasSuffix(sessionCookieSuffix) && !$0.value.isEmpty }
    }
}

enum NeonAuthClientInternal: Error {
    /// Sign-up succeeded but no session yet (e-mail verification required).
    case noSessionCookie
}
