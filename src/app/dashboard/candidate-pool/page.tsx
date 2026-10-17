"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { AlertTriangle, ChevronLeft, ChevronRight, Database, Filter, Info, Mail, Plus, Search, X } from "lucide-react";
import { configAPI, poolAPI, PoolSearchParams } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MailImportModal } from "@/components/mail/MailImportModal";
import { cn, getErrorMessage } from "@/lib/utils";
import { PoolFacets, PoolListItem, PoolSearchResult } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  AddToJobModal, FilterStatusChips, formatDate, formatExperience, isReliable,
} from "@/components/pool/PoolBits";

const SORTS = [
  { value: "added_desc", label: "Newest added" },
  { value: "added_asc", label: "Oldest added" },
  { value: "name", label: "Name A–Z" },
  { value: "experience_desc", label: "Most experience" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "relevance", label: "Best text match" },
];
const COMMON_LANGUAGES = ["English", "Arabic", "Hindi", "Urdu", "Malayalam", "Tagalog", "French"];

const inputClass = "w-full bg-[#132F4C] border border-[#2A3F5E] rounded-lg px-3 py-2 text-white text-sm placeholder-[#546E7A] focus:outline-none focus:border-[#00C853]";

function useDebounced<T>(value: T, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function ChipInput({ label, values, onChange, suggestions, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = `${label}-suggestions`;
  const add = (value: string) => {
    const v = value.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <label className="text-xs text-[#B0BEC5] mb-1 block">{label}</label>
      <div className="flex gap-1">
        <input list={listId} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }} className={inputClass} />
        <button type="button" onClick={() => add(draft)} className="px-2 rounded-lg bg-[#132F4C] border border-[#2A3F5E] text-[#B0BEC5] hover:text-[#00C853]"><Plus size={14} /></button>
        <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00C853]/15 text-[#00C853] text-xs">
              {v}<button onClick={() => onChange(values.filter((x) => x !== v))}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CandidatePoolPage() {
  const [query, setQuery] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [certification, setCertification] = useState("");
  const [minYears, setMinYears] = useState("");
  const [maxYears, setMaxYears] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [addedFrom, setAddedFrom] = useState("");
  const [addedTo, setAddedTo] = useState("");
  const [includeUncertain, setIncludeUncertain] = useState(false);
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [sort, setSort] = useState("added_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [result, setResult] = useState<PoolSearchResult | null>(null);
  const [facets, setFacets] = useState<PoolFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);

  const debouncedQuery = useDebounced(query);
  const debouncedRole = useDebounced(role);
  const debouncedCert = useDebounced(certification);
  const debouncedMin = useDebounced(minYears);
  const debouncedMax = useDebounced(maxYears);

  const params: PoolSearchParams = useMemo(() => ({
    q: debouncedQuery || undefined,
    skills: skills.length ? skills : undefined,
    languages: languages.length ? languages : undefined,
    role: debouncedRole || undefined,
    certification: debouncedCert || undefined,
    min_years: debouncedMin !== "" ? Number(debouncedMin) : undefined,
    max_years: debouncedMax !== "" ? Number(debouncedMax) : undefined,
    sources: sources.length ? sources : undefined,
    added_from: addedFrom || undefined,
    added_to: addedTo || undefined,
    include_uncertain: includeUncertain || undefined,
    include_unknown: includeUnknown || undefined,
    needs_review: needsReview || undefined,
    sort, page, page_size: pageSize,
  }), [debouncedQuery, skills, languages, debouncedRole, debouncedCert, debouncedMin, debouncedMax, sources,
       addedFrom, addedTo, includeUncertain, includeUnknown, needsReview, sort, page, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poolAPI.search(params);
      setResult(res.data as PoolSearchResult);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load the candidate pool"));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    poolAPI.facets().then((res) => setFacets(res.data as PoolFacets)).catch(() => undefined);
  }, []);
  // Any filter change goes back to page 1.
  useEffect(() => { setPage(1); }, [debouncedQuery, skills, languages, debouncedRole, debouncedCert, debouncedMin,
    debouncedMax, sources, addedFrom, addedTo, includeUncertain, includeUnknown, needsReview, sort, pageSize]);

  const filtersActive = skills.length + languages.length + sources.length > 0 || role || certification || minYears ||
    maxYears || addedFrom || addedTo || includeUncertain || includeUnknown || needsReview;
  const clearFilters = () => {
    setSkills([]); setLanguages([]); setRole(""); setCertification(""); setMinYears(""); setMaxYears("");
    setSources([]); setAddedFrom(""); setAddedTo(""); setIncludeUncertain(false); setIncludeUnknown(false); setNeedsReview(false);
  };
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const { user } = useAuth();
  const [mailboxImport, setMailboxImport] = useState(false);
  const [mailboxEnabled, setMailboxEnabled] = useState(false);
  useEffect(() => {
    configAPI.get().then((r) => setMailboxEnabled(Boolean(r.data?.features?.outlook)))
      .catch(() => setMailboxEnabled(false));
  }, []);
  const canImport = mailboxEnabled && (user?.permissions || []).includes("mail.import");
  const items = result?.items || [];
  const allOnPage = items.length > 0 && items.every((i) => selected.has(i.pool_candidate_id));

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Database className="text-[#00C853]" /> Candidate Pool</h1>
          <p className="text-[#B0BEC5] text-sm mt-1">
            Everyone whose CV has been imported, across all jobs. Each unique CV is extracted once and reused.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && (
            <Button variant="secondary" onClick={() => setMailboxImport(true)}>
              <Mail size={16} className="mr-1" /> Import from mailbox
            </Button>
          )}
          {selected.size > 0 && (
            <Button onClick={() => setShowAdd(true)}><Plus size={16} className="mr-1" /> Add {selected.size} to job</Button>
          )}
        </div>
      </motion.div>
      {mailboxImport && (
        <MailImportModal onClose={() => setMailboxImport(false)} onImported={load} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <Card className="xl:col-span-1 h-fit space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-medium flex items-center gap-2"><Filter size={16} /> Filters</h2>
            {filtersActive && <button onClick={clearFilters} className="text-xs text-[#B0BEC5] hover:text-[#00C853]">Clear all</button>}
          </div>
          <ChipInput label="Skills (all must match)" values={skills} onChange={setSkills} placeholder="e.g. SAP"
            suggestions={(facets?.skills || []).map((s) => s.value)} />
          <ChipInput label="Languages" values={languages} onChange={setLanguages} placeholder="e.g. Arabic"
            suggestions={Array.from(new Set([...(facets?.languages || []).map((s) => s.value), ...COMMON_LANGUAGES]))} />
          <div>
            <label className="text-xs text-[#B0BEC5] mb-1 block">Role / job title</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. logistics coordinator" className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-[#B0BEC5] mb-1 block">Certification</label>
            <input value={certification} onChange={(e) => setCertification(e.target.value)} placeholder="e.g. NEBOSH" className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-[#B0BEC5] mb-1 block">Experience (years, overlaps counted once)</label>
            <div className="flex gap-2">
              <input type="number" min={0} step={0.5} value={minYears} onChange={(e) => setMinYears(e.target.value)} placeholder="min" className={inputClass} />
              <input type="number" min={0} step={0.5} value={maxYears} onChange={(e) => setMaxYears(e.target.value)} placeholder="max" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#B0BEC5] mb-1 block">Source</label>
            <div className="flex flex-wrap gap-2">
              {(facets?.sources?.length ? facets.sources.map((s) => s.value) : ["upload", "zip"]).map((source) => (
                <label key={source} className="flex items-center gap-1 text-sm text-[#B0BEC5]">
                  <input type="checkbox" checked={sources.includes(source)}
                    onChange={() => setSources(sources.includes(source) ? sources.filter((s) => s !== source) : [...sources, source])} />
                  {source}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#B0BEC5] mb-1 block">Date added (from – to)</label>
            <div className="grid grid-cols-1 gap-2">
              <input type="date" value={addedFrom} onChange={(e) => setAddedFrom(e.target.value)} className={inputClass} />
              <input type="date" value={addedTo} onChange={(e) => setAddedTo(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-[#2A3F5E]">
            <label className="flex items-start gap-2 text-sm text-[#B0BEC5]">
              <input type="checkbox" className="mt-1" checked={includeUncertain} onChange={(e) => setIncludeUncertain(e.target.checked)} />
              <span>Include uncertain matches <span className="block text-xs text-[#546E7A]">values not found verbatim in the CV text, scans, or experience ranges that straddle the limit</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm text-[#B0BEC5]">
              <input type="checkbox" className="mt-1" checked={includeUnknown} onChange={(e) => setIncludeUnknown(e.target.checked)} />
              <span>Include unknown <span className="block text-xs text-[#546E7A]">the CV did not state this (e.g. no skills section, no dates)</span></span>
            </label>
            <label className="flex items-center gap-2 text-sm text-[#B0BEC5]">
              <input type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} /> Needs review only
            </label>
          </div>
          <p className="text-xs text-[#546E7A] flex gap-1"><Info size={12} className="mt-0.5 flex-shrink-0" />
            By default only values traced to the CV text are used. This shows source support, not independent verification.
            Personal characteristics are never searchable.</p>
        </Card>

        <div className="xl:col-span-3 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#546E7A]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, e-mail, roles, employers, skills…"
                className={cn(inputClass, "pl-9")} />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={cn(inputClass, "md:w-48")}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className={cn(inputClass, "md:w-28")}>
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A3F5E] text-sm text-[#B0BEC5]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allOnPage} onChange={() => setSelected((prev) => {
                  const next = new Set(prev);
                  items.forEach((i) => (allOnPage ? next.delete(i.pool_candidate_id) : next.add(i.pool_candidate_id)));
                  return next;
                })} /> Select page
              </label>
              <span>{loading ? "Loading…" : `${result?.total ?? 0} candidate${result?.total === 1 ? "" : "s"}`}{selected.size ? ` · ${selected.size} selected` : ""}</span>
            </div>
            {result && result.broader_total !== null && result.broader_total > result.total && (
              <div className="px-4 py-2 text-xs text-yellow-300 bg-yellow-500/5 border-b border-[#2A3F5E]">
                {result.broader_total - result.total} more candidate(s) match only with uncertain or unknown values
                (e.g. not found verbatim in the CV text, scans, missing dates).{" "}
                <button className="underline" onClick={() => { setIncludeUncertain(true); setIncludeUnknown(true); }}>Show them</button>
              </div>
            )}
            {loading && !result ? (
              <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-[#00C853] border-t-transparent rounded-full animate-spin" /></div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center text-[#B0BEC5]">
                No candidates match. {filtersActive && "Try including uncertain or unknown values, or clear filters."}
              </div>
            ) : (
              <ul className="divide-y divide-[#2A3F5E]">
                {items.map((item) => <PoolRow key={item.pool_candidate_id} item={item} selected={selected.has(item.pool_candidate_id)} onToggle={toggle} />)}
              </ul>
            )}
          </Card>

          {result && result.pages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm text-[#B0BEC5]">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /> Previous</Button>
              <span>Page {result.page} of {result.pages}</span>
              <Button variant="ghost" size="sm" disabled={page >= result.pages} onClick={() => setPage(page + 1)}>Next <ChevronRight size={16} /></Button>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddToJobModal candidateIds={Array.from(selected)} onClose={() => setShowAdd(false)}
          onDone={() => { setSelected(new Set()); load(); }} />
      )}
    </div>
  );
}

function PoolRow({ item, selected, onToggle }: { item: PoolListItem; selected: boolean; onToggle: (id: string) => void }) {
  return (
    <li className={cn("px-4 py-3 flex gap-3 hover:bg-[#132F4C]/50", selected && "bg-[#00C853]/5")}>
      <input type="checkbox" className="mt-1.5" checked={selected} onChange={() => onToggle(item.pool_candidate_id)} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/candidate-pool/${item.pool_candidate_id}`} className="text-white font-medium hover:text-[#00C853]">
            {item.name || "Unnamed (CV not extracted yet)"}
          </Link>
          {item.extraction_status === "failed" && <span className="px-2 py-0.5 rounded-full text-xs bg-[#FF5252]/20 text-[#FF5252]">Extraction failed</span>}
          {item.extraction_status === "pending" || item.extraction_status === "processing" ? (
            <span className="px-2 py-0.5 rounded-full text-xs bg-[#B0BEC5]/20 text-[#B0BEC5]">Extraction {item.extraction_status}</span>
          ) : null}
          {item.review_codes.includes("arabic_or_mixed_language") && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-[#FF5252]/15 text-[#FF8A80]" title="Arabic or mixed-language CV: AI extraction was less reliable in testing. Check the original.">
              Arabic/mixed – check extraction
            </span>
          )}
          {item.review_flag_count > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/15 text-yellow-300" title="Validation flags, identity review or version choice">
              <AlertTriangle size={11} /> {item.review_flag_count} to review
            </span>
          )}
        </div>
        <p className="text-sm text-[#B0BEC5] truncate">
          {[item.current_title, item.current_employer].filter(Boolean).join(" · ") || "No current role extracted"}
          <span className="text-[#546E7A]" title={item.experience_as_of ? `Calculated to ${item.experience_as_of}` : undefined}> · Experience {formatExperience(item.experience_months)}</span>
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.top_skills.map((s) => (
            <span key={s.name} title={isReliable(s.support) ? "Traced to the CV text" : "Uncertain: not found verbatim in the CV text"}
              className={cn("px-2 py-0.5 rounded-full text-xs", isReliable(s.support) ? "bg-[#00C853]/10 text-[#00C853]" : "bg-yellow-500/10 text-yellow-300 italic")}>
              {s.name}
            </span>
          ))}
          {item.languages.map((l) => (
            <span key={l.name} className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-300">{l.name}</span>
          ))}
        </div>
        <FilterStatusChips statuses={item.filter_status} />
      </div>
      <div className="text-right text-xs text-[#546E7A] whitespace-nowrap space-y-1">
        <div>Added {formatDate(item.added_at)}</div>
        <div>{item.sources.join(", ") || "—"} · {item.documents} CV{item.documents === 1 ? "" : "s"}</div>
        <div title={item.jobs.map((j) => j.title).join(", ")}>{item.jobs.length} job{item.jobs.length === 1 ? "" : "s"}</div>
      </div>
    </li>
  );
}
