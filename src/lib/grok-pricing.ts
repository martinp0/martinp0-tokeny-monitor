/** xAI Grok text API prices in USD per 1M tokens (source: docs.x.ai/developers/pricing). */
export const GROK_PRICING_CHECKED = "22. 10. 2026";
export const GROK_PRICING_URL = "https://docs.x.ai/developers/pricing";

export interface GrokPrice {
  model: string;
  context: string;
  input: number;
  cached: number;
  output: number;
  /** Rates applied to the whole request once the prompt reaches 200k tokens. */
  longInput: number;
  longOutput: number;
}

export const GROK_MODELS: GrokPrice[] = [
  { model: "grok-4.7", context: "500k", input: 2, cached: 0.5, output: 6, longInput: 4, longOutput: 12 },
  { model: "grok-4.5", context: "500k", input: 2, cached: 0.3, output: 6, longInput: 4, longOutput: 12 },
  { model: "grok-4.3", context: "1M", input: 1.25, cached: 0.2, output: 2.5, longInput: 2.5, longOutput: 5 },
  { model: "grok-4.20-0309-non-reasoning", context: "1M", input: 1.25, cached: 0.2, output: 2.5, longInput: 2.5, longOutput: 5 },
  { model: "grok-build-0.1", context: "256k", input: 1, cached: 0.2, output: 2, longInput: 2, longOutput: 4 },
];

export function fmtUsd(v: number) {
  return `$${v.toFixed(2)}`;
}
