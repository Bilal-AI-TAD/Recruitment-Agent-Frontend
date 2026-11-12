"use client";

import { createPortal } from "react-dom";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, Pencil, RotateCcw, Search, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { jobTitlesAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { JobTitle } from "@/types";

const field = "w-full rounded-lg border border-[#2A3F5E] bg-[#0A1929] px-3 py-2 text-sm text-white placeholder-[#546E7A] focus:border-[#00C853] focus:outline-none";

/** The organisation's job title list: search, rename (optionally renaming the jobs using it), delete or hide, restore. */
export function ManageJobTitles({ open, onClose, onChanged }: {
  open: boolean; onClose: () => void; onChanged?: () => void;
}) {
  const [titles, setTitles] = useState<JobTitle[]>([]);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; updateJobs: boolean } | null>(null);
  const [deleting, setDeleting] = useState<JobTitle | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTitles((await jobTitlesAPI.list(true)).data.job_titles);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load the job titles"));
    }
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => {
    if (!open || deleting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (editing) setEditing(null); else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, editing, deleting, onClose]);

  const shown = useMemo(() => titles
    .filter((t) => showArchived || !t.archived)
    .filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase())), [titles, query, showArchived]);
  const archivedCount = titles.filter((t) => t.archived).length;

  const saveRename = async (title: JobTitle) => {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    try {
      const res = await jobTitlesAPI.rename(title.job_title_id, editing.name, editing.updateJobs && title.used_by > 0);
      toast.success(res.data.jobs_renamed ? `Renamed, and ${res.data.jobs_renamed} job(s) updated` : "Title renamed");
      setEditing(null);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not rename the title"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await jobTitlesAPI.remove(deleting.job_title_id);
      toast.success(res.data.result === "archived" ? `"${deleting.name}" hidden from the list; its jobs keep the title`
        : `"${deleting.name}" deleted`);
      setDeleting(null);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete the title"));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (title: JobTitle) => {
    try {
      await jobTitlesAPI.restore(title.job_title_id);
      toast.success(`"${title.name}" is back in the list`);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not restore the title"));
    }
  };

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="manage-titles-heading" data-testid="manage-titles"
        className="relative flex h-full w-full flex-col overflow-hidden border-[#2A3F5E] bg-[#1a2a3a] shadow-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl sm:border">
        <div className="flex items-center justify-between border-b border-[#2A3F5E] px-6 py-4">
          <div>
            <h3 id="manage-titles-heading" className="text-lg font-semibold text-white">Manage job titles</h3>
            <p className="text-xs text-[#B0BEC5]">Shared by everyone in your organisation. Duplicates are not allowed.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#B0BEC5] hover:bg-[#132F4C] hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-6 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#546E7A]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles…"
              aria-label="Search job titles" className={cn(field, "pl-8")} />
          </div>
          {archivedCount > 0 && (
            <label className="flex items-center gap-2 text-xs text-[#B0BEC5]">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-[#00C853]" /> Show hidden ({archivedCount})
            </label>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto px-3 pb-4" data-testid="manage-titles-list">
          {shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-[#B0BEC5]">No job titles match.</li>}
          {shown.map((t) => (
            <li key={t.job_title_id} data-testid="title-row"
              className="rounded-lg px-3 py-2.5 hover:bg-[#132F4C]/60">
              {editing?.id === t.job_title_id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input autoFocus value={editing.name} aria-label="New title" className={field}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveRename(t); } }} />
                    <Button size="sm" onClick={() => saveRename(t)} isLoading={busy} aria-label="Save title">
                      <Check size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel rename">
                      <X size={14} />
                    </Button>
                  </div>
                  {t.used_by > 0 && (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2.5 text-xs text-[#B0BEC5]" data-testid="rename-impact">
                      <label className="flex items-start gap-2 text-white">
                        <input type="checkbox" checked={editing.updateJobs} className="mt-0.5 accent-[#00C853]"
                          onChange={(e) => setEditing({ ...editing, updateJobs: e.target.checked })} data-testid="rename-jobs" />
                        <span>Used by {t.used_by} job{t.used_by === 1 ? "" : "s"} – also rename {t.used_by === 1 ? "it" : `those ${t.used_by} jobs`}</span>
                      </label>
                      <p className="mt-1 pl-6">
                        {editing.updateJobs
                          ? "Recommended for spelling fixes. Their current assessments will show “Job title edited” (out of date – nothing is re-assessed automatically), and their mailbox search phrases will start from the new title."
                          : "Only future jobs use the new name; existing jobs keep their current title."}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", t.archived ? "text-[#546E7A] line-through" : "text-white")}>{t.name}</p>
                    <p className="text-xs text-[#546E7A]">
                      {t.used_by ? `Used by ${t.used_by} job${t.used_by === 1 ? "" : "s"}` : "Not used yet"}
                      {t.archived && " · hidden from the list"}
                    </p>
                  </div>
                  {t.archived ? (
                    <Button size="sm" variant="ghost" onClick={() => restore(t)}><RotateCcw size={14} className="mr-1" /> Restore</Button>
                  ) : (
                    <>
                      <button type="button" aria-label={`Rename ${t.name}`} title="Rename"
                        onClick={() => setEditing({ id: t.job_title_id, name: t.name, updateJobs: true })}
                        className="rounded-lg p-2 text-[#B0BEC5] hover:bg-[#132F4C] hover:text-white"><Pencil size={15} /></button>
                      <button type="button" aria-label={`Delete ${t.name}`} title={t.used_by ? "Hide from the list" : "Delete"}
                        onClick={() => setDeleting(t)}
                        className="rounded-lg p-2 text-[#B0BEC5] hover:bg-[#FF5252]/10 hover:text-[#FF8A80]">
                        {t.used_by ? <Archive size={15} /> : <Trash2 size={15} />}
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog open={deleting !== null} busy={busy} testId="delete-title-dialog"
        title={deleting?.used_by ? "Hide this job title?" : "Delete this job title?"}
        message={deleting?.used_by
          ? <>“{deleting.name}” is used by {deleting.used_by} job{deleting.used_by === 1 ? "" : "s"}, so it will be hidden from
            the list instead of deleted. Those jobs keep their title. You can restore it later.</>
          : <>“{deleting?.name}” is not used by any job and will be deleted.</>}
        confirmLabel={deleting?.used_by ? "Hide title" : "Delete title"} onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)} />
    </div>,
    document.body,
  );
}
