"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowDown, Briefcase, CheckCircle2, ClipboardList, FileText, GraduationCap, ListChecks, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { AutoTextarea } from "@/components/ui/AutoTextarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { JobTitlePicker } from "@/components/jobs/JobTitlePicker";
import { ManageJobTitles } from "@/components/jobs/ManageJobTitles";
import { RequirementLists } from "@/components/jobs/RequirementLists";
import { jobsAPI, jobTitlesAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { Job, JobTitle, RequirementItem, RequirementsGeneration } from "@/types";

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editJob?: Job | null;
  /** Open scrolled to a section (e.g. "requirements" from the job page's lists) instead of the title. */
  focusSection?: "requirements";
}

type Form = {
  job_title_id: string; about_role: string; requirements: string; required_experience: string;
  job_available: boolean; location: string; job_type: string; open_positions: number;
  must: RequirementItem[]; nice: RequirementItem[]; generation: RequirementsGeneration | null;
};
type FieldName = "job_title_id" | "about_role" | "requirements" | "required_experience" | "open_positions";

const emptyForm: Form = {
  job_title_id: "", about_role: "", requirements: "", required_experience: "", job_available: true, location: "",
  job_type: "Full-time", open_positions: 1, must: [], nice: [], generation: null,
};
const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Remote"];
const input = "w-full rounded-lg border bg-[#132F4C] px-4 py-2.5 text-white placeholder-[#546E7A] focus:outline-none focus:border-[#00C853] focus:ring-1 focus:ring-[#00C853]/40";
const ORDER: FieldName[] = ["job_title_id", "about_role", "requirements", "required_experience", "open_positions"];

function fromJob(job?: Job | null): Form {
  if (!job) return emptyForm;
  return {
    job_title_id: job.job_title_id || "", about_role: job.about_role || "", requirements: job.requirements || "",
    required_experience: job.required_experience || "", job_available: job.job_available !== false,
    location: job.location || "", job_type: job.job_type || "Full-time", open_positions: job.open_positions || 1,
    must: job.must_have_requirements || [], nice: job.nice_to_have_requirements || [],
    generation: job.requirements_generation || null,
  };
}

function validate(f: Form): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!f.job_title_id) errors.job_title_id = "Choose a job title (or create one).";
  if (!f.about_role.trim()) errors.about_role = "Describe the role.";
  if (!f.requirements.trim()) errors.requirements = "List the required skills and qualifications.";
  if (!f.required_experience.trim()) errors.required_experience = "Describe the experience needed.";
  if (!Number.isInteger(f.open_positions) || f.open_positions < 1) errors.open_positions = "At least 1 position.";
  return errors;
}

