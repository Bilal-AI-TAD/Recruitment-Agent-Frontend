"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Radar, X } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { headhuntingAPI } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { HHConfig, HHRun } from "@/types";
import { CostBadge, DisclaimerBanner, RunStatusBadge } from "./HeadhuntingBits";

const ACTIVE = ["queued", "running"];

function StartRunModal({ jobId, jobLocation, config, onClose, onStarted }: {
  jobId: string; jobLocation?: string | null; config: HHConfig; onClose: () => void; onStarted: (runId: string) => void;
}) {
  const [mode, setMode] = useState<"rules-diagnostic" | "ai">("rules-diagnostic");
  const [location, setLocation] = useState(jobLocation || "");
  const [engineRequests, setEngineRequests] = useState(config.limits.max_engine_requests);
  const [fetches, setFetches] = useState(config.limits.max_fetches);
  const [busy, setBusy] = useState(false);
  const [requestId] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())));
  const aiAllowed = config.modes.includes("ai");

  const submit = async () => {
    if (!location.trim()) {
      toast.error("Enter the location to search in");
      return;
    }
    setBusy(true);
    try {
      const res = await headhuntingAPI.start(jobId, {
        mode, location: location.trim(), client_request_id: requestId,
        limits: { max_engine_requests: engineRequests, max_fetches: fetches },
      });
      onStarted(res.data.run_id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start headhunting"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="bg-[#1a2a3a] border border-[#2A3F5E] rounded-2xl p-6 w-full max-w-xl space-y-4" role="dialog"
        aria-label="Run headhunting">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2"><Radar size={20} className="text-[#00C853]" /> Run Headhunting</h2>
          <button onClick={onClose} className="text-[#B0BEC5] hover:text-white" aria-label="Close"><X size={20} /></button>
        </div>
        <DisclaimerBanner disclaimers={config.disclaimers} />
        <div className="space-y-2">
          <p className="text-sm text-white font-medium">Mode</p>
          <label className="flex items-start gap-2 text-sm text-[#B0BEC5]">
            <input type="radio" checked={mode === "rules-diagnostic"} onChange={() => setMode("rules-diagnostic")} />
            <span><span className="text-white font-medium">Free search – rules only</span> <CostBadge mode="rules-diagnostic" />
              <span className="block">No AI and no cost. Keyword evidence is shown as &quot;indicated&quot; at most.</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[#B0BEC5]">
            <input type="radio" disabled={!aiAllowed} checked={mode === "ai"} onChange={() => setMode("ai")} />
            <span>
              <span className={aiAllowed ? "text-white font-medium" : ""}>AI assessment ({config.ai.model})</span> <CostBadge mode="ai" />
              <span className="block">Paid: at most
              {" "}${config.ai.max_cost_usd_per_run?.toFixed(2)} per run
              {config.ai.daily_remaining_usd != null && <> · ${config.ai.daily_remaining_usd.toFixed(2)} left today</>}.</span>
              {!aiAllowed && <span className="block text-xs text-[#546E7A]">
                {config.ai.unavailable_reason || "Needs the headhunting.run_ai permission."}</span>}
            </span>
          </label>
        </div>
        <Input label="Location to search" value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. United Arab Emirates" />
        <div className="grid grid-cols-2 gap-3">
          <Input label={`Search requests (max ${config.limits.max_engine_requests})`} type="number" min={1}
            max={config.limits.max_engine_requests} value={engineRequests}
            onChange={(e) => setEngineRequests(Math.min(Number(e.target.value) || 1, config.limits.max_engine_requests))} />
          <Input label={`Page fetches (max ${config.limits.max_fetches})`} type="number" min={0}
            max={config.limits.max_fetches} value={fetches}
            onChange={(e) => setFetches(Math.min(Number(e.target.value) || 0, config.limits.max_fetches))} />
        </div>
        <p className="text-xs text-[#546E7A]">Limits are enforced by the server. No one is contacted; LinkedIn profiles are never fetched.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} isLoading={busy}>
            {mode === "ai" ? `Start paid AI run (max $${config.ai.max_cost_usd_per_run?.toFixed(2)})` : "Start free run"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function HeadhuntingCard({ jobId, jobLocation, isOpen }: { jobId: string; jobLocation?: string | null; isOpen: boolean }) {
  const [config, setConfig] = useState<HHConfig | null>(null);
  const [runs, setRuns] = useState<HHRun[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const loadRuns = useCallback(async () => {
    try {
      const res = await headhuntingAPI.runs(jobId);
      setRuns(res.data.runs || []);
    } catch {
      setRuns([]);
    }
  }, [jobId]);

  useEffect(() => {
    headhuntingAPI.config().then((r) => setConfig(r.data)).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (config?.enabled && (config.modes.length || config.can_review)) loadRuns();
  }, [config, loadRuns]);

  useEffect(() => {
    if (!runs.some((r) => ACTIVE.includes(r.status))) return;
    const timer = setInterval(loadRuns, 3000);
    return () => clearInterval(timer);
  }, [runs, loadRuns]);

  if (!config?.enabled || (!config.modes.length && !config.can_review)) return null;
  const canRun = config.modes.length > 0;
  const active = runs.some((r) => ACTIVE.includes(r.status));

  return (
    <Card>
      {modalOpen && (
        <StartRunModal jobId={jobId} jobLocation={jobLocation} config={config} onClose={() => setModalOpen(false)}
          onStarted={(runId) => { setModalOpen(false); router.push(`/dashboard/jobs/${jobId}/headhunting/${runId}`); }} />
      )}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Radar size={18} className="text-[#00C853]" /> Headhunting</h2>
          <p className="text-xs text-[#B0BEC5]">Find public profiles for this job and review the evidence. Internal pilot.</p>
        </div>
        {canRun && (
          <Button size="sm" onClick={() => setModalOpen(true)} disabled={!isOpen || active}
            title={!isOpen ? "Reopen the job to run headhunting" : active ? "A run is already in progress" : undefined}>
            Run Headhunting
          </Button>
        )}
      </div>
      {runs.length === 0 ? (
        <p className="text-sm text-[#546E7A]">No headhunting runs yet.</p>
      ) : (
        <ul className="divide-y divide-[#2A3F5E]/60">
          {runs.slice(0, 5).map((r) => (
            <li key={r.run_id} className="py-2 flex items-center justify-between gap-2 text-sm">
              <Link href={`/dashboard/jobs/${jobId}/headhunting/${r.run_id}`} className="text-white hover:text-[#00C853]">
                {r.created_at ? new Date(r.created_at).toLocaleString() : r.run_id} · {r.filters?.location}
              </Link>
              <span className="flex items-center gap-2 text-xs text-[#B0BEC5]">
                <CostBadge mode={r.mode} /> {(r.counts?.prospects as number | undefined) ?? 0} prospects <RunStatusBadge status={r.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
