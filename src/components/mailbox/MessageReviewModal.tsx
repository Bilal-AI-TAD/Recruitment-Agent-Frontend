"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Paperclip, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OutboxMessage } from "@/types";

export interface ReviewContent {
  from: string | null;
  to: string;
  onRecord: string | null;
  subject: string;
  body: string;
  footer?: string | null;
  outreach?: boolean;
}

const sameAddress = (a?: string | null, b?: string | null) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();

/** The [[placeholders]] HR still has to replace (same rule as the server, which refuses approval while any remain). */
export function openPlaceholders(...texts: string[]): string[] {
  const seen: string[] = [];
  for (const text of texts) {
    for (const match of (text || "").match(/\[\[[^\[\]\n]{1,200}\]\]/g) || []) {
      if (!seen.includes(match)) seen.push(match);
    }
  }
  return seen;
}

/** Honest wording after an approval: never "sent" before Outlook has taken it. */
export function approvalOutcome(m: OutboxMessage): string {
  if (["submitted", "confirmed"].includes(m.status)) return "Approved and sent.";
  if (m.status === "approved" && m.status_detail) return `Approved, not sent: ${m.status_detail}`;
  return "Approved. Outlook is sending it now; the status below changes to Sent once Outlook has taken it.";
}

/** The last look before an e-mail is approved (or put up for approval): exactly what the recipient will receive. */
export function MessageReviewModal({ content, canApprove, sendingIssue, onBack, onConfirm }: {
  content: ReviewContent; canApprove: boolean; sendingIssue: string | null | undefined;
  onBack: () => void; onConfirm: () => Promise<void>;
}) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);            // a second click before React re-renders must not submit twice

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !inFlight.current) onBack(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const confirm = async () => {
    if (inFlight.current || !checked) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const otherAddress = !content.outreach && !sameAddress(content.to, content.onRecord);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={() => !inFlight.current && onBack()}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="bg-[#1a2a3a] border border-[#2A3F5E] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4"
        role="dialog" aria-modal="true" aria-label="Review e-mail" data-testid="review-modal">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#00C853]" /> Review e-mail</h2>
          <button onClick={onBack} disabled={busy} className="text-[#B0BEC5] hover:text-white" aria-label="Close"><X size={20} /></button>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-[#B0BEC5]">From</dt>
          <dd className="text-white break-all" data-testid="review-from">{content.from || "Company mailbox (not connected)"}</dd>
          <dt className="text-[#B0BEC5]">To</dt>
          <dd className="text-white break-all" data-testid="review-to">{content.to}
            {otherAddress && (
              <span className="block text-xs text-yellow-200 flex items-center gap-1" data-testid="review-recipient-differs">
                <AlertTriangle size={12} /> Not the candidate&apos;s address on record{content.onRecord ? ` (${content.onRecord})` : ""}
              </span>
            )}
          </dd>
          <dt className="text-[#B0BEC5]">Subject</dt>
          <dd className="text-white break-words" data-testid="review-subject">{content.subject}</dd>
          <dt className="text-[#B0BEC5]">Attachments</dt>
          <dd className="text-[#B0BEC5] flex items-center gap-1" data-testid="review-attachments">
            <Paperclip size={12} /> No attachments (attachments are not supported)</dd>
        </dl>

        <div className="rounded-lg border border-[#2A3F5E] bg-[#132F4C] p-3 text-sm text-[#E0E0E0] whitespace-pre-wrap break-words"
          data-testid="review-body">
          {content.body}
          {content.footer && <span className="block mt-3 text-xs text-[#B0BEC5]">{content.footer}</span>}
        </div>

        {sendingIssue && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-200 flex gap-2"
            data-testid="review-sending-issue">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>Sending is currently off or blocked: {sendingIssue} {canApprove
              ? "Approving will not send it now; it will wait in the Outbox."
              : "It will wait in the Outbox."}</span>
          </div>
        )}
        {!canApprove && (
          <p className="text-xs text-[#B0BEC5]">You cannot approve e-mails. Someone with approval rights must approve exactly this text before it is sent.</p>
        )}

        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy}
            data-testid="review-checked" />
          I have checked the recipient and email content.
        </label>

        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={onBack} disabled={busy}>Back to edit</Button>
          <Button size="sm" onClick={confirm} isLoading={busy} disabled={!checked || busy} data-testid="review-confirm">
            {canApprove ? "Approve and send" : "Request approval"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
