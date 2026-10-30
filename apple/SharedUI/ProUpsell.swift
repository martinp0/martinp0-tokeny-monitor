import SwiftUI
import TokenyCore

/// What Pro adds, shown instead of the locked sections on the Free plan.
///
/// The apps sell nothing: Pro is bought and managed on the web. Linking out to a purchase page is
/// allowed on the US storefront (guideline 3.1.1(a), 2025) but elsewhere needs the StoreKit
/// External Purchase Link entitlement, so outside the US flip ``showsWebLink`` off (or ship IAP).
enum ProUpsellPolicy {
    static let showsWebLink = true
}

struct ProUpsellCard: View {
    let accountURL: URL
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Tokeny Pro", systemImage: "sparkles")
                .font(.headline)
            Text("Full history, month-end forecast, budget alerts and unlimited providers.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if ProUpsellPolicy.showsWebLink {
                Button {
                    openURL(accountURL)
                } label: {
                    Label("Manage plan on the web", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(.glass)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
