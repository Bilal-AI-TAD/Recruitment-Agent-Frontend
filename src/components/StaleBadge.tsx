"use client";

import { AlertTriangle } from "lucide-react";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { StaleCode, StaleReason } from "@/types";

const SHORT: Record<StaleCode, string> = {
  job_changed: "job edited",
  newer_cv_version: "newer CV",
  profile_reextracted: "CV re-extracted",
  scoring_changed: "scoring rules updated",
  model_changed: "AI model changed",
};
const ORDER: StaleCode[] = ["job_changed", "newer_cv_version", "profile_reextracted", "scoring_changed", "model_changed"];

export function reasonText(reason: StaleReason): string {
  return reason.detail || reason.label;
}

/** "35 job edited · 5 newer CV" from the ranking's per-reason counts. */
export function staleBreakdownText(breakdown: Partial<Record<StaleCode, number>> | undefined): string {
  return ORDER.filter((code) => breakdown?.[code]).map((code) => `${breakdown![code]} ${SHORT[code]}`).join(" · ");
}

/** Compact "Out of date" badge; the specific reasons open in a popover on hover, focus or tap. */
export function StaleBadge({ reasons, action = "Use Re-assess to update it.", testId = "stale-badge" }: {
  reasons: StaleReason[]; action?: string; testId?: string;
}) {
  return (
    <InfoPopover testId={testId}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-yellow-500/40 bg-yellow-500/15 px-2 py-0.5 text-xs font-medium text-yellow-300 hover:bg-yellow-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
      label={<><AlertTriangle size={11} aria-hidden="true" /> Out of date</>}>
      <p className="mb-1.5 font-semibold text-yellow-300">Why this assessment is out of date</p>
      <ul className="space-y-1.5">
        {(reasons.length ? reasons : [{ code: "job_changed", label: "Details changed after this assessment" } as StaleReason])
          .map((r) => <li key={r.code} className="leading-snug">• {reasonText(r)}</li>)}
      </ul>
      <p className="mt-2 text-[#B0BEC5]">{action} Nothing is re-assessed automatically.</p>
    </InfoPopover>
  );
}
