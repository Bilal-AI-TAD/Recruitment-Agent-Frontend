"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { AlertTriangle, CheckCircle2, Send, ShieldCheck, XCircle } from "lucide-react";
import { mailAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { MailSendingStatus, OutboxMessage } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OUTBOX_TONE } from "@/components/mailbox/MessagesPanel";

const FILTERS: { key: string; label: string }[] = [
  { key: "attention", label: "Needs attention" },
  { key: "", label: "All" },
  { key: "confirmed", label: "Sent" },
  { key: "bounced", label: "Bounced" },
  { key: "cancelled", label: "Cancelled" },
];

/** Outbox: every e-mail the app may send, its approval and its honest delivery status. */
export default function OutboxPage() {
  const [filter, setFilter] = useState("attention");
  const [messages, setMessages] = useState<OutboxMessage[] | null>(null);
  const [sending, setSending] = useState<MailSendingStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await mailAPI.outbox(filter || undefined);
      setMessages(res.data.messages as OutboxMessage[]);
      setSending(res.data.sending as MailSendingStatus);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load the outbox"));
      setMessages([]);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
    } catch (err) {
      toast.error(getErrorMessage(err, "The action failed"));
    } finally {
      setBusy(null);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Send className="text-[#00C853]" /> Outbox</h1>
        <p className="text-[#B0BEC5] text-sm mt-1">
          E-mails from the company mailbox. Candidate e-mails are sent only after an approval of exactly their text.
          &ldquo;Accepted&rdquo; and &ldquo;Sent&rdquo; mean Outlook took the message; delivery to the recipient is not confirmed (bounces show here).
        </p>
      </motion.div>

      {sending?.issue && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200 flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {sending.issue}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key || "all"} onClick={() => setFilter(f.key)}
            className={cn("px-3 py-1 rounded-full text-sm border", filter === f.key
              ? "border-[#00C853] text-[#00C853]" : "border-[#2A3F5E] text-[#B0BEC5] hover:text-white")}>{f.label}</button>
        ))}
      </div>

      <Card>
        {messages === null ? <p className="text-sm text-[#B0BEC5]">Loading…</p> : messages.length === 0 ? (
          <p className="text-sm text-[#B0BEC5]">Nothing here.</p>
        ) : (
          <ul className="divide-y divide-[#2A3F5E]">
            {messages.map((m) => (
              <li key={m.outbox_id} className="py-3 first:pt-0 last:pb-0" data-testid="outbox-row">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white font-medium break-words">
                      {m.kind === "account_invitation" ? "Account invitation" : m.subject}
                      {m.kind === "headhunting_outreach" && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-purple-500/15 text-purple-300">Outreach – has not applied</span>}
                      {m.kind === "live_check" && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-300">Live check</span>}
                    </p>
                    <p className="text-xs text-[#546E7A] mt-0.5 break-all">
                      To {m.recipients.join(", ")} · written by {m.created_by || "–"}
                      {m.approved_by && <> · approved by {m.approved_by}{m.self_approved ? " (the author)" : ""}</>}
                      {m.created_at && <> · {new Date(m.created_at).toLocaleString()}</>}
                      {m.candidate_id && <> · <Link href={`/dashboard/candidates/${m.candidate_id}`} className="underline">application</Link></>}
                    </p>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs", OUTBOX_TONE[m.status])}>{m.status_label}</span>
                </div>
                {m.body && <p className="mt-2 text-sm text-[#E0E0E0] whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{m.body}</p>}
                {m.footer && <p className="mt-1 text-xs text-[#B0BEC5] whitespace-pre-wrap break-words">{m.footer}</p>}
                {m.status_detail && <p className="mt-1 text-xs text-[#B0BEC5]">{m.status_detail}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {m.can_approve && (
                    <Button size="sm" isLoading={busy === `a-${m.outbox_id}`}
                      onClick={() => act(`a-${m.outbox_id}`, () => mailAPI.approve(m.outbox_id, m.content_hash), "Approved")}>
                      <ShieldCheck size={14} className="mr-1" /> Approve this exact message
                    </Button>
                  )}
                  {m.can_edit && m.candidate_id && (
                    <Link href={`/dashboard/candidates/${m.candidate_id}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm border border-[#2A3F5E] text-[#E0E0E0] hover:text-white">
                      Edit on the candidate page
                    </Link>
                  )}
                  {m.can_cancel && (
                    <Button size="sm" variant="ghost" isLoading={busy === `c-${m.outbox_id}`}
                      onClick={() => window.confirm("Cancel this message? It will not be sent.") &&
                        act(`c-${m.outbox_id}`, () => mailAPI.cancel(m.outbox_id), "Cancelled")}>
                      <XCircle size={14} className="mr-1" /> Cancel
                    </Button>
                  )}
                  {m.can_resolve && (
                    <>
                      <Button size="sm" variant="secondary"
                        onClick={() => act(`r-${m.outbox_id}`, () => mailAPI.resolve(m.outbox_id, "sent"), "Marked as sent")}>
                        <CheckCircle2 size={14} className="mr-1" /> It is in Sent Items
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => act(`r-${m.outbox_id}`, () => mailAPI.resolve(m.outbox_id, "not_sent"), "Marked as not sent")}>
                        It was not sent
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
