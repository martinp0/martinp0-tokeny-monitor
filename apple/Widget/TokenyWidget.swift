import WidgetKit
import SwiftUI

/// Apple Watch complication: spend this month (and today), budget gauge.
struct SpendEntry: TimelineEntry {
    let date: Date
    let summary: UsageSummary?
    let currency: Currency
}

struct SpendProvider: TimelineProvider {
    func placeholder(in context: Context) -> SpendEntry { SpendEntry(date: Date(), summary: .preview, currency: .CZK) }

    func getSnapshot(in context: Context, completion: @escaping (SpendEntry) -> Void) {
        if context.isPreview { return completion(placeholder(in: context)) }
        completion(SpendEntry(date: Date(), summary: TokenySettings.lastSummary, currency: TokenySettings.currency))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SpendEntry>) -> Void) {
        Task {
            let summary = (try? await TokenyAPI.refresh()) ?? TokenySettings.lastSummary
            let entry = SpendEntry(date: Date(), summary: summary, currency: TokenySettings.currency)
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(30 * 60))))
        }
    }
}

@main
struct TokenyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TokenySpend", provider: SpendProvider()) { entry in
            SpendView(entry: entry).containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Tokeny")
        .description("Útrata za AI tokeny tento měsíc a rozpočet.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}

struct SpendView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SpendEntry

    private func short(_ usd: Double) -> String { Fmt.short(usd, entry.currency, rate: Fmt.rate(entry.summary)) }

    var body: some View {
        let s = entry.summary
        switch family {
        case .accessoryInline:
            Text(s.map { "Tokeny \(short($0.month.cost_usd))" } ?? "Tokeny –")
        case .accessoryCorner:
            Text(s.map { short($0.month.cost_usd) } ?? "–")
                .widgetCurvesContent()
                .widgetLabel {
                    if let f = s?.budgetFraction { Gauge(value: min(f, 1)) { Text("Rozpočet") }.tint(Color.tokenyPrimary) }
                    else { Text("Tokeny") }
                }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text("Tokeny").font(.headline).widgetAccentable()
                Text(s.map { "Měsíc \(short($0.month.cost_usd))" } ?? "Nastav na iPhonu")
                if let s {
                    Text("Dnes \(short(s.today.cost_usd))\(s.budgetFraction.map { " · \(Int(($0 * 100).rounded())) %" } ?? "")")
                        .foregroundStyle(.secondary)
                }
            }
            .font(.caption)
            .frame(maxWidth: .infinity, alignment: .leading)
        default: // accessoryCircular
            if let s, let f = s.budgetFraction {
                Gauge(value: min(f, 1)) { Image(systemName: "dollarsign") } currentValueLabel: {
                    Text(short(s.month.cost_usd)).minimumScaleFactor(0.5)
                }
                .gaugeStyle(.accessoryCircular)
                .tint(f >= 1 ? .red : Color.tokenyPrimary)
            } else {
                ZStack {
                    AccessoryWidgetBackground()
                    Text(s.map { short($0.month.cost_usd) } ?? "–").font(.caption2.bold()).minimumScaleFactor(0.5)
                }
            }
        }
    }
}
