"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  icon,
  className,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[#B0BEC5] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#B0BEC5]">
            {icon}
          </div>
        )}
        <input
          className={cn(
            "w-full px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white placeholder-[#546E7A] transition-all duration-200",
            "focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/20",
            icon && "pl-10",
            error && "border-[#FF5252] focus:border-[#FF5252] focus:ring-[#FF5252]/20",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-[#FF5252]">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className,
  ...props
}: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[#B0BEC5] mb-1.5">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          "w-full px-4 py-2.5 bg-[#132F4C] border border-[#2A3F5E] rounded-lg text-white placeholder-[#546E7A] transition-all duration-200 resize-none",
          "focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/20",
          error && "border-[#FF5252] focus:border-[#FF5252] focus:ring-[#FF5252]/20",
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-[#FF5252]">{error}</p>}
    </div>
  );
}
