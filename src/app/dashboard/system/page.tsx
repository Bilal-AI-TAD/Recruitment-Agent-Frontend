"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Database, Clock, AlertTriangle, CheckCircle, RefreshCw, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { analyticsAPI } from "@/lib/api";
import { Toaster } from "react-hot-toast";
import { GmailConnectionsCard } from "@/components/gmail/GmailConnectionsCard";
import { COST_LABEL, COST_NOTE, CostTotals, formatUsd } from "@/lib/cost";

const mockServices = [
  { name: "PostgreSQL", status: "healthy", responseTime: "12ms", uptime: "99.9%" },
  { name: "OpenAI API", status: "healthy", responseTime: "450ms", uptime: "99.8%" },
  { name: "Redis Cache", status: "healthy", responseTime: "2ms", uptime: "100%" },
  { name: "Email Service", status: "healthy", responseTime: "1200ms", uptime: "98.5%" },
];

export default function SystemPage() {
  const [timeRange, setTimeRange] = useState<"daily" | "weekly">("daily");
  const [tokenUsage, setTokenUsage] = useState<any[]>([]);
  const [tokenSummary, setTokenSummary] = useState({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCachedTokens: 0,
    totalRequests: 0,
    costs: null as CostTotals | null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usageRes, summaryRes] = await Promise.all([
        analyticsAPI.getTokenUsage(timeRange),
        analyticsAPI.getTokenSummary(),
      ]);
      
      setTokenUsage(usageRes.data?.data || []);
      if (summaryRes.data) setTokenSummary(summaryRes.data);
    } catch (error) {
      console.error("Failed to fetch token data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalTokens = tokenUsage.reduce((acc, item) => acc + item.tokens, 0);
  const totalCost = tokenUsage.reduce((acc, item) => acc + (item.cost || 0), 0);
  const periodUnknown = tokenUsage.reduce((acc, item) => acc + (item.unknown_calls || 0), 0);
  const costs = tokenSummary.costs;
  const operations = Object.entries(costs?.operations || {});
  const maxIncurred = Math.max(...operations.map(([, o]) => o.incurred_usd), 0);
  const maxTokens = Math.max(...tokenUsage.map(d => d.tokens), 1);

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
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw size={18} className="mr-2" />
          Refresh
        </Button>
      </motion.div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Token Usage</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeRange("daily")}
                className={`px-3 py-1 rounded text-xs ${
                  timeRange === "daily" ? "bg-[#00C853] text-white" : "bg-[#132F4C] text-[#B0BEC5]"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setTimeRange("weekly")}
                className={`px-3 py-1 rounded text-xs ${
                  timeRange === "weekly" ? "bg-[#00C853] text-white" : "bg-[#132F4C] text-[#B0BEC5]"
                }`}
              >
                Weekly
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between mb-4">
              <div>
                <p className="text-sm text-[#B0BEC5]">Total Tokens</p>
                <p className="text-2xl font-bold text-white">{totalTokens.toLocaleString()}</p>
              </div>
              <div className="text-right" data-testid="period-cost">
                <p className="text-sm text-[#B0BEC5]" title={COST_NOTE}>{COST_LABEL}</p>
                <p className="text-2xl font-bold text-[#00C853]">{tokenUsage.length ? formatUsd(totalCost) : "–"}</p>
                {periodUnknown > 0 && <p className="text-xs text-yellow-300">+ {periodUnknown} call(s) with unknown cost</p>}
              </div>
            </div>
            
            <div className="h-40 flex items-end gap-2">
              {tokenUsage.slice(-7).map((item, index) => (
                <div key={index} className="flex-1 h-full flex flex-col justify-end items-center gap-2"
                  title={`${item.tokens.toLocaleString()} tokens`}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(item.tokens / maxTokens) * 100}%` }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    className="w-full bg-gradient-to-t from-[#00C853] to-[#00E676] rounded-t"
                  />
                </div>
              ))}
              {tokenUsage.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-[#546E7A] text-sm">
                  No data available
                </div>
              )}
            </div>
            <div className="flex justify-between mt-2">
              {tokenUsage.slice(-7).map((item, index) => (
                <span key={index} className="text-xs text-[#B0BEC5]">{item.date?.slice(5) || ""}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Cost Breakdown</CardTitle>
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
                    <span className="text-white font-medium">{o.incurred_usd > 0 || o.unknown_calls === 0 ? formatUsd(o.incurred_usd) : "Unknown"}</span>
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
              <p className="text-sm text-[#546E7A]">No AI calls recorded yet.</p>
            )}
            <p className="text-xs text-[#546E7A]">{COST_NOTE}</p>

            <div className="pt-4 border-t border-[#2A3F5E]">
              <div className="flex justify-between text-sm">
                <span className="text-[#B0BEC5]">Total API Requests</span>
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
        <CardHeader>
          <CardTitle>Token Summary</CardTitle>
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
              <p className="text-xl font-bold text-[#00C853]">{costs ? formatUsd(costs.incurred_usd) : "Unknown"}</p>
              {costs && costs.reconstructed_usd > 0 && (
                <p className="text-xs text-[#546E7A]">incl. {formatUsd(costs.reconstructed_usd)} reconstructed from logged usage</p>
              )}
            </div>
          </div>
          {costs && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm" data-testid="cost-status">
              <div className="p-3 bg-[#132F4C] rounded-lg">
                <p className="text-[#B0BEC5]">Unknown cost</p>
                <p className="text-white font-medium">{costs.unknown_calls} call(s)</p>
                {Object.entries(costs.unknown_reasons).map(([reason, n]) => (
                  <p key={reason} className="text-xs text-[#546E7A]">{n} × {reason}</p>
                ))}
              </div>
              <div className="p-3 bg-[#132F4C] rounded-lg">
                <p className="text-[#B0BEC5]">Billing uncertain</p>
                <p className="text-white font-medium">{costs.uncertain_usd > 0 ? `up to ${formatUsd(costs.uncertain_usd)}` : "None"}</p>
                <p className="text-xs text-[#546E7A]">Failed calls, counted at their reservation</p>
              </div>
              <div className="p-3 bg-[#132F4C] rounded-lg">
                <p className="text-[#B0BEC5]">Reserved (in flight)</p>
                <p className="text-white font-medium">{costs.reserved_active_usd > 0 ? formatUsd(costs.reserved_active_usd) : "None"}</p>
                <p className="text-xs text-[#546E7A]">Not yet incurred</p>
              </div>
              <div className="p-3 bg-[#132F4C] rounded-lg">
                <p className="text-[#B0BEC5]">Daily AI budget</p>
                <p className="text-white font-medium">{costs.daily_budget_usd === null ? "No shared cap configured" : formatUsd(costs.daily_budget_usd)}</p>
                <p className="text-xs text-[#546E7A]">Committed in 24 h: {formatUsd(costs.committed_24h_usd)} · prices {costs.price_table_version || "not configured"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
