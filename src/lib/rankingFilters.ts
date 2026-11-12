/** Ranked Candidates filters: kept in the URL (?assessed=7d&min=70&shortlist=yes) so a refresh or a shared link
 *  shows the same list. Pure functions - no React. */
import type { RankedCandidate } from "@/types";

export type AssessedPreset = "all" | "today" | "7d" | "30d" | "custom";
export type ShortlistFilter = "all" | "yes" | "no";

export interface RankingFilters {
  assessed: AssessedPreset;
  from: string;          // YYYY-MM-DD (custom range)
  to: string;
  min: number;           // 0 = no minimum
  shortlist: ShortlistFilter;
}

export const NO_FILTERS: RankingFilters = { assessed: "all", from: "", to: "", min: 0, shortlist: "all" };
const PRESETS: AssessedPreset[] = ["all", "today", "7d", "30d", "custom"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function readFilters(params: URLSearchParams | null): RankingFilters {
  const assessed = (params?.get("assessed") || "all") as AssessedPreset;
  const min = Math.round(Number(params?.get("min") || 0));
  const shortlist = params?.get("shortlist");
  const from = params?.get("from") || "";
  const to = params?.get("to") || "";
  return {
    assessed: PRESETS.includes(assessed) ? assessed : "all",
    from: DATE.test(from) ? from : "",
    to: DATE.test(to) ? to : "",
    min: Number.isFinite(min) ? Math.min(100, Math.max(0, min)) : 0,
    shortlist: shortlist === "yes" || shortlist === "no" ? shortlist : "all",
  };
}

/** The query string for these filters, keeping unrelated parameters. */
export function writeFilters(current: URLSearchParams | null, f: RankingFilters): string {
  const params = new URLSearchParams(current?.toString() || "");
  for (const key of ["assessed", "from", "to", "min", "shortlist"]) params.delete(key);
  if (f.assessed !== "all") params.set("assessed", f.assessed);
  if (f.assessed === "custom" && f.from) params.set("from", f.from);
  if (f.assessed === "custom" && f.to) params.set("to", f.to);
  if (f.min > 0) params.set("min", String(f.min));
  if (f.shortlist !== "all") params.set("shortlist", f.shortlist);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function filtersActive(f: RankingFilters): boolean {
  return f.assessed !== "all" || f.min > 0 || f.shortlist !== "all";
}

function localDay(value: string, endOfDay = false): number {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0).getTime();
}

/** [from, to] in epoch ms for the "last assessed" filter, or null for no date limit. */
export function assessedRange(f: RankingFilters, now: Date = new Date()): [number, number] | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (f.assessed) {
    case "today": return [today, Infinity];
    case "7d": return [today - 6 * 86_400_000, Infinity];
    case "30d": return [today - 29 * 86_400_000, Infinity];
    case "custom": return [f.from ? localDay(f.from) : -Infinity, f.to ? localDay(f.to, true) : Infinity];
    default: return null;
  }
}

/** Candidates matching every active filter. Without an assessment a candidate has no date or score, so it drops out
 *  as soon as a date or score filter is active. */
export function applyFilters(candidates: RankedCandidate[], f: RankingFilters, now: Date = new Date()): RankedCandidate[] {
  const range = assessedRange(f, now);
  return candidates.filter((c) => {
    if (f.shortlist === "yes" && !c.shortlist) return false;
    if (f.shortlist === "no" && c.shortlist) return false;
    if (f.min > 0 && (c.total_score === null || c.total_score === undefined || c.total_score < f.min)) return false;
    if (range) {
      if (!c.assessed_at) return false;
      const at = new Date(c.assessed_at).getTime();
      if (at < range[0] || at > range[1]) return false;
    }
    return true;
  });
}
