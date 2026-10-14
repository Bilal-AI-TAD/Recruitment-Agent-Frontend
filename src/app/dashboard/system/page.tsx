"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarRange, CheckCircle, Download, RefreshCw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { analyticsAPI, UsageRange } from "@/lib/api";
import { Toaster } from "react-hot-toast";
import { GmailConnectionsCard } from "@/components/gmail/GmailConnectionsCard";
import { OutlookMailboxCard } from "@/components/mailbox/OutlookMailboxCard";
import { AiReadiness, COST_LABEL, COST_NOTE, CostTotals, formatUsd } from "@/lib/cost";

const mockServices = [
  { name: "PostgreSQL", status: "healthy", responseTime: "12ms", uptime: "99.9%" },
  { name: "OpenAI API", status: "healthy", responseTime: "450ms", uptime: "99.8%" },
  { name: "Redis Cache", status: "healthy", responseTime: "2ms", uptime: "100%" },
  { name: "Email Service", status: "healthy", responseTime: "1200ms", uptime: "98.5%" },
];

/** UTC calendar day, YYYY-MM-DD. */
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86400000));
const PRESETS = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
];

interface UsageBucket { date?: string; week?: string; tokens: number; cost: number; unknown_calls: number; requests: number }

export default function SystemPage() {
  const [range, setRange] = useState<UsageRange>({ start: daysAgo(29), end: daysAgo(0), granularity: "day" });
  const [preset, setPreset] = useState<string>("30");
  const [draft, setDraft] = useState({ start: range.start, end: range.end });
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<UsageBucket[]>([]);
  const [tokenSummary, setTokenSummary] = useState({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCachedTokens: 0,
    totalRequests: 0,
    costs: null as CostTotals | null,
  });
  const [readiness, setReadiness] = useState<AiReadiness | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usageRes, summaryRes, readyRes, storageRes] = await Promise.all([
        analyticsAPI.getTokenUsage(range),
        analyticsAPI.getTokenSummary({ start: range.start, end: range.end }),
        analyticsAPI.getAiReadiness(),
        analyticsAPI.getStorageStatus().catch(() => ({ data: null })),
      ]);
      setTokenUsage(usageRes.data?.data || []);
      if (summaryRes.data) setTokenSummary(summaryRes.data);
      setReadiness(readyRes.data || null);
      setStorageStatus(storageRes.data || null);
    } catch (error) {
      console.error("Failed to fetch token data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const choosePreset = (key: string, days: number) => {
    setPreset(key);
    setRangeError(null);
    const next = { start: daysAgo(days - 1), end: daysAgo(0) };
    setDraft(next);
    setRange((r) => ({ ...r, ...next, granularity: days > 31 ? "week" : r.granularity }));
  };
  const applyCustom = () => {
    if (!draft.start || !draft.end) return setRangeError("Choose both dates.");
    if (draft.start > draft.end) return setRangeError("'From' must not be after 'To'.");
    const span = (Date.parse(draft.end) - Date.parse(draft.start)) / 86400000 + 1;
    if (span > 366) return setRangeError("Choose at most 366 days.");
    setRangeError(null);
    setPreset("custom");
    setRange((r) => ({ ...r, start: draft.start, end: draft.end, granularity: span > 92 ? "week" : r.granularity }));
  };

  const totalTokens = tokenUsage.reduce((acc, item) => acc + item.tokens, 0);
  const totalCost = tokenUsage.reduce((acc, item) => acc + (item.cost || 0), 0);
  const periodUnknown = tokenUsage.reduce((acc, item) => acc + (item.unknown_calls || 0), 0);
  const periodCalls = tokenUsage.reduce((acc, item) => acc + (item.requests || 0), 0);
  const costs = tokenSummary.costs;
  const operations = Object.entries(costs?.operations || {});
  const maxIncurred = Math.max(...operations.map(([, o]) => o.incurred_usd), 0);
  const maxTokens = Math.max(...tokenUsage.map(d => d.tokens), 1);
  const labelEvery = Math.max(1, Math.ceil(tokenUsage.length / 10));
  const rangeText = `${range.start} – ${range.end} (UTC)`;
  const periodCostText = periodCalls === 0 ? "–"
    : totalCost === 0 && periodUnknown === periodCalls ? "Unknown" : formatUsd(totalCost);

  const operationColors: Record<string, string> = {
    resume_parse: "#00C853",
    candidate_scoring: "#00E676",
    gmail_title_variants: "#4FC3F7",
    agent_update: "#FFB300",
    interview_scheduling: "#2196F3",
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">System</h1>
          <p className="text-[#B0BEC5]">Integrations, system health and token usage</p>
        </div>
        <Button variant="outline" onClick={fetchData} isLoading={isLoading}>
          <RefreshCw size={18} className="mr-2" />
          Refresh
        </Button>
      </motion.div>

      <OutlookMailboxCard />
      <GmailConnectionsCard />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockServices.map((service, index) => (
          <motion.div
            key={service.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card hover>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      service.status === "healthy" ? "bg-[#00C853]" : "bg-[#FFB300]"
                    }`} />
                    <span className="text-white font-medium">{service.name}</span>
                  </div>
                  {service.status === "healthy" ? (
                    <CheckCircle size={16} className="text-[#00C853]" />
                  ) : (
                    <AlertTriangle size={16} className="text-[#FFB300]" />
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#B0BEC5]">Response: {service.responseTime}</span>
                  <span className="text-[#B0BEC5]">Uptime: {service.uptime}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {readiness && <ReadinessCard readiness={readiness} />}
      {storageStatus && <StorageCard status={storageStatus} />}

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3" data-testid="usage-range">
          <div className="flex items-center gap-2 text-white font-medium mr-2"><CalendarRange size={16} /> Usage period</div>
          <div className="flex gap-2" role="group" aria-label="Preset periods">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => choosePreset(p.key, p.days)} aria-pressed={preset === p.key}
                className={`px-3 py-1.5 rounded text-xs ${preset === p.key ? "bg-[#00C853] text-white" : "bg-[#132F4C] text-[#B0BEC5]"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <label className="text-xs text-[#B0BEC5] flex flex-col gap-1">From
            <input type="date" value={draft.start} max={draft.end || undefined} aria-label="From (UTC)"
              onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
              className="bg-[#132F4C] text-white rounded px-2 py-1 text-sm [color-scheme:dark]" />
          </label>
          <label className="text-xs text-[#B0BEC5] flex flex-col gap-1">To
            <input type="date" value={draft.end} min={draft.start || undefined} aria-label="To (UTC)"
              onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
              className="bg-[#132F4C] text-white rounded px-2 py-1 text-sm [color-scheme:dark]" />
          </label>
          <Button size="sm" variant="secondary" onClick={applyCustom}>Show</Button>
          <div className="flex gap-2 ml-auto" role="group" aria-label="Group by">
            {(["day", "week"] as const).map((g) => (
              <button key={g} onClick={() => setRange((r) => ({ ...r, granularity: g }))} aria-pressed={range.granularity === g}
                className={`px-3 py-1.5 rounded text-xs ${range.granularity === g ? "bg-[#00C853] text-white" : "bg-[#132F4C] text-[#B0BEC5]"}`}>
                By {g}
              </button>
            ))}
          </div>
          <p className="basis-full text-xs text-[#546E7A]">
            Showing <span className="text-[#B0BEC5]" data-testid="range-text">{rangeText}</span>. Days are UTC calendar days; both
            dates are included. The chart, Cost Breakdown and Token Summary all use this period.
            {rangeError && <span className="text-[#FF8A80] ml-2">{rangeError}</span>}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Token Usage</CardTitle>
            <span className="text-xs text-[#546E7A]">by {range.granularity} · {rangeText}</span>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between mb-4">
              <div>
                <p className="text-sm text-[#B0BEC5]">Total Tokens</p>
                <p className="text-2xl font-bold text-white" data-testid="period-tokens">{totalTokens.toLocaleString()}</p>
              </div>
              <div className="text-right" data-testid="period-cost">
                <p className="text-sm text-[#B0BEC5]" title={COST_NOTE}>{COST_LABEL}</p>
                <p className={`text-2xl font-bold ${periodCostText === "Unknown" ? "text-yellow-300" : "text-[#00C853]"}`}>{periodCostText}</p>
                {periodUnknown > 0 && <p className="text-xs text-yellow-300">{periodCostText === "Unknown" ? "" : "+ "}{periodUnknown} call(s) with unknown cost</p>}
              </div>
            </div>

            <div className="h-40 flex items-end gap-1" data-testid="usage-chart">
              {periodCalls > 0 && tokenUsage.map((item, index) => (
                <div key={item.date || item.week} className="flex-1 h-full flex flex-col justify-end items-center"
                  title={`${item.date || item.week}: ${item.tokens.toLocaleString()} tokens · ${item.requests} call(s)` +
                    (item.unknown_calls ? ` · ${item.unknown_calls} with unknown cost` : item.cost ? ` · ${formatUsd(item.cost)}` : "")}
                  data-testid="usage-bar" data-tokens={item.tokens}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(item.tokens / maxTokens) * 100}%` }}
                    transition={{ delay: Math.min(index, 20) * 0.03, duration: 0.4 }}
                    className="w-full bg-gradient-to-t from-[#00C853] to-[#00E676] rounded-t"
                  />
                </div>
              ))}
              {periodCalls === 0 && (
                <div className="flex-1 self-center text-center text-[#546E7A] text-sm">
                  No AI calls in this period. Choose another period above.
                </div>
              )}
            </div>
            {periodCalls > 0 && (
              <div className="flex gap-1 mt-2">
                {tokenUsage.map((item, index) => (
                  <span key={item.date || item.week} className="flex-1 text-center text-[10px] text-[#B0BEC5] whitespace-nowrap overflow-visible">
                    {index % labelEvery === 0 ? (item.date ? item.date.slice(5) : item.week) : ""}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Cost Breakdown <span className="text-xs font-normal text-[#546E7A] ml-1">{rangeText}</span></CardTitle>
            <Button variant="outline" size="sm">
              <Download size={14} className="mr-1" />
              Export
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {operations.length > 0 ? (
              operations.map(([operation, o]) => (
                <div key={operation} className="p-4 bg-[#132F4C] rounded-lg" data-testid="operation-cost">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#B0BEC5] capitalize">{operation.replace(/_/g, " ")} <span className="text-xs text-[#546E7A]">· {o.calls} call(s)</span></span>
                    <span className={o.incurred_usd > 0 || o.unknown_calls === 0 ? "text-white font-medium" : "text-yellow-300 font-medium"}>
                      {o.incurred_usd > 0 || o.unknown_calls === 0 ? formatUsd(o.incurred_usd) : "Unknown"}</span>
                  </div>
                  <div className="h-2 bg-[#1E3A5F] rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${maxIncurred > 0 ? (o.incurred_usd / maxIncurred) * 100 : 0}%`,
                               backgroundColor: operationColors[operation] || "#00C853" }} />
                  </div>
                  {(o.reconstructed_usd > 0 || o.unknown_calls > 0 || o.reserved_active_usd > 0) && (
                    <p className="text-xs text-[#546E7A] mt-1">
                      {o.reconstructed_usd > 0 && `${formatUsd(o.reconstructed_usd)} reconstructed from logged usage. `}
                      {o.unknown_calls > 0 && `${o.unknown_calls} call(s) with unknown or uncertain cost. `}
                      {o.reserved_active_usd > 0 && `${formatUsd(o.reserved_active_usd)} reserved in flight.`}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-[#546E7A]">No AI calls in this period.</p>
            )}
            <p className="text-xs text-[#546E7A]">{COST_NOTE}</p>

            <div className="pt-4 border-t border-[#2A3F5E]">
              <div className="flex justify-between text-sm">
                <span className="text-[#B0BEC5]">AI calls in this period</span>
                <span className="text-white font-medium">{tokenSummary.totalRequests}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-[#B0BEC5]">Avg Tokens/Request</span>
                <span className="text-white font-medium">
                  {tokenSummary.totalRequests > 0
                    ? Math.round(tokenSummary.totalTokens / tokenSummary.totalRequests).toLocaleString()
                    : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Token Summary</CardTitle>
          <span className="text-xs text-[#546E7A]">{rangeText}</span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#132F4C] rounded-lg">
              <p className="text-sm text-[#B0BEC5]">Input Tokens</p>
              <p className="text-xl font-bold text-white">{tokenSummary.totalInputTokens.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-[#132F4C] rounded-lg">
              <p className="text-sm text-[#B0BEC5]">Output Tokens</p>
              <p className="text-xl font-bold text-white">{tokenSummary.totalOutputTokens.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-[#132F4C] rounded-lg">
              <p className="text-sm text-[#B0BEC5]">Total Tokens</p>
              <p className="text-xl font-bold text-white">{tokenSummary.totalTokens.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-[#132F4C] rounded-lg" data-testid="incurred-cost">
              <p className="text-sm text-[#B0BEC5]" title={COST_NOTE}>{COST_LABEL}</p>
              {costs && costs.incurred_usd === 0 && costs.unknown_calls > 0 ? (
                <p className="text-xl font-bold text-yellow-300">Unknown</p>
              ) : (
                <p className="text-xl font-bold text-[#00C853]">{costs ? formatUsd(costs.incurred_usd) : "Unknown"}</p>
              )}
              {costs && costs.reconstructed_usd > 0 && (
                <p className="text-xs text-[#546E7A]">incl. {formatUsd(costs.reconstructed_usd)} reconstructed from logged usage</p>
              )}
              {costs && costs.unknown_calls > 0 && costs.incurred_usd > 0 && (
                <p className="text-xs text-yellow-300">+ {costs.unknown_calls} call(s) with unknown cost</p>
              )}
            </div>
          </div>
          {costs && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm" data-testid="cost-status">
              <div className="p-3 bg-[#132F4C] rounded-lg">
                <p className="text-[#B0BEC5]">Unknown cost <span className="text-[#546E7A]">(this period)</span></p>
                <p className="text-white font-medium">{costs.unknown_calls} call(s)</p>
                {Object.entries(costs.unknown_reasons).map(([reason, n]) => (
                  <p key={reason} className="text-xs text-[#546E7A]" data-testid="unknown-reason">{n} × {reason}</p>
                ))}
              </div>
              <div className="p-3 bg-[#132F4C] rounded-lg">
                <p className="text-[#B0BEC5]">Billing uncertain <span className="text-[#546E7A]">(this period)</span></p>
                <p className="text-white font-medium">{costs.uncertain_usd > 0 ? `up to ${formatUsd(costs.uncertain_usd)}` : "None"}</p>
                <p className="text-xs text-[#546E7A]">Failed calls, counted at their reservation</p>
              </div>
              <div className="p-3 bg-[#132F4C] rounded-lg">
                <p className="text-[#B0BEC5]">Reserved (in flight)</p>
                <p className="text-white font-medium">{costs.reserved_active_usd > 0 ? formatUsd(costs.reserved_active_usd) : "None"}</p>
                <p className="text-xs text-[#546E7A]">Not yet incurred</p>
              </div>
              <div className="p-3 bg-[#132F4C] rounded-lg" data-testid="budget-status">
                <p className="text-[#B0BEC5]">Shared AI budget <span className="text-[#546E7A]">(now)</span></p>
                <p className={costs.daily_budget_usd === null ? "text-yellow-300 font-medium" : "text-white font-medium"}>
                  {costs.daily_budget_usd === null ? "Not configured – paid AI blocked" : `${formatUsd(costs.daily_budget_usd)} per 24 h`}</p>
                <p className="text-xs text-[#546E7A]">Committed in the last 24 h: {formatUsd(costs.committed_24h_usd)} · prices {costs.price_table_version || "none established today"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Whether the signed-in user can start a paid CV analysis now, and why not. */
function ReadinessCard({ readiness }: { readiness: AiReadiness }) {
  const b = readiness.shared_budget;
  return (
    <Card data-testid="ai-readiness">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><ShieldCheck size={18} /> Paid AI readiness <span className="text-xs font-normal text-[#546E7A]">(for you)</span></CardTitle>
        <span className={`text-xs px-2 py-1 rounded ${readiness.ready ? "bg-[#00C853]/20 text-[#00C853]" : "bg-yellow-500/20 text-yellow-300"}`}
          data-testid="ai-readiness-state">{readiness.ready ? "Ready" : "Blocked"}</span>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {readiness.blockers.length > 0 && (
          <ul className="space-y-1" data-testid="ai-readiness-blockers">
            {readiness.blockers.map((x) => (
              <li key={x.code + x.message} className="text-yellow-300 flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{x.message}</li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {readiness.models.map((m) => (
            <div key={m.stage} className="p-3 bg-[#132F4C] rounded-lg">
              <p className="text-[#B0BEC5] capitalize">CV {m.stage} model</p>
              <p className="text-white font-medium">{m.provider ? `${m.provider}:${m.model}` : "Not configured"}</p>
              <p className="text-xs text-[#546E7A]">{m.price
                ? `$${m.price.input} in${m.price.cached_input != null ? ` · $${m.price.cached_input} cached` : ""} · $${m.price.output} out per 1M tokens · ${m.price.version} (from ${m.price.effective_from || "configured"})`
                : "No price established today"}</p>
            </div>
          ))}
          <div className="p-3 bg-[#132F4C] rounded-lg">
            <p className="text-[#B0BEC5]">Shared AI budget</p>
            <p className={b.configured ? "text-white font-medium" : "text-yellow-300 font-medium"}>
              {b.configured ? `${formatUsd(b.remaining_usd)} left of ${formatUsd(b.daily_budget_usd)} (24 h)` : "Not configured"}</p>
            <p className="text-xs text-[#546E7A]">Needs room for about {formatUsd(b.analysis_estimate_usd)} per analysis (a pre-check, not a cap)</p>
          </div>
        </div>
        <p className="text-xs text-[#546E7A]">Requires: {readiness.permissions_required.join(", ")}. Re-checked by the server at every paid
          call, including background processing.</p>
      </CardContent>
    </Card>
  );
}

interface StorageStatus { backend: string; configured: boolean; issue: string | null; private: boolean;
  link_ttl_seconds: number; pending_uploads: number; pending_deletions: number; failing_deletions: number }

/** Where CV files are kept and whether uploads/deletions are waiting (counts only). */
function StorageCard({ status }: { status: StorageStatus }) {
  return (
    <Card data-testid="storage-status">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>CV storage</CardTitle>
        <span className={`text-xs px-2 py-1 rounded ${status.configured ? "bg-[#00C853]/20 text-[#00C853]" : "bg-yellow-500/20 text-yellow-300"}`}>
          {status.backend === "cloudinary" ? "Private cloud (Cloudinary)" : "Local disk"}</span>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="p-3 bg-[#132F4C] rounded-lg">
          <p className="text-[#B0BEC5]">Access</p>
          <p className="text-white font-medium">{status.private ? `Signed links, valid ${status.link_ttl_seconds} s`
            : "Streamed by the server after sign-in"}</p>
          {status.issue && <p className="text-xs text-yellow-300">{status.issue}</p>}
        </div>
        <div className="p-3 bg-[#132F4C] rounded-lg">
          <p className="text-[#B0BEC5]">Unfinished uploads</p>
          <p className="text-white font-medium">{status.pending_uploads}</p>
          <p className="text-xs text-[#546E7A]">Completed by the next import of the same file</p>
        </div>
        <div className="p-3 bg-[#132F4C] rounded-lg">
          <p className="text-[#B0BEC5]">Files waiting to be deleted</p>
          <p className={status.failing_deletions ? "text-yellow-300 font-medium" : "text-white font-medium"}>
            {status.pending_deletions}{status.failing_deletions ? ` (${status.failing_deletions} retrying)` : ""}</p>
          <p className="text-xs text-[#546E7A]">Deleted after the records; retried while storage is unavailable</p>
        </div>
      </CardContent>
    </Card>
  );
}
