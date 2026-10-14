"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, COMPANY_NAME, INTERVIEW_FEATURES_ENABLED } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  Phone,
  Settings,
  Database,
  UserCog,
  Send,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Briefcase, label: "Jobs", href: "/dashboard/jobs" },
  { icon: Users, label: "Candidates", href: "/dashboard/candidates" },
  { icon: Database, label: "Candidate Pool", href: "/dashboard/candidate-pool" },
  // AI calls and interview scheduling are not part of the current release.
  ...(INTERVIEW_FEATURES_ENABLED
    ? [
        { icon: Calendar, label: "Interviews", href: "/dashboard/interviews" },
        { icon: Phone, label: "AI Calls", href: "/dashboard/ai-calls" },
      ]
    : []),
  { icon: Settings, label: "System", href: "/dashboard/system" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  // Owners (accounts.manage) see the Accounts page; the server enforces it regardless.
  const perms = user?.permissions || [];
  const items = [
    ...navItems,
    ...(["mail.send", "mail.approve_send", "accounts.manage"].some((p) => perms.includes(p))
      ? [{ icon: Send, label: "Outbox", href: "/dashboard/outbox" }] : []),
    ...(perms.includes("accounts.manage") ? [{ icon: UserCog, label: "Accounts", href: "/dashboard/accounts" }] : []),
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen bg-[#0A1929] border-r border-[#2A3F5E] z-50 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-[#2A3F5E]">
        <motion.div
          className="flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C853] to-[#00E676] flex items-center justify-center">
            <span className="text-white font-bold text-xs">TAD</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-white font-semibold text-sm whitespace-nowrap">{COMPANY_NAME}</span>
            <span className="text-[#B0BEC5] text-xs whitespace-nowrap">Recruitment Agent</span>
          </div>
        </motion.div>
      </div>

      <nav className="flex-1 py-4 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 group relative",
                isActive
                  ? "bg-[#00C853]/10 text-[#00C853]"
                  : "text-[#B0BEC5] hover:bg-[#132F4C] hover:text-[#00C853]"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#00C853] rounded-r-full"
                />
              )}
              <item.icon
                size={20}
                className={cn("flex-shrink-0", isActive && "text-[#00C853]")}
              />
              <span className="text-sm font-medium whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </motion.aside>
  );
}
