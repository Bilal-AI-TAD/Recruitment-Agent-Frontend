"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, CornerDownRight, History, LayoutTemplate, Mail, Pencil, PenLine, Send, ShieldCheck, XCircle } from "lucide-react";
import { mailAPI } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { CandidateThread, OutboxMessage } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MessageReviewModal, ReviewContent, approvalOutcome, openPlaceholders } from "./MessageReviewModal";

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

interface TemplateOption { template: string; label: string; description?: string; subject: string; body: string; footer?: string | null }

/** What the review modal is looking at: the unsaved draft, or a saved message awaiting approval. */
type Review = { content: ReviewContent; message?: OutboxMessage };

const EVENT_LABELS: Record<string, string> = {
  composed: "Written", edited: "Edited – needs approval again", recipient_changed: "Recipient changed",
  approved: "Approved", approval_invalid: "Content changed after approval – needs approval again",
  queued: "Waiting to be sent", throttled: "Outlook asked to slow down – retrying",
  draft_created: "Draft created in Outlook", draft_missing: "Draft missing – recreating",
  send_requested: "Sending", submitted: "Sent", send_outcome_unknown: "Outcome uncertain – being checked",
  resend_same_draft: "Retrying the same draft (no duplicate)", confirmed_in_sent_items: "Found in Sent Items",
  confirmed_manually: "Marked as sent by HR", marked_not_sent: "Marked as not sent by HR",
  manual_review: "Needs checking in Outlook", recipient_suppressed: "Stopped: recipient asked not to be contacted",
  access_lost: "Paused: mailbox access lost", cancelled: "Cancelled", bounced: "Bounced", failed: "Failed",
};

