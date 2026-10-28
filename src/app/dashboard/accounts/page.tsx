"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Copy, KeyRound, Mail, ShieldAlert, UserCheck, UserX, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { accountsAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

interface PermissionInfo { permission: string; label: string; sensitive: boolean; grantable: boolean;
                          for_all_members?: boolean }
interface AccessRequest { request_id: string; email: string; first_name: string; last_name: string; note: string | null;
  status: string; created_at: string | null }
interface Member { user_id: string; name: string; email: string; status: string; permissions: string[]; is_owner: boolean }
interface Invitation { invitation_id: string; email: string; state: string; permissions: string[]; expires_at: string;
  delivery: string; failed_attempts: number; invited_by: string | null }
interface AuditEvent { action: string; actor: string; target_email: string | null; details: Record<string, unknown>; at: string | null }
interface LinkResult { link: string | null; link_note?: string; delivery: string; invitation: Invitation }

/** Permission checkboxes. Sensitive rights (spending, deletion, ownership) are flagged and never pre-selected. */
function PermissionPicker({ catalog, value, onChange }: { catalog: PermissionInfo[]; value: string[];
                                                         onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5" data-testid="permission-picker">
      {catalog.filter((p) => p.grantable).map((p) => (
        <label key={p.permission} className="flex items-start gap-2 text-xs text-[#B0BEC5]">
          <input type="checkbox" className="mt-0.5" aria-label={p.permission} disabled={p.for_all_members}
            checked={p.for_all_members || value.includes(p.permission)}
            onChange={(e) => onChange(e.target.checked ? [...value, p.permission] : value.filter((x) => x !== p.permission))} />
          <span><span className="text-white font-mono">{p.permission}</span>{p.for_all_members
            ? <span className="ml-1 text-[#00C853]">(included for every member - server setting AI_FOR_ALL_MEMBERS)</span>
            : p.sensitive && <span className="ml-1 text-yellow-300">(sensitive)</span>} – {p.label}</span>
        </label>
      ))}
    </div>
  );
}