function Section({ icon, title, hint, children, testId }: {
  icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode; testId?: string;
}) {
  return (
    <section className="rounded-xl border border-[#2A3F5E] bg-[#132F4C]/40 p-4 sm:p-5" data-testid={testId}>
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 text-[#00C853]">{icon}</span>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white">{title}</h4>
          {hint && <p className="text-xs text-[#B0BEC5]">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[#CFD8DC]">
      {children}{required && <span className="ml-0.5 text-[#FF8A80]" aria-hidden="true">*</span>}
      {required && <span className="sr-only"> (required)</span>}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="mt-1 text-xs text-[#FF8A80]" role="alert">{message}</p> : null;
}

/** Create / edit a job: a large dialog (full screen on small screens) with grouped sections, growing text areas,
 *  a sticky footer, validation, an unsaved-changes guard and keyboard support (Esc, Ctrl/Cmd+Enter, focus trap). */
export function JobModal({ isOpen, onClose, onSuccess, editJob, focusSection }: JobModalProps) {
  const uid = useId();
  const ids = (name: string) => `${uid}-${name}`;
  const [form, setForm] = useState<Form>(emptyForm);
  const [initial, setInitial] = useState<Form>(emptyForm);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [titles, setTitles] = useState<JobTitle[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [autoSignal, setAutoSignal] = useState(0);     // "the description is written": may trigger AI lists
  const [aiStatus, setAiStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const loadTitles = useCallback(async () => {
    try {
      setTitles((await jobTitlesAPI.list()).data.job_titles);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load the job titles"));
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const start = fromJob(editJob);
    setForm(start);
    setInitial(start);
    setTouched({});
    setSubmitted(false);
    loadTitles();
    opener.current = document.activeElement as HTMLElement | null;
    if (focusSection) {             // after the opening animation, so the target is laid out
      setTimeout(() => {
        const target = document.getElementById(`${uid}-requirement-lists`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        target?.focus({ preventScroll: true });
      }, 250);
    } else {
      setTimeout(() => document.getElementById(`${uid}-job_title_id`)?.focus(), 30);
    }
    return () => { opener.current?.focus?.(); };
  }, [isOpen, editJob, loadTitles, uid, focusSection]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const requirementInputs = useMemo(() => ({
    title: titles.find((t) => t.job_title_id === form.job_title_id)?.name || editJob?.title || "",
    about_role: form.about_role, requirements: form.requirements, required_experience: form.required_experience,
    location: form.location, job_type: form.job_type,
  }), [titles, form.job_title_id, editJob?.title, form.about_role, form.requirements, form.required_experience,
    form.location, form.job_type]);

  // Stopping typing in the description for a moment also counts as "finished writing it".
  useEffect(() => {
    if (!isOpen || editJob) return;
    const timer = setTimeout(() => setAutoSignal((n) => n + 1), 2500);
    return () => clearTimeout(timer);
  }, [form.about_role, isOpen, editJob]);
  const errors = validate(form);
  const showError = (name: FieldName) => (submitted || touched[name]) ? errors[name] : undefined;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const touch = (name: FieldName) => setTouched((t) => ({ ...t, [name]: true }));

  const requestClose = useCallback(() => {
    if (isLoading) return;
    if (dirty) setConfirmDiscard(true); else onClose();
  }, [dirty, isLoading, onClose]);

  const submit = async () => {
    setSubmitted(true);
    const first = ORDER.find((name) => errors[name]);
    if (first) {
      document.getElementById(ids(first))?.focus();
      return;
    }
    setIsLoading(true);
    const hadLists = Boolean(editJob?.must_have_requirements || editJob?.nice_to_have_requirements);
    const withLists = hadLists || form.must.length + form.nice.length > 0 || form.generation !== null;
    const payload = {
      ...(withLists ? { must_have_requirements: form.must, nice_to_have_requirements: form.nice,
        requirements_generation: form.generation } : {}),
      job_title_id: form.job_title_id, about_role: form.about_role.trim(), requirements: form.requirements.trim(),
      required_experience: form.required_experience.trim(), job_available: form.job_available,
      location: form.location.trim() || null, job_type: form.job_type || null, open_positions: form.open_positions,
    };
    try {
      if (editJob) {
        await jobsAPI.update(editJob.job_id, payload);
        toast.success("Job updated");
      } else {
        await jobsAPI.create(payload);
        toast.success("Job created");
      }
      setInitial(form);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save the job"));
    } finally {
      setIsLoading(false);
    }
  };

  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; });

  // Keyboard: Esc closes (asking first if there are changes), Ctrl/Cmd+Enter saves, Tab stays inside the dialog.
  useEffect(() => {
    if (!isOpen || manageOpen || confirmDiscard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); requestClose(); return; }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitRef.current(); return; }
      if (e.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const [first, last] = [focusable[0], focusable[focusable.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, manageOpen, confirmDiscard, requestClose]);

  // Leaving the page with unsaved changes asks the browser's own confirmation.
  useEffect(() => {
    if (!isOpen || !dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isOpen, dirty]);

  if (!isOpen) return null;
  const selectedTitle = titles.find((t) => t.job_title_id === form.job_title_id);
  const fieldBorder = (name: FieldName) => showError(name) ? "border-[#FF5252]" : "border-[#2A3F5E]";

  // Rendered on <body> so no transformed or clipped page container can shrink the overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4" data-testid="job-modal-overlay">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={requestClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={ids("heading")} data-testid="job-modal"
        initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18 }}
        className="relative flex h-full w-full flex-col overflow-clip bg-[#1a2a3a] shadow-2xl md:h-[min(92vh,980px)] md:max-w-[1100px] md:rounded-2xl md:border md:border-[#2A3F5E]">
        <header className="flex items-start justify-between gap-4 border-b border-[#2A3F5E] bg-[#1a2a3a]/95 px-5 py-4 sm:px-7">
          <div>
            <h3 id={ids("heading")} className="text-xl font-semibold text-white">{editJob ? "Edit job" : "Create a new job"}</h3>
            <p className="text-sm text-[#B0BEC5]">
              Fields marked <span className="text-[#FF8A80]">*</span> are required. CVs are assessed against the description,
              skills and experience below.
            </p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close" className="rounded-lg p-1.5 text-[#B0BEC5] hover:bg-[#132F4C] hover:text-white">
            <X size={22} />
          </button>
        </header>

        <form id={ids("form")} noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
          <Section icon={<Briefcase size={18} />} title="Job details" testId="section-details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="sm:col-span-2 lg:col-span-3">
                <Label htmlFor={ids("job_title_id")} required>Job title</Label>
                <div>
                  <JobTitlePicker id={ids("job_title_id")} titles={titles} value={form.job_title_id}
                    fallbackName={editJob && form.job_title_id === editJob.job_title_id && !selectedTitle ? editJob.title : undefined}
                    onChange={(t) => { set("job_title_id", t.job_title_id); touch("job_title_id"); }}
                    onTitlesChanged={loadTitles} onManage={() => setManageOpen(true)}
                    invalid={Boolean(showError("job_title_id"))} describedBy={ids("job_title_id-error")} />
                </div>
                <FieldError id={ids("job_title_id-error")} message={showError("job_title_id")} />
              </div>
              <div className="lg:col-span-3">
                <Label htmlFor={ids("status")}>Status</Label>
                <select id={ids("status")} value={form.job_available ? "open" : "closed"}
                  onChange={(e) => set("job_available", e.target.value === "open")} className={cn(input, "border-[#2A3F5E]")}>
                  <option value="open">Open – accepting candidates</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor={ids("job_type")}>Job type</Label>
                <select id={ids("job_type")} value={form.job_type} onChange={(e) => set("job_type", e.target.value)}
                  className={cn(input, "border-[#2A3F5E]")}>
                  {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor={ids("location")}>Location</Label>
                <input id={ids("location")} value={form.location} onChange={(e) => set("location", e.target.value)}
                  placeholder="e.g. JAFZA, Dubai, UAE" className={cn(input, "border-[#2A3F5E]")} />
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor={ids("open_positions")} required>Open positions</Label>
                <input id={ids("open_positions")} type="number" min={1} value={form.open_positions}
                  onChange={(e) => set("open_positions", parseInt(e.target.value, 10) || 0)} onBlur={() => touch("open_positions")}
                  aria-invalid={Boolean(showError("open_positions")) || undefined} aria-describedby={ids("open_positions-error")}
                  className={cn(input, fieldBorder("open_positions"))} />
                <FieldError id={ids("open_positions-error")} message={showError("open_positions")} />
              </div>
            </div>
          </Section>

          <Section icon={<FileText size={18} />} title="Job description" hint="What the role is about and its main responsibilities." testId="section-description">
            <Label htmlFor={ids("about_role")} required>Description</Label>
            <AutoTextarea id={ids("about_role")} value={form.about_role} minRows={6}
              onChange={(e) => set("about_role", e.target.value)}
              onBlur={() => { touch("about_role"); setAutoSignal((n) => n + 1); }}
              placeholder="Describe the role, the team and the main responsibilities…"
              aria-invalid={Boolean(showError("about_role")) || undefined} aria-describedby={ids("about_role-error")}
              className={cn(input, "leading-relaxed", fieldBorder("about_role"))} data-testid="field-about_role" />
            <div className="flex justify-between">
              <FieldError id={ids("about_role-error")} message={showError("about_role")} />
              <span className="ml-auto mt-1 text-xs text-[#546E7A]">{form.about_role.length} characters</span>
            </div>
            {aiStatus !== "idle" && (
              <button type="button" data-testid="ai-status-chip"
                onClick={() => document.getElementById(ids("requirement-lists"))?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={cn("mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                  aiStatus === "running" ? "ai-glow border-transparent text-[#B9F6CA]"
                    : aiStatus === "failed" ? "border-[#FF5252]/40 text-[#FFCDD2] hover:bg-[#FF5252]/10"
                      : "border-[#00C853]/40 text-[#B9F6CA] hover:bg-[#00C853]/10")}>
                {aiStatus === "running" ? <Loader2 size={12} className="animate-spin" />
                  : aiStatus === "failed" ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                {aiStatus === "running" ? "AI is drafting the Must-Have / Nice-to-Have lists…"
                  : aiStatus === "failed" ? "The AI could not draft the lists – add them by hand"
                    : "Must-Have / Nice-to-Have lists drafted – review them"}
                <span className="inline-flex items-center gap-0.5 font-medium">View <ArrowDown size={11} /></span>
              </button>
            )}
          </Section>

          <Section icon={<ClipboardList size={18} />} title="Required skills & qualifications" hint="Skills, systems, certificates, licences and education the job needs." testId="section-skills">
            <Label htmlFor={ids("requirements")} required>Skills & qualifications</Label>
            <AutoTextarea id={ids("requirements")} value={form.requirements} minRows={4}
              onChange={(e) => set("requirements", e.target.value)} onBlur={() => touch("requirements")}
              placeholder="e.g. WMS (Manhattan or SAP EWM), inventory control, valid UAE forklift licence…"
              aria-invalid={Boolean(showError("requirements")) || undefined} aria-describedby={ids("requirements-error")}
              className={cn(input, "leading-relaxed", fieldBorder("requirements"))} />
            <div className="flex justify-between">
              <FieldError id={ids("requirements-error")} message={showError("requirements")} />
              <span className="ml-auto mt-1 text-xs text-[#546E7A]">{form.requirements.length} characters</span>
            </div>
          </Section>

          <Section icon={<GraduationCap size={18} />} title="Required experience" hint="Years and kind of experience." testId="section-experience">
            <Label htmlFor={ids("required_experience")} required>Experience</Label>
            <AutoTextarea id={ids("required_experience")} value={form.required_experience} minRows={2}
              onChange={(e) => set("required_experience", e.target.value)} onBlur={() => touch("required_experience")}
              placeholder="e.g. 5+ years in warehouse or logistics operations, 2 of them leading a shift"
              aria-invalid={Boolean(showError("required_experience")) || undefined} aria-describedby={ids("required_experience-error")}
              className={cn(input, "leading-relaxed", fieldBorder("required_experience"))} />
            <FieldError id={ids("required_experience-error")} message={showError("required_experience")} />
          </Section>

          {/* not ids("requirements"): that is the Required skills field */}
          <div id={ids("requirement-lists")} tabIndex={-1} className="scroll-mt-4 outline-none" aria-label="Must-Have and Nice-to-Have requirements" />
          <Section icon={<ListChecks size={18} />} title="Must-Have & Nice-to-Have requirements"
            hint="Optional. Saving the job never waits for the AI." testId="section-requirements">
            <RequirementLists must={form.must} nice={form.nice} generation={form.generation} mode={editJob ? "edit" : "create"}
              jobId={editJob?.job_id} autoSignal={autoSignal} inputs={requirementInputs}
              onChange={({ must, nice, generation }) => setForm((f) => ({ ...f, must, nice, generation }))}
              onStatus={setAiStatus} />
          </Section>
        </form>

        <footer className="flex flex-col-reverse gap-3 border-t border-[#2A3F5E] bg-[#1a2a3a]/95 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"
          data-testid="job-modal-footer">
          <p className="hidden text-xs text-[#546E7A] sm:block">
            {dirty ? "Unsaved changes · " : ""}Ctrl/⌘ + Enter to save · Esc to close
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={requestClose} className="flex-1 sm:flex-none">Cancel</Button>
            <Button type="submit" form={ids("form")} isLoading={isLoading} className="flex-1 sm:flex-none sm:min-w-[160px]">
              {editJob ? "Save changes" : "Create Job"}
            </Button>
          </div>
        </footer>
      </motion.div>

      <ManageJobTitles open={manageOpen} onClose={() => setManageOpen(false)} onChanged={loadTitles} />
      <ConfirmDialog open={confirmDiscard} variant="danger" testId="discard-dialog" title="Discard unsaved changes?"
        message="You have changes in this job that haven't been saved. If you close now, they'll be lost."
        confirmLabel="Discard changes" onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        onCancel={() => setConfirmDiscard(false)} />
    </div>,
    document.body,
  );
}