const sameAddress = (a?: string | null, b?: string | null) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();

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
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const requestKey = useRef(requestId());
  const chosen = templates.find((t) => t.template === template);
  const missing = openPlaceholders(subject, body);

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
      setTemplate(""); setSubject(""); setBody(""); setFooter(null);   // HR chooses the template first
      setTo(thread?.recipient || "");
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

  const changeTemplate = () => {
    const edited = chosen && (subject !== chosen.subject || body !== chosen.body);
    if (edited && !window.confirm("Change the template? Your edits to this draft will be replaced.")) return;
    setTemplate("");
  };

  const reviewDraft = () => setReview({ content: {
    from: thread?.sending.mailbox || null, to: thread?.outreach ? thread.recipient || "" : to.trim(),
    onRecord: thread?.recipient || null, subject: subject.trim(), body: body.trim(), footer, outreach: !!thread?.outreach } });

  const approveSaved = async (m: OutboxMessage) => {
    try {
      const res = await mailAPI.approve(m.outbox_id, m.content_hash);
      toast.success(approvalOutcome(res.data as OutboxMessage), { duration: 7000 });
      setReview(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not approve the message"));
    } finally {
      load();
    }
  };

  /** Saves the draft exactly as reviewed (idempotent per draft), then approves that exact text if the user may. */
  const submitDraft = async () => {
    let saved: OutboxMessage;
    try {
      const res = await mailAPI.compose(applicationId, { template, subject, body, client_request_id: requestKey.current,
                                                         ...(!thread?.outreach && to.trim() ? { recipient: to.trim() } : {}) });
      saved = res.data as OutboxMessage;
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save the message"));
      return;
    }
    requestKey.current = requestId();
    setComposing(false);
    setReview(null);
    if (!canApprove || !saved.can_approve) {
      toast.success("Approval requested: the message waits in the Outbox until someone with approval rights approves it.");
      load();
      return;
    }
    await approveSaved(saved);
  };

  const reviewSaved = (m: OutboxMessage) => setReview({ message: m, content: {
    from: m.from || thread?.sending.mailbox || null, to: m.recipients.join(", "), onRecord: thread?.recipient || null,
    subject: m.subject, body: m.body || "", footer: m.footer, outreach: m.kind === "headhunting_outreach" } });

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
              <Button size="sm" onClick={startCompose} disabled={!thread.recipient && thread.outreach}><PenLine size={14} className="mr-1" />
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

        {composing && !template && (
          <div className="bg-[#132F4C] rounded-lg p-3 space-y-2" data-testid="template-chooser">
            <p className="text-sm text-white font-medium">Choose a template</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => (
                <button key={t.template} onClick={() => pickTemplate(t.template)} data-testid="template-option"
                  className="text-left rounded-lg border border-[#2A3F5E] p-3 hover:border-[#00C853] focus:outline-none focus:border-[#00C853]">
                  <span className="block text-sm text-white font-medium">{t.label}</span>
                  {t.description && <span className="block text-xs text-[#B0BEC5] mt-0.5">{t.description}</span>}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {composing && template && (
          <div className="bg-[#132F4C] rounded-lg p-3 space-y-2" data-testid="compose">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-white font-medium" data-testid="compose-template">{chosen?.label}</p>
              <Button size="sm" variant="ghost" onClick={changeTemplate}><LayoutTemplate size={14} className="mr-1" /> Change template</Button>
            </div>
            <RecipientField outreach={!!thread.outreach} value={to} onChange={setTo} onRecord={thread.recipient} />
            <input className={inputClass} aria-label="Subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
            <textarea className={cn(inputClass, "min-h-56")} aria-label="Message" value={body} maxLength={10000}
              onChange={(e) => setBody(e.target.value)} />
            {footer && (
              <div className="text-xs text-[#B0BEC5] whitespace-pre-wrap border-t border-[#2A3F5E] pt-2" data-testid="outreach-footer">
                <span className="text-[#546E7A]">Added automatically (cannot be edited):</span>{"\n"}{footer}
              </div>
            )}
            {missing.length > 0 && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-200" data-testid="placeholders">
                <p className="font-medium">Still to complete – replace each of these (including the brackets) before review:</p>
                <ul className="list-disc pl-5 mt-1">{missing.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            )}
            <p className="text-xs text-[#546E7A]">Plain text. Nothing is sent until you review it and exactly this text is approved.</p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>Cancel</Button>
              <Button size="sm" onClick={reviewDraft} data-testid="review-draft"
                disabled={missing.length > 0 || !subject.trim() || !body.trim() || (!thread.outreach && !to.trim())}>
                Review
              </Button>
            </div>
          </div>
        )}

        {thread.messages.length === 0 && !composing && <p className="text-sm text-[#B0BEC5]">No e-mails to this candidate yet.</p>}
        <ul className="space-y-3">
          {thread.messages.slice().reverse().map((m) => (
            <MessageItem key={m.outbox_id} message={m} busy={busy} canApprove={canApprove} canWrite={canWrite}
              replies={replies(m.outbox_id)} act={act} mailbox={thread.sending.mailbox} onRecord={thread.recipient}
              onReview={reviewSaved} />
          ))}
        </ul>
        {review && (
          <MessageReviewModal content={review.content} sendingIssue={thread.sending.issue}
            canApprove={review.message ? true : canApprove} onBack={() => setReview(null)}
            onConfirm={() => review.message ? approveSaved(review.message) : submitDraft()} />
        )}
      </CardContent>
    </Card>
  );
}

function RecipientField({ outreach, value, onChange, onRecord }: {
  outreach: boolean; value: string; onChange: (v: string) => void; onRecord: string | null;
}) {
  if (outreach) return <p className="text-xs text-[#B0BEC5]">To: <span className="text-white">{onRecord}</span> (outreach always goes to the address on record)</p>;
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-[#B0BEC5]">To
        <input className={cn(inputClass, "flex-1")} aria-label="To" type="email" value={value} maxLength={320}
          onChange={(e) => onChange(e.target.value)} />
      </label>
      {value.trim() && !sameAddress(value, onRecord) && (
        <p className="mt-1 text-xs text-yellow-200 flex items-center gap-1" data-testid="recipient-differs">
          <AlertTriangle size={12} /> Not the candidate&apos;s address on record{onRecord ? ` (${onRecord})` : ""}. The approver will see this address.
        </p>
      )}
    </div>
  );
}

function MessageItem({ message: m, busy, canApprove, canWrite, replies, act, mailbox, onRecord, onReview }: {
  message: OutboxMessage; busy: string | null; canApprove: boolean; canWrite: boolean; replies: CandidateThread["replies"];
  act: (key: string, fn: () => Promise<unknown>, done: string) => void; mailbox: string | null | undefined;
  onRecord: string | null; onReview: (m: OutboxMessage) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [to, setTo] = useState(m.recipients[0] || "");
  const [subject, setSubject] = useState(m.subject);
  const [body, setBody] = useState(m.body || "");
  const outreach = m.kind === "headhunting_outreach";
  const startEdit = () => { setTo(m.recipients[0] || ""); setSubject(m.subject); setBody(m.body || ""); setEditing(true); };
  const saveEdit = () => act(`edit-${m.outbox_id}`, async () => {
    await mailAPI.edit(m.outbox_id, subject, body, outreach ? undefined : to.trim());
    setEditing(false);
  }, m.status === "approved" ? "Edited – the approval was removed; it needs approval again" : "Edited – waiting for approval");
  const review = m.status === "awaiting_approval";
  const missing = m.open_placeholders || [];
  const otherAddress = !sameAddress(m.recipients[0], onRecord);
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
      {editing ? (
        <div className="mt-2 space-y-2" data-testid="edit-message">
          <RecipientField outreach={outreach} value={to} onChange={setTo} onRecord={onRecord} />
          <input className={inputClass} aria-label="Edit subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
          <textarea className={cn(inputClass, "min-h-32")} aria-label="Edit message" value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} />
          {m.status === "approved" && <p className="text-xs text-yellow-200">Saving removes the approval: the message must be approved again.</p>}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel edit</Button>
            <Button size="sm" onClick={saveEdit} isLoading={busy === `edit-${m.outbox_id}`}
              disabled={!subject.trim() || !body.trim() || (!outreach && !to.trim())}>Save changes</Button>
          </div>
        </div>
      ) : review ? (
        <div className="mt-2 rounded-lg border border-blue-500/40 bg-[#0f2236] p-3 text-sm space-y-1" data-testid="exact-message">
          <p className="text-xs text-blue-300">This exact message will be sent after approval:</p>
          <p className="text-xs text-[#B0BEC5]">To: <span className="text-white">{m.recipients.join(", ")}</span>
            {otherAddress && !outreach && <span className="text-yellow-200"> – not the candidate&apos;s address on record</span>}</p>
          {mailbox && <p className="text-xs text-[#B0BEC5]">From: <span className="text-white">{mailbox}</span></p>}
          <p className="text-xs text-[#B0BEC5]">Subject: <span className="text-white">{m.subject}</span></p>
          {m.body && <p className="text-[#E0E0E0] whitespace-pre-wrap break-words pt-1">{m.body}</p>}
          {m.footer && <p className="text-xs text-[#B0BEC5] whitespace-pre-wrap break-words">{m.footer}</p>}
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs text-[#546E7A]">To {m.recipients.join(", ")}</p>
          {m.body && <p className="mt-2 text-sm text-[#E0E0E0] whitespace-pre-wrap break-words">{m.body}</p>}
          {m.footer && <p className="mt-1 text-xs text-[#B0BEC5] whitespace-pre-wrap break-words">{m.footer}</p>}
        </>
      )}
      {m.status_detail && <p className="mt-2 text-xs text-[#B0BEC5]">{m.status_detail}</p>}
      {review && !editing && missing.length > 0 && (
        <p className="mt-2 text-xs text-yellow-200" data-testid="message-placeholders">
          Still to complete before approval: {missing.join(", ")}</p>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {m.can_approve && canApprove && !editing && (
          <Button size="sm" onClick={() => onReview(m)} disabled={missing.length > 0} data-testid="review-and-approve"
            title={missing.length > 0 ? "Edit the message and complete the placeholders first" : undefined}>
            <ShieldCheck size={14} className="mr-1" /> Review and approve
          </Button>
        )}
        {m.can_edit && canWrite && !editing && (
          <Button size="sm" variant="secondary" onClick={startEdit}><Pencil size={14} className="mr-1" /> Edit</Button>
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
      {(m.events || []).length > 0 && (
        <details className="mt-2" data-testid="message-history">
          <summary className="text-xs text-[#546E7A] cursor-pointer flex items-center gap-1"><History size={12} /> History</summary>
          <ul className="mt-1 space-y-0.5">
            {(m.events || []).map((e, i) => (
              <li key={i} className="text-xs text-[#B0BEC5]">
                {e.at ? new Date(e.at).toLocaleString() : ""} · {EVENT_LABELS[e.event] || e.event}{e.actor ? ` · ${e.actor}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      {["submitted", "confirmed"].includes(m.status) && (
        <p className="mt-2 text-xs text-[#546E7A] flex items-center gap-1"><Send size={12} /> Delivery to the recipient&apos;s server is not confirmed by Outlook; a bounce would appear here.</p>
      )}
    </li>
  );
}
