import Foundation

/// Calls the read-only `usage-summary` edge function with a personal token
/// (the same kind of token as for MCP, created in Nastavení → MCP tokeny).
struct TokenyAPI: Sendable {
    let baseURL: URL
    let token: String

    enum APIError: LocalizedError {
        case notConfigured, unauthorized, notDeployed, server(Int), badResponse

        var errorDescription: String? {
            switch self {
            case .notConfigured: return "Vlož token v nastavení."
            case .unauthorized: return "Token neplatí. Vytvoř nový v Nastavení → MCP tokeny."
            case .notDeployed: return "Na serveru chybí funkce usage-summary."
            case .server(let c): return "Server odpověděl chybou \(c)."
            case .badResponse: return "Odpovědi serveru nerozumím."
            }
        }
    }

    static func fromSettings() throws -> TokenyAPI {
        guard let token = Keychain.readToken() else { throw APIError.notConfigured }
        return TokenyAPI(baseURL: TokenySettings.serverURL, token: token)
    }

    private static let session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.timeoutIntervalForRequest = 20
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: c)
    }()

    func fetchSummary() async throws -> UsageSummary {
        var comps = URLComponents(url: baseURL.appendingPathComponent("functions/v1/usage-summary"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "tz", value: TimeZone.current.identifier)]
        var req = URLRequest(url: comps.url!)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, resp) = try await Self.session.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw APIError.badResponse }
        switch http.statusCode {
        case 200..<300: break
        case 401, 403: throw APIError.unauthorized
        case 404: throw APIError.notDeployed
        default: throw APIError.server(http.statusCode)
        }
        do { return try JSONDecoder().decode(UsageSummary.self, from: data) } catch { throw APIError.badResponse }
    }

    /// Fetches and caches the summary for widgets.
    static func refresh() async throws -> UsageSummary {
        let s = try await fromSettings().fetchSummary()
        TokenySettings.lastSummary = s
        return s
    }
}
