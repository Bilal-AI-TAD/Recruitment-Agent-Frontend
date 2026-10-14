"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { accountsAPI } from "@/lib/api";
import { COMPANY_NAME, getErrorMessage } from "@/lib/utils";

/** Redeem a single-use invitation. The token comes from the URL fragment (#token=...), which browsers never send to
 *  servers; it is removed from the address bar as soon as it is read. */
export default function AcceptInvitationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<{ organization: string; expires_at: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const found = hash.get("token");
    window.history.replaceState(null, "", window.location.pathname);       // keep the token out of history
    if (!found) {
      setProblem("This invitation link is incomplete. Open the link from the invitation e-mail again.");
      return;
    }
    setToken(found);
    accountsAPI.inspectInvitation(found)
      .then((res) => setInfo(res.data))
      .catch((err) => setProblem(getErrorMessage(err, "This invitation link is not valid.")));
  }, []);

  const change = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError("The passwords do not match.");
    if (form.password.length < 10) return setError("Choose a password of at least 10 characters.");
    setBusy(true);
    try {
      await accountsAPI.acceptInvitation({ token: token as string, email: form.email, password: form.password,
                                           first_name: form.first_name, last_name: form.last_name });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, "The invitation could not be accepted."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A1929] p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-[#132F4C]/80 backdrop-blur-xl border border-[#2A3F5E] rounded-2xl p-8 shadow-2xl space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Accept invitation</h1>
            <p className="text-[#B0BEC5]">{info ? `You are invited to ${info.organization} on the ${COMPANY_NAME} Recruitment Agent.`
              : `${COMPANY_NAME} Recruitment Agent`}</p>
          </div>

          {problem && (
            <div className="flex gap-2 text-sm text-red-300" data-testid="invitation-problem">
              <AlertCircle size={18} className="shrink-0" /> {problem}
            </div>
          )}

          {done && (
            <div className="text-center space-y-3" data-testid="invitation-accepted">
              <CheckCircle className="mx-auto text-[#00C853]" size={32} />
              <p className="text-white font-medium">Your account is ready.</p>
              <Link href="/login" className="text-[#00C853] hover:underline font-medium">Sign in</Link>
            </div>
          )}

          {info && !done && (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-xs text-[#B0BEC5]">Expires {new Date(info.expires_at).toLocaleString()}. Enter the e-mail
                address this invitation was sent to; several wrong attempts lock the invitation.</p>
              <Input type="email" name="email" label="Your e-mail address" value={form.email} onChange={change}
                icon={<Mail size={18} />} required />
              <div className="grid grid-cols-2 gap-4">
                <Input name="first_name" label="First Name" value={form.first_name} onChange={change}
                  icon={<User size={18} />} required />
                <Input name="last_name" label="Last Name" value={form.last_name} onChange={change}
                  icon={<User size={18} />} required />
              </div>
              <Input type="password" name="password" label="Password (at least 10 characters)" value={form.password}
                onChange={change} icon={<Lock size={18} />} required />
              <Input type="password" name="confirm" label="Repeat password" value={form.confirm} onChange={change}
                icon={<Lock size={18} />} required />
              {error && <p className="text-sm text-red-300" data-testid="invitation-error">{error}</p>}
              <Button type="submit" className="w-full" size="lg" isLoading={busy}>Create my account</Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
