"use client";

import React, { useState } from "react";
import { Search, Bell, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export function TopBar() {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleSettings = () => {
    setShowDropdown(false);
    router.push("/dashboard/system");
  };

  return (
    <header className="h-16 bg-[#0A1929]/80 backdrop-blur-md border-b border-[#2A3F5E] flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#546E7A]" size={18} />
          <input
            type="text"
            placeholder="Search jobs, candidates..."
            className="w-full pl-10 pr-4 py-2 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white placeholder-[#546E7A] focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-[#132F4C] text-[#B0BEC5] hover:text-[#00C853] transition-colors">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#00C853] rounded-full animate-pulse" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1.5 pr-3 rounded-lg hover:bg-[#132F4C] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00C853] to-[#00E676] flex items-center justify-center text-white text-sm font-medium ring-2 ring-transparent hover:ring-[#00C853] transition-all">
              {user?.first_name?.[0] || "U"}
            </div>
            <span className="text-sm text-white">{user?.first_name}</span>
            <ChevronDown size={16} className="text-[#B0BEC5]" />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-48 bg-[#132F4C] border border-[#2A3F5E] rounded-lg shadow-lg overflow-hidden"
              >
                <div className="p-3 border-b border-[#2A3F5E]">
                  <p className="text-sm text-white font-medium">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-[#B0BEC5]">{user?.email}</p>
                </div>
                <div className="p-1">
                  <button 
                    onClick={handleSettings}
                    className="w-full text-left px-3 py-2 text-sm text-[#B0BEC5] hover:bg-[#1E3A5F] hover:text-white rounded transition-colors"
                  >
                    Settings
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-[#FF5252] hover:bg-[#FF5252]/10 rounded transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
