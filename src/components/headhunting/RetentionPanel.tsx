"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { headhuntingAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { HHConfig, HHRetentionInfo } from "@/types";

const EXTEND_REASON: Record<string, string> = {
  active_review: "HR review in progress",
  pending_hiring_decision: "Hiring decision pending",
  other: "Other (note required)",
};
const DELETE_REASON: Record<string, string> = {
  data_subject_request: "Request from the person (data-subject request)",
  not_relevant: "Not relevant",
  wrong_person_or_inaccurate: "Wrong person or inaccurate",
  other: "Other",
};
const ACTION: Record<string, string> = {
  discovered: "Found – retention started",
  extend: "Retention extended",
  delete_now: "Deleted",
  purge: "Expired data purged",
  replay: "Deletion re-applied after a restore",
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");
const field = "bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-xs text-white px-2 py-1";

export function RetentionPanel({ prospectId, jobId, canonicalUrl, onDeleted }: {
  prospectId: string; jobId: string; canonicalUrl: string; onDeleted: () => void;
}) {
  const [info, setInfo] = useState<HHRetentionInfo | null>(null);
  const [config, setConfig] = useState<HHConfig | null>(null);
  const [reason, setReason] = useState("active_review");
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState("not_relevant");
  const [suppress, setSuppress] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([headhuntingAPI.retention(prospectId), headhuntingAPI.config()]);
      setInfo(r.data);
      setConfig(c.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load retention"));
    }
  }, [prospectId]);

  useEffect(() => { load(); }, [load]);

  if (!info) return null;
  const forced = (config?.retention.forced_suppression_reasons || []).includes(deleteReason);
  const maxDays = config?.retention.max_extension_days ?? 90;

  const doExtend = async () => {
    setBusy(true);
    try {
      await headhuntingAPI.extend(jobId, { canonical_url: canonicalUrl, days, reason_code: reason, note: note || null });
      toast.success("Retention extended");
      setNote("");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not extend retention"));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (url: string) => {
    setBusy(true);
    try {
      const res = await headhuntingAPI.deleteNow({ canonical_url: url, reason_code: deleteReason, suppress: suppress || forced });
      const d = res.data.deleted;
      toast.success(`Deleted from ${d.runs} run(s) in ${d.jobs} job(s)${d.suppressed ? "; will not be collected again" : ""}`);
      if (url === canonicalUrl) onDeleted(); else await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Retention" className="rounded-lg border border-[#2A3F5E] p-3 space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Clock size={14} /> Retention</h3>
      <div className="text-xs text-[#B0BEC5] space-y-1">
        <p data-testid="retention-expiry">
          This person&apos;s data for this job is <strong className="text-white">deleted on {day(info.expires_at)}</strong>
          {info.days_left !== null && ` (${info.days_left} day(s) left)`}.
        </p>
        <p>Found {day(info.first_discovered_at)} · cannot be kept beyond {day(info.cap_at)} · extended {info.extensions} time(s).
          Review status does not extend retention.</p>
        {info.extension_note && <p>Extension note (deleted with the data): “{info.extension_note}”</p>}
      </div>

      {info.history.length > 0 && (
        <ul className="text-xs text-[#546E7A] space-y-0.5" aria-label="Retention history">
          {info.history.map((h, i) => (
            <li key={i}>{day(h.at)} – {ACTION[h.action] || h.action}
              {h.reason_code && ` (${EXTEND_REASON[h.reason_code]?.replace(" (note required)", "") || DELETE_REASON[h.reason_code] || h.reason_code})`}
              {h.new_expires_at && ` → until ${day(h.new_expires_at)}`}</li>
          ))}
        </ul>
      )}

      {!info.can_manage ? (
        <p className="text-xs text-[#546E7A]">Extending or deleting needs the headhunting.retention permission.</p>
      ) : (
        <>
          <div className="space-y-2" aria-label="Extend retention">
            <p className="text-xs text-white font-medium">Extend retention</p>
            {info.can_extend_until ? (
              <div className="flex flex-wrap items-end gap-2">
                <select aria-label="Extension reason" value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
                  {(config?.retention.extend_reasons || Object.keys(EXTEND_REASON)).map((r) =>
                    <option key={r} value={r}>{EXTEND_REASON[r] || r}</option>)}
                </select>
                <label className="text-xs text-[#B0BEC5]">Days from today
                  <input aria-label="Extension days" type="number" min={1} max={maxDays} value={days}
                    onChange={(e) => setDays(Math.max(1, Math.min(maxDays, Number(e.target.value) || 1)))}
                    className={`${field} ml-1 w-16`} />
                </label>
                <input aria-label="Extension note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
                  placeholder="Note – deleted with the data; no contact details" className={`${field} flex-1 min-w-[180px]`} />
                <Button size="sm" variant="secondary" isLoading={busy} onClick={doExtend}
                  disabled={reason === "other" && !note.trim()}>Extend</Button>
                <p className="w-full text-[11px] text-[#546E7A]">Latest possible date now: {day(info.can_extend_until)}.
                  The reason is audited; the note is not kept in the audit log.</p>
              </div>
            ) : (
              <p className="text-xs text-[#546E7A]">Cannot be extended further (limit {day(info.cap_at)}).</p>
            )}
          </div>

          <div className="space-y-2">
            {!deleting ? (
              <Button size="sm" variant="danger" onClick={() => setDeleting(true)}><Trash2 size={14} className="mr-1" /> Delete now…</Button>
            ) : (
              <div className="rounded-lg border border-[#FF5252]/40 bg-[#FF5252]/5 p-3 space-y-2" role="group" aria-label="Delete now">
                <p className="text-xs text-[#FF8A80] flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5" />
                  <span>{`Removes this person from ${info.presence?.runs ?? "all"} run(s) in ${info.presence?.jobs ?? "all"} job(s), `
                    + "including other users' runs: evidence, assessments, search results, reviews and notes. This cannot be undone."}</span></p>
                <select aria-label="Deletion reason" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} className={field}>
                  {(config?.retention.delete_reasons || Object.keys(DELETE_REASON)).map((r) =>
                    <option key={r} value={r}>{DELETE_REASON[r] || r}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs text-[#B0BEC5]">
                  <input type="checkbox" aria-label="Do not collect again" checked={suppress || forced} disabled={forced}
                    onChange={(e) => setSuppress(e.target.checked)} />
                  Do not collect this profile again{forced && " (always applied to requests from the person)"}
                </label>
                {(info.possible_same_person || []).length > 0 && (
                  <div className="text-xs text-[#B0BEC5]" aria-label="Possibly the same person">
                    <p className="text-white">Possibly the same person (not deleted automatically):</p>
                    <ul className="space-y-1 mt-1">
                      {info.possible_same_person!.map((o) => (
                        <li key={o.canonical_url} className="flex items-center gap-2">
                          <span className="break-all">{o.display_name} – {o.canonical_url} ({o.match})</span>
                          <Button size="sm" variant="ghost" disabled={confirmText !== "DELETE" || busy}
                            onClick={() => doDelete(o.canonical_url)}>Delete this one too</Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input aria-label="Type DELETE to confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE" className={`${field} w-28`} />
                  <Button size="sm" variant="danger" isLoading={busy} disabled={confirmText !== "DELETE"}
                    onClick={() => doDelete(canonicalUrl)}>Delete everywhere</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setDeleting(false); setConfirmText(""); }}>Cancel</Button>
                </div>
                {(info.presence?.active_runs ?? 0) > 0 &&
                  <p className="text-xs text-yellow-300">A running run contains this profile – deletion waits until it finishes.</p>}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
