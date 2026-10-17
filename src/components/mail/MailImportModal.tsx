"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertTriangle, CheckCircle2, Forward, Loader2, Mail, Paperclip, Plus, RefreshCw, RotateCcw, Search, Sparkles, X,
  XCircle,
} from "lucide-react";
import { mailImportAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import {
  MailAttachmentPreview, MailConnection, MailConnectionsResponse, MailImportRun, MailItemStatus,
  MailSearchResponse, MailSearchResultItem, MailVariants, MailPhrasePreview, MailSkippedMessage,
} from "@/types";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/components/pool/PoolBits";

const AUTO_CONTINUE_ROUNDS = 10;   // a search continues by itself this many times before asking for "Load more"

const mergeById = <T extends { message_id: string }>(prev: T[], next: T[]) => {
  const seen = new Set(prev.map((r) => r.message_id));
  return [...prev, ...next.filter((r) => !seen.has(r.message_id))];
};

const inputClass = "bg-[#132F4C] border border-[#2A3F5E] rounded-lg px-3 py-2 text-white text-sm placeholder-[#546E7A] focus:outline-none focus:border-[#00C853]";
const POLL_MS = 2500;

const MATCH: Record<string, { label: string; className: string }> = {
  strong: { label: "Strong match", className: "bg-[#00C853]/15 text-[#00C853]" },
  possible: { label: "Possible match", className: "bg-yellow-500/15 text-yellow-300" },
  weak: { label: "Weak – broader search", className: "bg-orange-500/15 text-orange-300" },
};

const ATTACHMENT_STATUS: Record<MailAttachmentPreview["import_status"], { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-500/15 text-blue-300" },
  in_pool: { label: "In pool – profile reused", className: "bg-[#00C853]/15 text-[#00C853]" },
  in_job: { label: "Already in this job", className: "bg-[#546E7A]/20 text-[#B0BEC5]" },
  unsupported: { label: "Not importable", className: "bg-[#FF5252]/15 text-[#FF8A80]" },
};

export const ITEM_STATUS: Record<MailItemStatus, { label: string; className: string }> = {
  pending: { label: "Waiting", className: "text-[#B0BEC5]" },
  processing: { label: "Importing…", className: "text-blue-300" },
  imported: { label: "Imported", className: "text-[#00C853]" },
  duplicate: { label: "Already imported", className: "text-yellow-300" },
  rejected: { label: "Not a usable CV", className: "text-[#FF8A80]" },
  failed: { label: "Failed – retryable", className: "text-[#FF5252]" },
  cancelled: { label: "Cancelled", className: "text-[#546E7A]" },
};

export const RUN_STATUS: Record<MailImportRun["status"], string> = {
  queued: "Waiting to start",
  running: "Importing",
  completed: "Finished",
  completed_with_errors: "Finished with errors",
  cancelled: "Cancelled",
  paused_reconnect: "Paused – mailbox needs reconnecting",
};

function size(bytes: number | null | undefined) {
  if (!bytes) return "–";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function requestId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Mailbox CV search (the company Outlook mailbox): choose the mailbox and period, review the job's
 * title/subject variations, preview matching application e-mails and import the selected CV attachments.
 * With a job, imported CVs become applications for it; without one (Candidate Pool) they are only added to the
 * pool - associating them with a job is a separate, explicit step there.
 * Nothing is imported until HR selects attachments; the e-mail text is shown as plain text.
 */
export function MailImportModal({ jobId, jobTitle, initialRunId, onClose, onImported }: {
  jobId?: string | null; jobTitle?: string; initialRunId?: string | null; onClose: () => void; onImported: () => void;
}) {
  const poolOnly = !jobId;
  const [connections, setConnections] = useState<MailConnection[] | null>(null);
  const [connectionId, setConnectionId] = useState("");
  const [period, setPeriod] = useState<"all" | "range">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [variants, setVariants] = useState<MailVariants | null>(null);
  const [list, setList] = useState<string[]>([]);
  const [edited, setEdited] = useState(false);
  const [newVariant, setNewVariant] = useState("");
  const [search, setSearch] = useState<MailSearchResponse | null>(null);
  const [results, setResults] = useState<MailSearchResultItem[]>([]);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [run, setRun] = useState<MailImportRun | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);   // e-mails checked while a search continues
  const [skipped, setSkipped] = useState<MailSkippedMessage[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ from: string; value: string } | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [preview, setPreview] = useState<MailPhrasePreview[] | null>(null);
  const requestKey = useRef(requestId());
  const notified = useRef<string | null>(null);

  useEffect(() => {
    mailImportAPI.connections().then((res) => {
      const data = res.data as MailConnectionsResponse;
      const usable = data.connections.filter((c) => c.status === "active");
      setConnections(usable);
      if (usable.length) setConnectionId(usable[0].connection_id);
    }).catch((err) => { toast.error(getErrorMessage(err, "Could not load mailboxes")); setConnections([]); });
    if (!jobId) return;                       // pool search: HR types the job titles to look for
    mailImportAPI.variants(jobId).then((res) => {
      const v = res.data as MailVariants;
      setVariants(v);
      setList(v.variants);
    }).catch((err) => toast.error(getErrorMessage(err, "Could not prepare title variations")));
  }, [jobId]);

  const loadRun = useCallback(async (runId: string) => {
    try {
      const res = await mailImportAPI.run(runId);
      setRun(res.data as MailImportRun);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load the import"));
    }
  }, []);

  useEffect(() => { if (initialRunId) loadRun(initialRunId); }, [initialRunId, loadRun]);
  useEffect(() => {
    if (!run || !["queued", "running"].includes(run.status)) {
      if (run && notified.current !== `${run.run_id}:${run.status}`) {
        notified.current = `${run.run_id}:${run.status}`;
        onImported();
      }
      return;
    }
    const t = setInterval(() => loadRun(run.run_id), POLL_MS);
    return () => clearInterval(t);
  }, [run, loadRun, onImported]);

  const regenerate = async (useAi = false) => {
    if (!jobId) return;
    if (useAi && !window.confirm("Ask the AI for more phrases? Only the job title and a short excerpt of the "
      + "requirements are sent (never e-mails), and it counts towards the AI budget.")) return;
    setBusy(useAi ? "ai" : "variants");
    try {
      const res = await mailImportAPI.regenerateVariants(jobId, useAi);
      const v = res.data as MailVariants;
      setVariants(v);
      setList(v.variants);
      setEdited(false);
      setPreview(null);
      if (useAi && v.ai_refused) toast("AI suggestions are not available (AI is disabled or over budget). The phrases were built from the job title.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not rebuild the phrases"));
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = () => {
    if (!editing) return;
    const v = editing.value.trim();
    if (v && v !== editing.from && !list.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setList(list.map((x) => (x === editing.from ? v : x)));
      setEdited(true);
      setPreview(null);
    }
    setEditing(null);
  };

  const runPreview = async () => {
    if (!jobId) return;
    const subjects = previewText.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20);
    if (!subjects.length || !list.length) return;
    setBusy("preview");
    try {
      const res = await mailImportAPI.previewVariants(jobId, list, subjects);
      setPreview((res.data as { results: MailPhrasePreview[] }).results);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not test the phrases"));
    } finally {
      setBusy(null);
    }
  };

  const addVariant = (value: string) => {
    const v = value.trim();
    if (!v || list.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setList([...list, v]);
    setEdited(true);
    setNewVariant("");
  };

  const runSearch = async (mode: "narrow" | "broad") => {
    if (!connectionId || !list.length) return;
    if (period === "range" && (!dateFrom || !dateTo)) {
      toast.error("Choose both dates, or All history.");
      return;
    }
    if (mode === "broad" && !window.confirm(
      "Broader search also looks for:\n• the title words anywhere in the e-mail or attachment name, and\n" +
      "• e-mails with a CV attachment whose subject says application / applying / CV / resume / vacancy " +
      "without naming this job.\n\nThese results are marked as weak matches. Only previews are read; nothing is " +
      "imported until you select attachments. Continue?")) return;
    setBusy(mode);
    setSearchError(null);
    try {
      if (edited && jobId) {
        await mailImportAPI.saveVariants(jobId, list);
        setEdited(false);
      }
      const res = await mailImportAPI.search({
        connection_id: connectionId, job_id: jobId || null, variants: list, mode, confirm_broad: mode === "broad",
        ...(period === "range" ? { date_from: dateFrom, date_to: dateTo } : {}),
      });
      let data = res.data as MailSearchResponse;
      let found = data.results, skippedSoFar = data.skipped || [];
      setSelected({});
      setConfirmed(new Set());
      // Each server step stops after a few seconds to stay responsive; continue until the period is fully checked,
      // so an unfinished search is never shown as "nothing found".
      for (let round = 0; data.incomplete && data.can_load_more && round < AUTO_CONTINUE_ROUNDS; round++) {
        setProgress(data.totals?.listed ?? 0);
        try {
          data = (await mailImportAPI.more(data.search_id)).data as MailSearchResponse;
        } catch {
          break;                                   // keep what was found; the banner offers "Load more"
        }
        found = mergeById(found, data.results);
        skippedSoFar = mergeById(skippedSoFar, data.skipped || []);
      }
      setSearch(data);
      setResults(found);
      setSkipped(skippedSoFar);
    } catch (err) {
      // A failed search is never shown as "no results": nothing was checked.
      setSearch(null);
      setResults([]);
      setSkipped([]);
      setSearchError(getErrorMessage(err, "The mailbox could not be searched"));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const loadMore = async () => {
    if (!search) return;
    setBusy("more");
    try {
      const res = await mailImportAPI.more(search.search_id);
      const data = res.data as MailSearchResponse;
      setSearch(data);
      setResults((prev) => mergeById(prev, data.results));
      setSkipped((prev) => mergeById(prev, data.skipped || []));
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load more results – the e-mails checked so far are still shown"));
    } finally {
      setBusy(null);
    }
  };

  const doneStatus = poolOnly ? "in_pool" as const : "in_job" as const;
  const selectable = (a: MailAttachmentPreview) => a.supported && a.import_status !== doneStatus;
  const toggle = (messageId: string, partId: string) => setSelected((prev) => {
    const next = { ...prev };
    const parts = new Set(next[messageId] || []);
    if (parts.has(partId)) parts.delete(partId); else parts.add(partId);
    next[messageId] = parts;
    return next;
  });
  const selectStrong = () => {
    const next: Record<string, Set<string>> = {};
    for (const r of results) {
      if (r.match.level !== "strong") continue;
      const parts = r.attachments.filter(selectable).map((a) => a.part_id);
      if (parts.length) next[r.message_id] = new Set(parts);
    }
    setSelected(next);
  };
  const selectedCount = useMemo(() => Object.values(selected).reduce((n, s) => n + s.size, 0), [selected]);
  const needsConfirmation = useMemo(() => results.filter((r) => (r.other_jobs || []).length
    && selected[r.message_id]?.size && !confirmed.has(r.message_id)).length, [results, selected, confirmed]);

  const startImport = async () => {
    if (!search || !selectedCount) return;
    setBusy("import");
    try {
      const selections = Object.entries(selected).filter(([, parts]) => parts.size)
        .map(([message_id, parts]) => ({ message_id, part_ids: Array.from(parts),
                                          ...(confirmed.has(message_id) ? { confirm_job: true } : {}) }));
      const res = await mailImportAPI.startImport({ search_id: search.search_id, selections,
                                               client_request_id: requestKey.current });
      requestKey.current = requestId();
      setRun(res.data as MailImportRun);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start the import"));
    } finally {
      setBusy(null);
    }
  };

  const control = async (action: "cancel" | "retry") => {
    if (!run) return;
    setBusy(action);
    try {
      const res = action === "cancel" ? await mailImportAPI.cancel(run.run_id) : await mailImportAPI.retry(run.run_id);
      setRun(res.data as MailImportRun);
    } catch (err) {
      toast.error(getErrorMessage(err, action === "cancel" ? "Could not cancel" : "Could not retry"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="bg-[#1a2a3a] border border-[#2A3F5E] rounded-2xl p-6 w-full max-w-4xl max-h-[92vh] flex flex-col"
        role="dialog" aria-label="Import CVs from a mailbox">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2"><Mail size={20} className="text-[#00C853]" /> Import CVs from a mailbox</h2>
            <p className="text-sm text-[#B0BEC5]">
              {poolOnly ? "Candidate Pool only – not added to any job" : jobTitle} · nothing in the mailbox is changed
            </p>
          </div>
          <button onClick={onClose} className="text-[#B0BEC5] hover:text-white" aria-label="Close"><X size={22} /></button>
        </div>

        <div className="overflow-y-auto pr-1 space-y-5">
          {run ? (
            <RunProgress run={run} busy={busy} onCancel={() => control("cancel")} onRetry={() => control("retry")}
              onBack={() => {
                const done = new Set((run.items || []).filter((i) => i.status === "imported" || i.status === "duplicate")
                  .map((i) => `${i.message_id}/${i.part_id}`));
                setResults((prev) => prev.map((r) => ({ ...r, attachments: r.attachments.map((a) =>
                  done.has(`${r.message_id}/${a.part_id}`) ? { ...a, import_status: doneStatus } : a) })));
                setSelected({});
                setRun(null);
              }} canSearchAgain={!!search} poolOnly={poolOnly} />
          ) : (
            <>
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#B0BEC5] mb-1">Mailbox</label>
                  {connections === null ? <p className="text-sm text-[#B0BEC5]">Loading…</p> : connections.length === 0 ? (
                    <p className="text-sm text-yellow-200">
                      No connected mailbox is available to you. Connect one (or ask its owner to share it) on the{" "}
                      <Link href="/dashboard/system" className="underline">System page</Link>.
                    </p>
                  ) : (
                    <select className={cn(inputClass, "w-full")} value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
                      {connections.map((c) => (
                        <option key={c.connection_id} value={c.connection_id}>
                          Outlook · {c.mailbox_email}
                          {c.is_owner ? "" : ` (shared by ${c.owner_name || "a colleague"})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-[#B0BEC5] mb-1">Period (received)</label>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-[#E0E0E0]">
                    <label className="flex items-center gap-1"><input type="radio" checked={period === "all"} onChange={() => setPeriod("all")} /> All history</label>
                    <label className="flex items-center gap-1"><input type="radio" checked={period === "range"} onChange={() => setPeriod("range")} /> Date range</label>
                  </div>
                  {period === "range" && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input type="date" aria-label="From" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                      <input type="date" aria-label="To" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs text-[#B0BEC5]">{poolOnly ? "Job titles to look for in subjects" : "Subject phrases for this job"}</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {variants && !poolOnly && (
                      <span className="text-xs text-[#546E7A]">
                        {variants.source === "ai" ? "Built from the job title + AI suggestions" : "Built from the job title (no AI)"}
                        {variants.edited || edited ? " · edited by HR" : ""}
                      </span>
                    )}
                    {!poolOnly && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => regenerate(false)} isLoading={busy === "variants"}
                          title="Discard edits and rebuild the phrases from the job title">
                          <RefreshCw size={14} className="mr-1" /> Reset to suggested
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => regenerate(true)} isLoading={busy === "ai"}
                          title="Optional: ask the AI for more wordings (uses the AI budget)">
                          <Sparkles size={14} className="mr-1" /> Suggest more with AI
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {!variants && !poolOnly ? <p className="text-sm text-[#B0BEC5]"><Loader2 size={14} className="inline animate-spin mr-1" /> Preparing variations…</p> : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {list.map((v) => editing?.from === v ? (
                        <input key={v} autoFocus className={cn(inputClass, "py-1 text-xs w-64")} aria-label={`Edit ${v}`}
                          value={editing.value} maxLength={80} onChange={(e) => setEditing({ from: v, value: e.target.value })}
                          onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }} />
                      ) : (
                        <span key={v} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[#132F4C] border border-[#2A3F5E] text-[#E0E0E0]">
                          <button className="hover:text-white" title="Click to edit" onClick={() => setEditing({ from: v, value: v })}>{v}</button>
                          <button aria-label={`Remove ${v}`} className="hover:text-[#FF5252]"
                            onClick={() => { setList(list.filter((x) => x !== v)); setEdited(true); setPreview(null); }}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input className={cn(inputClass, "flex-1")} aria-label="Add a job title"
                        placeholder={poolOnly ? "Add a job title, e.g. Warehouse Supervisor" : "Add a phrase, e.g. Full Stack ML Engineer"}
                        value={newVariant} maxLength={80} onChange={(e) => setNewVariant(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addVariant(newVariant); }} />
                      <Button size="sm" variant="secondary" onClick={() => addVariant(newVariant)}><Plus size={14} /></Button>
                    </div>
                    {variants && variants.rejected.length > 0 && (
                      <p className="text-xs text-[#546E7A] mt-2">
                        Not added – may be a different role:{" "}
                        {variants.rejected.filter((r) => !list.includes(r.variant)).map((r) => (
                          <button key={r.variant} className="underline mr-2 hover:text-white" onClick={() => addVariant(r.variant)}
                            title="Add it anyway (searches for this wording too)">+ {r.variant}</button>
                        ))}
                      </p>
                    )}
                    <p className="text-xs text-[#546E7A] mt-2">
                      Every e-mail received in the period is checked. A subject matches when it contains all the words of one
                      phrase, in any order – ignoring case, spaces, hyphens and punctuation, and prefixes such as RE:, FW:,
                      &quot;Application for&quot;, &quot;CV for&quot; or &quot;Resume for&quot;. AI / Artificial Intelligence and
                      Fullstack / Full-Stack / Full Stack count as the same. A small typo is shown as a possible match.
                    </p>
                    {!poolOnly && (
                      <details className="mt-2">
                        <summary className="text-xs text-[#B0BEC5] cursor-pointer">Test the phrases with sample subjects</summary>
                        <textarea className={cn(inputClass, "w-full mt-2 h-20")} aria-label="Sample subjects, one per line"
                          placeholder={"One subject per line, e.g.\nRE: Application for Full-Stack AI Engineer"}
                          value={previewText} onChange={(e) => { setPreviewText(e.target.value); setPreview(null); }} />
                        <div className="flex justify-end mt-1">
                          <Button size="sm" variant="secondary" onClick={runPreview} isLoading={busy === "preview"}
                            disabled={!previewText.trim() || !list.length}>Test</Button>
                        </div>
                        {preview && (
                          <ul className="mt-2 space-y-1" data-testid="phrase-preview">
                            {preview.map((p) => (
                              <li key={p.subject} className="text-xs flex flex-wrap items-start gap-2">
                                {p.matches ? <CheckCircle2 size={14} className="text-[#00C853] mt-0.5" /> : <XCircle size={14} className="text-[#FF8A80] mt-0.5" />}
                                <span className="text-[#E0E0E0] break-words">{p.subject}</span>
                                <span className="text-[#546E7A]">{p.matches ? (p.level === "possible" ? `possible match – ${p.explanation}` : `matches “${p.phrase}”`) : "does not match – not offered"}</span>
                                {p.other_jobs.length > 0 && <span className="text-yellow-300">also names: {p.other_jobs.map((j) => j.title).join(", ")}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                    )}
                  </>
                )}
                <div className="flex items-center justify-end gap-3 mt-3">
                  {progress !== null && (
                    <span className="text-xs text-[#B0BEC5]" data-testid="search-progress">
                      <Loader2 size={12} className="inline animate-spin mr-1" /> Searching… {progress} e-mail(s) checked
                    </span>
                  )}
                  <Button onClick={() => runSearch("narrow")} isLoading={busy === "narrow"}
                    disabled={!connectionId || !list.length || (!variants && !poolOnly)}>
                    <Search size={16} className="mr-2" /> Search mailbox
                  </Button>
                </div>
              </section>

              {searchError && (
                <div role="alert" className="rounded-lg border border-[#FF5252]/40 bg-[#FF5252]/10 p-3 text-sm text-[#FF8A80] flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><XCircle size={16} /> Search failed – no e-mails were checked. {searchError}</span>
                  <Button size="sm" variant="secondary" onClick={() => runSearch("narrow")} isLoading={busy === "narrow"}>Retry</Button>
                </div>
              )}

              {search && (
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-sm text-[#E0E0E0]">
                      {results.length} matching e-mail(s) with attachments{search.mode === "broad" ? " (broader search)" : ""}
                    </p>
                    <div className="flex gap-2">
                      {results.some((r) => r.match.level === "strong") && (
                        <Button size="sm" variant="ghost" onClick={selectStrong}>Select strong matches</Button>
                      )}
                      {search.mode === "narrow" && (
                        <Button size="sm" variant="ghost" onClick={() => runSearch("broad")} isLoading={busy === "broad"}>Broader search…</Button>
                      )}
                    </div>
                  </div>
                  {search.coverage && search.coverage.windows_total > 0 && (
                    <p className="mb-2 text-xs text-[#546E7A]" data-testid="scan-coverage">
                      {search.complete ? "Every e-mail in the period was checked" : "Checked so far"}:{" "}
                      {search.coverage.searched_from ? `${formatDate(search.coverage.searched_from)} – ${formatDate(search.coverage.searched_to)}` : "not yet"}
                      {" "}({search.coverage.windows_done} of {search.coverage.windows_total} periods)
                      {search.totals.listed ? ` · ${search.totals.listed} e-mails looked at` : ""}.
                      {" "}Results reflect the mailbox when each period was searched.
                    </p>
                  )}
                  {search.incomplete && (
                    <div className="mb-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><AlertTriangle size={16} /> Search incomplete. {search.incomplete_reason}
                        {search.estimated_total > 0 && <> (The mailbox estimates about {search.estimated_total} e-mail(s).)</>}</span>
                      {search.can_load_more && <Button size="sm" variant="secondary" onClick={loadMore} isLoading={busy === "more"}>Load more</Button>}
                    </div>
                  )}
                  {search.summary && <SearchSummary summary={search.summary} poolOnly={poolOnly} />}
                  <ul className="space-y-3">
                    {results.map((r) => <ResultCard key={r.message_id} result={r} selected={selected[r.message_id]}
                                                    onToggle={(part) => toggle(r.message_id, part)} selectable={selectable}
                                                    jobTitle={jobTitle} confirmed={confirmed.has(r.message_id)}
                                                    onConfirm={(yes) => setConfirmed((prev) => {
                                                      const next = new Set(prev);
                                                      if (yes) next.add(r.message_id); else next.delete(r.message_id);
                                                      return next;
                                                    })} />)}
                  </ul>
                  {skipped.length > 0 && (
                    <details open className="mt-4" data-testid="skipped-emails">
                      <summary className="text-sm text-yellow-200 cursor-pointer">
                        {skipped.length} e-mail(s) name this {poolOnly ? "title" : "job"} but cannot be imported
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {skipped.map((m) => (
                          <li key={m.message_id} className="bg-[#132F4C] rounded-lg p-3 text-sm">
                            <p className="text-white break-words">{m.subject || "(no subject)"}</p>
                            <p className="text-xs text-[#546E7A]">{formatDate(m.received_at)}{m.sender_domain ? ` · from …@${m.sender_domain}` : ""}</p>
                            <p className="text-xs text-yellow-200 mt-1">{m.detail}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {!run && search && (
          <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-[#2A3F5E]">
            <p className="text-xs text-[#546E7A]">
              {needsConfirmation
                ? <span className="text-yellow-200">{needsConfirmation} selected e-mail(s) also name another open job – confirm the job on each before importing.</span>
                : "The sender is kept as the e-mail's source; the candidate is identified from the CV itself."}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={startImport} disabled={!selectedCount || needsConfirmation > 0} isLoading={busy === "import"}>
                <Paperclip size={16} className="mr-2" /> Import {selectedCount} CV{selectedCount === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SearchSummary({ summary, poolOnly }: { summary: NonNullable<MailSearchResponse["summary"]>; poolOnly: boolean }) {
  const parts = [
    `${summary.listed} e-mail(s) checked`,
    `${summary.subject_matched} name this ${poolOnly ? "title" : "job"}`,
    summary.importable ? `${summary.importable} with a CV to import` : null,
    summary.already_imported ? `${summary.already_imported} already imported` : null,
    summary.no_eligible_cv ? `${summary.no_eligible_cv} without a PDF/DOCX file` : null,
    summary.own_mail ? `${summary.own_mail} our own mail (not offered)` : null,
    summary.outside_period ? `${summary.outside_period} outside the period` : null,
    summary.not_matching ? `${summary.not_matching} about other things (not shown)` : null,
  ].filter(Boolean);
  return (
    <div className="mb-3" data-testid="search-summary">
      <p className="text-xs text-[#B0BEC5]">{parts.join(" · ")}</p>
      {summary.empty_text && (
        <p className={cn("mt-2 rounded-lg border p-3 text-sm",
          summary.empty_reason === "all_imported" ? "border-[#00C853]/40 bg-[#00C853]/10 text-[#B9F6CA]"
            : "border-yellow-500/40 bg-yellow-500/10 text-yellow-200")}>{summary.empty_text}</p>
      )}
    </div>
  );
}

function ResultCard({ result, selected, onToggle, selectable, jobTitle, confirmed, onConfirm }: {
  result: MailSearchResultItem; selected?: Set<string>; onToggle: (partId: string) => void;
  selectable: (a: MailAttachmentPreview) => boolean; jobTitle?: string; confirmed: boolean;
  onConfirm: (yes: boolean) => void;
}) {
  const otherJobs = result.other_jobs || [];
  const match = MATCH[result.match.level] || MATCH.weak;
  return (
    <li className="bg-[#132F4C] rounded-lg p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium break-words">{result.subject || "(no subject)"}</p>
          <p className="text-xs text-[#B0BEC5] mt-0.5 break-all">
            From {result.sender_name ? `${result.sender_name} ` : ""}{result.sender_email ? `<${result.sender_email}>` : ""} · {formatDate(result.received_at)}
          </p>
          {result.forwarded && (
            <p className="text-xs text-blue-300 mt-0.5 flex items-center gap-1">
              <Forward size={12} /> Forwarded{result.forwarded_from_email || result.forwarded_from_name
                ? ` – original sender ${result.forwarded_from_name || ""} ${result.forwarded_from_email ? `<${result.forwarded_from_email}>` : ""}` : ""}
            </p>
          )}
        </div>
        <span className={cn("px-2 py-0.5 rounded-full text-xs whitespace-nowrap", match.className)} title={result.match.explanation}>{match.label}</span>
      </div>
      <p className="text-xs text-[#546E7A] mt-1">{result.match.explanation}</p>
      {otherJobs.length > 0 && (
        <div className="mt-2 rounded border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-200">
          <p className="flex items-center gap-1"><AlertTriangle size={12} /> Also names another open job: {otherJobs.map((j) => j.title).join(", ")}.</p>
          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} />
            This is an application for {jobTitle || "this job"}
          </label>
        </div>
      )}
      {result.text && (
        <details className="mt-2">
          <summary className="text-xs text-[#B0BEC5] cursor-pointer">E-mail text</summary>
          <p className="mt-1 text-xs text-[#E0E0E0] whitespace-pre-wrap break-words max-h-48 overflow-y-auto bg-[#0f2236] rounded p-2">
            {result.text}{result.text_truncated ? "\n…" : ""}
          </p>
        </details>
      )}
      <ul className="mt-2 space-y-1">
        {result.attachments.map((a) => {
          const status = ATTACHMENT_STATUS[a.import_status];
          const can = selectable(a);
          return (
            <li key={a.part_id} className={cn("flex flex-wrap items-center gap-2 text-sm", !can && "opacity-70")}>
              <input type="checkbox" disabled={!can} checked={!!selected?.has(a.part_id)} onChange={() => onToggle(a.part_id)}
                aria-label={`Select ${a.filename}`} />
              <Paperclip size={14} className="text-[#B0BEC5]" />
              <span className="text-[#E0E0E0] break-all">{a.filename}</span>
              <span className="text-xs text-[#546E7A]">{size(a.size)}{a.nested_in_email ? " · inside an attached e-mail" : ""}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs", status.className)} title={a.import_detail || a.reason || undefined}>{status.label}</span>
              {!a.supported && a.reason && <span className="text-xs text-[#FF8A80]">{a.reason}</span>}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function RunProgress({ run, busy, onCancel, onRetry, onBack, canSearchAgain, poolOnly }: {
  run: MailImportRun; busy: string | null; onCancel: () => void; onRetry: () => void; onBack: () => void;
  canSearchAgain: boolean; poolOnly?: boolean;
}) {
  const active = ["queued", "running"].includes(run.status);
  const done = run.total - (run.counts.pending || 0) - (run.counts.processing || 0);
  const retryable = (run.counts.failed || 0) + (run.counts.cancelled || 0) + (run.counts.pending || 0) > 0 && !active;
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-white font-medium flex items-center gap-2">
            {active ? <Loader2 size={16} className="animate-spin text-blue-300" />
              : run.status === "completed" ? <CheckCircle2 size={16} className="text-[#00C853]" />
                : <XCircle size={16} className="text-yellow-300" />}
            {RUN_STATUS[run.status]} · {done} of {run.total} file(s)
          </p>
          <p className="text-xs text-[#B0BEC5] mt-0.5">
            {run.counts.imported || 0} imported · {run.counts.duplicate || 0} already imported · {run.counts.rejected || 0} not usable ·{" "}
            {run.counts.failed || 0} failed{run.cancel_requested && active ? " · cancelling after the current file" : ""}
          </p>
          {run.status_reason && <p className="text-xs text-yellow-200 mt-1">{run.status_reason}</p>}
          {run.status === "paused_reconnect" && (
            <p className="text-xs text-yellow-200 mt-1">Reconnect the mailbox on the <Link href="/dashboard/system" className="underline">System page</Link>, then click Retry. Files already imported are not imported again.</p>
          )}
        </div>
        <div className="flex gap-2">
          {active && <Button size="sm" variant="danger" onClick={onCancel} isLoading={busy === "cancel"} disabled={run.cancel_requested}>Cancel import</Button>}
          {retryable && <Button size="sm" variant="secondary" onClick={onRetry} isLoading={busy === "retry"}><RotateCcw size={14} className="mr-1" /> Retry</Button>}
          {!active && canSearchAgain && <Button size="sm" variant="ghost" onClick={onBack}>Back to results</Button>}
        </div>
      </div>
      <p className="text-xs text-[#546E7A] mt-2">
        {poolOnly
          ? "Imported CVs are added to the Candidate Pool only. Open a person there to add them to a job."
          : "Imported CVs are extracted once (or their existing profile is reused) and then assessed for this job; the ranking updates automatically."}
      </p>
      <ul className="mt-3 space-y-1 max-h-80 overflow-y-auto">
        {(run.items || []).map((item) => (
          <li key={item.item_id} className="flex flex-wrap items-start gap-2 text-sm bg-[#132F4C] rounded p-2">
            <Paperclip size={14} className="text-[#B0BEC5] mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[#E0E0E0] break-all">{item.filename || `Attachment ${item.part_id}`}
                {item.candidate_name && <span className="text-[#B0BEC5]"> → {item.candidate_name}</span>}</p>
              {item.subject && <p className="text-xs text-[#546E7A] break-words">{item.subject}{item.sender ? ` · from ${item.sender}` : ""}</p>}
              {item.reason && <p className="text-xs text-[#B0BEC5]">{item.reason}</p>}
            </div>
            <span className={cn("text-xs whitespace-nowrap", ITEM_STATUS[item.status].className)}>
              {ITEM_STATUS[item.status].label}{item.processing_status && item.status === "imported" ? ` · ${item.processing_status}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
