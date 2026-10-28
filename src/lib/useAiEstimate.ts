"use client";

import { useEffect, useState } from "react";
import { analyticsAPI } from "@/lib/api";

/** An ESTIMATE of the AI cost of analysing CVs (the organization's recent average per CV, or the configured value
 *  without history). Shown before HR confirms an upload / import / add / re-assess - never exact, never a limit. */
export interface AiEstimate {
  per_new_cv_usd: number;     // extraction + scoring of a new CV
  per_scoring_usd: number;    // scoring only (pool add, re-assess)
  basis: "recent_average" | "configured";
  sample_cvs: number;
  days: number;
}

let cached: Promise<AiEstimate | null> | null = null;

export function useAiEstimate(): AiEstimate | null {
  const [estimate, setEstimate] = useState<AiEstimate | null>(null);
  useEffect(() => {
    cached = cached || analyticsAPI.getAiEstimate().then((r) => r.data as AiEstimate).catch(() => null);
    let alive = true;
    cached.then((e) => { if (alive) setEstimate(e); });
    return () => { alive = false; };
  }, []);
  return estimate;
}