function OneTimeLink({ result, onClose }: { result: LinkResult; onClose: () => void }) {
  if (!result.link) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-label="Invitation link">
      <div className="bg-[#132F4C] border border-[#2A3F5E] rounded-xl p-6 max-w-lg w-full mx-4 space-y-3">
        <h3 className="text-white font-semibold flex items-center gap-2"><KeyRound size={18} /> Invitation link for {result.invitation.email}</h3>
        <p className="text-sm text-yellow-300">{result.link_note}</p>
        <div className="flex gap-2">
          <input readOnly value={result.link} className="flex-1 bg-[#0A1929] text-white text-xs rounded px-2 py-1.5 font-mono"
            data-testid="invitation-link" aria-label="One-time invitation link" />
          <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(result.link || "");
            toast.success("Copied"); }}><Copy size={14} className="mr-1" /> Copy</Button>
        </div>
        <p className="text-xs text-[#546E7A]">Single use, only for {result.invitation.email}, expires
          {" "}{new Date(result.invitation.expires_at).toLocaleString()}. It will not be shown again.</p>
        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const { user } = useAuth();
  const isOwner = !!user?.permissions?.includes("accounts.manage");
  const [catalog, setCatalog] = useState<PermissionInfo[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [choice, setChoice] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState<Record<string, string[]>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePerms, setInvitePerms] = useState<string[]>([]);
  const [linkResult, setLinkResult] = useState<LinkResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, r, m, i, a] = await Promise.all([accountsAPI.permissions(), accountsAPI.requests(), accountsAPI.members(),
        accountsAPI.invitations(), accountsAPI.audit()]);
      setCatalog(c.data); setRequests(r.data); setMembers(m.data); setInvitations(i.data); setAudit(a.data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load accounts"));
    }
  }, []);

  useEffect(() => { if (isOwner) load(); }, [isOwner, load]);

  const act = async (key: string, fn: () => Promise<{ data: unknown }>, ok: string) => {
    setBusy(key);
    try {
      const res = await fn();
      const data = res.data as Partial<LinkResult>;
      if (data && "link" in data && data.invitation) setLinkResult(data as LinkResult);
      else if (data && data.delivery === "queued") toast.success("Invitation e-mail queued");
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "The action failed"));
    } finally {
      setBusy(null);
    }
  };

  if (!isOwner) {
    return (
      <Card><p className="text-[#B0BEC5]" data-testid="accounts-forbidden">Only the organization owner can manage accounts.</p></Card>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {linkResult && <OneTimeLink result={linkResult} onClose={() => setLinkResult(null)} />}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users size={22} /> Accounts</h1>
        <p className="text-[#B0BEC5]">{user?.organization?.name} – access requests, members, permissions and invitations.
          New accounts get no permissions unless you tick them; owner rights are granted only on the server.</p>
      </div>

      <Card data-testid="pending-requests">
        <CardHeader><CardTitle>Pending access requests</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {requests.length === 0 && <p className="text-sm text-[#546E7A]">No pending requests.</p>}
          {requests.map((r) => (
            <div key={r.request_id} className="p-3 bg-[#132F4C] rounded-lg space-y-2" data-testid="access-request">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-white font-medium">{r.first_name} {r.last_name} <span className="text-[#B0BEC5] font-normal">· {r.email}</span></p>
                  {r.note && <p className="text-xs text-[#B0BEC5]">“{r.note}”</p>}
                  <p className="text-xs text-[#546E7A]">Requested {r.created_at ? new Date(r.created_at).toLocaleString() : ""}</p>
                </div>
                <div className="flex gap-2 items-start">
                  <Button size="sm" isLoading={busy === `a${r.request_id}`}
                    onClick={() => act(`a${r.request_id}`, () => accountsAPI.approve(r.request_id, choice[r.request_id] || []),
                      "Approved – invitation created")}>Approve & invite</Button>
                  <Button size="sm" variant="outline" isLoading={busy === `r${r.request_id}`}
                    onClick={() => act(`r${r.request_id}`, () => accountsAPI.reject(r.request_id), "Request rejected")}>Reject</Button>
                </div>
              </div>
              <PermissionPicker catalog={catalog} value={choice[r.request_id] || []}
                onChange={(v) => setChoice({ ...choice, [r.request_id]: v })} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="members">
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {members.map((m) => (
            <div key={m.user_id} className="p-3 bg-[#132F4C] rounded-lg space-y-2" data-testid="member">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-white font-medium">{m.name} <span className="text-[#B0BEC5] font-normal">· {m.email}</span>
                    {m.is_owner && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-[#00C853]/20 text-[#00C853]">owner</span>}
                    {m.status !== "active" && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300">{m.status}</span>}</p>
                  <p className="text-xs text-[#546E7A]">{m.permissions.length ? m.permissions.join(", ") : "No permissions"}</p>
                </div>
                <div className="flex gap-2 items-start">
                  {editing[m.user_id] ? (
                    <>
                      <Button size="sm" isLoading={busy === `p${m.user_id}`}
                        onClick={() => act(`p${m.user_id}`, () => accountsAPI.setPermissions(m.user_id, editing[m.user_id]),
                          "Permissions saved").then(() => { const next = { ...editing }; delete next[m.user_id]; setEditing(next); })}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => { const next = { ...editing }; delete next[m.user_id]; setEditing(next); }}>Cancel</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="secondary"
                      onClick={() => setEditing({ ...editing, [m.user_id]: m.permissions.filter((p) => p !== "accounts.manage") })}>
                      Permissions</Button>
                  )}
                  {m.user_id !== user?.user_id && (m.status === "active" ? (
                    <Button size="sm" variant="outline" isLoading={busy === `s${m.user_id}`}
                      onClick={() => act(`s${m.user_id}`, () => accountsAPI.setStatus(m.user_id, "disabled"), "Account disabled")}>
                      <UserX size={14} className="mr-1" /> Disable</Button>
                  ) : (
                    <Button size="sm" variant="outline" isLoading={busy === `s${m.user_id}`}
                      onClick={() => act(`s${m.user_id}`, () => accountsAPI.setStatus(m.user_id, "active"), "Account enabled")}>
                      <UserCheck size={14} className="mr-1" /> Enable</Button>
                  ))}
                </div>
              </div>
              {editing[m.user_id] && (
                <PermissionPicker catalog={catalog} value={editing[m.user_id]}
                  onChange={(v) => setEditing({ ...editing, [m.user_id]: v })} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="invitations">
        <CardHeader><CardTitle>Invitations</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-[#132F4C] rounded-lg space-y-2">
            <div className="flex flex-wrap gap-2 items-end">
              <label className="text-xs text-[#B0BEC5] flex-1 min-w-[220px]">Invite by e-mail
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  aria-label="Invite e-mail" className="mt-1 w-full bg-[#0A1929] text-white rounded px-2 py-1.5 text-sm" />
              </label>
              <Button size="sm" isLoading={busy === "invite"} disabled={!inviteEmail}
                onClick={() => act("invite", () => accountsAPI.invite(inviteEmail, invitePerms), "Invitation created")
                  .then(() => { setInviteEmail(""); setInvitePerms([]); })}><Mail size={14} className="mr-1" /> Invite</Button>
            </div>
            <PermissionPicker catalog={catalog} value={invitePerms} onChange={setInvitePerms} />
          </div>
          {invitations.map((i) => (
            <div key={i.invitation_id} className="flex flex-wrap justify-between gap-2 text-sm" data-testid="invitation">
              <div>
                <p className="text-white">{i.email} <span className={`ml-1 text-xs px-2 py-0.5 rounded ${i.state === "open"
                  ? "bg-[#00C853]/20 text-[#00C853]" : "bg-[#2A3F5E] text-[#B0BEC5]"}`}>{i.state}</span></p>
                <p className="text-xs text-[#546E7A]">e-mail: {i.delivery.replace("_", " ")} · expires {new Date(i.expires_at).toLocaleString()}
                  {i.failed_attempts > 0 && ` · ${i.failed_attempts} wrong e-mail attempt(s)`}{i.permissions.length > 0 && ` · ${i.permissions.join(", ")}`}</p>
              </div>
              {["open", "expired", "locked"].includes(i.state) && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" isLoading={busy === `re${i.invitation_id}`}
                    onClick={() => act(`re${i.invitation_id}`, () => accountsAPI.reissue(i.invitation_id), "New invitation created")}>Reissue</Button>
                  {i.state === "open" && (
                    <Button size="sm" variant="outline" isLoading={busy === `rv${i.invitation_id}`}
                      onClick={() => act(`rv${i.invitation_id}`, () => accountsAPI.revoke(i.invitation_id), "Invitation revoked")}>Revoke</Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert size={18} /> Audit log</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs text-[#B0BEC5]" data-testid="audit-log">
            {audit.map((e, n) => (
              <li key={n}><span className="text-[#546E7A]">{e.at ? new Date(e.at).toLocaleString() : ""}</span> · {e.actor} ·
                <span className="text-white"> {e.action.replace(/_/g, " ")}</span>{e.target_email && ` · ${e.target_email}`}
                {typeof e.details?.permission === "string" && ` · ${e.details.permission}`}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
