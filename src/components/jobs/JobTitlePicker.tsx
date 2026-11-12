"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { duplicateTitle, jobTitlesAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { JobTitle } from "@/types";

const field = "w-full rounded-lg border border-[#2A3F5E] bg-[#0A1929] px-3 py-2 text-sm text-white placeholder-[#546E7A] focus:border-[#00C853] focus:outline-none";
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Choose a job title from the organisation's list (searchable, keyboard friendly). Titles cannot be typed straight
 *  into the job: "+ Create Job Title" adds one to the list (duplicates are caught) and selects it. */
export function JobTitlePicker({ titles, value, fallbackName, onChange, onTitlesChanged, onManage, invalid, describedBy,
  id }: {
  titles: JobTitle[]; value: string; fallbackName?: string; onChange: (title: JobTitle) => void;
  onTitlesChanged: () => Promise<void> | void; onManage: () => void; invalid?: boolean; describedBy?: string; id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = titles.find((t) => t.job_title_id === value);
  const shown = useMemo(() => titles.filter((t) => !t.archived && norm(t.name).includes(norm(query))), [titles, query]);
  const exact = titles.find((t) => !t.archived && norm(t.name) === norm(creating ?? ""));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function close() { setOpen(false); setCreating(null); setQuery(""); }
  const pick = (t: JobTitle) => { onChange(t); close(); };

  const save = async () => {
    const name = (creating || "").trim();
    if (!name) return;
    if (exact) { pick(exact); toast(`"${exact.name}" is already in the list – selected it`); return; }
    setSaving(true);
    try {
      const created = (await jobTitlesAPI.create(name)).data;
      await onTitlesChanged();
      pick(created);
      toast.success(`"${created.name}" added to the job titles`);
    } catch (error) {
      const existing = duplicateTitle(error);
      if (existing) { await onTitlesChanged(); pick(existing); toast(`"${existing.name}" is already in the list – selected it`); }
      else toast.error(getErrorMessage(error, "Could not add the job title"));
    } finally {
      setSaving(false);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(shown.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) pick(shown[active]); else setCreating(query.trim()); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  };

  return (
    <div ref={wrap} className="relative">
      <button id={id} type="button" role="combobox" aria-expanded={open} aria-controls={listId} aria-haspopup="listbox"
        aria-invalid={invalid || undefined} aria-describedby={describedBy} data-testid="title-picker"
        onClick={() => { setOpen((o) => !o); setActive(0); }}
        onKeyDown={(e) => { if ((e.key === "ArrowDown" || e.key === "Enter") && !open) { e.preventDefault(); setOpen(true); } }}
        className={cn("flex w-full items-center justify-between gap-2 rounded-lg border bg-[#132F4C] px-4 py-2.5 text-left text-white",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C853]",
          invalid ? "border-[#FF5252]" : "border-[#2A3F5E] hover:border-[#3d5a80]")}>
        <span className={cn("truncate", !selected && !fallbackName && "text-[#546E7A]")}>
          {selected?.name || fallbackName || "Choose a job title…"}
        </span>
        <ChevronDown size={16} className={cn("flex-shrink-0 text-[#B0BEC5] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#2A3F5E] bg-[#0F2236] shadow-2xl"
          data-testid="title-picker-panel">
          {creating === null ? (
            <>
              <div className="relative border-b border-[#2A3F5E] p-2">
                <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#546E7A]" />
                <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onListKey}
                  placeholder="Search job titles…" aria-label="Search job titles" aria-controls={listId}
                  aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined} className={cn(field, "pl-8")} />
              </div>
              <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1" aria-label="Job titles">
                {shown.length === 0 && (
                  <li className="px-4 py-3 text-sm text-[#B0BEC5]">No title matches “{query}”.</li>
                )}
                {shown.map((t, i) => (
                  <li key={t.job_title_id} id={`${listId}-${i}`} role="option" aria-selected={t.job_title_id === value}
                    onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(t)}
                    className={cn("flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm",
                      i === active ? "bg-[#00C853]/10 text-white" : "text-[#E0E0E0]")}>
                    <span className="truncate">{t.name}</span>
                    {t.job_title_id === value && <Check size={14} className="flex-shrink-0 text-[#00C853]" />}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-2 border-t border-[#2A3F5E] p-2">
                <button type="button" onClick={() => setCreating(query.trim())} data-testid="create-title"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#00C853] hover:bg-[#00C853]/10">
                  <Plus size={14} /> Create Job Title
                </button>
                <button type="button" onClick={() => { close(); onManage(); }} data-testid="manage-titles-link"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[#B0BEC5] hover:bg-[#132F4C] hover:text-white">
                  <Settings2 size={13} /> Manage job titles
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2 p-3" data-testid="create-title-form">
              <label className="block text-xs font-medium text-[#B0BEC5]" htmlFor={`${listId}-new`}>New job title</label>
              <input id={`${listId}-new`} autoFocus value={creating} onChange={(e) => setCreating(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); save(); }
                  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setCreating(null); }
                }}
                placeholder="e.g. Inventory Controller" maxLength={225} className={field} />
              {exact && <p className="text-xs text-yellow-300">Already in the list as “{exact.name}” – saving selects it.</p>}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCreating(null)}>Back</Button>
                <Button size="sm" onClick={save} isLoading={saving} disabled={!creating.trim()}>
                  {exact ? "Select it" : "Save title"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
