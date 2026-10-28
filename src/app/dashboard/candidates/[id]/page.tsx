"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, Briefcase, Star, FileText, RotateCcw, Info, MapPin, Link2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MISSING_STATUS_LABELS, ScoreBadge, StatusBadge, scoreColor } from "@/components/CandidateStatus";
import { HeadhuntedApplication } from "@/components/headhunting/HeadhuntedApplication";
import { MessagesPanel } from "@/components/mailbox/MessagesPanel";
import { useAuth } from "@/context/AuthContext";
import { candidatesAPI, openCandidateCV, scheduleAPI } from "@/lib/api";
import { getErrorMessage, INTERVIEW_FEATURES_ENABLED } from "@/lib/utils";
import { CandidateAssessment } from "@/types";

type Json = Record<string, unknown>;

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") return Object.values(value as Json).map(asText).filter(Boolean).join(" · ");
  return String(value);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[#00C853] font-medium text-sm mb-2">{title}</h4>
      {children}
    </div>
  );
}

function ProfileView({ profile }: { profile: Json }) {
  const personal = (profile.personal_info || {}) as Json;
  const summary = (profile.summary_objective || {}) as Json;
  const skills = (profile.skills || {}) as Json;
  const experience = asList(profile.experience) as Json[];
  const education = asList(profile.education) as Json[];
  const certifications = asList(profile.certifications_courses);
  const projects = asList(profile.projects) as Json[];
  const languages = (profile.languages || {}) as Json;
  const skillGroups: [string, unknown][] = [
    ["Technical skills", skills.hard_skills],
    ["Tools & technologies", skills.tools_technologies],
    ["Soft skills", skills.soft_skills],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 text-sm text-[#B0BEC5]">
        {asText(personal.email) && <span className="flex items-center gap-1"><Mail size={14} />{asText(personal.email)}</span>}
        {asText(personal.phone) && <span className="flex items-center gap-1"><Phone size={14} />{asText(personal.phone)}</span>}
        {asText(personal.location) && <span className="flex items-center gap-1"><MapPin size={14} />{asText(personal.location)}</span>}
        {asList(personal.links).map((link, i) => (
          <span key={i} className="flex items-center gap-1 break-all"><Link2 size={14} />{asText(link)}</span>
        ))}
      </div>

      {(asText(summary.career_summary) || asText(summary.objective)) && (
        <Section title="Summary">
          <p className="text-white text-sm whitespace-pre-line">{asText(summary.career_summary) || asText(summary.objective)}</p>
        </Section>
      )}

      <Section title="Experience">
        {experience.length ? (
          <div className="space-y-3">
            {experience.map((role, i) => (
              <div key={i} className="bg-[#0A1929]/50 rounded-lg p-3">
                <p className="text-white font-medium text-sm">
                  {asText(role.title) || "Role"}{asText(role.company) ? ` · ${asText(role.company)}` : ""}
                </p>
                <p className="text-xs text-[#B0BEC5]">
                  {[asText(role.dates), asText(role.years_of_experience), asText(role.location)].filter(Boolean).join(" · ")}
                </p>
                {asList(role.responsibilities).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {asList(role.responsibilities).map((item, j) => (
                      <li key={j} className="text-xs text-white">• {asText(item)}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-[#B0BEC5]">No work experience found in the CV.</p>}
      </Section>

      <Section title="Skills">
        <div className="space-y-2">
          {skillGroups.map(([label, values]) => asList(values).length > 0 && (
            <div key={label}>
              <p className="text-xs text-[#B0BEC5] mb-1">{label}</p>
              <div className="flex flex-wrap gap-1">
                {asList(values).map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 bg-[#00C853]/10 text-[#00C853] rounded text-xs">{asText(skill)}</span>
                ))}
              </div>
            </div>
          ))}
          {skillGroups.every(([, values]) => asList(values).length === 0) && (
            <p className="text-sm text-[#B0BEC5]">No skills listed in the CV.</p>
          )}
        </div>
      </Section>

      <Section title="Education">
        {education.length ? (
          <ul className="space-y-1">
            {education.map((item, i) => (
              <li key={i} className="text-sm text-white">
                {asText(item.degree) || "Qualification"}
                <span className="text-[#B0BEC5]">{asText(item.institution) ? ` · ${asText(item.institution)}` : ""}{asText(item.dates) ? ` · ${asText(item.dates)}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[#B0BEC5]">No education listed in the CV.</p>}
      </Section>

      {certifications.length > 0 && (
        <Section title="Certifications & Courses">
          <ul className="space-y-1">
            {certifications.map((item, i) => <li key={i} className="text-sm text-white">• {asText(item)}</li>)}
          </ul>
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="Projects">
          <ul className="space-y-1">
            {projects.map((item, i) => (
              <li key={i} className="text-sm text-white">• {asText(item.title) || asText(item)}{asText(item.description) ? ` — ${asText(item.description)}` : ""}</li>
            ))}
          </ul>
        </Section>
      )}

      {asText(languages.spoken_languages) && (
        <Section title="Languages">
          <p className="text-sm text-white">{asText(languages.spoken_languages)}</p>
        </Section>
      )}
    </div>
  );
}

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const canSeeMessages = true;          // shared workspace: every member reads the e-mails; actions keep their permissions
  const [data, setData] = useState<CandidateAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await candidatesAPI.assessment(candidateId);
      setData(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load candidate"));
    } finally {
      setIsLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh while the CV is still being processed.
  useEffect(() => {
    if (!["pending", "queued", "processing"].includes(data?.processing_status || "")) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [data?.processing_status, load]);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Action failed"));
    } finally {
      setBusy(null);
    }
  };

  const handleViewCV = async () => {
    if (!data) return;
    if (data.resume_is_remote && data.resume_url) {
      window.open(data.resume_url, "_blank", "noopener");
      return;
    }
    try {
      await openCandidateCV(data.candidate_id, data.resume_filename);
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

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-[#B0BEC5]">Candidate not found</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const assessment = data.assessment;

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <button onClick={() => router.push(`/dashboard/jobs/${data.job_id}`)} className="p-2 rounded-lg hover:bg-[#132F4C] text-[#B0BEC5] hover:text-white transition-colors" aria-label="Back to job">
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{data.name}</h1>
              <StatusBadge status={data.processing_status} />
              {data.shortlist && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium flex items-center gap-1">
                  <Star size={12} fill="currentColor" /> Shortlisted
                </span>
              )}
            </div>
            <p className="text-[#B0BEC5] text-sm flex items-center gap-2">
              <Briefcase size={14} /> {data.job_title || "Unknown job"}
              {data.resume_filename && data.resume_filename !== data.name && <span>· {data.resume_filename}</span>}
              {data.cv_version && <span>· CV v{data.cv_version}</span>}
              {data.pool_candidate_id && (
                <Link href={`/dashboard/candidate-pool/${data.pool_candidate_id}`} className="text-[#00C853] hover:underline">
                  View in Candidate Pool
                </Link>
              )}
            </p>
            {(data.added_by_name || data.analysis_requested_by_name || data.shortlist_updated_by_name) && (
              <p className="text-xs text-[#546E7A] mt-0.5" data-testid="candidate-attribution">
                {[data.added_by_name && `Added by ${data.added_by_name}`,
                  data.analysis_requested_by_name && `analysis requested by ${data.analysis_requested_by_name}`,
                  data.shortlist_updated_by_name && `${data.shortlist ? "shortlisted" : "shortlist changed"} by ${data.shortlist_updated_by_name}`,
                  data.updated_by_name && `last edited by ${data.updated_by_name}`].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {data.has_resume && (
            <Button variant="outline" onClick={handleViewCV}>
              <FileText size={16} className="mr-2" /> View Original CV
            </Button>
          )}
          {data.processing_status === "failed" && data.has_resume && data.added_via !== "headhunting" && (
            <Button variant="outline" isLoading={busy === "retry"} onClick={() => run("retry", () => candidatesAPI.retry(data.candidate_id), "Retry queued")}>
              <RotateCcw size={16} className="mr-2" /> Retry Processing
            </Button>
          )}
          {data.processing_status === "completed" && data.added_via !== "headhunting" && (
            <Button variant="outline" isLoading={busy === "reassess"} onClick={() => run("reassess", () => candidatesAPI.reassess(data.candidate_id), "Re-assessment queued")}>
              <RotateCcw size={16} className="mr-2" /> Re-assess
            </Button>
          )}
          {data.processing_status === "completed" && (
            <Button
              variant={data.shortlist ? "secondary" : "primary"}
              isLoading={busy === "shortlist"}
              onClick={() => run("shortlist", () => candidatesAPI.toggleShortlist(data.candidate_id), data.shortlist ? "Removed from shortlist" : "Added to shortlist")}
            >
              <Star size={16} className="mr-2" /> {data.shortlist ? "Remove from Shortlist" : "Add to Shortlist"}
            </Button>
          )}
          {INTERVIEW_FEATURES_ENABLED && data.shortlist && (
            <Button variant="outline" isLoading={busy === "agent"} onClick={() => run("agent", () => scheduleAPI.updateAgent(data.candidate_id, data.job_id), "Voice agent updated")}>
              Prepare AI Call
            </Button>
          )}
        </div>
      </motion.div>

      {data.processing_error && (
        <div className="bg-[#FF5252]/10 border border-[#FF5252]/30 rounded-lg p-3 text-sm text-[#FF8A80]">{data.processing_error}</div>
      )}

      {data.added_via === "headhunting" && <HeadhuntedApplication data={data} onChanged={load} />}

      <p className="flex items-start gap-2 text-xs text-[#B0BEC5]">
        <Info size={14} className="mt-0.5 flex-shrink-0" />
        AI-assisted assessment based only on job-related evidence in the CV. Missing information is treated as unknown.
        HR makes all shortlisting and hiring decisions.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Job Match</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {assessment ? (
              <>
                <div className="text-center">
                  <p className={`text-5xl font-bold ${scoreColor(assessment.total_score)}`}>{Math.round(assessment.total_score)}</p>
                  <p className="text-[#B0BEC5] text-sm">Match score out of 100</p>
                  {assessment.is_stale && (
                    <p className="text-xs text-yellow-300 mt-1">
                      Out of date: {(assessment.stale_reasons || []).map((r) => r.label).join("; ") || "the job was edited"}. Re-assess to update it.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  {assessment.criteria.map((criterion) => (
                    <div key={criterion.key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white">{criterion.label}</span>
                        <span className="text-[#B0BEC5]">{criterion.score}/{criterion.max}</span>
                      </div>
                      <div className="h-2 bg-[#0A1929] rounded-full overflow-hidden">
                        <div className="h-full bg-[#00C853] rounded-full" style={{ width: `${(criterion.score / criterion.max) * 100}%` }} />
                      </div>
                      {criterion.evidence.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {criterion.evidence.map((item, i) => <li key={i} className="text-xs text-[#B0BEC5]">“{item}”</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                <Section title="Why this score">
                  <p className="text-sm text-white whitespace-pre-line">{assessment.summary || "—"}</p>
                </Section>

                <Section title="Relevant strengths">
                  {assessment.strengths.length ? (
                    <ul className="space-y-2">
                      {assessment.strengths.map((strength, i) => (
                        <li key={i} className="text-sm">
                          <p className="text-white">• {strength.point}</p>
                          {strength.evidence && <p className="text-xs text-[#B0BEC5] ml-3">CV evidence: “{strength.evidence}”</p>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-[#B0BEC5]">No job-related strengths identified.</p>}
                </Section>

                <Section title="Missing requirements or information">
                  {assessment.missing_requirements.length ? (
                    <ul className="space-y-2">
                      {assessment.missing_requirements.map((item, i) => (
                        <li key={i} className="text-sm">
                          <p className="text-white">• {item.requirement} <span className="text-xs text-yellow-300">({MISSING_STATUS_LABELS[item.status] || item.status})</span></p>
                          {item.note && <p className="text-xs text-[#B0BEC5] ml-3">{item.note}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-[#B0BEC5]">None identified.</p>}
                </Section>

                {assessment.llm?.model && (
                  <p className="text-xs text-[#B0BEC5]">Assessed with {assessment.llm.model}{assessment.assessed_at ? ` on ${new Date(assessment.assessed_at).toLocaleString()}` : ""}.</p>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <ScoreBadge score={null} />
                <p className="text-[#B0BEC5] text-sm mt-2">
                  {["pending", "queued", "processing"].includes(data.processing_status)
                    ? "The CV is being processed. This page refreshes automatically."
                    : data.processing_status === "awaiting_cv" ? "CV required for analysis – no AI assessment without a CV."
                      : data.processing_status === "awaiting_analysis" ? "Not analysed yet – start the AI analysis above (paid)."
                        : "No assessment available."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {canSeeMessages && <MessagesPanel applicationId={candidateId} permissions={permissions} />}

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Extracted CV Profile</CardTitle></CardHeader>
          <CardContent>
            {data.profile ? <ProfileView profile={data.profile} /> : (
              <p className="text-[#B0BEC5] text-sm">The profile has not been extracted yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
