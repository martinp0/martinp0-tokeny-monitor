import Foundation

/// Responses captured from supabase/functions/usage-summary (shape of version 1).
enum Fixtures {
    static let proSummary = Data(
        #"""
        {
          "version": 1,
          "plan": "pro",
          "generated_at": "2026-10-30T06:52:11.482Z",
          "tz": "Europe/Prague",
          "today": { "cost_usd": 1.8421, "tokens": 412000, "requests": 96 },
          "month": { "cost_usd": 38.2, "tokens": 9800000, "requests": 2140, "key": "2026-10" },
          "previous_month": { "cost_usd": 41.7, "tokens": 10100000, "requests": 2311, "key": "2026-09" },
          "forecast_month_usd": 39.47,
          "budget": { "monthly_usd": 50, "threshold_pct": 80, "enabled": true },
          "usd_czk": { "rate": 23.41, "date": "2026-10-29" },
          "daily": [ { "date": "2026-10-29", "cost_usd": 2.1 }, { "date": "2026-10-30", "cost_usd": 1.8421 } ],
          "top_models": [ { "name": "anthropic/claude-sonnet-4-20250514", "cost_usd": 21.3 } ],
          "providers": [ { "name": "Anthropic", "cost_usd": 24 }, { "name": "OpenAI", "cost_usd": 14.2 } ],
          "last_activity_at": "2026-10-30T06:40:00+00:00"
        }
        """#.utf8)

    /// Free plan over a user JWT: no previous month, no forecast, no budget, no rate yet.
    static let freeSummary = Data(
        #"""
        {
          "version": 1,
          "plan": "free",
          "generated_at": "2026-10-30T06:52:11Z",
          "tz": "Europe/Prague",
          "today": { "cost_usd": 0, "tokens": 0, "requests": 0 },
          "month": { "cost_usd": 3.5, "tokens": 120000, "requests": 40, "key": "2026-10" },
          "previous_month": null,
          "forecast_month_usd": null,
          "budget": null,
          "usd_czk": null,
          "daily": [],
          "top_models": [],
          "providers": [],
          "last_activity_at": null
        }
        """#.utf8)

    /// Before `plan` existed (personal-token clients only, which are always Pro).
    static let legacySummary = Data(
        #"""
        {
          "version": 1,
          "generated_at": "2026-10-25T10:00:00Z",
          "tz": "Europe/Prague",
          "today": { "cost_usd": 1, "tokens": 10, "requests": 1 },
          "month": { "cost_usd": 2, "tokens": 20, "requests": 2, "key": "2026-10" },
          "previous_month": { "cost_usd": 3, "tokens": 30, "requests": 3, "key": "2026-09" },
          "forecast_month_usd": 4,
          "budget": null,
          "usd_czk": { "rate": 24, "date": null },
          "daily": [],
          "top_models": [],
          "providers": [],
          "last_activity_at": "2026-10-25T09:58:00Z"
        }
        """#.utf8)
}
