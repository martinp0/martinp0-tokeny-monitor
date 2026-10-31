import Foundation

/// Whether the app may show anything that leads to buying Pro on the web.
///
/// The apps sell nothing in-app (no IAP). App Review Guidelines (last updated Oct 16, 2026):
/// - **US storefront:** 3.1.1(a) / 3.1.3 allow buttons, external links and other calls to action
///   to web purchase without any entitlement.
/// - **Everywhere else (EU included):** a link out to purchase needs a StoreKit External Purchase
///   Link entitlement and Apple's terms for it, so we show no purchase links and no upsell there.
///   The app is a free companion to the web service.
///
/// Fails closed: an unknown storefront (nil, offline, Simulator without an account) gets no links.
public enum PurchaseLinkPolicy {
    /// ISO 3166-1 alpha-3 codes (StoreKit `Storefront.countryCode` format) where links are allowed.
    public static let linkStorefronts: Set<String> = ["USA"]

    public static func allowsPurchaseLinks(storefrontCountryCode code: String?) -> Bool {
        guard let code = code?.trimmingCharacters(in: .whitespaces).uppercased(), !code.isEmpty else { return false }
        return linkStorefronts.contains(code)
    }

    /// Where "Manage account on the web" goes: the full settings page (it has the Pro checkout)
    /// only where purchase links are allowed, otherwise the profile page (email, password,
    /// export, delete account), which has nothing to buy.
    public static func accountURL(for config: AppConfig, allowsPurchaseLinks: Bool) -> URL {
        allowsPurchaseLinks ? config.accountURL : config.profileURL
    }
}
