"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Briefcase,
  Users,
  TrendingUp,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { analyticsAPI } from "@/lib/api";

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numValue = typeof value === 'number' ? value : 0;
    let start = 0;
    const duration = 1500;
    const increment = numValue / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= numValue) {
        setDisplayValue(numValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue}{suffix}</span>;
}

function MetricCard({
  title,
  value,
  suffix,
  trend,
  icon: Icon,
  delay,
}: {
  title: string;
  value: number;
  suffix?: string;
  trend?: { value: number; positive: boolean };
  icon: React.ElementType;
  delay: number;
}) {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="h-full min-h-[140px]"
    >
      <Card hover className="relative overflow-hidden h-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between h-full">
            <div>
              <p className="text-[#B0BEC5] text-sm mb-1">{title}</p>
              <p className="text-3xl font-bold text-white">
                <AnimatedNumber value={safeValue} suffix={suffix} />
              </p>
              {trend && (
                <p className={`text-sm mt-2 ${trend.positive ? "text-[#00C853]" : "text-[#FF5252]"}`}>
                  <ArrowUpRight size={14} className="inline mr-1" />
                  +{trend.value} this month
                </p>
              )}
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#00C853]/20 flex items-center justify-center">
              <Icon className="text-[#00C853]" size={24} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00C853] to-[#00E676] opacity-50" />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TrendChart({ tokenUsage }: { tokenUsage: any[] }) {
  const safeUsage = Array.isArray(tokenUsage) ? tokenUsage : [];
  const validUsage = safeUsage.filter(d => d && typeof d === 'object' && typeof d.tokens === 'number');
  const maxTokens = validUsage.length > 0 ? Math.max(...validUsage.map(d => d.tokens), 1) : 1;

  if (validUsage.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Usage Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#B0BEC5] text-center py-8">No token usage data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Usage Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-end justify-between gap-2">
          {validUsage.slice(-7).map((item, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(item.tokens / maxTokens) * 100}%` }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="w-full bg-[#00C853]/30 rounded-t-lg relative group"
              >
                <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#132F4C] text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {item.tokens.toLocaleString()} tokens
                </div>
              </motion.div>
              <span className="text-xs text-[#B0BEC5]">{item.date?.slice(5) || ""}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#00C853]" />
            <span className="text-sm text-[#B0BEC5]">Tokens Used</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreDistribution({ distribution }: { distribution: any[] }) {
  const safeDistribution = Array.isArray(distribution) ? distribution : [];
  const colors: Record<string, string> = {
    "90-100": "#00E676",
    "80-89": "#00C853",
    "70-79": "#FFB300",
    "60-69": "#FF9800",
    "Below 60": "#FF5252",
  };

  const validDistribution = safeDistribution.filter(item => 
    item && typeof item === 'object' && typeof item.name === 'string'
  );

  if (validDistribution.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#B0BEC5] text-center py-4">No score data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {validDistribution.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-4"
            >
              <span className="text-sm text-[#B0BEC5] w-20">{item.name}</span>
              <div className="flex-1 h-4 bg-[#132F4C] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.value}%` }}
                  transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: colors[item.name] || "#00C853" }}
                />
              </div>
              <span className="text-sm text-white w-8">{item.value}%</span>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityFeed({ activities }: { activities: any[] }) {
  const safeActivities = Array.isArray(activities) ? activities : [];
  const validActivities = safeActivities.filter(a => a && typeof a === 'object');
  
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {validActivities.length === 0 ? (
            <p className="text-center text-[#B0BEC5] py-4">No recent activity</p>
          ) : (
            validActivities.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#132F4C] transition-colors cursor-pointer"
              >
                <div className="relative mt-1">
                  <div className={`w-2 h-2 rounded-full bg-[#00C853]`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white">{item.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-[#546E7A]">{formatTime(item.timestamp || "")}</p>
                    {item.cost != null && item.cost > 0 && (
                      <span className="text-xs text-[#00C853]">${Number(item.cost).toFixed(4)}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState({
    totalJobs: 0,
    totalCandidates: 0,
    avgScore: 0,
    interviewsToday: 0,
  });
  const [tokenUsage, setTokenUsage] = useState<any[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, tokenRes, distRes, activityRes] = await Promise.all([
          analyticsAPI.getDashboardMetrics(),
          analyticsAPI.getTokenUsage("daily"),
          analyticsAPI.getScoreDistribution(),
          analyticsAPI.getRecentActivity(8),
        ]);
        
        setMetrics(metricsRes?.data || { totalJobs: 0, totalCandidates: 0, avgScore: 0, interviewsToday: 0 });
        setTokenUsage(tokenRes?.data?.data || tokenRes?.data || []);
        setScoreDistribution(distRes?.data || distRes || []);
        setActivities(activityRes?.data || activityRes || []);
      } catch (error: any) {
        console.error("Failed to fetch dashboard data:", error);
        setMetrics({ totalJobs: 0, totalCandidates: 0, avgScore: 0, interviewsToday: 0 });
        setTokenUsage([]);
        setScoreDistribution([]);
        setActivities([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-[#B0BEC5]">Welcome back! Here&apos;s your hiring overview.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="h-full cursor-pointer" onClick={() => router.push('/dashboard/jobs')}>
          <MetricCard
            title="Total Jobs"
            value={metrics.totalJobs}
            trend={{ value: 3, positive: true }}
            icon={Briefcase}
            delay={0}
          />
        </div>
        <div className="h-full cursor-pointer" onClick={() => router.push('/dashboard/candidates')}>
          <MetricCard
            title="Total Candidates"
            value={metrics.totalCandidates}
            trend={{ value: 12, positive: true }}
            icon={Users}
            delay={0.1}
          />
        </div>
        <div className="h-full">
          <MetricCard
            title="Average Score"
            value={metrics.avgScore}
            suffix="%"
            icon={TrendingUp}
            delay={0.2}
          />
        </div>
        <div className="h-full cursor-pointer" onClick={() => router.push('/dashboard/interviews')}>
          <MetricCard
            title="Interviews Today"
            value={metrics.interviewsToday}
            icon={Calendar}
            delay={0.3}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart tokenUsage={tokenUsage} />
        <ScoreDistribution distribution={scoreDistribution} />
      </div>

      <ActivityFeed activities={activities} />
    </div>
  );
}
