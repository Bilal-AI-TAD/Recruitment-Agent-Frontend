"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, Link2, Mail, RefreshCw, Share2, ShieldCheck, Unplug } from "lucide-react";
import { gmailAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { GmailConnection, GmailConnectionsResponse } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/components/pool/PoolBits";

const NONCE_KEY = "gmail_oauth_nonce";

const CALLBACK_ERRORS: Record<string, string> = {
  access_denied: "Google sign-in was cancelled, so nothing was connected.",
  invalid_state: "This Google sign-in link has expired or was already used. Click Connect Gmail again.",
  not_configured: "Gmail is not configured on the server yet.",
  admin_policy_enforced: "Your Google Workspace administrator does not allow this app yet.",
  org_internal: "This app is limited to the company's Google Workspace accounts.",
  invalid_code: "Google returned an invalid sign-in response. Please try again.",
  google_error: "Google could not complete the sign-in. Please try again.",
};

const ERROR_CODES: Record<string, string> = {
  invalid_grant: "Google access expired or was revoked",
  scope_lost: "read access was withdrawn in the Google account",
  mailbox_changed: "the Google account no longer matches this mailbox",
  token_key_changed: "the server's token encryption key changed",
  unauthorized: "Google refused the stored authorisation",
  refresh_unavailable: "Google could not be reached when refreshing access",
};

const STATUS: Record<GmailConnection["status"], { label: string; className: string }> = {
  active: { label: "Connected", className: "bg-[#00C853]/15 text-[#00C853]" },
  needs_reconnect: { label: "Reconnect needed", className: "bg-yellow-500/15 text-yellow-300" },
  disconnected: { label: "Disconnected", className: "bg-[#546E7A]/20 text-[#B0BEC5]" },
};

function newNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Gmail connections (read-only): connect, health, reconnect, disconnect and explicit sharing. */
export function GmailConnectionsCard() {
  const router = useRouter();
  const [data, setData] = useState<GmailConnectionsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [shareable, setShareable] = useState<{ user_id: string; name: string; email: string }[]>([]);
  const [shareSelection, setShareSelection] = useState<Set<string>>(new Set());
  const handledReturn = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await gmailAPI.connections();
      setData(res.data as GmailConnectionsResponse);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load Gmail connections"));
    }
  }, []);

  // Back from Google: finish the connection with this tab's nonce, then clean the URL.
  useEffect(() => {
    if (handledReturn.current) return;
    handledReturn.current = true;
    const params = new URLSearchParams(window.location.search);
    const flow = params.get("gmail_flow");
    const error = params.get("gmail_error");
    if (!flow && !error) {
      load();
      return;
    }
    router.replace("/dashboard/system");
    if (error) {
      toast.error(CALLBACK_ERRORS[error] || CALLBACK_ERRORS.google_error);
      load();
      return;
    }
    const nonce = sessionStorage.getItem(NONCE_KEY);
    sessionStorage.removeItem(NONCE_KEY);
    if (!nonce || !flow) {
      toast.error("This Google sign-in was started in another browser tab. Click Connect Gmail again here.");
      load();
      return;
    }
    setBusy("complete");
    gmailAPI.complete(flow, nonce)
      .then((res) => toast.success(`Connected ${(res.data as GmailConnection).mailbox_email} (read-only)`))
      .catch((err) => toast.error(getErrorMessage(err, "The Gmail connection could not be completed")))
      .finally(() => { setBusy(null); load(); });
  }, [load, router]);

  const connect = async (connectionId?: string) => {
    setBusy(connectionId || "connect");
    try {
      const nonce = newNonce();
      sessionStorage.setItem(NONCE_KEY, nonce);
      const res = await gmailAPI.connect(nonce, connectionId);
      window.location.assign((res.data as { authorization_url: string }).authorization_url);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start Google sign-in"));
      setBusy(null);
    }
  };

  const run = async (key: string, action: () => Promise<{ data: unknown }>, success: (c: GmailConnection) => string) => {
    setBusy(key);
    try {
      const res = await action();
      toast.success(success(res.data as GmailConnection));
    } catch (err) {
      toast.error(getErrorMessage(err, "The action failed"));
    } finally {
      setBusy(null);
      load();
    }
  };

  const openShare = async (connection: GmailConnection) => {
    if (shareFor === connection.connection_id) {
      setShareFor(null);
      return;
    }
    try {
      const res = await gmailAPI.shareableUsers();
      setShareable((res.data as { users: typeof shareable }).users);
      setShareSelection(new Set(connection.shared_with.map((u) => u.user_id)));
      setShareFor(connection.connection_id);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load users"));
    }
  };

  const revokeText = (c: GmailConnection) => ({
    revoked: "Disconnected and Google access revoked.",
    skipped_shared_grant: "Disconnected. Google access was not revoked because another connection uses the same mailbox.",
    already_invalid: "Disconnected. Google access had already been revoked.",
    failed: "Disconnected here, but Google could not be reached to revoke access. Remove the app in the Google account.",
    not_needed: "Disconnected.",
  } as Record<string, string>)[c.revoke_result || "not_needed"] || "Disconnected.";

  const mine = (data?.connections || []).filter((c) => c.is_owner);
  const shared = (data?.connections || []).filter((c) => !c.is_owner);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2"><Mail size={18} className="text-[#00C853]" /> Gmail – CV import</h2>
          <p className="text-sm text-[#B0BEC5] mt-1">
            Read-only access to a mailbox, used to find and import CVs from past applications on a job page.
            The app cannot send, delete, move or mark e-mails.
          </p>
        </div>
        {data?.can_connect && (
          <Button onClick={() => connect()} isLoading={busy === "connect" || busy === "complete"} disabled={!data.configured}
            title={data.configured ? undefined : data.setup_issue || undefined}>
            <Link2 size={16} className="mr-2" /> Connect Gmail
          </Button>
        )}
      </div>

      {data && !data.configured && (
        <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200 flex gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{data.setup_issue} See <span className="font-mono">backend/docs/gmail_integration.md</span>.</span>
        </div>
      )}
      {data && !data.can_connect && !data.can_import && (
        <p className="text-sm text-[#B0BEC5]">
          You do not have Gmail access. An administrator can grant <span className="font-mono">gmail.connect</span> or{" "}
          <span className="font-mono">gmail.import</span> on the server.
        </p>
      )}
      {data && data.can_connect && mine.length === 0 && (
        <p className="text-sm text-[#B0BEC5]">No mailbox connected yet. Connected mailboxes are private to you unless you share them.</p>
      )}
      {!data && <p className="text-sm text-[#B0BEC5]">Loading…</p>}

      {[{ title: "My connections", list: mine }, { title: "Shared with me", list: shared }].map(({ title, list }) => list.length > 0 && (
        <div key={title} className="mt-3">
          <h3 className="text-xs uppercase tracking-wide text-[#546E7A] mb-2">{title}</h3>
          <ul className="space-y-3">
            {list.map((c) => (
              <li key={c.connection_id} className="bg-[#132F4C] rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white font-medium break-all">{c.mailbox_email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
                      {!c.is_owner && c.owner_name && <span className="text-[#B0BEC5]">Shared by {c.owner_name}</span>}
                      {c.status === "active" && c.read_only && (
                        <span className="flex items-center gap-1 text-[#B0BEC5]"><ShieldCheck size={12} /> Read-only – cannot send, delete or change e-mail</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.status !== "disconnected" && (
                      <Button size="sm" variant="ghost" isLoading={busy === `check-${c.connection_id}`}
                        onClick={() => run(`check-${c.connection_id}`, () => gmailAPI.check(c.connection_id),
                          (r) => (r.status === "active" ? `${r.mailbox_email} is working` : `${r.mailbox_email} needs reconnecting`))}>
                        <RefreshCw size={14} className="mr-1" /> Check
                      </Button>
                    )}
                    {c.is_owner && c.status !== "active" && data?.can_connect && (
                      <Button size="sm" variant="secondary" isLoading={busy === c.connection_id} disabled={!data.configured}
                        onClick={() => (c.status === "disconnected" ? connect() : connect(c.connection_id))}>
                        <Link2 size={14} className="mr-1" /> {c.status === "disconnected" ? "Connect again" : "Reconnect"}
                      </Button>
                    )}
                    {c.is_owner && c.status !== "disconnected" && data?.can_connect && (
                      <Button size="sm" variant="ghost" onClick={() => openShare(c)}><Share2 size={14} className="mr-1" /> Share</Button>
                    )}
                    {c.is_owner && c.status !== "disconnected" && (
                      <Button size="sm" variant="danger" isLoading={busy === `disc-${c.connection_id}`}
                        onClick={() => window.confirm(`Disconnect ${c.mailbox_email}? Stored Google tokens are deleted and access is revoked at Google (unless another connection uses the same mailbox). Imported CVs stay in the Candidate Pool.`) &&
                          run(`disc-${c.connection_id}`, () => gmailAPI.disconnect(c.connection_id), revokeText)}>
                        <Unplug size={14} className="mr-1" /> Disconnect
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-[#546E7A] mt-2 space-y-0.5">
                  <div>
                    Connected {formatDate(c.connected_at)}
                    {c.last_checked_at && <> · last checked {new Date(c.last_checked_at).toLocaleString()}</>}
                    {c.last_used_at && <> · last used {formatDate(c.last_used_at)}</>}
                  </div>
                  {c.status === "needs_reconnect" && (
                    <div className="text-yellow-300">
                      {ERROR_CODES[c.last_error_code || ""] || "Google access needs to be renewed"}.{" "}
                      {c.is_owner ? "Reconnect to continue imports." : "Ask the owner to reconnect it."}
                    </div>
                  )}
                  {c.status === "active" && c.last_error_code && (
                    <div className="text-yellow-300">Last check had a problem: {ERROR_CODES[c.last_error_code] || c.last_error_code.replace(/_/g, " ")}</div>
                  )}
                  {c.unexpected_scopes.length > 0 && (
                    <div className="text-yellow-300">Google also granted: {c.unexpected_scopes.join(", ")}. Only read access is used.</div>
                  )}
                  {c.is_owner && c.shared_with.length > 0 && (
                    <div>Shared with {c.shared_with.map((u) => u.name || u.email).join(", ")}</div>
                  )}
                  {c.status === "disconnected" && c.disconnected_at && <div>Disconnected {formatDate(c.disconnected_at)}</div>}
                </div>
                {shareFor === c.connection_id && (
                  <div className="mt-3 border-t border-[#2A3F5E] pt-3">
                    <p className="text-sm text-[#E0E0E0] mb-2">Who else may search and import from this mailbox?</p>
                    {shareable.length === 0 ? (
                      <p className="text-xs text-[#B0BEC5]">No other user has the gmail.import permission yet.</p>
                    ) : (
                      <ul className="space-y-1 mb-2">
                        {shareable.map((u) => (
                          <li key={u.user_id}>
                            <label className="flex items-center gap-2 text-sm text-[#E0E0E0]">
                              <input type="checkbox" checked={shareSelection.has(u.user_id)}
                                onChange={(e) => setShareSelection((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(u.user_id); else next.delete(u.user_id);
                                  return next;
                                })} />
                              {u.name} <span className="text-[#546E7A]">{u.email}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" isLoading={busy === `share-${c.connection_id}`}
                        onClick={() => run(`share-${c.connection_id}`, () => gmailAPI.setShares(c.connection_id, Array.from(shareSelection)),
                          () => "Sharing updated").then(() => setShareFor(null))}>
                        <CheckCircle2 size={14} className="mr-1" /> Save sharing
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShareFor(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
