"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertTriangle, ArrowLeft, Briefcase, CheckCircle2, Download, Eye, FileText, GitMerge, Mail, Phone, Plus,
  RefreshCw, ShieldAlert, Star, StickyNote, Trash2, Undo2, UserX,
} from "lucide-react";
import { openPoolDocument, poolAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { cn, getErrorMessage } from "@/lib/utils";
import { PoolCandidateDetail, PoolDocument, PoolNote, ParsedDate } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScoreBadge, StatusBadge } from "@/components/CandidateStatus";
import {
  AddToJobModal, SupportBadge, formatDate, formatExperience, formatMonth, isReliable,
} from "@/components/pool/PoolBits";

type Json = Record<string, any>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-[#00C853] font-medium text-sm uppercase tracking-wide mb-2 border-b border-[#2A3F5E] pb-1">{title}</h3>
      {children}
    </section>
  );
}

function dateText(d?: ParsedDate | null) {
  if (!d) return "?";
  if (d.is_present) return "Present";
  return d.value || d.raw || "?";
}

function errorText(err: unknown, fallback: string) {
  const detail = (err as { response?: { data?: { detail?: { error?: { details?: unknown } } } } })?.response?.data?.detail;
  const details = detail?.error?.details as { message?: string } | string | undefined;
  if (details && typeof details === "object" && details.message) return details.message;
  return getErrorMessage(err, fallback);
}

