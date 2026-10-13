"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertTriangle, CheckCircle2, Forward, Loader2, Mail, Paperclip, Plus, RefreshCw, RotateCcw, Search, Sparkles, X,
  XCircle,
} from "lucide-react";
import { gmailAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import {
  GmailAttachmentPreview, GmailConnection, GmailConnectionsResponse, GmailImportRun, GmailItemStatus,
  GmailSearchResponse, GmailSearchResultItem, GmailVariants,
} from "@/types";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/components/pool/PoolBits";

const inputClass = "bg-[#132F4C] border border-[#2A3F5E] rounded-lg px-3 py-2 text-white text-sm placeholder-[#546E7A] focus:outline-none focus:border-[#00C853]";
const POLL_MS = 2500;

const MATCH: Record<string, { label: string; className: string }> = {
  strong: { label: "Strong match", className: "bg-[#00C853]/15 text-[#00C853]" },
  possible: { label: "Possible match", className: "bg-yellow-500/15 text-yellow-300" },
  weak: { label: "Weak – broader search", className: "bg-orange-500/15 text-orange-300" },
};

const ATTACHMENT_STATUS: Record<GmailAttachmentPreview["import_status"], { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-500/15 text-blue-300" },
  in_pool: { label: "In pool – profile reused", className: "bg-[#00C853]/15 text-[#00C853]" },
  in_job: { label: "Already in this job", className: "bg-[#546E7A]/20 text-[#B0BEC5]" },
  unsupported: { label: "Not importable", className: "bg-[#FF5252]/15 text-[#FF8A80]" },
};

export const ITEM_STATUS: Record<GmailItemStatus, { label: string; className: string }> = {
  pending: { label: "Waiting", className: "text-[#B0BEC5]" },
  processing: { label: "Importing…", className: "text-blue-300" },
  imported: { label: "Imported", className: "text-[#00C853]" },
  duplicate: { label: "Already imported", className: "text-yellow-300" },
  rejected: { label: "Not a usable CV", className: "text-[#FF8A80]" },
  failed: { label: "Failed – retryable", className: "text-[#FF5252]" },
  cancelled: { label: "Cancelled", className: "text-[#546E7A]" },
};

export const RUN_STATUS: Record<GmailImportRun["status"], string> = {
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
 * Historical Gmail search for one job: choose a mailbox and period, review the title/subject
 * variations, preview matching application e-mails and import the selected CV attachments.
 * Nothing is imported until HR selects attachments; the e-mail text is shown as plain text.
 */
export function GmailImportModal({ jobId, jobTitle, initialRunId, onClose, onImported }: {
  jobId: string; jobTitle: string; initialRunId?: string | null; onClose: () => void; onImported: () => void;
}) {
  const [connections, setConnections] = useState<GmailConnection[] | null>(null);
  const [connectionId, setConnectionId] = useState("");
  const [period, setPeriod] = useState<"all" | "range">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [variants, setVariants] = useState<GmailVariants | null>(null);
  const [list, setList] = useState<string[]>([]);
  const [edited, setEdited] = useState(false);
  const [newVariant, setNewVariant] = useState("");
  const [search, setSearch] = useState<GmailSearchResponse | null>(null);
  const [results, setResults] = useState<GmailSearchResultItem[]>([]);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [run, setRun] = useState<GmailImportRun | null>(null);
  const requestKey = useRef(requestId());
  const notified = useRef<string | null>(null);

  useEffect(() => {
    gmailAPI.connections().then((res) => {
      const data = res.data as GmailConnectionsResponse;
      const usable = data.connections.filter((c) => c.status === "active");
      setConnections(usable);
      if (usable.length) setConnectionId(usable[0].connection_id);
    }).catch((err) => { toast.error(getErrorMessage(err, "Could not load mailboxes")); setConnections([]); });
    gmailAPI.variants(jobId).then((res) => {
      const v = res.data as GmailVariants;
      setVariants(v);
      setList(v.variants);
    }).catch((err) => toast.error(getErrorMessage(err, "Could not prepare title variations")));
  }, [jobId]);

  const loadRun = useCallback(async (runId: string) => {
    try {
      const res = await gmailAPI.run(runId);
      setRun(res.data as GmailImportRun);
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

  const regenerate = async () => {
    setBusy("variants");
    try {
      const res = await gmailAPI.regenerateVariants(jobId);
      const v = res.data as GmailVariants;
      setVariants(v);
      setList(v.variants);
      setEdited(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not regenerate variations"));
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
    try {
      if (edited) {
        await gmailAPI.saveVariants(jobId, list);
        setEdited(false);
      }
      const res = await gmailAPI.search({
        connection_id: connectionId, job_id: jobId, variants: list, mode, confirm_broad: mode === "broad",
        ...(period === "range" ? { date_from: dateFrom, date_to: dateTo } : {}),
      });
      const data = res.data as GmailSearchResponse;
      setSearch(data);
      setResults(data.results);
      setSelected({});
      if (!data.results.length) toast("No matching e-mails with CV attachments in this period.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Gmail search failed"));
    } finally {
      setBusy(null);
    }
  };

  const loadMore = async () => {
    if (!search) return;
    setBusy("more");
    try {
      const res = await gmailAPI.more(search.search_id);
      const data = res.data as GmailSearchResponse;
      setSearch(data);
      setResults((prev) => {
        const seen = new Set(prev.map((r) => r.message_id));
        return [...prev, ...data.results.filter((r) => !seen.has(r.message_id))];
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load more results"));
    } finally {
      setBusy(null);
    }
  };

  const selectable = (a: GmailAttachmentPreview) => a.supported && a.import_status !== "in_job";
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

  const startImport = async () => {
    if (!search || !selectedCount) return;
    setBusy("import");
    try {
      const selections = Object.entries(selected).filter(([, parts]) => parts.size)
        .map(([message_id, parts]) => ({ message_id, part_ids: Array.from(parts) }));
      const res = await gmailAPI.startImport({ search_id: search.search_id, selections,
                                               client_request_id: requestKey.current });
      requestKey.current = requestId();
      setRun(res.data as GmailImportRun);
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
      const res = action === "cancel" ? await gmailAPI.cancel(run.run_id) : await gmailAPI.retry(run.run_id);
      setRun(res.data as GmailImportRun);
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
        role="dialog" aria-label="Import CVs from Gmail">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2"><Mail size={20} className="text-[#00C853]" /> Import CVs from Gmail</h2>
            <p className="text-sm text-[#B0BEC5]">{jobTitle} · read-only: nothing in the mailbox is changed</p>
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
                  done.has(`${r.message_id}/${a.part_id}`) ? { ...a, import_status: "in_job" as const } : a) })));
                setSelected({});
                setRun(null);
              }} canSearchAgain={!!search} />
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
                          {c.mailbox_email}{c.is_owner ? "" : ` (shared by ${c.owner_name || "a colleague"})`}
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
                  <label className="text-xs text-[#B0BEC5]">Job-title and subject variations</label>
                  <div className="flex items-center gap-2">
                    {variants && (
                      <span className="text-xs text-[#546E7A] flex items-center gap-1">
                        <Sparkles size={12} /> {variants.source === "ai" ? "Suggested by AI" : "Built by local rules (AI unavailable)"}
                        {variants.edited || edited ? " · edited by HR" : ""}
                      </span>
                    )}
                    <Button size="sm" variant="ghost" onClick={regenerate} isLoading={busy === "variants"}>
                      <RefreshCw size={14} className="mr-1" /> Regenerate
                    </Button>
                  </div>
                </div>
                {!variants ? <p className="text-sm text-[#B0BEC5]"><Loader2 size={14} className="inline animate-spin mr-1" /> Preparing variations…</p> : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {list.map((v) => (
                        <span key={v} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[#132F4C] border border-[#2A3F5E] text-[#E0E0E0]">
                          {v}
                          <button aria-label={`Remove ${v}`} className="hover:text-[#FF5252]"
                            onClick={() => { setList(list.filter((x) => x !== v)); setEdited(true); }}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input className={cn(inputClass, "flex-1")} placeholder="Add a variation, e.g. Application for the position of …"
                        value={newVariant} maxLength={80} onChange={(e) => setNewVariant(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addVariant(newVariant); }} />
                      <Button size="sm" variant="secondary" onClick={() => addVariant(newVariant)}><Plus size={14} /></Button>
                    </div>
                    {variants.rejected.length > 0 && (
                      <p className="text-xs text-[#546E7A] mt-2">
                        Not added – may be a different role:{" "}
                        {variants.rejected.filter((r) => !list.includes(r.variant)).map((r) => (
                          <button key={r.variant} className="underline mr-2 hover:text-white" onClick={() => addVariant(r.variant)}
                            title="Add it anyway (searches for this wording too)">+ {r.variant}</button>
                        ))}
                      </p>
                    )}
                    <p className="text-xs text-[#546E7A] mt-2">
                      Gmail is asked only for e-mails with a PDF or DOCX attachment whose subject contains these title words.
                      Each result is then matched here (word order, abbreviations such as AI / Artificial Intelligence, small typos).
                    </p>
                  </>
                )}
                <div className="flex justify-end mt-3">
                  <Button onClick={() => runSearch("narrow")} isLoading={busy === "narrow"}
                    disabled={!connectionId || !list.length || !variants}>
                    <Search size={16} className="mr-2" /> Search Gmail
                  </Button>
                </div>
              </section>

              {search && (
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-sm text-[#E0E0E0]">
                      {results.length} matching e-mail(s){search.mode === "broad" ? " (broader search)" : ""}
                      {search.totals.hidden > 0 && <span className="text-[#546E7A]"> · {search.totals.hidden} other e-mail(s) did not match and are hidden</span>}
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
                  {search.incomplete && (
                    <div className="mb-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><AlertTriangle size={16} /> Search incomplete. {search.incomplete_reason}
                        {search.estimated_total > 0 && <> (Gmail estimates about {search.estimated_total} e-mail(s).)</>}</span>
                      {search.can_load_more && <Button size="sm" variant="secondary" onClick={loadMore} isLoading={busy === "more"}>Load more</Button>}
                    </div>
                  )}
                  <ul className="space-y-3">
                    {results.map((r) => <ResultCard key={r.message_id} result={r} selected={selected[r.message_id]}
                                                    onToggle={(part) => toggle(r.message_id, part)} selectable={selectable} />)}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        {!run && search && (
          <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-[#2A3F5E]">
            <p className="text-xs text-[#546E7A]">The sender is kept as the e-mail&apos;s source; the candidate is identified from the CV itself.</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={startImport} disabled={!selectedCount} isLoading={busy === "import"}>
                <Paperclip size={16} className="mr-2" /> Import {selectedCount} CV{selectedCount === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ResultCard({ result, selected, onToggle, selectable }: {
  result: GmailSearchResultItem; selected?: Set<string>; onToggle: (partId: string) => void;
  selectable: (a: GmailAttachmentPreview) => boolean;
}) {
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

function RunProgress({ run, busy, onCancel, onRetry, onBack, canSearchAgain }: {
  run: GmailImportRun; busy: string | null; onCancel: () => void; onRetry: () => void; onBack: () => void;
  canSearchAgain: boolean;
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
      <p className="text-xs text-[#546E7A] mt-2">Imported CVs are extracted once (or their existing profile is reused) and then assessed for this job; the ranking updates automatically.</p>
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
