"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Database, Edit, FileText, Mail, Play, RefreshCw, RotateCcw, Star, Info } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CVImport } from "@/components/CVImport";
import { JobModal } from "@/components/JobModal";
import { PoolPickerModal } from "@/components/pool/PoolPickerModal";
import { GmailImportModal } from "@/components/gmail/GmailImportModal";
import { GmailImportHistory } from "@/components/gmail/GmailImportHistory";
import { useAuth } from "@/context/AuthContext";
import { MISSING_STATUS_LABELS, ScoreBadge, StatusBadge } from "@/components/CandidateStatus";
import { candidatesAPI, configAPI, jobsAPI, openCandidateCV } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { Job, JobRanking, RankedCandidate } from "@/types";

const POLL_INTERVAL_MS = 3000;

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [ranking, setRanking] = useState<JobRanking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);
  const [gmailEnabled, setGmailEnabled] = useState(false);
  const [gmailOpen, setGmailOpen] = useState(false);
  const [gmailRunId, setGmailRunId] = useState<string | null>(null);
  const [gmailRefresh, setGmailRefresh] = useState(0);
  const { user } = useAuth();
  const canImportGmail = (user?.permissions || []).includes("gmail.import");

  useEffect(() => {
    configAPI.get().then((r) => setGmailEnabled(Boolean(r.data?.features?.gmail))).catch(() => setGmailEnabled(false));
  }, []);

  const loadJob = useCallback(async () => {
    try {
      const response = await jobsAPI.getById(jobId);
      setJob(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load job"));
    }
  }, [jobId]);

  const loadRanking = useCallback(async () => {
    try {
      const response = await jobsAPI.ranking(jobId);
      setRanking(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load candidates"));
    }
  }, [jobId]);

  useEffect(() => {
    Promise.all([loadJob(), loadRanking()]).finally(() => setIsLoading(false));
  }, [loadJob, loadRanking]);

  const inProgress = (ranking?.status_counts?.pending || 0) + (ranking?.status_counts?.processing || 0);
  const pendingCount = ranking?.status_counts?.pending || 0;

  // Keep the list fresh while CVs are being processed in the background.
  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(loadRanking, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [inProgress, loadRanking]);

  const runAction = async (candidateId: string, action: () => Promise<unknown>, success: string) => {
    setBusyId(candidateId);
    try {
      await action();
      toast.success(success);
      await loadRanking();
    } catch (error) {
      toast.error(getErrorMessage(error, "Action failed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleProcessPending = async () => {
    setProcessing(true);
    try {
      const response = await jobsAPI.processPending(jobId);
      toast.success(response.data.queued ? `${response.data.queued} CV(s) queued for AI processing` : "No pending CVs");
      await loadRanking();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to start processing"));
    } finally {
      setProcessing(false);
    }
  };

  const handleViewCV = async (candidate: RankedCandidate) => {
    if (candidate.resume_is_remote && candidate.resume_url) {
      window.open(candidate.resume_url, "_blank", "noopener");
      return;
    }
    try {
      await openCandidateCV(candidate.candidate_id, candidate.resume_filename);
    } catch {
      toast.error("The original CV could not be opened");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#00C853] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-[#B0BEC5] mb-4">Job not found</p>
        <Button onClick={() => router.push("/dashboard/jobs")}>Back to Jobs</Button>
      </div>
    );
  }

  const isOpen = job.job_available !== false;
  const candidates = ranking?.candidates || [];
  const staleCount = candidates.filter((c) => c.is_stale).length;

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {poolOpen && job && (
        <PoolPickerModal jobId={jobId} jobTitle={job.title} onClose={() => setPoolOpen(false)} onAdded={loadRanking} />
      )}
      {gmailOpen && job && (
        <GmailImportModal jobId={jobId} jobTitle={job.title} initialRunId={gmailRunId}
          onClose={() => { setGmailOpen(false); setGmailRunId(null); setGmailRefresh((n) => n + 1); }}
          onImported={() => { loadRanking(); loadJob(); setGmailRefresh((n) => n + 1); }} />
      )}
      <JobModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => { loadJob(); loadRanking(); }}
        editJob={job}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push("/dashboard/jobs")}
            className="p-2 rounded-lg hover:bg-[#132F4C] text-[#B0BEC5] hover:text-white transition-colors"
            aria-label="Back to jobs"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{job.title}</h1>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                isOpen ? "bg-[#00C853]/20 text-[#00C853]" : "bg-[#FF5252]/20 text-[#FF5252]"
              )}>
                {isOpen ? "Open" : "Closed"}
              </span>
            </div>
            <p className="text-[#B0BEC5] text-sm">
              {[job.location, job.job_type, job.required_experience].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Edit size={16} className="mr-2" />
          Edit Job
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 space-y-4">
          <div>
            <h3 className="text-[#00C853] font-medium text-sm mb-1">Job Description</h3>
            <p className="text-white text-sm whitespace-pre-line">{job.about_role || "—"}</p>
          </div>
          <div>
            <h3 className="text-[#00C853] font-medium text-sm mb-1">Required Skills &amp; Qualifications</h3>
            <p className="text-white text-sm whitespace-pre-line">{job.requirements || "—"}</p>
          </div>
          <div>
            <h3 className="text-[#00C853] font-medium text-sm mb-1">Required Experience</h3>
            <p className="text-white text-sm whitespace-pre-line">{job.required_experience || "—"}</p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-white">Import CVs</h2>
            {gmailEnabled && canImportGmail && (
              <Button variant="outline" size="sm" disabled={!isOpen} onClick={() => { setGmailRunId(null); setGmailOpen(true); }}
                title={isOpen ? "Search a connected mailbox for past applications to this job" : "This job is closed. Reopen it to import more CVs."}>
                <Mail size={16} className="mr-2" /> Import from Gmail
              </Button>
            )}
          </div>
          <CVImport
            jobId={jobId}
            disabled={!isOpen}
            disabledReason="This job is closed. Reopen it to import more CVs."
            onImported={() => { loadRanking(); loadJob(); }}
          />
          {canImportGmail && (
            <GmailImportHistory jobId={jobId} refreshKey={gmailRefresh}
              onOpen={(runId) => { setGmailRunId(runId); setGmailOpen(true); }} />
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Ranked Candidates</h2>
            <p className="text-xs text-[#B0BEC5]">
              {ranking?.status_counts?.completed || 0} assessed · {inProgress} in progress ·{" "}
              {ranking?.status_counts?.failed || 0} failed · {ranking?.status_counts?.duplicate || 0} duplicate
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={loadRanking}>
              <RefreshCw size={14} className="mr-1" />
              Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPoolOpen(true)} disabled={job?.job_available === false}
              title={job?.job_available === false ? "Reopen the job to add candidates" : "Search the shared candidate pool"}>
              <Database size={14} className="mr-1" />
              Find candidates in pool
            </Button>
            {pendingCount > 0 && (
              <Button size="sm" onClick={handleProcessPending} isLoading={processing}>
                <Play size={14} className="mr-1" />
                Process {pendingCount} pending
              </Button>
            )}
          </div>
        </div>

        <p className="flex items-start gap-2 text-xs text-[#B0BEC5] bg-[#0A1929]/50 rounded-lg p-3 mb-4">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          Scores compare job-related CV evidence with this job&apos;s requirements. Personal characteristics are not used.
          Information missing from a CV is treated as unknown. Shortlisting and hiring decisions are made by HR.
        </p>

        {staleCount > 0 && (
          <p className="text-xs text-yellow-300 mb-3">
            {staleCount} assessment(s) are out of date (job edited, newer CV version, or scoring/model changed). Use &quot;Re-assess&quot; to update them.
          </p>
        )}

        {candidates.length === 0 ? (
          <p className="text-[#B0BEC5] text-center py-8">No CVs imported yet. Upload CVs above to start.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#B0BEC5] border-b border-[#2A3F5E]">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Candidate</th>
                  <th className="py-2 pr-3 font-medium">Match</th>
                  <th className="py-2 pr-3 font-medium">Strengths</th>
                  <th className="py-2 pr-3 font-medium">Missing / unknown</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.candidate_id} className="border-b border-[#2A3F5E]/50 align-top">
                    <td className="py-3 pr-3 text-white font-semibold">{candidate.rank ?? "—"}</td>
                    <td className="py-3 pr-3 min-w-[180px]">
                      <Link href={`/dashboard/candidates/${candidate.candidate_id}`} className="text-white font-medium hover:text-[#00C853]">
                        {candidate.name}
                      </Link>
                      {candidate.shortlist && <Star size={12} className="inline ml-1 text-yellow-400" fill="currentColor" />}
                      {candidate.profile?.current_title && (
                        <p className="text-xs text-[#B0BEC5]">
                          {candidate.profile.current_title}
                          {candidate.profile.current_company ? ` · ${candidate.profile.current_company}` : ""}
                        </p>
                      )}
                      {candidate.resume_filename && candidate.resume_filename !== candidate.name && (
                        <p className="text-xs text-[#B0BEC5] truncate max-w-[220px]" title={candidate.resume_filename}>
                          {candidate.resume_filename}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <StatusBadge status={candidate.processing_status} />
                        {candidate.added_via === "pool" && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-300">From pool</span>
                        )}
                        {candidate.added_via === "gmail" && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/15 text-purple-300"
                            title={candidate.gmail ? `E-mail "${candidate.gmail.subject || ""}" from ${candidate.gmail.sender_name || candidate.gmail.sender_email || "unknown sender"}${candidate.gmail.forwarded_from_email ? ` (forwarded from ${candidate.gmail.forwarded_from_email})` : ""}. The sender is not necessarily the candidate.` : undefined}>
                            From Gmail
                          </span>
                        )}
                        {candidate.cv_version && <span className="text-xs text-[#546E7A]">CV v{candidate.cv_version}</span>}
                        {(candidate.open_identity_reviews || 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-[#FF5252]/15 text-[#FF8A80]"
                            title="Another record shares this candidate's e-mail or phone but not their name. Check the identity review in the Candidate Pool. The CV was still assessed.">
                            Possible duplicate – identity review
                          </span>
                        )}
                        {(candidate.extraction_review_flags || []).length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/15 text-yellow-300"
                            title={`Check the extracted profile against the original CV before relying on this score: ${(candidate.extraction_review_flags || []).join(", ").replace(/_/g, " ")}`}>
                            Check extraction
                          </span>
                        )}
                        {candidate.pool_candidate_id && (
                          <Link href={`/dashboard/candidate-pool/${candidate.pool_candidate_id}`} className="text-xs text-[#00C853] hover:underline">pool profile</Link>
                        )}
                      </div>
                      {candidate.processing_error && (
                        <p className="text-xs text-[#FF8A80] mt-1 max-w-[260px]">{candidate.processing_error}</p>
                      )}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <ScoreBadge score={candidate.total_score} />
                      {candidate.is_stale && (
                        <p className="text-xs text-yellow-300 max-w-[140px]" title={(candidate.stale_reasons || []).map((r) => r.label).join("; ")}>
                          Out of date{candidate.stale_reasons?.length ? `: ${candidate.stale_reasons.map((r) => r.label).join("; ")}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-3 max-w-[260px]">
                      {candidate.strengths.length ? (
                        <ul className="space-y-1">
                          {candidate.strengths.map((strength, i) => (
                            <li key={i} className="text-xs text-white" title={strength.evidence}>• {strength.point}</li>
                          ))}
                        </ul>
                      ) : <span className="text-[#B0BEC5]">—</span>}
                    </td>
                    <td className="py-3 pr-3 max-w-[260px]">
                      {candidate.missing_requirements.length ? (
                        <ul className="space-y-1">
                          {candidate.missing_requirements.map((item, i) => (
                            <li key={i} className="text-xs text-[#B0BEC5]" title={item.note}>
                              • <span className="text-white">{item.requirement}</span>{" "}
                              <span>({MISSING_STATUS_LABELS[item.status] || item.status})</span>
                            </li>
                          ))}
                        </ul>
                      ) : <span className="text-[#B0BEC5]">—</span>}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {candidate.has_resume && (
                          <Button size="sm" variant="ghost" onClick={() => handleViewCV(candidate)}>
                            <FileText size={14} className="mr-1" />
                            CV
                          </Button>
                        )}
                        {candidate.processing_status === "failed" && candidate.has_resume && (
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={busyId === candidate.candidate_id}
                            onClick={() => runAction(candidate.candidate_id, () => candidatesAPI.retry(candidate.candidate_id), "Retry queued")}
                          >
                            <RotateCcw size={14} className="mr-1" />
                            Retry
                          </Button>
                        )}
                        {candidate.is_stale && (
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={busyId === candidate.candidate_id}
                            onClick={() => runAction(candidate.candidate_id, () => candidatesAPI.reassess(candidate.candidate_id), "Re-assessment queued")}
                          >
                            Re-assess
                          </Button>
                        )}
                        {candidate.processing_status === "completed" && (
                          <Button
                            size="sm"
                            variant={candidate.shortlist ? "secondary" : "outline"}
                            isLoading={busyId === candidate.candidate_id}
                            onClick={() => runAction(
                              candidate.candidate_id,
                              () => candidatesAPI.toggleShortlist(candidate.candidate_id),
                              candidate.shortlist ? "Removed from shortlist" : "Added to shortlist",
                            )}
                          >
                            <Star size={14} className="mr-1" />
                            {candidate.shortlist ? "Shortlisted" : "Shortlist"}
                          </Button>
                        )}
                      </div>
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