export default function PoolCandidatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<PoolCandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const permissions = user?.permissions || [];
  const canMerge = permissions.includes("pool.merge");
  const canRemove = permissions.includes("pool.remove");
  const needs = (perm: string) => `You need the "${perm}" permission (granted by an administrator on the server).`;

  const load = useCallback(async () => {
    try {
      const res = await poolAPI.get(id);
      setData(res.data as PoolCandidateDetail);
    } catch (err) {
      const merged = (err as { response?: { status?: number; data?: { detail?: { error?: { details?: { merged_into_id?: string } } } } } }).response;
      if (merged?.status === 409 && merged.data?.detail?.error?.details?.merged_into_id) {
        router.replace(`/dashboard/candidate-pool/${merged.data.detail.error.details.merged_into_id}`);
        return;
      }
      toast.error(getErrorMessage(err, "Could not load this candidate"));
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);
  // Poll while an extraction or assessment is running.
  useEffect(() => {
    if (!data) return;
    const running = data.documents.some((d) => d.extraction_status === "processing" || d.extraction_status === "pending")
      || data.applications.some((a) => a.processing_status === "processing" || a.processing_status === "pending");
    if (!running) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [data, load]);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(errorText(err, "The action failed"));
    } finally {
      setBusy(null);
    }
  };

  const removeFromPool = async () => {
    if (!data) return;
    const apps = data.applications.length;
    const message = apps
      ? `Remove ${data.name || "this candidate"} from the pool? This also deletes ${apps} job application(s) with their assessments, all CV files, profiles and notes. This cannot be undone.`
      : `Remove ${data.name || "this candidate"} from the pool? All CV files, profiles and notes are deleted. This cannot be undone.`;
    if (!window.confirm(message)) return;
    try {
      await poolAPI.remove(data.pool_candidate_id, apps > 0);
      toast.success("Removed from the candidate pool");
      router.push("/dashboard/candidate-pool");
    } catch (err) {
      toast.error(errorText(err, "Could not remove the candidate"));
    }
  };

  if (loading) {
    return <div className="flex justify-center p-16"><div className="w-8 h-8 border-4 border-[#00C853] border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!data) return <p className="text-[#B0BEC5]">Candidate not found.</p>;

  const profile = data.profile;
  const sections: Json = profile?.sections || {};
  const facts = profile?.facts;
  const flags = profile?.validation?.flags || [];
  const reviewFlags = flags.filter((f) => f.severity === "review");
  const summary = sections.summary_objective || {};
  const experience: Json[] = Array.isArray(sections.experience) ? sections.experience : [];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      <Link href="/dashboard/candidate-pool" className="inline-flex items-center gap-1 text-sm text-[#B0BEC5] hover:text-[#00C853]">
        <ArrowLeft size={16} /> Candidate Pool
      </Link>

      <Card>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{data.name || "Unnamed (CV not extracted yet)"}</h1>
            <p className="text-[#B0BEC5] mt-1">{[data.current_title, data.current_employer].filter(Boolean).join(" · ") || "No current role extracted"}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-[#B0BEC5]">
              {data.known_emails.map((e) => <span key={e} className="flex items-center gap-1"><Mail size={14} /> {e}</span>)}
              {data.phone && <span className="flex items-center gap-1"><Phone size={14} /> {data.phone}</span>}
              <span title={data.experience.has_present_role ? "Roles marked 'Present' are counted only up to this date - never automatically to today." : undefined}>
                Experience: <span className="text-white">{formatExperience(data.experience_months)}</span>
                {data.experience.as_of && <span className="text-[#546E7A]"> · calculated to {formatDate(data.experience.as_of)} ({EXPERIENCE_SOURCES[data.experience.as_of_source || "first_import"]})</span>}
                {profile?.derived?.experience?.status === "partial" && <span className="text-yellow-300"> (some roles without dates)</span>}
              </span>
              <span>Added {formatDate(data.added_at)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowAdd(true)} disabled={!data.current.profile_id}><Plus size={16} className="mr-1" /> Add to job</Button>
            <Button variant="danger" onClick={removeFromPool} disabled={!canRemove} title={canRemove ? undefined : needs("pool.remove")}>
              <UserX size={16} className="mr-1" /> Remove from pool
            </Button>
          </div>
        </div>
      </Card>

      {data.experience.has_present_role && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#B0BEC5] -mt-3">
          {data.experience.present_confirmed_at ? (
            <>
              <span>“Present” confirmed as of {formatDate(data.experience.present_confirmed_at)}{data.experience.present_confirmed_by ? ` by ${data.experience.present_confirmed_by}` : ""}.</span>
              <button className="text-[#00C853] hover:underline" onClick={() => run("present", () => poolAPI.clearPresent(data.pool_candidate_id), "Confirmation removed")}>Remove confirmation</button>
            </>
          ) : <span>The CV lists a current role. Experience is counted to the CV date only.</span>}
          <button className="text-[#00C853] hover:underline" onClick={() => run("present", () => poolAPI.confirmPresent(data.pool_candidate_id), "Confirmed as of today")}>
            Confirm still in this role today
          </button>
        </div>
      )}

      {(data.language_warning || data.warnings.length > 0) && (
        <Card className={cn(data.language_warning ? "border-[#FF8A80]/50" : "border-yellow-500/40")}>
          <h2 className={cn("font-medium flex items-center gap-2 mb-2", data.language_warning ? "text-[#FF8A80]" : "text-yellow-300")}>
            <ShieldAlert size={18} /> {data.language_warning ? "Arabic / mixed-language CV – check before relying on this profile" : "Extraction checks need attention"}
          </h2>
          <ul className="space-y-1 text-sm text-[#E0E0E0] list-disc list-inside">
            {data.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
          </ul>
          <p className="text-xs text-[#546E7A] mt-2">
            These automatic checks catch some extraction errors, not all. They never exclude, rank down or reject the
            candidate – compare with the original CV and correct your judgement where needed.
          </p>
        </Card>
      )}

      {(data.current.needs_review || data.identity_reviews.length > 0 || data.extraction_status === "failed") && (
        <Card className="border-yellow-500/40">
          <h2 className="text-yellow-300 font-medium flex items-center gap-2 mb-3"><AlertTriangle size={18} /> Needs HR review</h2>
          <div className="space-y-3 text-sm">
            {data.current.needs_review && <p className="text-[#B0BEC5]">{data.current.review_reason} Use “Make current” on the right version below.</p>}
            {data.extraction_status === "failed" && <p className="text-[#B0BEC5]">The CV could not be extracted. Use Retry on the CV version below.</p>}
            {data.identity_reviews.map((r) => (
              <div key={r.review_id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-[#132F4C] rounded-lg p-3">
                <p className="text-[#B0BEC5]">
                  Possibly the same person as{" "}
                  <Link className="text-white hover:text-[#00C853]" href={`/dashboard/candidate-pool/${r.other_candidate_id}`}>{r.other_name || "another candidate"}</Link>{" "}
                  <span className="text-[#546E7A]">({r.reason.replace(/_/g, " ")}{r.evidence && (r.evidence as Json).email ? `: ${(r.evidence as Json).email}` : ""})</span>.
                  Not merged automatically.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" isLoading={busy === r.review_id} disabled={!canMerge}
                    title={canMerge ? undefined : needs("pool.merge")}
                    onClick={() => window.confirm("Merge both records into this candidate? CVs, applications and notes move here.") &&
                      run(r.review_id, () => poolAPI.mergeReview(r.review_id, data.pool_candidate_id), "Records merged")}>
                    <GitMerge size={14} className="mr-1" /> Same person – merge
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!canMerge} title={canMerge ? undefined : needs("pool.merge")}
                    onClick={() => run(r.review_id, () => poolAPI.dismissReview(r.review_id), "Marked as different people")}>
                    Different people
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2"><FileText size={18} /> Profile (current CV version)</h2>
            {profile && <span className="text-xs text-[#546E7A]">{profile.extractor === "legacy_import" ? "Extracted before the pool existed" : `AI extraction (${profile.model || "model unknown"})`} · {formatDate(profile.extracted_at)}</span>}
          </div>
          {!profile ? (
            <p className="text-[#B0BEC5]">No extracted profile yet.</p>
          ) : (
            <>
              {profile.evidence && !profile.evidence.text_available && (
                <p className="mb-4 text-sm text-yellow-300 bg-yellow-500/10 rounded-lg p-3">
                  This CV has no readable text layer (e.g. a scan). Extracted values could not be traced to the CV text and are uncertain – check the original.
                </p>
              )}
              {(summary.career_summary || summary.objective) && (
                <Section title="Summary"><p className="text-[#E0E0E0] text-sm whitespace-pre-line">{summary.career_summary || summary.objective}</p></Section>
              )}
              <Section title="Experience">
                {experience.length === 0 ? <p className="text-sm text-[#546E7A]">No roles extracted.</p> : (
                  <ol className="space-y-4">
                    {experience.map((role, idx) => {
                      const fact = facts?.roles.find((r) => r.index === idx);
                      return (
                        <li key={idx} className="border-l-2 border-[#2A3F5E] pl-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-white font-medium">{role.title || "Untitled role"}</span>
                            {role.company && <span className="text-[#B0BEC5]">· {role.company}</span>}
                            <SupportBadge support={fact?.support} />
                          </div>
                          <p className="text-xs text-[#546E7A]">
                            {fact?.dates_as_written || role.dates || `${dateText(fact?.start)} – ${dateText(fact?.end)}`}
                            {role.location ? ` · ${role.location}` : ""}
                          </p>
                          {Array.isArray(role.responsibilities) && role.responsibilities.length > 0 && (
                            <ul className="list-disc list-inside text-sm text-[#E0E0E0] mt-1 space-y-0.5">
                              {role.responsibilities.map((r: string, i: number) => <li key={i}>{r}</li>)}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Section>
              <Section title="Education">
                {facts?.education.length ? (
                  <ul className="space-y-2 text-sm">
                    {facts.education.map((e, i) => (
                      <li key={i} className="text-[#E0E0E0]">
                        <span className="text-white">{e.degree || "Qualification"}</span>{e.institution ? ` · ${e.institution}` : ""}
                        {e.dates ? <span className="text-[#546E7A]"> · {e.dates}</span> : null} <SupportBadge support={e.institution_support || e.degree_support} />
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-[#546E7A]">No education extracted.</p>}
              </Section>
              <Section title="Skills">
                {facts?.skills.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {facts.skills.map((s) => (
                      <span key={s.name} title={isReliable(s.support) ? "Traced to the CV text" : "Uncertain – not found verbatim in the CV text"}
                        className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs",
                          isReliable(s.support) ? "bg-[#00C853]/10 text-[#00C853]" : "bg-yellow-500/10 text-yellow-300 italic")}>
                        {s.name}{!isReliable(s.support) && " ?"}
                      </span>
                    ))}
                  </div>
                ) : <p className="text-sm text-[#546E7A]">No skills extracted (unknown – not the same as “none”).</p>}
              </Section>
              <Section title="Certifications & courses">
                {facts?.certifications.length ? (
                  <ul className="space-y-1 text-sm text-[#E0E0E0]">
                    {facts.certifications.map((c, i) => (
                      <li key={i}>{c.name}{c.issuer ? ` · ${c.issuer}` : ""}{c.date ? <span className="text-[#546E7A]"> · {c.date}</span> : null} <SupportBadge support={c.support} /></li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-[#546E7A]">None listed in the CV.</p>}
              </Section>
              <Section title="Languages">
                {facts?.languages.length ? (
                  <div className="flex flex-wrap gap-2 text-sm">
                    {facts.languages.map((l) => <span key={l.name} className="text-[#E0E0E0]">{l.as_written} <SupportBadge support={l.support} /></span>)}
                  </div>
                ) : <p className="text-sm text-[#546E7A]">Not listed in the CV.</p>}
              </Section>
              <Section title="Extraction checks">
                <p className="text-xs text-[#546E7A] mb-2">{profile.validation?.support_note}</p>
                {flags.length === 0 ? <p className="text-sm text-[#00C853] flex items-center gap-1"><CheckCircle2 size={14} /> No issues found.</p> : (
                  <ul className="space-y-1 text-sm">
                    {flags.map((f, i) => (
                      <li key={i} className={cn("flex gap-2", f.severity === "review" ? "text-yellow-300" : "text-[#B0BEC5]")}>
                        {f.severity === "review" ? <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> : <span className="w-3.5" />} {f.message}
                      </li>
                    ))}
                  </ul>
                )}
                {reviewFlags.length > 0 && <p className="text-xs text-[#546E7A] mt-2">{reviewFlags.length} item(s) need a human check against the original CV.</p>}
              </Section>
            </>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-white font-semibold mb-3">CV versions</h2>
            <ul className="space-y-3">
              {data.documents.map((doc) => (
                <DocumentItem key={doc.document_id} doc={doc} busy={busy}
                  onMakeCurrent={() => run(doc.document_id, () => poolAPI.setCurrentDocument(data.pool_candidate_id, doc.document_id), "Current CV version changed")}
                  onRetry={() => run(doc.document_id, () => poolAPI.retryDocument(doc.document_id), "Extraction queued")} />
              ))}
            </ul>
          </Card>

          {data.merges.length > 0 && (
            <Card>
              <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><GitMerge size={18} /> Merge history</h2>
              <ul className="space-y-3 text-sm">
                {data.merges.map((m) => (
                  <li key={m.merge_id} className="bg-[#132F4C] rounded-lg p-3">
                    <p className="text-[#E0E0E0]">
                      {m.role === "kept" ? <>Merged <span className="text-white">{m.other_name || "another record"}</span> into this record</>
                        : <>This record was merged into another one</>}
                      {" "}{m.automatic ? "automatically (same e-mail, compatible name)" : `by ${m.by || "HR"}`} on {formatDate(m.created_at)}.
                    </p>
                    <p className="text-xs text-[#546E7A]">Moved: {m.moved.documents} CV(s), {m.moved.applications} application(s), {m.moved.notes} note(s), {m.moved.imports} import record(s)</p>
                    {m.undone_at ? (
                      <p className="text-xs text-yellow-300 mt-1">Undone {m.undone_by ? `by ${m.undone_by} ` : ""}on {formatDate(m.undone_at)}.</p>
                    ) : m.can_undo ? (
                      <Button size="sm" variant="ghost" className="mt-1" disabled={!canMerge} title={canMerge ? undefined : needs("pool.merge")}
                        isLoading={busy === m.merge_id}
                        onClick={() => window.confirm(`Undo this merge? ${m.other_name || "The other record"} gets back its CVs, applications (with assessment history), notes and import history.`) &&
                          run(m.merge_id, () => poolAPI.undoMerge(m.merge_id), "Merge undone")}>
                        <Undo2 size={14} className="mr-1" /> Undo merge
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><Briefcase size={18} /> Jobs & assessments</h2>
            {data.applications.length === 0 ? <p className="text-sm text-[#B0BEC5]">Not in any job yet.</p> : (
              <ul className="space-y-3">
                {data.applications.map((a) => (
                  <li key={a.candidate_id} className="bg-[#132F4C] rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/dashboard/jobs/${a.job_id}`} className="text-white font-medium hover:text-[#00C853]">{a.job_title}</Link>
                      <ScoreBadge score={a.assessment?.total_score} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#B0BEC5]">
                      <StatusBadge status={a.processing_status} />
                      {a.shortlist && <span className="inline-flex items-center gap-1 text-yellow-300"><Star size={12} /> Shortlisted</span>}
                      {!a.job_open && <span>Job closed</span>}
                      <span>{a.added_via === "pool" ? "Added from pool" : "Uploaded"} {formatDate(a.added_at)}</span>
                      {a.assessment?.cv_version && <span>· CV v{a.assessment.cv_version}</span>}
                    </div>
                    {a.assessment?.stale_reasons?.length ? (
                      <p className="text-xs text-yellow-300 mt-1">Out of date: {a.assessment.stale_reasons.map((r) => r.label).join("; ")}. Re-assess from the job.</p>
                    ) : null}
                    {a.processing_error && <p className="text-xs text-[#FF8A80] mt-1">{a.processing_error}</p>}
                    <Link href={`/dashboard/candidates/${a.candidate_id}`} className="text-xs text-[#00C853] hover:underline">View assessment</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><StickyNote size={18} /> HR notes</h2>
            <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} maxLength={5000}
              placeholder="Add a note (visible to all HR users)…"
              className="w-full bg-[#132F4C] border border-[#2A3F5E] rounded-lg px-3 py-2 text-white text-sm placeholder-[#546E7A]" />
            <div className="flex justify-end mt-2">
              <Button size="sm" disabled={!noteDraft.trim()} isLoading={busy === "note"}
                onClick={() => run("note", async () => { await poolAPI.addNote(data.pool_candidate_id, noteDraft.trim()); setNoteDraft(""); }, "Note saved")}>
                Save note
              </Button>
            </div>
            <ul className="space-y-3 mt-3">
              {data.notes.map((n: PoolNote) => (
                <li key={n.note_id} className="bg-[#132F4C] rounded-lg p-3 text-sm">
                  {editing?.id === n.note_id ? (
                    <>
                      <textarea value={editing.body} onChange={(e) => setEditing({ id: n.note_id, body: e.target.value })} rows={3}
                        className="w-full bg-[#0A1929] border border-[#2A3F5E] rounded-lg px-2 py-1 text-white text-sm" />
                      <div className="flex justify-end gap-2 mt-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button size="sm" disabled={!editing.body.trim()}
                          onClick={() => run(n.note_id, async () => { await poolAPI.updateNote(n.note_id, editing.body.trim()); setEditing(null); }, "Note updated")}>Save</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[#E0E0E0] whitespace-pre-line">{n.body}</p>
                      <div className="flex items-center justify-between mt-1 text-xs text-[#546E7A]">
                        <span>{n.author_name || "Unknown"} · {formatDate(n.created_at)}{n.updated_at && n.updated_at !== n.created_at ? " (edited)" : ""}</span>
                        {user && String((user as { user_id?: string }).user_id) === n.author_user_id && (
                          <span className="flex gap-2">
                            <button className="hover:text-[#00C853]" onClick={() => setEditing({ id: n.note_id, body: n.body })}>Edit</button>
                            <button className="hover:text-[#FF5252]" onClick={() => window.confirm("Delete this note?") &&
                              run(n.note_id, () => poolAPI.deleteNote(n.note_id), "Note deleted")}><Trash2 size={12} /></button>
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {showAdd && <AddToJobModal candidateIds={[data.pool_candidate_id]} onClose={() => setShowAdd(false)} onDone={load} />}
    </div>
  );
}

const EXPERIENCE_SOURCES: Record<string, string> = {
  file_modified: "CV file date",
  first_import: "date the CV was received",
  hr_confirmed: "confirmed by HR",
};

function DocumentItem({ doc, busy, onMakeCurrent, onRetry }: {
  doc: PoolDocument; busy: string | null; onMakeCurrent: () => void; onRetry: () => void;
}) {
  const open = async (download: boolean) => {
    try {
      await openPoolDocument(doc.document_id, doc.original_filename, download);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not open the CV"));
    }
  };
  const comparisons = doc.profiles.filter((p) => p.comparison_only);
  return (
    <li className={cn("rounded-lg p-3 border", doc.is_current ? "border-[#00C853]/50 bg-[#00C853]/5" : "border-[#2A3F5E] bg-[#132F4C]")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-white text-sm font-medium truncate">v{doc.version_number ?? "?"} · {doc.original_filename || "CV"}</span>
        {doc.is_current && <span className="px-2 py-0.5 rounded-full text-xs bg-[#00C853]/20 text-[#00C853]">Current</span>}
      </div>
      <div className="text-xs text-[#546E7A] mt-1 space-y-0.5">
        <div>First imported {formatDate(doc.first_imported_at)} · latest dated content {formatMonth(doc.content_latest_month)}{doc.content_has_present ? " (to present)" : ""}</div>
        {doc.file_metadata?.modified && <div>File modified {formatDate(doc.file_metadata.modified)} (file metadata)</div>}
        <div>Text layer: {doc.text_source === "none" ? "none (scan?)" : doc.text_source || "not checked"} · extraction {doc.extraction_status}{doc.extraction_attempts > 1 ? ` (${doc.extraction_attempts} attempts)` : ""}</div>
        {doc.extraction_error && <div className="text-[#FF8A80]">{doc.extraction_error}</div>}
        <details className="mt-1">
          <summary className="cursor-pointer text-[#B0BEC5]">Import history ({doc.imports.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {doc.imports.map((i) => (
              <li key={i.import_id}>{formatDate(i.imported_at)} · {i.source}{i.source_detail && (i.source_detail as Json).archive ? ` (${(i.source_detail as Json).archive})` : ""} · {i.original_filename} · {i.outcome.replace(/_/g, " ")}{i.job_id ? "" : " · job deleted"}
                {i.email && (
                  <div className="ml-3 mt-0.5 text-[#B0BEC5]">
                    E-mail “{i.email.subject || "(no subject)"}” from {i.email.sender_name || ""} {i.email.sender_email ? `<${i.email.sender_email}>` : ""}
                    {i.email.forwarded_from_email ? ` · forwarded from ${i.email.forwarded_from_name || ""} <${i.email.forwarded_from_email}>` : ""}
                    {i.email.received_at ? ` · received ${formatDate(i.email.received_at)}` : ""}
                    <span className="block text-[#546E7A]">The sender is where the CV came from, not necessarily the candidate.</span>
                    {i.email.text_excerpt && (
                      <details><summary className="cursor-pointer">Application e-mail text</summary>
                        <p className="whitespace-pre-wrap break-words bg-[#0f2236] rounded p-2 mt-1">{i.email.text_excerpt}{i.email.text_truncated ? "\n…" : ""}</p>
                      </details>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
        {comparisons.length > 0 && <div>{comparisons.length} comparison extraction(s) from the local prototype – not used for the profile.</div>}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <Button size="sm" variant="secondary" onClick={() => open(false)}><Eye size={14} className="mr-1" /> View</Button>
        <Button size="sm" variant="ghost" onClick={() => open(true)}><Download size={14} className="mr-1" /> Download</Button>
        {!doc.is_current && doc.extraction_status === "completed" && (
          <Button size="sm" variant="ghost" isLoading={busy === doc.document_id} onClick={onMakeCurrent}>Make current</Button>
        )}
        {(doc.extraction_status === "failed" || doc.extraction_status === "pending") && (
          <Button size="sm" variant="outline" isLoading={busy === doc.document_id} onClick={onRetry}><RefreshCw size={14} className="mr-1" /> Retry extraction</Button>
        )}
      </div>
    </li>
  );
}
