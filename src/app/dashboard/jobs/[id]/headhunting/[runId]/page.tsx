"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { headhuntingAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { HHProspect, HHReviewStatus, HHRun } from "@/types";
import { CostBadge, DISAGREEMENT, DisclaimerBanner, REQUIREMENT_STATUS, RunStatusBadge, SOURCE_KIND, StatusChip, issueText, prospectLabel } from "@/components/headhunting/HeadhuntingBits";
import { ProspectDetail } from "@/components/headhunting/ProspectDetail";

const STAGES = ["requirements", "queries", "search", "screen", "research", "assess", "done"];
const STAGE_LABEL: Record<string, string> = {
  requirements: "Requirements", queries: "Queries", search: "Search", screen: "Screen", research: "Research",
  assess: "Assess", done: "Done",
};
const REVIEW_LABEL: Record<HHReviewStatus, string> = {
  new: "New", shortlist_for_review: "Shortlist for review", needs_more_info: "Needs more info", not_relevant: "Not relevant",
};
const ACTIVE = ["queued", "running"];
const ITEM_KIND: Record<string, string> = {
  search_query: "Search query", research_lead: "Research", research_unattached: "Research (other pages)",
  assess_lead: "Assessment",
};

function Usage({ run }: { run: HHRun }) {
  const rows: [string, number | undefined, number | undefined][] = [
    ["Search requests", run.usage?.engine_requests, run.limits?.max_engine_requests],
    ["Page fetches", run.usage?.fetches, run.limits?.max_fetches],
  ];
  if (run.mode === "ai") {
    rows.push(["AI calls", run.usage?.llm_calls, run.limits?.max_llm_calls]);
    rows.push(["AI spend (USD, upper bound)", run.usage?.spent_upper_bound_usd, run.limits?.max_cost_usd]);
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {rows.map(([label, used, max]) => (
        <div key={label} className="rounded-lg bg-[#132F4C] p-3">
          <p className="text-xs text-[#B0BEC5]">{label}</p>
          <p className="text-white text-sm font-medium">{typeof used === "number" ? Number(used.toFixed(4)) : 0} / {max ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

export default function HeadhuntingRunPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const runId = params.runId as string;
  const [run, setRun] = useState<HHRun | null>(null);
  const [prospects, setProspects] = useState<HHProspect[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<string>("");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const filters: Record<string, string> = {};
      if (reviewFilter) filters.review_status = reviewFilter;
      if (statusFilter) filters.has_status = statusFilter;
      if (expiringOnly) filters.expiring_soon = "true";
      const res = await headhuntingAPI.prospects(runId, filters);
      setRun(res.data.run);
      setProspects(res.data.prospects || []);
      setNotFound(false);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 403) {
        setRun(null);          // also stops polling
        setProspects([]);
        setNotFound(true);
      } else {
        toast.error(getErrorMessage(error, "Could not load the run"));
      }
    }
  }, [runId, reviewFilter, statusFilter, expiringOnly]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!run || !ACTIVE.includes(run.status)) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [run, load]);

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

  const noteOf = (p: HHProspect) => notes[p.prospect_id] ?? p.review.note ?? "";
  const setReview = (p: HHProspect, status: HHReviewStatus) =>
    act(() => headhuntingAPI.review(jobId, { canonical_url: p.canonical_url, status, note: noteOf(p) || null }), "Review saved");
  const saveNote = (p: HHProspect) => {
    if (noteOf(p) === (p.review.note ?? "")) return;
    setReview(p, p.review.status);
  };

  const closeDetail = useCallback(() => setSelected(null), []);
  const stageIndex = run ? STAGES.indexOf(run.stage) : -1;
  const errors = (run?.counts?.stage_errors as { stage: string; error: unknown }[] | undefined) || [];
  const failedItems = run?.failed_items || [];

  if (notFound) {
    return (
      <div className="space-y-6">
        <button onClick={() => router.push(`/dashboard/jobs/${jobId}`)} aria-label="Back to job"
          className="p-2 rounded-lg hover:bg-[#132F4C] text-[#B0BEC5] hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <Card>
          <h1 className="text-xl font-semibold text-white">Run not found or not accessible</h1>
          <p className="text-sm text-[#B0BEC5] mt-1">This headhunting run does not exist, Headhunting is not enabled,
            or you do not have permission to view it.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {selected && <ProspectDetail prospectId={selected} jobId={jobId} onClose={closeDetail}
        onDeleted={() => { setSelected(null); load(); }} />}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => router.push(`/dashboard/jobs/${jobId}`)} aria-label="Back to job"
            className="p-2 rounded-lg hover:bg-[#132F4C] text-[#B0BEC5] hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">Headhunting run
              {run && <CostBadge mode={run.mode} />}{run && <RunStatusBadge status={run.status} />}</h1>
            {run && <p className="text-sm text-[#B0BEC5]">{run.filters?.location} · {run.mode === "ai" ? `AI assessment (${run.model}) – paid, max $${run.limits?.max_cost_usd}` : "Free search – rules only, no AI cost"}
              {run.status_reason ? ` · ${run.status_reason}` : ""}</p>}
          </div>
        </div>
        {run && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw size={14} className="mr-1" /> Refresh</Button>
            {ACTIVE.includes(run.status) && (
              <Button size="sm" variant="danger" isLoading={busy} disabled={run.cancel_requested}
                onClick={() => act(() => headhuntingAPI.cancel(runId), "Cancellation requested")}>
                <XCircle size={14} className="mr-1" /> {run.cancel_requested ? "Cancelling…" : "Cancel"}
              </Button>
            )}
            {["cancelled", "failed", "completed_with_errors", "budget_exhausted"].includes(run.status) && (
              <Button size="sm" variant="secondary" isLoading={busy}
                onClick={() => act(() => headhuntingAPI.retry(runId), "Run resumed within the remaining limits")}>
                <RotateCcw size={14} className="mr-1" /> Retry
              </Button>
            )}
          </div>
        )}
      </div>

      <DisclaimerBanner disclaimers={run?.disclaimers} />

      {run && (
        <Card className="space-y-4">
          <ol className="flex flex-wrap gap-2" aria-label="Progress">
            {STAGES.map((s, i) => (
              <li key={s} className={cn("px-3 py-1 rounded-full text-xs border",
                i < stageIndex || run.stage === "done" ? "border-[#00C853]/50 text-[#00C853]"
                  : i === stageIndex ? "border-blue-400 text-blue-300 animate-pulse" : "border-[#2A3F5E] text-[#546E7A]")}>
                {STAGE_LABEL[s]}
                {s === "search" && run.items?.search_query && ` ${run.items.search_query.done || 0}/${Object.values(run.items.search_query).reduce((a, b) => a + b, 0)}`}
                {s === "assess" && run.items?.assess_lead && ` ${run.items.assess_lead.done || 0}/${Object.values(run.items.assess_lead).reduce((a, b) => a + b, 0)}`}
              </li>
            ))}
          </ol>
          <Usage run={run} />
          {Number(run.counts?.suppressed || 0) > 0 && (
            <p className="text-xs text-[#B0BEC5]" data-testid="suppressed-count">
              {String(run.counts?.suppressed)} profile(s) skipped: deleted earlier with &quot;do not collect again&quot;.</p>
          )}
          {errors.length + failedItems.length > 0 && (
            <details open className="text-xs text-yellow-300">
              <summary className="cursor-pointer inline-flex items-center gap-1">
                <AlertTriangle size={12} /> {errors.length + failedItems.length} recorded issue(s)</summary>
              <ul className="mt-1 space-y-1 text-[#B0BEC5]">
                {failedItems.map((f) => (
                  <li key={`${f.kind}:${f.key}`}>{ITEM_KIND[f.kind] || f.kind} {f.key}: failed after {f.attempts} attempt(s)
                    {f.reason && ` – ${f.reason}`}</li>
                ))}
                {errors.map((e, i) => <li key={i}>{e.stage}: {issueText(e.error)}</li>)}
              </ul>
              {["completed_with_errors", "failed"].includes(run.status) &&
                <p className="mt-1 text-[#546E7A]">Retry re-attempts failed items within the run&apos;s remaining limits.</p>}
            </details>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Prospects ({prospects.length})</h2>
            <p className="text-xs text-[#B0BEC5]">Every prospect stays visible – including &quot;indicated&quot; ones. HR decides; nothing is rejected automatically. No one has been contacted.</p>
            {run && run.mode !== "ai" && (
              <p className="text-xs text-[#00C853] mt-1" data-testid="free-run-review-hint">
                Free run: requirements are only &quot;indicated&quot; or &quot;unknown&quot; – never &quot;supported&quot;.
                Open each prospect and check that every indicated excerpt is about this person and this requirement.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-sm text-[#B0BEC5]">
              <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)}
                aria-label="Expiring soon only" /> Expiring soon
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-sm text-white px-3 py-1.5" aria-label="Filter by requirement status">
              <option value="">Any requirement status</option>
              {Object.entries(REQUIREMENT_STATUS).map(([k, v]) => <option key={k} value={k}>Has {v.label.toLowerCase()}</option>)}
            </select>
            <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}
              className="bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-sm text-white px-3 py-1.5" aria-label="Filter by review">
              <option value="">All review states</option>
              {Object.entries(REVIEW_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        {prospects.length === 0 ? (
          <p className="text-[#B0BEC5] text-center py-8">{run && ACTIVE.includes(run.status) ? "Searching… prospects appear after the screening stage." : "No prospects."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#B0BEC5] border-b border-[#2A3F5E]">
                  <th className="py-2 pr-3 font-medium">Prospect</th>
                  <th className="py-2 pr-3 font-medium">Requirements</th>
                  <th className="py-2 pr-3 font-medium">Location (rules | AI)</th>
                  <th className="py-2 pr-3 font-medium">Experience statements</th>
                  <th className="py-2 pr-3 font-medium">Review</th>
                  <th className="py-2 font-medium">Retention</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.prospect_id} className="border-b border-[#2A3F5E]/50 align-top">
                    <td className="py-3 pr-3 min-w-[200px]">
                      <button onClick={() => setSelected(p.prospect_id)} className="text-white font-medium hover:text-[#00C853] text-left">
                        {prospectLabel(p).label}
                      </button>
                      {!prospectLabel(p).stated && <p className="text-xs text-[#546E7A]">Name not stated in the sources</p>}
                      {p.headline && <p className="text-xs text-[#B0BEC5] max-w-[260px]">{p.headline}</p>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#132F4C] text-[#B0BEC5]">{p.profile_type.replace(/_/g, " ")}</span>
                        {p.source_kinds.map((k) => <span key={k} className="px-2 py-0.5 rounded-full text-xs bg-[#0A1929] text-[#B0BEC5]">{SOURCE_KIND[k] || k}</span>)}
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#0A1929] text-[#546E7A]">{p.assessment_method === "llm" ? "AI assessed" : "rules diagnostic"}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 min-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {p.requirements.map((r) => <StatusChip key={r.requirement} status={r.status}
                          label={`${r.requirement}${r.activity && r.activity !== "none" ? ` · ${r.activity}` : ""}`} />)}
                      </div>
                      <p className="text-xs text-[#546E7A] mt-1">{p.status_counts.supported} supported · {p.status_counts.indicated} indicated ·
                        {" "}{p.status_counts.unknown} unknown · {p.status_counts.contradicted} contradicted</p>
                    </td>
                    <td className="py-3 pr-3 text-xs text-[#B0BEC5] min-w-[180px]">
                      <p><span className="text-white">{p.deterministic.current_location?.value || "unknown"}</span>
                        {p.ai && <> | <span className="text-white">{p.ai.current_location?.value || "unknown"}</span></>}</p>
                      {p.deterministic.availability?.value && <p>available: {p.deterministic.availability.value}</p>}
                      {p.deterministic.relocation_preference?.value && <p>open to: {p.deterministic.relocation_preference.value}</p>}
                      {p.deterministic.location_hints.length > 0 && <p className="text-[#546E7A]">hint: {p.deterministic.location_hints.join(", ")}</p>}
                      {p.disagreements.map((d) => <p key={d} className="text-yellow-300 flex items-center gap-1"><AlertTriangle size={11} /> {DISAGREEMENT[d] || d}</p>)}
                    </td>
                    <td className="py-3 pr-3 text-xs text-[#B0BEC5] max-w-[220px]">
                      {p.deterministic.experience_claims.map((c) => c.text).join("; ") || "unknown"}
                      {p.ai?.experience_statement?.value && <p className="text-white">AI: {p.ai.experience_statement.value}</p>}
                    </td>
                    <td className="py-3 pr-3">
                      <select value={p.review.status} disabled={busy} onChange={(e) => setReview(p, e.target.value as HHReviewStatus)}
                        className="bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-xs text-white px-2 py-1" aria-label="Review state">
                        {Object.entries(REVIEW_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <input value={noteOf(p)} placeholder="Note" aria-label="Review note" maxLength={1000}
                        onChange={(e) => setNotes((n) => ({ ...n, [p.prospect_id]: e.target.value }))}
                        onBlur={() => saveNote(p)}
                        className="mt-1 block w-40 bg-[#0A1929] border border-[#2A3F5E] rounded-lg text-xs text-white px-2 py-1" />
                    </td>
                    <td className="py-3 pl-3 text-xs whitespace-nowrap" data-testid="retention-cell">
                      {p.retention.days_left !== null && (
                        <span className={cn("px-2 py-0.5 rounded-full", p.retention.expiring_soon
                          ? "bg-yellow-500/15 text-yellow-300" : "bg-[#132F4C] text-[#B0BEC5]")}
                          title={p.retention.expires_at ? `Deleted on ${new Date(p.retention.expires_at).toLocaleDateString()}` : undefined}>
                          Deleted in {p.retention.days_left} day(s)
                        </span>
                      )}
                      {p.retention.extended && <p className="mt-1 text-[#546E7A]">extended</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
