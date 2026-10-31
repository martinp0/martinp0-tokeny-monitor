import Foundation

/// What the iPhone sends to the Apple Watch over WatchConnectivity. The Watch never gets a token:
/// it shows what the phone fetched and asks the phone to refresh.
public struct WatchPayload: Codable, Equatable, Sendable {
    public var cached: CachedSummary?
    public var currency: Currency
    public var signedIn: Bool

    public init(cached: CachedSummary?, currency: Currency, signedIn: Bool) {
        self.cached = cached
        self.currency = currency
        self.signedIn = signedIn
    }

    /// Key in the WatchConnectivity application context / message dictionaries.
    public static let contextKey = "payload"
    /// Message key the Watch sends to ask for fresh data.
    public static let refreshRequestKey = "refresh"

    public func encoded() throws -> Data { try JSONEncoder().encode(self) }

    public static func decode(_ data: Data) -> WatchPayload? {
        try? JSONDecoder().decode(WatchPayload.self, from: data)
    }
}
