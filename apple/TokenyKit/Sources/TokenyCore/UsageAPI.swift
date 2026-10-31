import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

public enum UsageAPIError: Error, Equatable, Sendable {
    /// Missing or expired session: sign in again.
    case unauthorized
    /// The server refused a Pro-only request (`{"error":"pro_required"}`).
    case proRequired
    /// The `/api/usage-summary` endpoint is missing (server being deployed or rolled back).
    case notDeployed
    case server(status: Int)
    case offline
    case badResponse
}

/// Talks to the Tokeny API (`/api/*` on the web origin) as the signed-in user.
/// Read-only except ``deleteAccount(accessToken:)``.
///
/// `accessToken` is the credential from ``TokenyAuth``: either the Neon Auth session cookie
/// (`name=value`, sent as `Cookie`) or a Neon Auth JWT (sent as `Authorization: Bearer`).
/// The server accepts both (server/auth.ts).
public struct UsageAPI: Sendable {
    public typealias Transport = @Sendable (URLRequest) async throws -> (Data, URLResponse)

    public let config: AppConfig
    private let transport: Transport

    public init(config: AppConfig = .production, transport: Transport? = nil) {
        self.config = config
        self.transport = transport ?? { request in try await URLSession.shared.data(for: request) }
    }

    public func summaryRequest(accessToken: String, timeZone: TimeZone = .current) -> URLRequest {
        var comps = URLComponents(url: config.apiURL.appending(path: "usage-summary"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "tz", value: timeZone.identifier)]
        var req = URLRequest(url: comps.url!)
        req.httpMethod = "GET"
        req.timeoutInterval = 20
        req.cachePolicy = .reloadIgnoringLocalCacheData
        authorize(&req, accessToken: accessToken)
        return req
    }

    public func fetchSummary(accessToken: String, timeZone: TimeZone = .current) async throws -> UsageSummary {
        let data = try await send(summaryRequest(accessToken: accessToken, timeZone: timeZone))
        return try Self.decodeSummary(data)
    }

    /// Deletes the account and all its data (App Store guideline 5.1.1(v)); same as on the web.
    public func deleteAccount(accessToken: String) async throws {
        var req = URLRequest(url: config.apiURL.appending(path: "account").appending(path: "delete"))
        req.httpMethod = "POST"
        req.timeoutInterval = 30
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = Data("{}".utf8)
        authorize(&req, accessToken: accessToken)
        _ = try await send(req)
    }

    public static func decodeSummary(_ data: Data) throws -> UsageSummary {
        do {
            return try JSONDecoder().decode(UsageSummary.self, from: data)
        } catch {
            throw UsageAPIError.badResponse
        }
    }

    /// Maps an HTTP status (and error body) to ``UsageAPIError``; nil means success.
    public static func error(status: Int, body: Data) -> UsageAPIError? {
        switch status {
        case 200..<300: return nil
        case 401: return .unauthorized
        case 403:
            if let e = try? JSONDecoder().decode(ErrorBody.self, from: body), e.error == "pro_required" {
                return .proRequired
            }
            return .unauthorized
        case 404: return .notDeployed
        default: return .server(status: status)
        }
    }

    private struct ErrorBody: Decodable {
        var error: String?
    }

    private func authorize(_ req: inout URLRequest, accessToken: String) {
        Self.authorize(&req, credential: accessToken)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
    }

    /// Puts a session cookie (`name=value`) in `Cookie`, anything else in `Authorization: Bearer`.
    /// Cookies are set by hand, so URLSession's shared cookie jar is never involved.
    public static func authorize(_ req: inout URLRequest, credential: String) {
        req.httpShouldHandleCookies = false
        if credential.contains("=") {
            req.setValue(credential, forHTTPHeaderField: "Cookie")
        } else {
            req.setValue("Bearer \(credential)", forHTTPHeaderField: "Authorization")
        }
    }

    private func send(_ req: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await transport(req)
        } catch is CancellationError {
            throw CancellationError()
        } catch let e as URLError where e.code == .cancelled {
            throw CancellationError()
        } catch {
            throw UsageAPIError.offline
        }
        guard let http = response as? HTTPURLResponse else { throw UsageAPIError.badResponse }
        if let e = Self.error(status: http.statusCode, body: data) { throw e }
        return data
    }
}
