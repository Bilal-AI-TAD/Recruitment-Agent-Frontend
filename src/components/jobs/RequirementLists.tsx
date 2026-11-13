"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Award, Briefcase, Building2, Clock, GraduationCap, Languages, MapPin, Plus, Quote,
  RefreshCw, Sparkles, Tag, Trash2, Wrench, X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { AgentActivity } from "@/components/ai/AgentActivity";
import { useAgentRun } from "@/components/ai/useAgentRun";
import { jobRequirementsAPI } from "@/lib/api";
import { formatUsd } from "@/lib/cost";
import { cn } from "@/lib/utils";
import { RequirementItem, RequirementsGeneration, RequirementsReadiness, RequirementType } from "@/types";

export type ListName = "must" | "nice";
export interface RequirementInputs {
  title: string; about_role: string; requirements: string; required_experience: string; location: string;
  job_type: string;
}

export const AUTO_MIN_CHARS = 250;
const PLAN = [
  { key: "reading", label: "Reading job description" }, { key: "thinking", label: "Thinking…" },
  { key: "must_have", label: "Identifying must-haves" }, { key: "nice_to_have", label: "Identifying nice-to-haves" },
  { key: "checking", label: "Checking for duplicates" }, { key: "done", label: "Done" },
];
export const TYPES: { value: RequirementType; label: string; icon: React.ElementType }[] = [
  { value: "experience_years", label: "Experience (years)", icon: Clock },
  { value: "skill", label: "Skill", icon: Wrench },
  { value: "licence_certification", label: "Licence / certification", icon: Award },
  { value: "degree", label: "Degree", icon: GraduationCap },
  { value: "location_visa", label: "Location / visa", icon: MapPin },
  { value: "industry_sector", label: "Industry / sector", icon: Building2 },
  { value: "language", label: "Language", icon: Languages },
  { value: "other", label: "Other", icon: Tag },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.value, t]));
const FIELD_LABELS: Record<string, string> = {
  job_title: "Job title", job_description: "Job description", required_skills: "Required skills & qualifications",
  required_experience: "Required experience", location: "Location", job_type: "Job type",
};
const NAMES: Record<ListName, string> = { must: "Must-Have", nice: "Nice-to-Have" };
const field = "w-full rounded-lg border border-[#2A3F5E] bg-[#0A1929] px-3 py-1.5 text-sm text-white placeholder-[#546E7A] focus:border-[#00C853] focus:outline-none";

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9+#./]+/g) || [])
  .filter((w) => !["a", "an", "the", "of", "in", "with", "and", "or", "for", "to", "experience"].includes(w)));
/** The same requirement written twice (same meaningful words, case and spacing ignored). */
export function sameRequirement(a: string, b: string): boolean {
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return a.trim().toLowerCase() === b.trim().toLowerCase();
  return wa.size === wb.size && [...wa].every((w) => wb.has(w));
}
const newId = () => Math.random().toString(16).slice(2, 14);
const squash = (s?: string | null) => (s || "").trim().replace(/\s+/g, " ");
/** Has anything the AI read changed since the lists were generated? */
export function inputsChanged(inputs: RequirementInputs, generation?: RequirementsGeneration | null): boolean {
  const source = generation?.source;
  if (!source) return false;
  return (Object.keys(inputs) as (keyof RequirementInputs)[]).some((k) => squash(inputs[k]) !== squash(source[k]));
}

