"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Briefcase, X } from "lucide-react";
import { jobsAPI, poolAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { FilterStatus, Job, SourceSupport } from "@/types";
import { Button } from "@/components/ui/Button";

export const SUPPORT_LABELS: Record<SourceSupport, { label: string; tip: string; className: string }> = {
  in_section: { label: "In CV section", tip: "Found in the matching section of the CV text (source support, not independent verification).", className: "bg-[#00C853]/15 text-[#00C853]" },
  in_entry: { label: "In CV entry", tip: "Job title and employer found together near the dates in the CV text.", className: "bg-[#00C853]/15 text-[#00C853]" },
  elsewhere: { label: "In CV text", tip: "Found in the CV text, outside the expected section.", className: "bg-emerald-500/10 text-emerald-300" },
  partial: { label: "Partly found", tip: "Only part of this value could be traced to the CV text. Treat as uncertain.", className: "bg-yellow-500/15 text-yellow-300" },
  not_found_verbatim: { label: "Not found verbatim", tip: "Not found literally in the CV text - it may be paraphrased or wrong. Treat as uncertain.", className: "bg-yellow-500/15 text-yellow-300" },
  no_text_layer: { label: "Scan - unverifiable", tip: "The CV has no text layer (e.g. a scan), so this value cannot be traced. Treat as uncertain.", className: "bg-[#B0BEC5]/15 text-[#B0BEC5]" },
};

export function SupportBadge({ support }: { support?: SourceSupport | null }) {
  if (!support) return null;
  const style = SUPPORT_LABELS[support];
  return (
    <span title={style.tip} className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", style.className)}>
      {style.label}
    </span>
  );
}

export function isReliable(support?: SourceSupport | null) {
  return support === "in_section" || support === "in_entry" || support === "elsewhere";
}

const FILTER_STATUS: Record<FilterStatus, { label: string; className: string }> = {
  match: { label: "Match", className: "bg-[#00C853]/15 text-[#00C853]" },
  uncertain: { label: "Uncertain", className: "bg-yellow-500/15 text-yellow-300" },
  unknown: { label: "Unknown", className: "bg-[#B0BEC5]/15 text-[#B0BEC5]" },
  not_listed: { label: "Not listed in CV", className: "bg-[#FF5252]/10 text-[#FF8A80]" },
  outside: { label: "Outside range", className: "bg-[#FF5252]/10 text-[#FF8A80]" },
};

export function FilterStatusChips({ statuses }: { statuses: Record<string, FilterStatus> }) {
  const entries = Object.entries(statuses);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([key, status]) => (
        <span key={key} className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", FILTER_STATUS[status].className)}>
          {key.replace(/^[a-z]+:/, "")}: {FILTER_STATUS[status].label}
        </span>
      ))}
    </div>
  );
}

export function formatExperience(range: { min: number | null; max: number | null }) {
  if (range.min === null || range.max === null) return "Unknown";
  const y = (m: number) => (m / 12).toFixed(m % 12 === 0 ? 0 : 1);
  return range.min === range.max ? `${y(range.min)} yrs` : `${y(range.min)}–${y(range.max)} yrs`;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatMonth(index?: number | null) {
  if (index === null || index === undefined) return "unknown";
  const d = new Date(Math.floor(index / 12), index % 12, 1);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

/** Choose an open job and add the selected pool candidates (assessment only, no extraction). */
export function AddToJobModal({ candidateIds, onClose, onDone }: {
  candidateIds: string[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    jobsAPI.getAll()
      .then((res) => setJobs((res.data as Job[]).filter((j) => j.job_available !== false)))
      .catch((err) => toast.error(getErrorMessage(err, "Could not load jobs")))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!jobId) return;
    setSaving(true);
    try {
      const res = await poolAPI.addToJob(jobId, candidateIds);
      const { added, skipped, results } = res.data as { added: number; skipped: number; results: { status: string; reason?: string; name?: string }[] };
      const blocked = (res.data as { processing_blocked?: { message: string }[] | null }).processing_blocked;
      if (blocked?.length) toast(`${added} added – not analysed yet (Pending): ${blocked[0].message}`, { icon: "⚠️", duration: 8000 });
      else toast.success(`${added} added and queued for assessment${skipped ? `, ${skipped} skipped` : ""}`);
      results.filter((r) => r.status !== "added").slice(0, 3).forEach((r) => toast(`${r.name || "Candidate"}: ${r.reason}`));
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not add candidates to the job"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a2a3a] border border-[#2A3F5E] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Briefcase size={18} /> Add {candidateIds.length} to an open job</h3>
          <button onClick={onClose} className="text-[#B0BEC5] hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-sm text-[#B0BEC5] mb-4">
          Saved profiles are reused: no upload and no new CV extraction. Each candidate is assessed against
          the job&apos;s requirements. Shortlisting stays a manual decision.
        </p>
        {loading ? <p className="text-[#B0BEC5] text-sm">Loading jobs…</p> : jobs.length === 0 ? (
          <p className="text-[#B0BEC5] text-sm">There are no open jobs.</p>
        ) : (
          <select value={jobId} onChange={(e) => setJobId(e.target.value)}
            className="w-full bg-[#132F4C] border border-[#2A3F5E] rounded-lg px-3 py-2 text-white text-sm">
            <option value="">Select an open job…</option>
            {jobs.map((j) => <option key={j.job_id} value={j.job_id}>{j.title}{j.location ? ` · ${j.location}` : ""}</option>)}
          </select>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!jobId} isLoading={saving}>Add & assess</Button>
        </div>
      </motion.div>
    </div>
  );
}
