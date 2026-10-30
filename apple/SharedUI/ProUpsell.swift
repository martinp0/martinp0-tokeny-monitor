import SwiftUI
import TokenyCore

/// What Pro adds, with a link to the web. Shown on the Free plan **only on the US storefront**
/// (``AppModel/allowsPurchaseLinks``, rules in ``PurchaseLinkPolicy``). Elsewhere the app shows no
/// upsell at all: no price, no "upgrade", no link. See docs/app-review.md.
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
            Button {
                openURL(accountURL)
            } label: {
                Label("Upgrade on the web", systemImage: "arrow.up.right.square")
            }
            .buttonStyle(.glass)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
