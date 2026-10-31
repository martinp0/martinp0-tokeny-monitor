import AppIntents
import SwiftUI
import TokenyCore
import WidgetKit

#if os(iOS)
    import TokenyAuth
#endif

/// Home Screen, Lock Screen and Apple Watch widgets: this month's spend, today and the budget.
/// They read the summary the app cached in the App Group. On iPhone a stale cache is refreshed
/// with the stored access token if it is still valid; widgets never refresh the session itself.
@main
struct TokenyWidgetBundle: WidgetBundle {
    var body: some Widget {
        SpendWidget()
    }
}

struct SpendWidgetIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "AI spend"
    static let description = IntentDescription("This month's AI spend and your budget.")

    init() {}
}

struct SpendEntry: TimelineEntry {
    let date: Date
    let cached: CachedSummary?
    let currency: Currency

    var summary: UsageSummary? { cached?.summary }
    var rate: Double { summary?.usdToCZK ?? UsageSummary.fallbackUSDCZK }

    func money(_ usd: Double, compact: Bool = true) -> String {
        Fmt.money(usd, currency, rate: rate, style: compact ? .compact : .standard)
    }

    static let preview = SpendEntry(
        date: .now,
        cached: CachedSummary(summary: .preview, fetchedAt: .now),
        currency: .czk
    )
}

struct SpendProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SpendEntry { .preview }

    func snapshot(for configuration: SpendWidgetIntent, in context: Context) async -> SpendEntry {
        if context.isPreview { return .preview }
        return currentEntry()
    }

    func timeline(for configuration: SpendWidgetIntent, in context: Context) async -> Timeline<SpendEntry> {
        #if os(iOS)
            await refreshIfPossible()
        #endif
        return Timeline(entries: [currentEntry()], policy: .after(.now.addingTimeInterval(30 * 60)))
    }

    #if os(watchOS)
        func recommendations() -> [AppIntentRecommendation<SpendWidgetIntent>] {
            [AppIntentRecommendation(intent: SpendWidgetIntent(), description: "AI spend")]
        }
    #endif

    private func currentEntry() -> SpendEntry {
        let store = SummaryStore.shared
        return SpendEntry(date: .now, cached: store.load(), currency: store.currency)
    }

    #if os(iOS)
        private func refreshIfPossible() async {
            let store = SummaryStore.shared
            guard store.load()?.isStale() ?? true,
                let token = TokenyAuthClient.readOnly().storedAccessToken()
            else { return }
            if let summary = try? await UsageAPI().fetchSummary(accessToken: token) {
                store.save(summary)
            }
        }
    #endif
}

struct SpendWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "TokenySpend", intent: SpendWidgetIntent.self, provider: SpendProvider()) { entry in
            SpendWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("AI spend")
        .description("This month's AI spend and your budget.")
        .supportedFamilies(Self.families)
    }

    static var families: [WidgetFamily] {
        #if os(watchOS)
            [.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner]
        #else
            [.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline]
        #endif
    }
}

struct SpendWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SpendEntry

    var body: some View {
        if let s = entry.summary {
            content(s)
        } else {
            signedOut
        }
    }

    @ViewBuilder
    private func content(_ s: UsageSummary) -> some View {
        let status = s.budgetStatus
        switch family {
        case .accessoryInline:
            Text("AI \(entry.money(s.month.costUSD)) this month")

        case .accessoryCircular:
            if status.limitUSD != nil {
                Gauge(value: status.progress) {
                    Image(systemName: "chart.bar.fill")
                } currentValueLabel: {
                    Text(entry.money(s.month.costUSD)).minimumScaleFactor(0.5)
                }
                .gaugeStyle(.accessoryCircular)
                .tint(status.level.tint)
            } else {
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Image(systemName: "chart.bar.fill").font(.caption2)
                        Text(entry.money(s.month.costUSD)).font(.caption2.bold()).minimumScaleFactor(0.5)
                    }
                }
            }

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text("Tokeny").font(.headline).widgetAccentable()
                Text("Month \(entry.money(s.month.costUSD))")
                Text(todayLine(s)).foregroundStyle(.secondary)
            }
            .font(.caption)
            .monospacedDigit()
            .frame(maxWidth: .infinity, alignment: .leading)

        #if os(watchOS)
            case .accessoryCorner:
                Text(entry.money(s.month.costUSD))
                    .widgetCurvesContent()
                    .widgetLabel {
                        if status.limitUSD != nil {
                            Gauge(value: status.progress) { Text("Budget") }.tint(status.level.tint)
                        } else {
                            Text("Tokeny")
                        }
                    }
        #endif

        case .systemMedium:
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    monthBlock(s)
                    Spacer(minLength: 0)
                    if status.limitUSD != nil { budgetLine(status) }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Top models").font(.caption.weight(.medium)).foregroundStyle(.secondary)
                    ForEach(s.topModels.prefix(3)) { m in
                        HStack {
                            Text(Fmt.model(m.name, maxLength: 18)).lineLimit(1)
                            Spacer(minLength: 4)
                            Text(entry.money(m.costUSD)).foregroundStyle(.secondary)
                        }
                        .font(.caption)
                        .monospacedDigit()
                    }
                }
            }

        default:  // systemSmall
            VStack(alignment: .leading, spacing: 6) {
                monthBlock(s)
                Spacer(minLength: 0)
                if status.limitUSD != nil {
                    budgetLine(status)
                } else {
                    Text(todayLine(s)).font(.caption).foregroundStyle(.secondary).monospacedDigit()
                }
            }
        }
    }

    private func monthBlock(_ s: UsageSummary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("This month").font(.caption.weight(.medium)).foregroundStyle(.secondary)
            Text(entry.money(s.month.costUSD, compact: false))
                .font(.system(.title2, design: .rounded, weight: .semibold))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .widgetAccentable()
            Text(todayLine(s)).font(.caption).foregroundStyle(.secondary).monospacedDigit()
        }
    }

    private func budgetLine(_ status: BudgetStatus) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            ProgressView(value: status.progress).tint(status.level.tint)
            Text("Budget \(Fmt.percent(status.percent ?? 0))").font(.caption2).foregroundStyle(.secondary)
        }
    }

    private func todayLine(_ s: UsageSummary) -> String {
        String(localized: "Today \(entry.money(s.today.costUSD))")
    }

    private var signedOut: some View {
        VStack(spacing: 4) {
            Image(systemName: "chart.bar.fill").widgetAccentable()
            if family != .accessoryCircular && family != .accessoryInline {
                #if os(watchOS)
                    Text("Open Tokeny on iPhone").font(.caption2).multilineTextAlignment(.center)
                #else
                    Text("Sign in to Tokeny").font(.caption).multilineTextAlignment(.center)
                #endif
            }
        }
    }
}

#if os(iOS)
    #Preview("Small", as: .systemSmall) {
        SpendWidget()
    } timeline: {
        SpendEntry.preview
    }
#endif
