/** Usage-based AI cost display helpers: enough precision for small amounts, never "$0" for missing data. */

export const COST_LABEL = "Usage-based cost";
export const COST_NOTE = "Estimated from provider-reported tokens and the configured price table – not an invoice.";

export type CostStatus = "calculated" | "reconstructed" | "unknown" | "uncertain" | "pending" | "not_applicable" | null | undefined;

/** $12.34 · $0.03 · $0.0055 · <$0.0001 · $0 only for a known zero. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Unknown";
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs >= 0.0001) return `$${value.toFixed(4).replace(/(\.\d{2}\d*?)0+$/, "$1")}`;
  return "<$0.0001";
}

/** Text for one call's cost given its status (Unknown / Pending / Billing uncertain carry a reason). */
export function costLabel(cost: number | null | undefined, status: CostStatus): { text: string; known: boolean } {
  if (status === "calculated" || status === "reconstructed") {
    return { text: formatUsd(cost) + (status === "reconstructed" ? " (reconstructed)" : ""), known: true };
  }
  if (status === "pending") return { text: "Pending", known: false };
  if (status === "uncertain") return { text: "Billing uncertain", known: false };
  if (status === "not_applicable") return { text: "n/a", known: false };
  return { text: "Unknown", known: false };
}

export interface CostTotals {
  label: string;
  calculated_usd: number;
  reconstructed_usd: number;
  incurred_usd: number;
  uncertain_usd: number;
  reserved_active_usd: number;
  unknown_calls: number;
  unknown_reasons: Record<string, number>;
  price_table_version: string | null;
  daily_budget_usd: number | null;
  committed_24h_usd: number;
  operations: Record<string, {
    calls: number; calculated_usd: number; reconstructed_usd: number; incurred_usd: number;
    uncertain_usd: number; reserved_active_usd: number; unknown_calls: number;
  }>;
}
