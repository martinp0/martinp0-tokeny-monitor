import Foundation
import Testing

@testable import TokenyCore

struct PurchaseLinkPolicyTests {
    @Test func onlyTheUSStorefrontGetsLinks() {
        #expect(PurchaseLinkPolicy.allowsPurchaseLinks(storefrontCountryCode: "USA"))
        #expect(PurchaseLinkPolicy.allowsPurchaseLinks(storefrontCountryCode: "usa"))
        for code in ["CZE", "DEU", "FRA", "GBR", "CAN", "NLD", "JPN", "US", ""] {
            #expect(!PurchaseLinkPolicy.allowsPurchaseLinks(storefrontCountryCode: code), "\(code)")
        }
    }

    @Test func unknownStorefrontFailsClosed() {
        #expect(!PurchaseLinkPolicy.allowsPurchaseLinks(storefrontCountryCode: nil))
    }

    @Test func accountLinkAvoidsTheCheckoutOutsideTheUS() {
        let config = AppConfig.production
        #expect(PurchaseLinkPolicy.accountURL(for: config, allowsPurchaseLinks: true).path() == "/settings")
        #expect(PurchaseLinkPolicy.accountURL(for: config, allowsPurchaseLinks: false).path() == "/profile")
    }
}
