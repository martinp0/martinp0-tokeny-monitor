import Auth
import Foundation
import Testing

@testable import TokenyAuth

@Suite("Auth client")
struct AuthClientTests {
    @Test func inMemoryStorage() throws {
        let s = InMemoryAuthStorage()
        try s.store(key: "k", value: Data([1, 2]))
        #expect(try s.retrieve(key: "k") == Data([1, 2]))
        try s.remove(key: "k")
        #expect(try s.retrieve(key: "k") == nil)
    }

    @Test func noStoredSessionMeansNoToken() {
        let client = AuthClient(
            url: URL(string: "https://example.supabase.co/auth/v1")!,
            headers: ["apikey": "anon"],
            localStorage: InMemoryAuthStorage(),
            autoRefreshToken: false
        )
        #expect(client.storedAccessToken() == nil)
    }
}
