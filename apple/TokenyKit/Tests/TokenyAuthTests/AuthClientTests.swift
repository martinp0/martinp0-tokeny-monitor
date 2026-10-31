import Foundation
import Testing
import TokenyCore

@testable import TokenyAuth

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

private let config = AppConfig(webURL: URL(string: "https://tokeny.example")!, appGroup: "group.test")

private final class Recorder: @unchecked Sendable {
    var requests: [URLRequest] = []
}

private func transport(
    _ rec: Recorder, status: Int = 200, body: String, headers: [String: String] = [:]
) -> NeonAuthClient.Transport {
    { req in
        rec.requests.append(req)
        let res = HTTPURLResponse(url: req.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        return (Data(body.utf8), res)
    }
}

private let signInBody = #"{"token":"raw","user":{"id":"7f6c2b1e-1111-4222-8333-444455556666","email":"a@b.cz"}}"#
private let cookie = "__Secure-neon-auth.session_token=tok.sig; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax"

@Suite("Neon Auth client")
struct AuthClientTests {
    @Test func inMemoryStorage() {
        let s = InMemoryAuthStorage()
        #expect(s.load() == nil)
        let session = StoredSession(cookieName: "n", cookieValue: "v", userID: "u", email: nil, expiresAt: nil)
        s.save(session)
        #expect(s.load() == session)
        s.save(nil)
        #expect(s.load() == nil)
    }

    @Test func noStoredSessionMeansNoToken() {
        let client = NeonAuthClient(config: config, storage: InMemoryAuthStorage())
        #expect(client.storedAccessToken() == nil)
    }

    @Test func expiredSessionMeansNoToken() {
        let past = StoredSession(cookieName: "n", cookieValue: "v", userID: "u", email: nil, expiresAt: Date(timeIntervalSinceNow: -10))
        #expect(NeonAuthClient(config: config, storage: InMemoryAuthStorage(past)).storedAccessToken() == nil)
        let ok = StoredSession(cookieName: "n", cookieValue: "v", userID: "u", email: nil, expiresAt: Date(timeIntervalSinceNow: 3600))
        #expect(NeonAuthClient(config: config, storage: InMemoryAuthStorage(ok)).storedAccessToken() == "n=v")
    }

    @Test func signInStoresSessionCookie() async throws {
        let rec = Recorder()
        let storage = InMemoryAuthStorage()
        let client = NeonAuthClient(config: config, storage: storage, transport: transport(rec, body: signInBody, headers: ["Set-Cookie": cookie]))
        let s = try await client.signIn(email: "a@b.cz", password: "secret123")
        #expect(s.cookieHeader == "__Secure-neon-auth.session_token=tok.sig")
        #expect(s.userID == "7f6c2b1e-1111-4222-8333-444455556666")
        #expect(storage.load() == s)
        let req = try #require(rec.requests.first)
        #expect(req.url?.absoluteString == "https://tokeny.example/api/auth/sign-in/email")
        #expect(req.httpMethod == "POST")
        #expect(req.value(forHTTPHeaderField: "Origin") == "https://tokeny.example")
        #expect(req.httpShouldHandleCookies == false)
        let body = try JSONSerialization.jsonObject(with: req.httpBody ?? Data()) as? [String: String]
        #expect(body?["email"] == "a@b.cz")
    }

    @Test func wrongPasswordThrowsBetterAuthCode() async {
        let rec = Recorder()
        let client = NeonAuthClient(
            config: config, storage: InMemoryAuthStorage(),
            transport: transport(rec, status: 401, body: #"{"code":"INVALID_EMAIL_OR_PASSWORD","message":"Invalid email or password"}"#))
        await #expect(throws: NeonAuthError(status: 401, code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password")) {
            try await client.signIn(email: "a@b.cz", password: "x")
        }
    }

    @Test func signUpWithoutCookieNeedsConfirmation() async throws {
        let rec = Recorder()
        let client = NeonAuthClient(config: config, storage: InMemoryAuthStorage(), transport: transport(rec, body: signInBody))
        #expect(try await client.signUp(email: "a@b.cz", password: "secret123") == nil)
        let body = try JSONSerialization.jsonObject(with: rec.requests[0].httpBody ?? Data()) as? [String: String]
        #expect(body?["name"] == "a")
    }

    @Test func refreshClearsRevokedSession() async throws {
        let rec = Recorder()
        let start = StoredSession(cookieName: "__Secure-neon-auth.session_token", cookieValue: "v", userID: "u", email: nil, expiresAt: nil)
        let storage = InMemoryAuthStorage(start)
        let client = NeonAuthClient(config: config, storage: storage, transport: transport(rec, body: "null"))
        #expect(try await client.refresh() == nil)
        #expect(storage.load() == nil)
        #expect(rec.requests.first?.value(forHTTPHeaderField: "Cookie") == "__Secure-neon-auth.session_token=v")
    }

    @Test func refreshUpdatesExpiry() async throws {
        let rec = Recorder()
        let start = StoredSession(cookieName: "__Secure-neon-auth.session_token", cookieValue: "v", userID: "u", email: nil, expiresAt: nil)
        let storage = InMemoryAuthStorage(start)
        let body = #"{"session":{"expiresAt":"2030-01-02T03:04:05.000Z"},"user":{"id":"u2","email":"x@y.cz"}}"#
        let client = NeonAuthClient(config: config, storage: storage, transport: transport(rec, body: body))
        let s = try #require(try await client.refresh())
        #expect(s.userID == "u2")
        #expect(s.email == "x@y.cz")
        #expect(s.expiresAt == Date(timeIntervalSince1970: 1_893_553_445))
    }

    @Test func signOutAlwaysClearsLocally() async {
        let rec = Recorder()
        let start = StoredSession(cookieName: "n", cookieValue: "v", userID: "u", email: nil, expiresAt: nil)
        let storage = InMemoryAuthStorage(start)
        let client = NeonAuthClient(config: config, storage: storage, transport: { _ in throw URLError(.notConnectedToInternet) })
        await client.signOut()
        #expect(storage.load() == nil)
        _ = rec
    }

    @Test func appleSignInSendsIdTokenAndNonce() async throws {
        let rec = Recorder()
        let client = NeonAuthClient(
            config: config, storage: InMemoryAuthStorage(), transport: transport(rec, body: signInBody, headers: ["Set-Cookie": cookie]))
        _ = try await client.signInWithApple(idToken: "idtok", rawNonce: "n0nce")
        let req = try #require(rec.requests.first)
        #expect(req.url?.path == "/api/auth/sign-in/social")
        let body = try JSONSerialization.jsonObject(with: req.httpBody ?? Data()) as? [String: Any]
        #expect(body?["provider"] as? String == "apple")
        let id = body?["idToken"] as? [String: String]
        #expect(id?["token"] == "idtok")
        #expect(id?["nonce"] == "n0nce")
    }
}
