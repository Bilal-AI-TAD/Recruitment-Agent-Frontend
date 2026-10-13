"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAuth } from "@/context/AuthContext";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A1929] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00C853] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0A1929]">
      <Sidebar />
      <div className="ml-[260px] transition-all duration-25">
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
