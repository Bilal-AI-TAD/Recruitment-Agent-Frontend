"use client";

import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { HHDisclaimers, HHRequirementStatus } from "@/types";

export const REQUIREMENT_STATUS: Record<HHRequirementStatus, { label: string; className: string; hint: string }> = {
  supported: { label: "Supported", className: "bg-[#00C853]/15 text-[#00C853] border-[#00C853]/40",
    hint: "Supported by available public evidence. Not independently verified." },
  indicated: { label: "Indicated", className: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
    hint: "Plausible but indirect evidence. Not counted as met, and never a reason to reject." },
  unknown: { label: "Unknown", className: "bg-[#546E7A]/20 text-[#B0BEC5] border-[#546E7A]/40",
    hint: "No usable evidence either way." },
  contradicted: { label: "Contradicted", className: "bg-[#FF5252]/15 text-[#FF8A80] border-[#FF5252]/40",
    hint: "Public evidence explicitly conflicts with this requirement." },
};

export const RUN_STATUS: Record<string, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-blue-500/15 text-blue-300" },
  running: { label: "Running", className: "bg-blue-500/15 text-blue-300" },
  completed: { label: "Completed", className: "bg-[#00C853]/15 text-[#00C853]" },
  completed_with_errors: { label: "Completed with errors", className: "bg-yellow-500/15 text-yellow-300" },
  budget_exhausted: { label: "Stopped at a limit", className: "bg-yellow-500/15 text-yellow-300" },
  cancelled: { label: "Cancelled", className: "bg-[#546E7A]/20 text-[#B0BEC5]" },
  failed: { label: "Failed", className: "bg-[#FF5252]/15 text-[#FF8A80]" },
};

export const SOURCE_KIND: Record<string, string> = {
  search_snippet: "Search snippet",
  fetched_page: "Fetched page",
  github_api: "GitHub profile",
  cv_document: "CV",
};

export const DISAGREEMENT: Record<string, string> = {
  location_disagreement: "Rules and AI give different current locations",
  ai_omitted_location: "AI did not state the location the rules found",
  ai_location_moved_to_availability: "AI gave an availability statement as the current location; the server re-filed it as availability",
  availability_vs_residence: "An availability statement and a residence are mixed up",
  ai_omitted_experience: "AI did not state the experience the rules found",
  experience_qualifier_differs: "Rules and AI quote different experience statements",
};

/** Names are never inferred: when no source states one, show the profile handle or URL instead. */
export function prospectLabel(p: { display_name: string; handle?: string | null; canonical_url: string }) {
  if (p.display_name && p.display_name !== "unknown") return { label: p.display_name, stated: true };
  let path = p.canonical_url;
  try { path = new URL(p.canonical_url).pathname.replace(/^\/(in\/)?|\/$/g, ""); } catch { /* keep URL */ }
  return { label: p.handle || path || p.canonical_url, stated: false };
}

/** Readable text for a recorded stage issue ({error: "..."} objects, strings or anything else). */
export function issueText(error: unknown) {
  const raw = typeof error === "string" ? error
    : error && typeof error === "object" && typeof (error as { error?: unknown }).error === "string"
      ? (error as { error: string }).error : JSON.stringify(error);
  return raw.replace(/\s+/g, " ").slice(0, 240);
}

export function StatusChip({ status, label }: { status: HHRequirementStatus; label?: string }) {
  const s = REQUIREMENT_STATUS[status] || REQUIREMENT_STATUS.unknown;
  return (
    <span title={s.hint} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs border", s.className)}>
      {label ?? s.label}
    </span>
  );
}

export function StatusCounts({ counts }: { counts: Record<HHRequirementStatus, number> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(["supported", "indicated", "unknown", "contradicted"] as HHRequirementStatus[]).map((s) => (
        <StatusChip key={s} status={s} label={`${REQUIREMENT_STATUS[s].label} ${counts?.[s] ?? 0}`} />
      ))}
    </div>
  );
}

export function RunStatusBadge({ status }: { status: string }) {
  const s = RUN_STATUS[status] || { label: status, className: "bg-[#546E7A]/20 text-[#B0BEC5]" };
  return <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", s.className)}>{s.label}</span>;
}

export function DisclaimerBanner({ disclaimers }: { disclaimers?: HHDisclaimers }) {
  if (!disclaimers) return null;
  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-[#B0BEC5] space-y-1">
      <p className="flex items-start gap-2"><Info size={14} className="mt-0.5 flex-shrink-0 text-[#00C853]" />
        <span><strong className="text-white">Supported</strong> = {disclaimers.supported.replace(/^Supported = /, "")}</span></p>
      <p className="pl-6">{disclaimers.indicated}</p>
      <p className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-yellow-300" />
        <span>{disclaimers.evaluation}</span></p>
      <p className="pl-6">{disclaimers.scope}</p>
    </div>
  );
}
