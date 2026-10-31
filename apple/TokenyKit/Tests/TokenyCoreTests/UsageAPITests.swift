import Foundation
import Testing

@testable import TokenyCore

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

private let config = AppConfig(webURL: URL(string: "https://tokeny.example")!, appGroup: "group.test")

private func stub(status: Int, body: Data, capture: (@Sendable (URLRequest) -> Void)? = nil) -> UsageAPI.Transport {
    { request in
        capture?(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        return (body, response)
    }
}

private final class Box: @unchecked Sendable {
    var request: URLRequest?
}

@Suite("UsageAPI")
struct UsageAPITests {
    @Test func buildsSummaryRequest() throws {
        let api = UsageAPI(config: config)
        let req = api.summaryRequest(accessToken: "jwt123", timeZone: TimeZone(identifier: "Europe/Prague")!)
        #expect(req.httpMethod == "GET")
        #expect(req.url?.absoluteString == "https://tokeny.example/api/usage-summary?tz=Europe/Prague")
        #expect(req.value(forHTTPHeaderField: "Authorization") == "Bearer jwt123")
        #expect(req.value(forHTTPHeaderField: "Cookie") == nil)
        #expect(req.httpShouldHandleCookies == false)
    }

    @Test func sessionCookieGoesInCookieHeader() {
        let req = UsageAPI(config: config).summaryRequest(accessToken: "__Secure-neon-auth.session_token=abc.def")
        #expect(req.value(forHTTPHeaderField: "Cookie") == "__Secure-neon-auth.session_token=abc.def")
        #expect(req.value(forHTTPHeaderField: "Authorization") == nil)
    }

    @Test func fetchesAndDecodes() async throws {
        let box = Box()
        let api = UsageAPI(config: config, transport: stub(status: 200, body: Fixtures.proSummary) { box.request = $0 })
        let s = try await api.fetchSummary(accessToken: "t", timeZone: TimeZone(identifier: "UTC")!)
        #expect(s.month.costUSD == 38.2)
        #expect(box.request?.url?.query == "tz=UTC" || box.request?.url?.query == "tz=GMT")
    }

    @Test func mapsErrors() async {
        let cases: [(Int, String, UsageAPIError)] = [
            (401, #"{"error":"Unauthorized"}"#, .unauthorized),
            (403, #"{"error":"pro_required","feature":"mcp"}"#, .proRequired),
            (403, #"{"error":"Forbidden"}"#, .unauthorized),
            (404, "", .notDeployed),
            (500, #"{"error":"Internal server error"}"#, .server(status: 500)),
        ]
        for (status, body, expected) in cases {
            let api = UsageAPI(config: config, transport: stub(status: status, body: Data(body.utf8)))
            await #expect(throws: expected) { try await api.fetchSummary(accessToken: "t") }
        }
    }

    @Test func networkFailureIsOffline() async {
        let api = UsageAPI(config: config, transport: { _ in throw URLError(.notConnectedToInternet) })
        await #expect(throws: UsageAPIError.offline) { try await api.fetchSummary(accessToken: "t") }
    }

    @Test func cancellationIsNotAnError() async {
        let api = UsageAPI(config: config, transport: { _ in throw URLError(.cancelled) })
        await #expect(throws: CancellationError.self) { try await api.fetchSummary(accessToken: "t") }
    }

    @Test func deleteAccountPosts() async throws {
        let box = Box()
        let api = UsageAPI(
            config: config, transport: stub(status: 200, body: Data(#"{"success":true}"#.utf8)) { box.request = $0 })
        try await api.deleteAccount(accessToken: "jwt")
        #expect(box.request?.httpMethod == "POST")
        #expect(box.request?.url?.path == "/api/account/delete")
        #expect(box.request?.value(forHTTPHeaderField: "Authorization") == "Bearer jwt")
    }

    @Test func configURLs() {
        #expect(config.apiURL.absoluteString == "https://tokeny.example/api")
        #expect(config.authURL.absoluteString == "https://tokeny.example/api/auth")
        #expect(config.accountURL.absoluteString == "https://tokeny.example/settings")
        #expect(config.resetPasswordURL(email: "a@b.cz").absoluteString == "https://tokeny.example/reset-password?email=a@b.cz")
        #expect(AppConfig.production.webURL.host == "tokeny.martinpohl.cz")
    }

    @Test func configFromInfoPlist() {
        #expect(AppConfig.fromInfo(["TokenyWebHost": "tokeny.pohl.uk"]).webURL.absoluteString == "https://tokeny.pohl.uk")
        // A pasted full URL is tolerated.
        #expect(AppConfig.fromInfo(["TokenyWebHost": "https://x.example/"]).webURL.absoluteString == "https://x.example")
        // Missing or unexpanded build settings fall back to the built-in origin.
        #expect(AppConfig.fromInfo(["TokenyWebHost": "$(TOKENY_WEB_HOST)"]).webURL.host == AppConfig.fallbackWebHost)
        #expect(AppConfig.fromInfo([:]).webURL.host == AppConfig.fallbackWebHost)
    }
}
