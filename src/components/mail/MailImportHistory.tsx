"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { mailImportAPI } from "@/lib/api";
import { MailImportRun } from "@/types";
import { formatDate } from "@/components/pool/PoolBits";
import { RUN_STATUS } from "@/components/mail/MailImportModal";

/** Recent mailbox imports for a job - shared by the whole organization. `onOpen` is omitted for members who
 *  cannot import (they see the history, not the import screen). */
export function MailImportHistory({ jobId, refreshKey, onOpen }: {
  jobId: string; refreshKey: number; onOpen?: (runId: string) => void;
}) {
  const [runs, setRuns] = useState<MailImportRun[]>([]);

  const load = useCallback(() => {
    mailImportAPI.imports(jobId).then((res) => setRuns((res.data as { runs: MailImportRun[] }).runs)).catch(() => setRuns([]));
  }, [jobId]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    if (!runs.some((r) => ["queued", "running"].includes(r.status))) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [runs, load]);

  if (!runs.length) return null;
  return (
    <div className="mt-4 border-t border-[#2A3F5E] pt-3">
      <h3 className="text-sm text-[#B0BEC5] mb-2 flex items-center gap-2"><Mail size={14} /> Mailbox imports</h3>
      <ul className="space-y-1">
        {runs.slice(0, 5).map((r) => (
          <li key={r.run_id}>
            <button onClick={() => onOpen?.(r.run_id)} disabled={!onOpen} data-testid="import-run"
              className="w-full text-left text-xs text-[#E0E0E0] enabled:hover:text-white bg-[#132F4C] rounded px-2 py-1.5 flex flex-wrap justify-between gap-2 disabled:cursor-default">
              <span>{formatDate(r.created_at)} · {r.mailbox_email}{r.imported_by && <> · by {r.imported_by}</>}</span>
              <span className={r.status === "completed" ? "text-[#00C853]" : r.status === "running" || r.status === "queued" ? "text-blue-300" : "text-yellow-300"}>
                {RUN_STATUS[r.status]} · {r.counts.imported || 0}/{r.total} imported
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
