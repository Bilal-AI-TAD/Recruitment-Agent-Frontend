"use client";

import React from "react";
import { Filter, X } from "lucide-react";
import { AssessedPreset, filtersActive, RankingFilters, ShortlistFilter } from "@/lib/rankingFilters";
import { cn } from "@/lib/utils";

const PRESETS: { value: AssessedPreset; label: string }[] = [
  { value: "all", label: "Any time" }, { value: "today", label: "Today" }, { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" }, { value: "custom", label: "Custom" },
];
const SHORTLIST: { value: ShortlistFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "yes", label: "Shortlisted" }, { value: "no", label: "Not shortlisted" },
];
const field = "bg-[#0A1929] border border-[#2A3F5E] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#00C853]";

function Segmented<T extends string>({ value, options, onChange, label, testId }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; testId: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-[#2A3F5E] bg-[#0A1929] p-0.5"
      data-testid={testId}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
            value === o.value ? "bg-[#00C853]/20 text-[#00C853]" : "text-[#B0BEC5] hover:text-white")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Filters above Ranked Candidates: last assessed, minimum score, shortlist status, and the result count. */
export function RankingFiltersBar({ filters, onChange, shown, total }: {
  filters: RankingFilters; onChange: (f: RankingFilters) => void; shown: number; total: number;
}) {
  const set = (patch: Partial<RankingFilters>) => onChange({ ...filters, ...patch });
  const active = filtersActive(filters);
  return (
    <div className="mb-3 rounded-lg border border-[#2A3F5E] bg-[#0A1929]/40 p-3 space-y-3" data-testid="ranking-filters">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1">
          <p className="text-xs text-[#B0BEC5] flex items-center gap-1"><Filter size={12} /> Last assessed</p>
          <Segmented value={filters.assessed} options={PRESETS} label="Last assessed" testId="filter-assessed"
            onChange={(v) => set({ assessed: v })} />
          {filters.assessed === "custom" && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className="text-xs text-[#B0BEC5] flex items-center gap-1">From
                <input type="date" className={field} value={filters.from} max={filters.to || undefined}
                  onChange={(e) => set({ from: e.target.value })} data-testid="filter-from" /></label>
              <label className="text-xs text-[#B0BEC5] flex items-center gap-1">To
                <input type="date" className={field} value={filters.to} min={filters.from || undefined}
                  onChange={(e) => set({ to: e.target.value })} data-testid="filter-to" /></label>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="filter-min" className="text-xs text-[#B0BEC5] block">
            Minimum score {filters.min > 0 ? <span className="text-[#00C853] font-semibold">{filters.min}+</span> : "(any)"}
          </label>
          <div className="flex items-center gap-2">
            <input id="filter-min" type="range" min={0} max={100} step={5} value={filters.min}
              onChange={(e) => set({ min: Number(e.target.value) })} className="w-36 accent-[#00C853]"
              aria-valuetext={filters.min ? `${filters.min} or more` : "any score"} data-testid="filter-min-range" />
            <input type="number" min={0} max={100} value={filters.min} aria-label="Minimum score"
              onChange={(e) => set({ min: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
              className={cn(field, "w-16")} data-testid="filter-min" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-[#B0BEC5]">Shortlist</p>
          <Segmented value={filters.shortlist} options={SHORTLIST} label="Shortlist status" testId="filter-shortlist"
            onChange={(v) => set({ shortlist: v })} />
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-sm text-[#B0BEC5]" aria-live="polite" data-testid="filter-count">
            Showing <span className="text-white font-semibold">{shown}</span> of {total}
          </span>
          {active && (
            <button type="button" onClick={() => onChange({ assessed: "all", from: "", to: "", min: 0, shortlist: "all" })}
              className="inline-flex items-center gap-1 text-sm text-[#00C853] hover:underline" data-testid="clear-filters">
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
