"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Radar, Sparkles, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { candidatesAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { AnalysisState, CandidateAssessment } from "@/types";
import { SOURCE_KIND, StatusChip } from "./HeadhuntingBits";

/** Recruitment record of an application added from headhunting: provenance, CV, and the explicit paid analysis. */
export function HeadhuntedApplication({ data, onChanged }: { data: CandidateAssessment; onChanged: () => void }) {
  const [state, setState] = useState<AnalysisState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setState((await candidatesAPI.analysis(data.candidate_id)).data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load the analysis state"));
    }
  }, [data.candidate_id]);

  useEffect(() => { load(); }, [load, data.processing_status]);

  const attach = async (file: File) => {
    setBusy("cv");
    try {
      const res = await candidatesAPI.attachCV(data.candidate_id, file);
      toast.success(res.data.identity_review_opened
        ? "CV attached - it already belongs to someone in the pool, so an identity review was opened"
        : "CV attached. No AI analysis has run.");
      onChanged();
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not attach the CV"));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const analyse = async () => {
    setBusy("analysis");
    try {
      const res = await candidatesAPI.requestAnalysis(data.candidate_id);
      toast.success(res.data.created ? "AI analysis started" : "AI analysis is already running");
      onChanged();
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start the analysis"));
    } finally {
      setBusy(null);
    }
  };

  const provenance = data.headhunting?.provenance || [];
  const blockers = state?.blockers || [];
  const latest = state?.requests?.[0];
  const running = data.processing_status === "pending" || data.processing_status === "processing";
  return (
    <Card className="space-y-4" aria-label="Headhunting provenance and analysis">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Radar size={18} className="text-[#00C853]" />
          Found by Headhunting</h2>
        {data.pool_candidate_id && <Link href={`/dashboard/candidate-pool/${data.pool_candidate_id}`}
          className="text-sm text-[#00C853] hover:underline">View in Candidate Pool</Link>}
      </div>
      <p className="text-xs text-[#B0BEC5]">This person has not applied. No one has been contacted by the app.</p>
      {data.headhunting?.cv_name_mismatch && (
        <p className="text-xs text-yellow-300 flex items-center gap-1" data-testid="cv-name-mismatch">
          <AlertTriangle size={12} /> {data.headhunting.cv_name_mismatch.message}</p>
      )}
      {(data.headhunting?.open_identity_reviews || 0) > 0 && (
        <p className="text-xs text-yellow-300 flex items-center gap-1" data-testid="identity-review-warning">
          <AlertTriangle size={12} /> Possible duplicate – resolve the identity review in the Candidate Pool before analysis.</p>
      )}

      <div className="rounded-lg bg-[#132F4C] p-3 space-y-2" data-testid="analysis-section">
        <p className="text-sm text-white font-medium flex items-center gap-2"><Sparkles size={14} /> AI job analysis</p>
        {state?.cv_required ? (
          <div className="space-y-2">
            <p className="text-sm text-[#B0BEC5]" data-testid="cv-required"><strong className="text-white">CV required for analysis.</strong>{" "}
              The AI analysis compares a CV with the job; public-profile evidence is shown below but is never treated as a CV.</p>
            <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" aria-label="CV file"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) attach(f); }} />
            <Button size="sm" variant="secondary" isLoading={busy === "cv"} onClick={() => fileRef.current?.click()}>
              <Upload size={14} className="mr-1" /> Attach CV
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button size="sm" isLoading={busy === "analysis"} disabled={blockers.length > 0 || running} onClick={analyse}>
              {`Run AI analysis (paid, max $${(state?.max_cost_usd ?? 0).toFixed(2)})`}
            </Button>
            {running && <p className="text-xs text-blue-300">Analysis in progress – this page refreshes automatically.</p>}
            {blockers.map((b) => <p key={b.code} className="text-xs text-[#546E7A]" data-testid="analysis-blocker">{b.message}</p>)}
          </div>
        )}
        {latest && (
          <p className="text-xs text-[#B0BEC5]" data-testid="analysis-request">
            Last request: {latest.status}
            {latest.spent_usd !== null && ` · ${latest.llm_calls} AI call(s), $${latest.spent_usd.toFixed(4)}`}
            {latest.status === "failed" && latest.error && <span className="block text-[#FF8A80]">{latest.error}</span>}
          </p>
        )}
      </div>

      {provenance.map((p) => (
        <div key={p.link_id} className="space-y-2 text-xs" data-testid="provenance">
          <a href={p.canonical_url} target="_blank" rel="noopener noreferrer"
            className="text-[#00C853] hover:underline inline-flex items-center gap-1 break-all">{p.canonical_url} <ExternalLink size={12} /></a>
          {p.headline && <p className="text-[#B0BEC5]">{p.headline}</p>}
          <p className="text-[#546E7A]">{p.evidence.label} Added {p.added_at ? new Date(p.added_at).toLocaleDateString() : ""}
            {p.origin.job_id && p.origin.run_id && <> · <Link className="text-[#00C853] hover:underline"
              href={`/dashboard/jobs/${p.origin.job_id}/headhunting/${p.origin.run_id}`}>headhunting run</Link></>}</p>
          {(p.evidence.requirements || []).length > 0 && (
            <div className="flex flex-wrap gap-1">{p.evidence.requirements!.map((r) => <StatusChip key={r.requirement} status={r.status} label={r.requirement} />)}</div>
          )}
          {(p.evidence.search_sources || []).slice(0, 3).map((s, i) => (
            <p key={i} className="text-[#B0BEC5]"><span className="px-1.5 py-0.5 mr-1 rounded bg-[#0A1929]">Search snippet</span>
              {s.title} – {s.snippet}{(s.queries || 1) > 1 && <span className="text-[#546E7A]"> (returned by {s.queries} queries)</span>}</p>
          ))}
          {(p.evidence.fetched_sources || []).map((s, i) => (
            <p key={`f${i}`} className="text-[#B0BEC5]"><span className="px-1.5 py-0.5 mr-1 rounded bg-[#0A1929]">{SOURCE_KIND[s.source_kind] || s.source_kind}</span>
              {s.url}</p>
          ))}
        </div>
      ))}
    </Card>
  );
}
