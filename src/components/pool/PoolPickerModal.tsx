"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Database, Search, X } from "lucide-react";
import { poolAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { PoolListItem, PoolSearchResult } from "@/types";
import { Button } from "@/components/ui/Button";
import { FilterStatusChips, formatExperience, isReliable } from "@/components/pool/PoolBits";

const inputClass = "bg-[#132F4C] border border-[#2A3F5E] rounded-lg px-3 py-2 text-white text-sm placeholder-[#546E7A] focus:outline-none focus:border-[#00C853]";

/**
 * "Find candidates in pool" for a job: search the shared pool, select candidates and
 * assess them against this job. No upload and no new CV extraction.
 */
export function PoolPickerModal({ jobId, jobTitle, onClose, onAdded }: {
  jobId: string; jobTitle: string; onClose: () => void; onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [minYears, setMinYears] = useState("");
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const [hideInJob, setHideInJob] = useState(true);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PoolSearchResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poolAPI.search({
        q: q || undefined, skills: skill ? [skill] : undefined, min_years: minYears ? Number(minYears) : undefined,
        include_unknown: includeUnknown || undefined, job_id: jobId, exclude_in_job: hideInJob || undefined,
        sort: q ? "relevance" : "added_desc", page, page_size: 10,
      });
      setResult(res.data as PoolSearchResult);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not search the pool"));
    } finally {
      setLoading(false);
    }
  }, [q, skill, minYears, includeUnknown, hideInJob, page, jobId]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => { setPage(1); }, [q, skill, minYears, includeUnknown, hideInJob]);

  const canSelect = (item: PoolListItem) => item.has_profile && !item.in_job;
  const toggle = (item: PoolListItem) => {
    if (!canSelect(item)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.pool_candidate_id)) next.delete(item.pool_candidate_id); else next.add(item.pool_candidate_id);
      return next;
    });
  };

  const add = async () => {
    setSaving(true);
    try {
      const res = await poolAPI.addToJob(jobId, Array.from(selected));
      const { added, skipped, results } = res.data as { added: number; skipped: number; results: { status: string; reason?: string; name?: string }[] };
      const blocked = (res.data as { processing_blocked?: { message: string }[] | null }).processing_blocked;
      if (blocked?.length) toast(`${added} candidate(s) added – not analysed yet (Pending): ${blocked[0].message}`, { icon: "⚠️", duration: 8000 });
      else toast.success(`${added} candidate(s) added and queued for assessment${skipped ? `, ${skipped} skipped` : ""}`);
      results.filter((r) => r.status !== "added").slice(0, 3).forEach((r) => toast(`${r.name || "Candidate"}: ${r.reason}`));
      onAdded();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not add candidates"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a2a3a] border border-[#2A3F5E] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-semibold flex items-center gap-2"><Database size={18} className="text-[#00C853]" /> Find candidates in pool</h3>
          <button onClick={onClose} className="text-[#B0BEC5] hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-xs text-[#B0BEC5] mb-4">
          For <span className="text-white">{jobTitle}</span>. Saved profiles are reused (no upload, no re-extraction);
          each selected candidate gets a new assessment against this job. Shortlisting stays manual.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
          <div className="relative md:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#546E7A]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, role, employer, skill…" className={cn(inputClass, "w-full pl-8")} />
          </div>
          <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Skill (e.g. SAP)" className={inputClass} />
          <input type="number" min={0} step={0.5} value={minYears} onChange={(e) => setMinYears(e.target.value)} placeholder="Min. years" className={inputClass} />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-[#B0BEC5] mb-3">
          <label className="flex items-center gap-1"><input type="checkbox" checked={hideInJob} onChange={(e) => setHideInJob(e.target.checked)} /> Hide candidates already in this job</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={includeUnknown} onChange={(e) => setIncludeUnknown(e.target.checked)} /> Include unknown (not stated in CV)</label>
        </div>
        <div className="flex-1 overflow-y-auto border border-[#2A3F5E] rounded-lg">
          {loading && !result ? <p className="p-6 text-center text-[#B0BEC5] text-sm">Searching…</p> :
            !result || result.items.length === 0 ? <p className="p-6 text-center text-[#B0BEC5] text-sm">No matching candidates in the pool.</p> : (
            <ul className="divide-y divide-[#2A3F5E]">
              {result.items.map((item) => (
                <li key={item.pool_candidate_id} onClick={() => toggle(item)}
                  className={cn("p-3 flex gap-3", canSelect(item) ? "cursor-pointer hover:bg-[#132F4C]" : "opacity-60",
                    selected.has(item.pool_candidate_id) && "bg-[#00C853]/10")}>
                  <input type="checkbox" readOnly disabled={!canSelect(item)} checked={selected.has(item.pool_candidate_id)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{item.name || "Unnamed"}
                      {item.in_job && <span className="ml-2 text-xs text-[#B0BEC5]">already in this job</span>}
                      {!item.has_profile && <span className="ml-2 text-xs text-[#FF8A80]">no extracted profile – retry it in the pool first</span>}
                    </div>
                    <div className="text-xs text-[#B0BEC5] truncate">
                      {[item.current_title, item.current_employer].filter(Boolean).join(" · ") || "No current role"} · {formatExperience(item.experience_months)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.top_skills.slice(0, 6).map((s) => (
                        <span key={s.name} className={cn("px-1.5 py-0.5 rounded text-[10px]", isReliable(s.support) ? "bg-[#00C853]/10 text-[#00C853]" : "bg-yellow-500/10 text-yellow-300 italic")}>{s.name}</span>
                      ))}
                    </div>
                    <FilterStatusChips statuses={item.filter_status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-xs text-[#B0BEC5]">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></Button>
            <span>{result ? `Page ${result.page} of ${Math.max(result.pages, 1)} · ${result.total} found` : ""}</span>
            <Button size="sm" variant="ghost" disabled={!result || page >= result.pages} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={add} disabled={selected.size === 0} isLoading={saving}>Add & assess {selected.size || ""}</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
