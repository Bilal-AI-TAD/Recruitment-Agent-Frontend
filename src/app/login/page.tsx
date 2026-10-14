"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { COMPANY_NAME } from "@/lib/utils";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

function ErrorModal({ isOpen, onClose, title, message }: ErrorModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-[#1a2a3a] border border-red-500/30 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="text-red-500" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="text-sm text-red-400">Error</p>
              </div>
            </div>
            
            <p className="text-gray-300 mb-6">{message}</p>
            
            <Button onClick={onClose} className="w-full" variant="danger">
              Try Again
            </Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: "",
  });
  const { login, user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A1929] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00C853] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (error: any) {
      let errorTitle = "Login Failed";
      let errorMessage = "An unexpected error occurred. Please try again.";
      
      const detail = error.response?.data?.detail;
      
      if (detail) {
        if (typeof detail === "string") {
          if (detail.includes("Invalid") || detail.includes("password")) {
            errorTitle = "Invalid Credentials";
            errorMessage = "The email or password you entered is incorrect. Please check your credentials and try again.";
          } else {
            errorMessage = detail;
          }
        } else if (typeof detail === "object" && detail !== null) {
          errorMessage = detail.error?.details || detail.message || JSON.stringify(detail);
        }
      }
      
      setErrorModal({
        isOpen: true,
        title: errorTitle,
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0A1929] relative overflow-hidden">
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />

      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00C853" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-[40%] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A1929] to-[#132F4C]" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 z-10">
          <motion.div 
            animate={{ 
              boxShadow: ["0 0 5px #00C853", "0 0 30px #00C853", "0 0 5px #00C853"]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#00C853] to-[#00E676] flex items-center justify-center mb-8"
          >
            <span className="text-white font-bold text-3xl">TAD</span>
          </motion.div>
          
          <h1 className="text-4xl font-bold text-white mb-4 text-center">
            {COMPANY_NAME}
          </h1>
          <p className="text-xl text-[#B0BEC5] mb-8">Recruitment Agent</p>
          
          <div className="absolute bottom-0 left-0 right-0 h-32">
            <svg className="absolute bottom-0 w-full" viewBox="0 0 400 120" preserveAspectRatio="none">
              <motion.path
                d="M0,60 C100,120 200,0 300,60 C350,90 400,30 400,30 L400,120 L0,120 Z"
                fill="url(#waveGradient)"
                initial={{ d: "M0,60 C100,60 200,60 300,60 C350,60 400,60 400,60 L400,120 L0,120 Z" }}
                animate={{ 
                  d: [
                    "M0,60 C100,120 200,0 300,60 C350,90 400,30 400,30 L400,120 L0,120 Z",
                    "M0,60 C100,0 200,120 300,60 C350,30 400,90 400,90 L400,120 L0,120 Z",
                    "M0,60 C100,120 200,0 300,60 C350,90 400,30 400,30 L400,120 L0,120 Z"
                  ]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00C853" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00C853" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </motion.div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="bg-[#132F4C]/80 backdrop-blur-xl border border-[#2A3F5E] rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-[#B0BEC5]">Sign in to continue to your dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                type="email"
                label="Email Address"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail size={18} />}
                required
              />

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock size={18} />}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-[#546E7A] hover:text-[#00C853] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isLoading}
              >
                Sign In
              </Button>
            </form>

            <p className="mt-6 text-center text-[#B0BEC5]">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-[#00C853] hover:underline font-medium">
                Request access
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
