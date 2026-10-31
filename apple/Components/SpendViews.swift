import Charts
import SwiftUI
import TokenyCore

/// Small building blocks shared by the iPhone, Mac and Watch apps and the widgets.

extension BudgetStatus.Level {
    /// Semantic colour: content stays neutral, only the state is tinted.
    var tint: Color {
        switch self {
        case .none, .ok: .accentColor
        case .warning: .orange
        case .over: .red
        }
    }
}

/// Amount in the chosen currency with the other one underneath ("898 Kč" / "$38.20").
struct MoneyStack: View {
    let usd: Double
    let currency: Currency
    let rate: Double
    var primaryFont: Font = .system(.largeTitle, design: .rounded, weight: .semibold)
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        let pair = Fmt.moneyPair(usd, primary: currency, rate: rate)
        VStack(alignment: alignment, spacing: 2) {
            Text(pair.primary)
                .font(primaryFont)
                .monospacedDigit()
                .contentTransition(.numericText(value: usd))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(pair.secondary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }
}

/// Monthly budget as a bar with "spent of limit" and the percentage.
struct BudgetBar: View {
    let status: BudgetStatus
    let currency: Currency
    let rate: Double

    var body: some View {
        if let limit = status.limitUSD {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Budget")
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    Text(Fmt.percent(status.percent ?? 0))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(status.level.tint)
                        .monospacedDigit()
                }
                ProgressView(value: status.progress)
                    .tint(status.level.tint)
                Text("\(Fmt.money(status.spentUSD, currency, rate: rate)) of \(Fmt.money(limit, currency, rate: rate))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .accessibilityElement(children: .combine)
        }
    }
}

/// Provider or model with its share of the month, as a thin proportional bar.
struct ShareRow: View {
    let title: String
    let usd: Double
    let totalUSD: Double
    let currency: Currency
    let rate: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 12)
                Text(Fmt.money(usd, currency, rate: rate))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            .font(.callout)
            GeometryReader { geo in
                Capsule()
                    .fill(.tint.opacity(0.85))
                    .frame(width: max(4, geo.size.width * fraction))
            }
            .frame(height: 4)
            .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
    }

    private var fraction: Double {
        guard totalUSD > 0 else { return 0 }
        return min(max(usd / totalUSD, 0), 1)
    }
}

/// Daily spend this month as small bars.
struct DailyChart: View {
    let days: [UsageSummary.Day]
    let currency: Currency
    let rate: Double

    var body: some View {
        Chart(days) { day in
            BarMark(
                x: .value("Day", String(day.date.suffix(2))),
                y: .value("Spend", currency == .czk ? day.costUSD * rate : day.costUSD)
            )
            .foregroundStyle(.tint)
            .cornerRadius(2)
        }
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 3))
        }
        .accessibilityLabel(Text("Daily spend this month"))
    }
}

/// "Updated 5 min ago" with a stale hint.
struct UpdatedLabel: View {
    let cached: CachedSummary

    var body: some View {
        HStack(spacing: 4) {
            if cached.isStale() {
                Image(systemName: "clock.badge.exclamationmark")
            }
            Text("Updated \(cached.fetchedAt.formatted(.relative(presentation: .named)))")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }
}
