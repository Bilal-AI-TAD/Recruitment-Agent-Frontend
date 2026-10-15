"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, CornerDownRight, Mail, PenLine, Send, ShieldCheck, XCircle } from "lucide-react";
import { mailAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { CandidateThread, OutboxMessage } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const inputClass = "w-full bg-[#132F4C] border border-[#2A3F5E] rounded-lg px-3 py-2 text-white text-sm placeholder-[#546E7A] focus:outline-none focus:border-[#00C853]";

export const OUTBOX_TONE: Record<string, string> = {
  awaiting_approval: "bg-blue-500/15 text-blue-300",
  approved: "bg-blue-500/15 text-blue-300",
  draft_created: "bg-blue-500/15 text-blue-300",
  send_requested: "bg-blue-500/15 text-blue-300",
  submitted: "bg-[#00C853]/10 text-[#B9F6CA]",
  confirmed: "bg-[#00C853]/15 text-[#00C853]",
  uncertain: "bg-yellow-500/15 text-yellow-300",
  manual_review: "bg-yellow-500/15 text-yellow-300",
  bounced: "bg-[#FF5252]/15 text-[#FF8A80]",
  failed: "bg-[#FF5252]/15 text-[#FF8A80]",
  cancelled: "bg-[#546E7A]/20 text-[#B0BEC5]",
};

function requestId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface TemplateOption { template: string; label: string; subject: string; body: string; footer?: string | null }

/** E-mails to one candidate: compose -> approval (separate, recorded) -> send, with honest status and replies. */
export function MessagesPanel({ applicationId, permissions }: { applicationId: string; permissions: string[] }) {
  const canWrite = permissions.includes("mail.send") || permissions.includes("headhunting.outreach");
  const canMarkOptOut = ["mail.send", "mail.approve_send", "headhunting.outreach"].some((p) => permissions.includes(p));
  const canApprove = permissions.includes("mail.approve_send");
  const [thread, setThread] = useState<CandidateThread | null>(null);
  const [composing, setComposing] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [template, setTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const requestKey = useRef(requestId());

  const load = useCallback(async () => {
    try {
      const res = await mailAPI.thread(applicationId);
      setThread(res.data as CandidateThread);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load messages"));
    }
  }, [applicationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {              // follow messages that are on their way
    if (!thread?.messages.some((m) => ["approved", "draft_created", "send_requested", "submitted", "uncertain"].includes(m.status))) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [thread, load]);

  const startCompose = async () => {
    try {
      const res = await mailAPI.templates(applicationId);
      const data = res.data as { templates: TemplateOption[] };
      setTemplates(data.templates);
      const first = data.templates[0];
      setTemplate(first.template); setSubject(first.subject); setBody(first.body); setFooter(first.footer || null);
      setComposing(true);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not prepare the message"));
    }
  };

  const pickTemplate = (key: string) => {
    const t = templates.find((x) => x.template === key);
    if (!t) return;
    setTemplate(key); setSubject(t.subject); setBody(t.body); setFooter(t.footer || null);
  };

  const submit = async () => {
    setBusy("compose");
    try {
      await mailAPI.compose(applicationId, { template, subject, body, client_request_id: requestKey.current });
      requestKey.current = requestId();
      setComposing(false);
      toast.success("Saved. It is sent only after someone with approval rights approves it.");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save the message"));
    } finally {
      setBusy(null);
    }
  };

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

  if (!thread) return null;
  const replies = (id: string) => thread.replies.filter((r) => r.outbox_id === id);
  return (
    <Card className="lg:col-span-3" data-testid="messages-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail size={18} className="text-[#00C853]" />
          {thread.outreach ? "Outreach (headhunted – has not applied)" : "Messages"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-[#B0BEC5]">
            To: {thread.recipient ? <span className="text-white">{thread.recipient}</span> : <span className="text-yellow-200">no e-mail address on record yet</span>}
            {thread.sending.mailbox && <> · from {thread.sending.mailbox}</>}
          </p>
          <div className="flex gap-2">
            {thread.suppressed
              ? <span className="px-2 py-0.5 rounded-full text-xs bg-[#FF5252]/15 text-[#FF8A80]" data-testid="suppressed">Do not contact</span>
              : canMarkOptOut && thread.recipient && (
                <Button size="sm" variant="ghost" isLoading={busy === "optout"}
                  onClick={() => window.confirm("Mark this address as \"do not contact\"? No further e-mail can be written or sent to it. Only the owner can undo this.") &&
                    act("optout", () => mailAPI.optOut(applicationId), "Marked as do not contact")}>
                  Do not contact
                </Button>
              )}
            {canWrite && !composing && thread.can_compose && (
              <Button size="sm" onClick={startCompose} disabled={!thread.recipient}><PenLine size={14} className="mr-1" />
                {thread.outreach ? "Write outreach e-mail" : "Write e-mail"}</Button>
            )}
          </div>
        </div>
        {thread.compose_blocked_reason && (
          <p className="text-xs text-[#B0BEC5]" data-testid="compose-blocked">{thread.compose_blocked_reason}</p>
        )}
        {thread.sending.issue && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-200 flex gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {thread.sending.issue}
          </div>
        )}

        {composing && (
          <div className="bg-[#132F4C] rounded-lg p-3 space-y-2" data-testid="compose">
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button key={t.template} onClick={() => pickTemplate(t.template)}
                  className={cn("px-2 py-1 rounded-full text-xs border", t.template === template
                    ? "border-[#00C853] text-[#00C853]" : "border-[#2A3F5E] text-[#B0BEC5] hover:text-white")}>{t.label}</button>
              ))}
            </div>
            <input className={inputClass} aria-label="Subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
            <textarea className={cn(inputClass, "min-h-40")} aria-label="Message" value={body} maxLength={10000}
              onChange={(e) => setBody(e.target.value)} />
            {footer && (
              <div className="text-xs text-[#B0BEC5] whitespace-pre-wrap border-t border-[#2A3F5E] pt-2" data-testid="outreach-footer">
                <span className="text-[#546E7A]">Added automatically (cannot be edited):</span>{"\n"}{footer}
              </div>
            )}
            <p className="text-xs text-[#546E7A]">Plain text. Nothing is sent now: the message waits for an approval of exactly this text.</p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>Cancel</Button>
              <Button size="sm" onClick={submit} isLoading={busy === "compose"} disabled={!subject.trim() || !body.trim()}>
                Save and request approval
              </Button>
            </div>
          </div>
        )}

        {thread.messages.length === 0 && !composing && <p className="text-sm text-[#B0BEC5]">No e-mails to this candidate yet.</p>}
        <ul className="space-y-3">
          {thread.messages.slice().reverse().map((m) => (
            <MessageItem key={m.outbox_id} message={m} busy={busy} canApprove={canApprove}
              replies={replies(m.outbox_id)} act={act} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MessageItem({ message: m, busy, canApprove, replies, act }: {
  message: OutboxMessage; busy: string | null; canApprove: boolean; replies: CandidateThread["replies"];
  act: (key: string, fn: () => Promise<unknown>, done: string) => void;
}) {
  return (
    <li className="bg-[#132F4C] rounded-lg p-3" data-testid="outbox-message">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium break-words">{m.subject}</p>
          <p className="text-xs text-[#546E7A] mt-0.5">
            Written by {m.created_by || "–"}{m.approved_by && <> · approved by {m.approved_by}{m.self_approved ? " (the author)" : ""}</>}
            {m.created_at && <> · {new Date(m.created_at).toLocaleString()}</>}
          </p>
        </div>
        <span className={cn("px-2 py-0.5 rounded-full text-xs", OUTBOX_TONE[m.status])} data-testid="outbox-status">{m.status_label}</span>
      </div>
      {m.body && <p className="mt-2 text-sm text-[#E0E0E0] whitespace-pre-wrap break-words">{m.body}</p>}
      {m.footer && <p className="mt-1 text-xs text-[#B0BEC5] whitespace-pre-wrap break-words">{m.footer}</p>}
      {m.status_detail && <p className="mt-2 text-xs text-[#B0BEC5]">{m.status_detail}</p>}
      <div className="flex flex-wrap gap-2 mt-2">
        {m.can_approve && canApprove && (
          <Button size="sm" isLoading={busy === `approve-${m.outbox_id}`}
            onClick={() => act(`approve-${m.outbox_id}`, () => mailAPI.approve(m.outbox_id, m.content_hash), "Approved – it will be sent from the mailbox")}>
            <ShieldCheck size={14} className="mr-1" /> Approve and send
          </Button>
        )}
        {m.can_cancel && (
          <Button size="sm" variant="ghost" isLoading={busy === `cancel-${m.outbox_id}`}
            onClick={() => window.confirm("Cancel this message? It will not be sent.") &&
              act(`cancel-${m.outbox_id}`, () => mailAPI.cancel(m.outbox_id), "Cancelled")}>
            <XCircle size={14} className="mr-1" /> Cancel
          </Button>
        )}
        {m.can_resolve && (
          <>
            <Button size="sm" variant="secondary" onClick={() => act(`res-${m.outbox_id}`, () => mailAPI.resolve(m.outbox_id, "sent"), "Marked as sent")}>
              <CheckCircle2 size={14} className="mr-1" /> It is in Sent Items
            </Button>
            <Button size="sm" variant="ghost" onClick={() => act(`res-${m.outbox_id}`, () => mailAPI.resolve(m.outbox_id, "not_sent"), "Marked as not sent")}>
              It was not sent
            </Button>
          </>
        )}
      </div>
      {replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-[#2A3F5E] pl-3" data-testid="replies">
          {replies.map((r) => (
            <li key={r.inbound_id} className="text-sm">
              <p className={cn("text-xs flex items-center gap-1", r.is_bounce ? "text-[#FF8A80]" : "text-[#B0BEC5]")}>
                <CornerDownRight size={12} /> {r.is_bounce ? "Non-delivery report" : "Reply"} from {r.sender_name || r.sender_email}
                {r.opt_out && <span className="ml-1 px-1.5 rounded bg-[#FF5252]/15 text-[#FF8A80]">opt-out – no further e-mails</span>}
                {r.received_at && <> · {new Date(r.received_at).toLocaleString()}</>}
                {r.has_attachments && " · has attachments"}
              </p>
              {r.text_excerpt && <p className="text-[#E0E0E0] whitespace-pre-wrap break-words mt-0.5">{r.text_excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
      {["submitted", "confirmed"].includes(m.status) && (
        <p className="mt-2 text-xs text-[#546E7A] flex items-center gap-1"><Send size={12} /> Delivery to the recipient&apos;s server is not confirmed by Outlook; a bounce would appear here.</p>
      )}
    </li>
  );
}
