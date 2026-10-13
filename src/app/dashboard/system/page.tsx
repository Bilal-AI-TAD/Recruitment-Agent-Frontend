"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Database, Clock, AlertTriangle, CheckCircle, RefreshCw, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { analyticsAPI } from "@/lib/api";
import { Toaster } from "react-hot-toast";
import { GmailConnectionsCard } from "@/components/gmail/GmailConnectionsCard";

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
    totalCost: 0,
    operationCosts: {} as Record<string, number>,
    totalRequests: 0,
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
      setTokenSummary(summaryRes.data || {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        operationCosts: {},
        totalRequests: 0,
      });
    } catch (error) {
      console.error("Failed to fetch token data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalTokens = tokenUsage.reduce((acc, item) => acc + item.tokens, 0);
  const totalCost = tokenUsage.reduce((acc, item) => acc + item.cost, 0);
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
              <div className="text-right">
                <p className="text-sm text-[#B0BEC5]">Total Cost</p>
                <p className="text-2xl font-bold text-[#00C853]">${totalCost.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="h-40 flex items-end gap-2">
              {tokenUsage.slice(-7).map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
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
            {Object.entries(tokenSummary.operationCosts).length > 0 ? (
              Object.entries(tokenSummary.operationCosts).map(([operation, cost]) => (
                <div key={operation} className="p-4 bg-[#132F4C] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#B0BEC5] capitalize">{operation.replace("_", " ")}</span>
                    <span className="text-white font-medium">${cost.toFixed(4)}</span>
                  </div>
                  <div className="h-2 bg-[#1E3A5F] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full"
                      style={{ 
                        width: `${(cost / tokenSummary.totalCost) * 100}%`,
                        backgroundColor: operationColors[operation] || "#00C853"
                      }} 
                    />
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="p-4 bg-[#132F4C] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#B0BEC5]">Resume Parsing</span>
                    <span className="text-white font-medium">$0.00</span>
                  </div>
                  <div className="h-2 bg-[#1E3A5F] rounded-full overflow-hidden">
                    <div className="h-full w-[0%] bg-[#00C853] rounded-full" />
                  </div>
                </div>
                <div className="p-4 bg-[#132F4C] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#B0BEC5]">Candidate Scoring</span>
                    <span className="text-white font-medium">$0.00</span>
                  </div>
                  <div className="h-2 bg-[#1E3A5F] rounded-full overflow-hidden">
                    <div className="h-full w-[0%] bg-[#00E676] rounded-full" />
                  </div>
                </div>
                <div className="p-4 bg-[#132F4C] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#B0BEC5]">AI Calls</span>
                    <span className="text-white font-medium">$0.00</span>
                  </div>
                  <div className="h-2 bg-[#1E3A5F] rounded-full overflow-hidden">
                    <div className="h-full w-[0%] bg-[#FFB300] rounded-full" />
                  </div>
                </div>
              </>
            )}
            
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
            <div className="p-4 bg-[#132F4C] rounded-lg">
              <p className="text-sm text-[#B0BEC5]">Total Cost</p>
              <p className="text-xl font-bold text-[#00C853]">${tokenSummary.totalCost.toFixed(4)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
