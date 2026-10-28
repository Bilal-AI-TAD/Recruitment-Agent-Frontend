"use client";

import React from "react";
import { Coins } from "lucide-react";
import { formatUsd } from "@/lib/cost";
import { useAiEstimate } from "@/lib/useAiEstimate";

/** "Estimated AI cost ≈ $0.0103 for 3 CVs" before HR confirms an action that will analyse CVs.
 *  kind "new": extraction + scoring (upload, mailbox import); "scoring": scoring only (pool add, re-assess).
 *  `perCvOnly`: the number of CVs is not known yet (e.g. inside a ZIP) - show the per-CV estimate. */
export function EstimateNote({ count, kind = "new", perCvOnly = false, className = "" }: {
  count: number; kind?: "new" | "scoring"; perCvOnly?: boolean; className?: string;
}) {
  const estimate = useAiEstimate();
  if (!estimate || (count <= 0 && !perCvOnly)) return null;
  const per = kind === "new" ? estimate.per_new_cv_usd : estimate.per_scoring_usd;
  const basis = estimate.basis === "recent_average"
    ? `average of the last ${estimate.days} days`
    : "configured estimate - no history yet";
  return (
    <p className={`text-xs text-[#B0BEC5] flex items-center gap-1 ${className}`} data-testid="ai-estimate"
      title={`Estimate only (${basis}). The actual cost depends on CV length and retries and is shown on the job afterwards.`}>
      <Coins size={12} className="text-[#00C853]" />
      Estimated AI cost ≈ {formatUsd(per * Math.max(count, 1))}
      {perCvOnly ? " per CV" : ` for ${count} CV${count === 1 ? "" : "s"}`}
      <span className="text-[#546E7A]"> (estimate)</span>
    </p>
  );
}
