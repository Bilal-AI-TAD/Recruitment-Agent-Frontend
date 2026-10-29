"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import toast from "react-hot-toast";
import { sharingAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { CvShareStatus } from "@/types";

/** Whether this application's CV has an external "View CV" link (from an Excel export), and "Stop sharing". */
export function SharedCvStatus({ candidateId }: { candidateId: string }) {
  const [status, setStatus] = useState<CvShareStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    sharingAPI.cvShare(candidateId).then((r) => setStatus(r.data)).catch(() => setStatus(null));
  }, [candidateId]);
  useEffect(load, [load]);

  if (!status) return null;
  const stop = async () => {
    if (!window.confirm("Stop sharing this CV? Its link in exported Excel files will stop working for good. "
      + "A later export creates a new link.")) return;
    setBusy(true);
    try {
      setStatus((await sharingAPI.stopSharing(candidateId)).data);
      toast.success("CV sharing stopped – the exported link no longer works");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not stop sharing"));
    } finally {
      setBusy(false);
    }
  };
  const latest = status.links[0];
  const opened = status.links.reduce((sum, l) => sum + (l.opened || 0), 0);
  return (
    <p className="text-xs text-[#B0BEC5] mt-0.5 flex flex-wrap items-center gap-1" data-testid="shared-cv-status">
      <Link2 size={12} className="text-[#00C853]" />
      {status.shared && latest ? (
        <>
          <span>
            Shared CV link: active since {latest.created_at ? new Date(latest.created_at).toLocaleDateString() : "—"}
            {latest.created_by_name && <> (by {latest.created_by_name})</>} · opened {opened} time{opened === 1 ? "" : "s"}
            {!status.sharing_enabled && <span className="text-yellow-300"> · paused (External CV sharing is off)</span>}
          </span>
          <button type="button" onClick={stop} disabled={busy} data-testid="stop-sharing"
            className="ml-1 px-2 py-0.5 rounded border border-[#FF5252]/50 text-[#FF8A80] hover:bg-[#FF5252]/10 disabled:opacity-50">
            {busy ? "Stopping…" : "Stop sharing"}
          </button>
        </>
      ) : (
        <span>CV not shared outside the app (an Excel export creates a link).</span>
      )}
    </p>
  );
}
