import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessingStatus } from "@/types";

const STATUS_STYLES: Record<ProcessingStatus, { label: string; className: string }> = {
  completed: { label: "Assessed", className: "bg-[#00C853]/20 text-[#00C853]" },
  processing: { label: "Processing", className: "bg-blue-500/20 text-blue-300" },
  pending: { label: "Pending", className: "bg-[#B0BEC5]/20 text-[#B0BEC5]" },
  failed: { label: "Failed", className: "bg-[#FF5252]/20 text-[#FF5252]" },
  duplicate: { label: "Duplicate", className: "bg-yellow-500/20 text-yellow-300" },
  awaiting_cv: { label: "CV required for analysis", className: "bg-[#546E7A]/20 text-[#B0BEC5]" },
  awaiting_analysis: { label: "Ready for AI analysis", className: "bg-purple-500/20 text-purple-300" },
};

export function StatusBadge({ status }: { status: ProcessingStatus }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", style.className)}>
      {status === "processing" && <Loader2 size={12} className="animate-spin" />}
      {style.label}
    </span>
  );
}

export function scoreColor(score: number) {
  if (score >= 75) return "text-[#00C853]";
  if (score >= 50) return "text-yellow-300";
  return "text-[#FF8A80]";
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-[#B0BEC5]">—</span>;
  return <span className={cn("font-semibold", scoreColor(score))}>{Math.round(score)}<span className="text-xs text-[#B0BEC5]">/100</span></span>;
}

export const MISSING_STATUS_LABELS: Record<string, string> = {
  not_found: "Not found in CV (unknown)",
  partial: "Partially evidenced",
  unclear: "Unclear in CV",
};
