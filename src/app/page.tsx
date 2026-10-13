"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#0A1929] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#00C853] to-[#00E676] flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-2xl">TAD</span>
        </div>
        <p className="text-[#B0BEC5]">Loading...</p>
      </div>
    </div>
  );
}
