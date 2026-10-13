"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User, Briefcase, X, AlertCircle } from "lucide-react";
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

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "hr",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: "",
  });
  const { register, user, isLoading: authLoading } = useAuth();
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setErrorModal({
        isOpen: true,
        title: "Password Mismatch",
        message: "The passwords you entered do not match. Please make sure both passwords are the same.",
      });
      return;
    }
    
    if (formData.password.length < 6) {
      setErrorModal({
        isOpen: true,
        title: "Weak Password",
        message: "Password must be at least 6 characters long.",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      await register({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      router.push("/dashboard");
    } catch (error: any) {
      let errorTitle = "Registration Failed";
      let errorMessage = "An unexpected error occurred. Please try again.";
      
      const detail = error.response?.data?.detail;
      
      if (detail) {
        if (typeof detail === "string") {
          if (detail.includes("already") || detail.includes("exist")) {
            errorTitle = "Account Already Exists";
            errorMessage = "An account with this email already exists. Please try logging in instead.";
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

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-[#132F4C]/80 backdrop-blur-xl border border-[#2A3F5E] rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
              <p className="text-[#B0BEC5]">{`Join the ${COMPANY_NAME} Recruitment Agent`}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  name="first_name"
                  label="First Name"
                  placeholder="John"
                  value={formData.first_name}
                  onChange={handleChange}
                  icon={<User size={18} />}
                  required
                />
                <Input
                  name="last_name"
                  label="Last Name"
                  placeholder="Doe"
                  value={formData.last_name}
                  onChange={handleChange}
                  icon={<User size={18} />}
                  required
                />
              </div>

              <Input
                type="email"
                name="email"
                label="Email Address"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                icon={<Mail size={18} />}
                required
              />

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  label="Password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  icon={<Lock size={18} />}
                  required
                />
              </div>

              <Input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                label="Confirm Password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                icon={<Lock size={18} />}
                required
              />

              <div>
                <label className="block text-sm font-medium text-[#B0BEC5] mb-1.5">
                  Role
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0BEC5]" size={18} />
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/20 transition-all appearance-none"
                  >
                    <option value="hr">HR Manager</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex items-center gap-2 text-sm text-[#B0BEC5] hover:text-[#00C853] transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                {showPassword ? "Hide" : "Show"} passwords
              </button>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isLoading}
              >
                Create Account
              </Button>
            </form>

            <p className="mt-6 text-center text-[#B0BEC5]">
              Already have an account?{" "}
              <Link href="/login" className="text-[#00C853] hover:underline font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-[40%] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-bl from-[#0A1929] to-[#132F4C]" />
        
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
                fill="url(#waveGradient2)"
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
                <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00C853" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00C853" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
