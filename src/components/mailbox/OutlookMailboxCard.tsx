"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AlertTriangle, Inbox, Link2, MailCheck, RefreshCw, Send, Unplug } from "lucide-react";
import { mailImportAPI, outlookAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { MailConnection, MailConnectionsResponse, OutlookStatus } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/components/pool/PoolBits";
import { useAuth } from "@/context/AuthContext";

const NONCE_KEY = "outlook_oauth_nonce";

const CALLBACK_ERRORS: Record<string, string> = {
  access_denied: "Microsoft sign-in was cancelled, so nothing was connected.",
  invalid_state: "This Microsoft sign-in has expired or was already used. Click Connect Outlook again.",
  not_configured: "Outlook is not configured on the server yet.",
  microsoft_error: "Microsoft could not complete the sign-in. Please try again.",
};

const ERROR_CODES: Record<string, string> = {
  invalid_grant: "Microsoft access expired or was revoked",
  interaction_required: "Microsoft needs the user to sign in again",
  consent_required: "the app's consent was withdrawn",
  access_denied: "the app may no longer open the mailbox",
  token_key_changed: "the server's token encryption key changed",
  account_missing: "the stored Microsoft sign-in is incomplete",
  mode_changed: "the server's Outlook mode changed",
  outlook_scope_too_broad: "the app can read more mailboxes than allowed",
  outlook_no_mailbox_access: "the app cannot open the mailbox",
  refresh_unavailable: "Microsoft could not be reached when refreshing access",
};

const STATUS: Record<MailConnection["status"], { label: string; className: string }> = {
  active: { label: "Connected", className: "bg-[#00C853]/15 text-[#00C853]" },
  needs_reconnect: { label: "Reconnect needed", className: "bg-yellow-500/15 text-yellow-300" },
  disconnected: { label: "Disconnected", className: "bg-[#546E7A]/20 text-[#B0BEC5]" },
};

function newNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The company Outlook mailbox: CV import, candidate e-mails (with approval), reply tracking, account e-mails. */
export function OutlookMailboxCard() {
  const router = useRouter();
  const { user } = useAuth();
  const canSyncReplies = ["mail.send", "mail.approve_send", "mail.connect"].some((p) => (user?.permissions || []).includes(p));
  const [status, setStatus] = useState<OutlookStatus | null>(null);
  const [connections, setConnections] = useState<MailConnection[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const handledReturn = useRef(false);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([outlookAPI.status(), mailImportAPI.connections()]);
      setStatus(s.data as OutlookStatus);
      setConnections((c.data as MailConnectionsResponse).connections.filter((x) => x.provider === "outlook"));
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load the Outlook mailbox"));
    }
  }, []);

  // Back from Microsoft: finish the connection with this tab's nonce, then clean the URL.
  useEffect(() => {
    if (handledReturn.current) return;
    handledReturn.current = true;
    const params = new URLSearchParams(window.location.search);
    const flow = params.get("outlook_flow");
    const error = params.get("outlook_error");
    if (!flow && !error) {
      load();
      return;
    }
    router.replace("/dashboard/system");
    if (error) {
      toast.error(CALLBACK_ERRORS[error] || CALLBACK_ERRORS.microsoft_error);
      load();
      return;
    }
    const nonce = sessionStorage.getItem(NONCE_KEY);
    sessionStorage.removeItem(NONCE_KEY);
    if (!nonce || !flow) {
      toast.error("This Microsoft sign-in was started in another browser tab. Click Connect Outlook again here.");
      load();
      return;
    }
    setBusy("complete");
    outlookAPI.complete(flow, nonce)
      .then((res) => toast.success(`Connected ${(res.data as MailConnection).mailbox_email}`))
      .catch((err) => toast.error(getErrorMessage(err, "The Outlook connection could not be completed")))
      .finally(() => { setBusy(null); load(); });
  }, [load, router]);

  const connect = async () => {
    if (!status) return;
    setBusy("connect");
    try {
      if (status.auth_mode === "app_only") {
        const res = await outlookAPI.connectApp();
        toast.success(`Connected ${(res.data as MailConnection).mailbox_email} (app access, limited to this mailbox)`);
        setBusy(null);
        load();
        return;
      }
      const nonce = newNonce();
      sessionStorage.setItem(NONCE_KEY, nonce);
      const res = await outlookAPI.connect(nonce);
      window.location.assign((res.data as { authorization_url: string }).authorization_url);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not connect Outlook"));
      setBusy(null);
    }
  };

  const run = async (key: string, action: () => Promise<{ data: unknown }>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(getErrorMessage(err, "The action failed"));
    } finally {
      setBusy(null);
      load();
    }
  };

  const outbox = status?.outbox || {};
  const waiting = (outbox.awaiting_approval || 0) + (outbox.manual_review || 0);
  return (
    <Card data-testid="outlook-card">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2"><Inbox size={18} className="text-[#00C853]" /> Outlook mailbox</h2>
          <p className="text-sm text-[#B0BEC5] mt-1">
            The company recruitment mailbox{status?.mailbox ? <> (<span className="text-white">{status.mailbox}</span>)</> : ""}:
            CV import, candidate e-mails after approval, reply tracking and account invitations.
            It is shared by the whole organization: nobody needs to connect their own Outlook.
          </p>
        </div>
        {status?.can_connect && !connections.some((c) => c.status === "active") && (
          <Button onClick={connect} isLoading={busy === "connect" || busy === "complete"} disabled={!status.configured}
            title={status.configured ? undefined : status.setup_issue || undefined}>
            <Link2 size={16} className="mr-2" /> {status.auth_mode === "app_only" ? "Connect (app access)" : "Connect Outlook"}
          </Button>
        )}
      </div>

      {!status && <p className="text-sm text-[#B0BEC5]">Loading…</p>}
      {status && !status.configured && (
        <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200 flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{status.setup_issue} See <span className="font-mono">backend/docs/outlook.md</span>.</span>
        </div>
      )}
      {status?.configured && (
        <p className="text-xs text-[#546E7A] mb-3">
          Mode: {status.auth_mode === "app_only" ? "app access (no user sign-in; limited to this mailbox by Exchange)" : "signed-in user"} ·
          mailbox type: {status.mailbox_type}
        </p>
      )}

      <ul className="space-y-3">
        {connections.map((c) => (
          <li key={c.connection_id} className="bg-[#132F4C] rounded-lg p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white font-medium break-all">{c.mailbox_email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                  <span className={`px-2 py-0.5 rounded-full ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
                  <span className="text-[#B0BEC5]" data-testid="mailbox-connected-by">
                    {c.auth_mode === "app_only" ? "App access" : "Organization mailbox"}
                    {c.connected_by && <> · connected by {c.connected_by}</>}
                    {c.status === "disconnected" && c.disconnected_by && <> · disconnected by {c.disconnected_by}</>}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.status !== "disconnected" && (c.can_use || c.can_manage) && (
                  <Button size="sm" variant="ghost" isLoading={busy === `check-${c.connection_id}`}
                    onClick={() => run(`check-${c.connection_id}`, () => mailImportAPI.check(c.connection_id), "Checked")}>
                    <RefreshCw size={14} className="mr-1" /> Check
                  </Button>
                )}
                {c.can_manage && c.status !== "active" && status?.can_connect && (
                  <Button size="sm" variant="secondary" isLoading={busy === "connect"} disabled={!status.configured} onClick={connect}>
                    <Link2 size={14} className="mr-1" /> {c.status === "disconnected" ? "Connect again" : "Reconnect"}
                  </Button>
                )}
                {c.can_manage && c.status !== "disconnected" && (
                  <Button size="sm" variant="danger" isLoading={busy === `disc-${c.connection_id}`}
                    onClick={() => window.confirm(`Disconnect ${c.mailbox_email} for the whole organization? The stored Microsoft tokens are deleted and nobody can import or send until it is connected again. Messages waiting to be sent stay in the outbox until a mailbox is connected again. To remove the app's consent entirely, an administrator does that in Microsoft Entra ID.`) &&
                      run(`disc-${c.connection_id}`, () => mailImportAPI.disconnect(c.connection_id), "Disconnected; tokens deleted")}>
                    <Unplug size={14} className="mr-1" /> Disconnect
                  </Button>
                )}
              </div>
            </div>
            <div className="text-xs text-[#546E7A] mt-2 space-y-0.5">
              <div>
                Connected {formatDate(c.connected_at)}
                {c.last_checked_at && <> · last checked {new Date(c.last_checked_at).toLocaleString()}</>}
              </div>
              {c.status === "needs_reconnect" && (
                <div className="text-yellow-300">{ERROR_CODES[c.last_error_code || ""] || "Microsoft access needs to be renewed"}.
                  {c.can_manage ? " Reconnect to continue." : " Ask someone with the mail.connect permission to reconnect it."}</div>
              )}
              {c.status === "active" && c.last_error_code && (
                <div className="text-yellow-300">Last check had a problem: {ERROR_CODES[c.last_error_code] || c.last_error_code.replace(/_/g, " ")}</div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {status?.configured && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="bg-[#132F4C] rounded-lg p-3" data-testid="outlook-sending">
            <p className="text-white font-medium flex items-center gap-2"><Send size={14} /> Sending</p>
            {status.sending.issue
              ? <p className="text-yellow-200 text-xs mt-1">{status.sending.issue}</p>
              : <p className="text-[#00C853] text-xs mt-1">On{status.sending.test_allowlist ? " – test recipients only (allowlist)" : ""}. Every candidate e-mail still needs an approval.</p>}
            {(outbox.awaiting_approval || outbox.manual_review) ? (
              <p className="text-xs text-[#B0BEC5] mt-1">
                {waiting} message(s) need attention · <Link href="/dashboard/outbox" className="underline">Open the outbox</Link>
              </p>
            ) : null}
          </div>
          <div className="bg-[#132F4C] rounded-lg p-3">
            <p className="text-white font-medium flex items-center gap-2"><MailCheck size={14} /> Reply tracking</p>
            <p className="text-xs text-[#B0BEC5] mt-1">
              {status.reply_tracking?.last_synced_at
                ? <>Last checked {new Date(status.reply_tracking.last_synced_at).toLocaleString()}</>
                : status.active_connection_id ? "Not run yet" : "Starts when the mailbox is connected"}
              {status.reply_tracking?.last_error && <span className="text-yellow-200"> · last problem: {status.reply_tracking.last_error}</span>}
            </p>
            {status.active_connection_id && canSyncReplies && (
              <Button size="sm" variant="ghost" className="mt-1" isLoading={busy === "sync"}
                onClick={() => run("sync", () => outlookAPI.syncReplies(), "Replies checked")}>
                <RefreshCw size={14} className="mr-1" /> Check for replies now
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
