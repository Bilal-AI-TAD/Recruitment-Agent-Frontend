"use client";

import React, { useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Loader2, Sparkles, XCircle } from "lucide-react";
import { formatUsd } from "@/lib/cost";
import { cn } from "@/lib/utils";
import { AgentRunStatus, AgentStep } from "./useAgentRun";

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function StepIcon({ status }: { status: AgentStep["status"] }) {
  if (status === "done") return <CheckCircle2 size={16} className="text-[#00C853]" aria-hidden="true" />;
  if (status === "active") return <Loader2 size={16} className="animate-spin text-[#69F0AE]" aria-hidden="true" />;
  if (status === "failed") return <XCircle size={16} className="text-[#FF8A80]" aria-hidden="true" />;
  return <Circle size={16} className="text-[#3d5a80]" aria-hidden="true" />;
}

/** "AI at work": the real steps of a streamed AI job with live ticks, elapsed time, cost and the results appearing
 *  as they arrive (children). Collapses to one summary line when finished. Reusable for any streamed AI job. */
export function AgentActivity({ title, steps, status, elapsedMs, costUsd, summary, error, children, testId }: {
  title: string; steps: AgentStep[]; status: AgentRunStatus; elapsedMs: number; costUsd: number | null;
  summary?: React.ReactNode; error?: { message: string } | null; children?: React.ReactNode; testId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = steps.find((s) => s.status === "active");
  const running = status === "running";

  if (status === "done" && !expanded) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[#00C853]/25 bg-[#00C853]/5 px-3 py-2 text-sm"
        data-testid={testId} data-status={status}>
        <CheckCircle2 size={16} className="text-[#00C853]" aria-hidden="true" />
        <span className="text-[#E0E0E0]">{summary}</span>
        <span className="text-xs text-[#78909C]">{seconds(elapsedMs)}{costUsd !== null && ` · AI cost ${formatUsd(costUsd)}`}</span>
        <button type="button" onClick={() => setExpanded(true)} className="ml-auto text-xs text-[#B0BEC5] hover:text-white">
          Show steps
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-[#0F2236] p-4",
      running ? "ai-glow border-transparent" : status === "failed" ? "border-[#FF5252]/40" : "border-[#2A3F5E]")}
      data-testid={testId} data-status={status}>
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full bg-[#00C853]/15", running && "animate-pulse-glow")}>
          <Sparkles size={15} className="text-[#00C853]" aria-hidden="true" />
        </span>
        <h5 className="text-sm font-semibold text-white">{title}</h5>
        <span className="ml-auto text-xs tabular-nums text-[#78909C]" data-testid={testId && `${testId}-elapsed`}>
          {seconds(elapsedMs)}{costUsd !== null && ` · AI cost ${formatUsd(costUsd)}`}
        </span>
        {status === "done" && (
          <button type="button" onClick={() => setExpanded(false)} aria-label="Hide steps" className="text-[#B0BEC5] hover:text-white">
            <ChevronDown size={16} className="rotate-180" />
          </button>
        )}
      </div>
      <ol className="space-y-1.5" aria-label="Progress">
        {steps.map((s) => (
          <li key={s.key} className={cn("flex items-start gap-2 rounded-md px-2 py-1 text-sm transition-colors",
            s.status === "active" && "bg-[#00C853]/5")} data-testid="agent-step" data-step={s.key} data-state={s.status}>
            <span className="mt-0.5"><StepIcon status={s.status} /></span>
            <span className={cn(s.status === "pending" ? "text-[#546E7A]" : s.status === "failed" ? "text-[#FF8A80]" : "text-[#E0E0E0]",
              s.status === "active" && "ai-shimmer-text font-medium")}>{s.label}</span>
            {s.detail && <span className="text-xs leading-5 text-[#78909C]">– {s.detail}</span>}
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">{active ? active.label : status === "done" ? "Done" : ""}</p>
      {error && (
        <p className="mt-3 rounded-lg border border-[#FF5252]/30 bg-[#FF5252]/10 p-2.5 text-sm text-[#FFCDD2]" role="alert"
          data-testid={testId && `${testId}-error`}>{error.message}</p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