function TypeBadge({ type }: { type: RequirementType }) {
  const t = TYPE[type] || TYPE.other;
  const Icon = t.icon;
  return (
    <span title={t.label} className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[#132F4C] text-[#69F0AE]">
      <Icon size={13} aria-hidden="true" /><span className="sr-only">{t.label}</span>
    </span>
  );
}

function Row({ item, list, onSave, onMove, onDelete, onDragStart }: {
  item: RequirementItem; list: ListName; onSave: (patch: Partial<RequirementItem>) => void; onMove: () => void;
  onDelete: () => void; onDragStart: (e: React.DragEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [type, setType] = useState<RequirementType>(item.type);
  const save = () => {
    const value = squash(text);
    if (value && (value !== item.text || type !== item.type)) onSave({ text: value.slice(0, 160), type });
    setEditing(false);
  };
  const cancel = () => { setText(item.text); setType(item.type); setEditing(false); };
  const other = list === "must" ? "nice" : "must";

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-lg border border-[#00C853]/40 bg-[#132F4C] p-2" data-testid="req-row">
        <input autoFocus value={text} maxLength={160} aria-label="Requirement" className={cn(field, "min-w-[160px] flex-1")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); save(); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
          }} />
        <select value={type} onChange={(e) => setType(e.target.value as RequirementType)} aria-label="Type"
          className={cn(field, "w-auto")}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Button size="sm" onClick={save}>Save</Button>
        <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
      </li>
    );
  }
  return (
    <li draggable onDragStart={onDragStart} data-testid="req-row" data-origin={item.origin}
      className="animate-fade-in group flex cursor-grab items-start gap-2 rounded-lg border border-[#2A3F5E] bg-[#132F4C]/70 px-2 py-1.5 hover:border-[#3d5a80] active:cursor-grabbing">
      <TypeBadge type={item.type} />
      <button type="button" onClick={() => setEditing(true)} title="Edit"
        className="min-w-0 flex-1 text-left text-sm leading-6 text-[#E0E0E0] hover:text-white focus:outline-none focus-visible:underline">
        {item.text}
        {item.edited && item.origin === "ai" && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[#78909C]">edited</span>}
        {item.origin === "user" && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[#78909C]">added by HR</span>}
      </button>
      <InfoPopover ariaLabel="Where this comes from" testId="req-source" className="mt-0.5"
        panelClassName="border-[#00C853]/40"
        label={<Quote size={13} className={item.source ? "text-[#69F0AE]" : "text-[#546E7A]"} />}>
        {item.source ? (
          <span className="text-xs text-[#CFD8DC]">
            <span className="block text-[10px] uppercase tracking-wide text-[#78909C]">
              From {FIELD_LABELS[item.source_field || ""] || "the job"}
            </span>
            “{item.source}”
          </span>
        ) : (
          <span className="text-xs text-[#B0BEC5]">
            {item.origin === "user" ? "Added by HR – not taken from the job text." : "No matching sentence was found in the job text."}
          </span>
        )}
      </InfoPopover>
      <button type="button" onClick={onMove} aria-label={`Move to ${NAMES[other]}`} title={`Move to ${NAMES[other]}`}
        className="rounded p-1 text-[#78909C] hover:bg-[#0A1929] hover:text-white" data-testid="req-move">
        {list === "must" ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
      </button>
      <button type="button" onClick={onDelete} aria-label={`Delete ${item.text}`} title="Delete"
        className="rounded p-1 text-[#78909C] hover:bg-[#FF5252]/10 hover:text-[#FF8A80]" data-testid="req-delete">
        <Trash2 size={14} />
      </button>
    </li>
  );
}

function AddRow({ list, onAdd, onClose, exists }: {
  list: ListName; onAdd: (text: string, type: RequirementType) => void; onClose: () => void;
  exists: (text: string) => boolean;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState<RequirementType>("skill");
  const duplicate = squash(text) !== "" && exists(text);
  const add = () => {
    if (!squash(text) || duplicate) return;
    onAdd(squash(text).slice(0, 160), type);
    setText("");
  };
  return (
    <div className="space-y-1.5 rounded-lg border border-dashed border-[#00C853]/40 p-2" data-testid={`req-add-form-${list}`}>
      <div className="flex flex-wrap gap-2">
        <input autoFocus value={text} maxLength={160} placeholder={`New ${NAMES[list].toLowerCase()} requirement…`}
          aria-label={`New ${NAMES[list]} requirement`} className={cn(field, "min-w-[160px] flex-1")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
          }} />
        <select value={type} onChange={(e) => setType(e.target.value as RequirementType)} aria-label="Type"
          className={cn(field, "w-auto")}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Button size="sm" onClick={add} disabled={!squash(text) || duplicate}>Add</Button>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-[#78909C] hover:text-white">
          <X size={14} />
        </button>
      </div>
      {duplicate && <p className="text-xs text-yellow-300">Already in the lists.</p>}
    </div>
  );
}

/** The Must-Have / Nice-to-Have lists of a job: generated from the job description by AI (streamed, with the
 *  agent activity panel), editable by HR, never overwritten without asking. Saving the job never depends on it. */
export function RequirementLists({ must, nice, generation, inputs, jobId, mode, autoSignal, onChange, onStatus }: {
  must: RequirementItem[]; nice: RequirementItem[]; generation: RequirementsGeneration | null;
  inputs: RequirementInputs; jobId?: string; mode: "create" | "edit";
  /** Increments when the user has finished writing the description (left the field / paused typing). */
  autoSignal: number;
  onChange: (next: { must: RequirementItem[]; nice: RequirementItem[]; generation: RequirementsGeneration | null }) => void;
  /** Reports the AI run's state (so the form can show it next to the description, which may be far above). */
  onStatus?: (status: "idle" | "running" | "done" | "failed") => void;
}) {
  const agent = useAgentRun(PLAN);
  const [readiness, setReadiness] = useState<RequirementsReadiness | null>(null);
  const [live, setLive] = useState<{ must_have: RequirementItem[]; nice_to_have: RequirementItem[] }>({ must_have: [], nice_to_have: [] });
  const [adding, setAdding] = useState<ListName | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [keepManual, setKeepManual] = useState(true);
  const [dismissedChange, setDismissedChange] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ListName | null>(null);
  const [summary, setSummary] = useState<string>("");
  const autoDone = useRef(false);
  const state = useRef({ must, nice, generation });
  useEffect(() => { state.current = { must, nice, generation }; }, [must, nice, generation]);

  useEffect(() => {
    jobRequirementsAPI.readiness().then((r) => setReadiness(r.data)).catch(() => setReadiness(null));
  }, []);

  const running = agent.status === "running";
  useEffect(() => { onStatus?.(agent.status); }, [agent.status, onStatus]);
  const manual = [...must, ...nice].filter((i) => i.origin === "user" || i.edited);
  const hasLists = must.length + nice.length > 0;
  const estimate = readiness?.estimate_usd != null ? ` (≈ ${formatUsd(readiness.estimate_usd)})` : "";
  const changeKey = JSON.stringify(inputs);
  const jdChanged = !running && inputsChanged(inputs, generation) && dismissedChange !== changeKey;

  const generate = (keep: RequirementItem[] = []) => {
    setLive({ must_have: [], nice_to_have: [] });
    setConfirmRegen(false);
    agent.run("/job-requirements/generate", { ...inputs, job_id: jobId ?? null }, {
      onItem: ({ list, item }) => setLive((l) => ({ ...l, [list]: [...l[list as "must_have" | "nice_to_have"],
        { ...item, id: newId(), origin: "ai" }] })),
      onReset: () => setLive({ must_have: [], nice_to_have: [] }),
      onResult: (r) => {
        const kept = keep;
        const keptIds = new Set(kept.map((i) => i.id));
        // a new suggestion is dropped when HR kept the same requirement: same words, or (edited AI items) the same
        // sentence of the job it was taken from
        const isKept = (item: RequirementItem) => kept.some((k) => sameRequirement(k.text, item.text)
          || (Boolean(k.source) && squash(k.source) === squash(item.source)));
        const current = state.current;
        const nextMust = [...current.must.filter((i) => keptIds.has(i.id)),
          ...(r.must_have as RequirementItem[]).filter((i) => !isKept(i))];
        const nextNice = [...current.nice.filter((i) => keptIds.has(i.id)),
          ...(r.nice_to_have as RequirementItem[]).filter((i) => !isKept(i))];
        setSummary(`${r.must_have.length} must-have${r.must_have.length === 1 ? "" : "s"} · ${r.nice_to_have.length} ` +
          `nice-to-have${r.nice_to_have.length === 1 ? "" : "s"} from the job description` +
          (kept.length ? ` · kept ${kept.length} of yours` : ""));
        onChange({ must: nextMust, nice: nextNice, generation: r.generation });
        setDismissedChange(null);
      },
    });
  };

  // Automatic generation: Create Job only, once, when the description is long enough, the user has finished
  // writing it, the lists are still empty and AI is available.
  useEffect(() => {
    if (!autoSignal || mode !== "create" || autoDone.current || running || !readiness?.ready) return;
    if (inputs.about_role.trim().length < AUTO_MIN_CHARS || state.current.must.length + state.current.nice.length) return;
    autoDone.current = true;
    generate();
  }, [autoSignal]);

  const regenerate = () => {
    if (manual.length) { setKeepManual(true); setConfirmRegen(true); } else generate();
  };

  const update = (list: ListName, id: string, patch: Partial<RequirementItem>) => {
    const apply = (items: RequirementItem[]) => items.map((i) => (i.id === id ? { ...i, ...patch, edited: true } : i));
    onChange({ must: list === "must" ? apply(must) : must, nice: list === "nice" ? apply(nice) : nice, generation });
  };
  const remove = (list: ListName, id: string) => onChange({
    must: list === "must" ? must.filter((i) => i.id !== id) : must,
    nice: list === "nice" ? nice.filter((i) => i.id !== id) : nice, generation });
  const move = (from: ListName, id: string) => {
    const source = from === "must" ? must : nice;
    const item = source.find((i) => i.id === id);
    if (!item) return;
    onChange({
      must: from === "must" ? must.filter((i) => i.id !== id) : [...must, item],
      nice: from === "nice" ? nice.filter((i) => i.id !== id) : [...nice, item], generation });
  };
  const add = (list: ListName, text: string, type: RequirementType) => {
    const item: RequirementItem = { id: newId(), text, type, origin: "user", edited: false, source: null, source_field: null };
    onChange({ must: list === "must" ? [...must, item] : must, nice: list === "nice" ? [...nice, item] : nice, generation });
  };
  const exists = (text: string) => [...must, ...nice].some((i) => sameRequirement(i.text, text));

  const onDrop = (to: ListName) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const [from, id] = (e.dataTransfer.getData("text/plain") || "").split(":");
    if ((from === "must" || from === "nice") && from !== to) move(from, id);
  };

  const blocked = readiness && !readiness.ready ? readiness.blockers[0]?.message : null;
  const tooShort = inputs.about_role.trim().length + inputs.requirements.trim().length
    + inputs.required_experience.trim().length < (readiness?.min_input_chars ?? 60);

  const columns = useMemo(() => ([["must", must], ["nice", nice]] as [ListName, RequirementItem[]][]), [must, nice]);

  return (
    <div className="space-y-3" data-testid="requirements">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-[#B0BEC5]">
          AI drafts these from the job description; you decide. Hover the quote icon to see the sentence each one came from.
        </p>
        {(hasLists || generation) && !running && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={regenerate} disabled={Boolean(blocked) || tooShort}
            data-testid="req-regenerate">
            <RefreshCw size={13} className="mr-1.5" /> Regenerate from JD{estimate}
          </Button>
        )}
      </div>

      {jdChanged && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100"
          role="status" data-testid="req-jd-changed">
          <span>Job description changed. Regenerate?</span>
          <span className="text-xs text-yellow-200/70">Your lists stay as they are until you choose.</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={regenerate} disabled={Boolean(blocked)}>Regenerate</Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissedChange(changeKey)}>Dismiss</Button>
          </div>
        </div>
      )}

      {agent.status !== "idle" && (
        <AgentActivity title="Generating requirements from the job description" steps={agent.steps} status={agent.status}
          elapsedMs={agent.elapsedMs} costUsd={agent.costUsd} summary={summary} error={agent.error} testId="agent-activity">
          {running && (live.must_have.length + live.nice_to_have.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2" data-testid="req-live">
              {(["must_have", "nice_to_have"] as const).map((name) => (
                <div key={name}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#78909C]">
                    {name === "must_have" ? "Must-Have" : "Nice-to-Have"}
                  </p>
                  <ul className="space-y-1">
                    <AnimatePresence initial={false}>
                      {live[name].map((i) => (
                        <motion.li key={i.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 rounded-md bg-[#132F4C]/70 px-2 py-1 text-xs text-[#E0E0E0]"
                          data-testid="req-live-item">
                          <TypeBadge type={i.type} /> {i.text}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              ))}
            </div>
          )}
          {agent.status === "failed" && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => generate(manual)} disabled={Boolean(blocked)}>
                <RefreshCw size={13} className="mr-1.5" /> Try again
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding("must")}>
                <Plus size={13} className="mr-1.5" /> Add requirements by hand
              </Button>
            </div>
          )}
        </AgentActivity>
      )}

      {!hasLists && !running && agent.status !== "failed" && adding === null && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#2A3F5E] px-4 py-6 text-center"
          data-testid="req-empty">
          <Sparkles size={22} className="text-[#00C853]" aria-hidden="true" />
          <p className="max-w-md text-sm text-[#B0BEC5]">
            {mode === "create"
              ? `No requirements yet. They're generated automatically once the job description is written (${AUTO_MIN_CHARS}+ characters) – or start now.`
              : "No Must-Have / Nice-to-Have lists for this job yet."}
          </p>
          {blocked && <p className="max-w-md text-xs text-yellow-300" data-testid="req-blocked">AI unavailable: {blocked}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => generate()} disabled={Boolean(blocked) || tooShort} data-testid="req-generate">
              <Sparkles size={13} className="mr-1.5" /> Generate from JD{estimate}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding("must")} data-testid="req-add-by-hand">
              <Plus size={13} className="mr-1.5" /> Add by hand
            </Button>
          </div>
          {tooShort && !blocked && <p className="text-xs text-[#78909C]">Write the job description first.</p>}
        </div>
      )}

      {(hasLists || adding !== null) && !running && (
        <div className="grid gap-4 md:grid-cols-2">
          {columns.map(([list, items]) => (
            <div key={list} data-testid={`req-list-${list}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(list); }} onDragLeave={() => setDragOver(null)}
              onDrop={onDrop(list)}
              className={cn("rounded-xl border p-3 transition-colors",
                dragOver === list ? "border-[#00C853] bg-[#00C853]/5" : "border-[#2A3F5E] bg-[#0A1929]/40")}>
              <div className="mb-2 flex items-center gap-2">
                <Briefcase size={14} className={list === "must" ? "text-[#00C853]" : "text-[#64B5F6]"} aria-hidden="true" />
                <h5 className="text-sm font-semibold text-white">{NAMES[list]}</h5>
                <span className="rounded-full bg-[#132F4C] px-2 text-xs text-[#B0BEC5]" data-testid={`req-count-${list}`}>{items.length}</span>
                <span className="ml-auto hidden text-[10px] text-[#546E7A] md:inline">drag to move</span>
              </div>
              <ul className="space-y-1.5">
                {items.map((item) => (
                    <Row key={item.id} item={item} list={list} onSave={(p) => update(list, item.id, p)}
                      onMove={() => move(list, item.id)} onDelete={() => remove(list, item.id)}
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", `${list}:${item.id}`); e.dataTransfer.effectAllowed = "move"; }} />
                  ))}
                {!items.length && <li className="px-1 py-2 text-xs text-[#546E7A]">Nothing here yet.</li>}
              </ul>
              <div className="mt-2">
                {adding === list ? (
                  <AddRow list={list} onAdd={(t, ty) => add(list, t, ty)} onClose={() => setAdding(null)} exists={exists} />
                ) : (
                  <button type="button" onClick={() => setAdding(list)} data-testid={`req-add-${list}`}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#00C853] hover:bg-[#00C853]/10">
                    <Plus size={13} /> Add requirement
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={confirmRegen} variant="primary" testId="req-regen-dialog" title="Regenerate from the job description?"
        confirmLabel="Regenerate" onCancel={() => setConfirmRegen(false)}
        onConfirm={() => generate(keepManual ? manual : [])}
        message={(
          <span className="block space-y-3">
            <span className="block">The AI will draft new lists from the current job description. Its earlier suggestions are replaced.</span>
            <label className="flex items-start gap-2 text-white">
              <input type="checkbox" checked={keepManual} onChange={(e) => setKeepManual(e.target.checked)}
                className="mt-1 accent-[#00C853]" data-testid="req-keep-manual" />
              <span>Keep my {manual.length} manual or edited item{manual.length === 1 ? "" : "s"}</span>
            </label>
          </span>
        )} />
    </div>
  );
}
