"use client";

import React, { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** A clearly visible checkbox with a 44 × 44 px click area (the whole label), for selecting rows. */
export function SelectBox({ checked, indeterminate = false, onChange, label, disabled = false, className = "",
  testId }: {
  checked: boolean; indeterminate?: boolean; onChange: (checked: boolean) => void; label: string;
  disabled?: boolean; className?: string; testId?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  const on = checked || indeterminate;
  return (
    <label className={cn("relative inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-white/5", className)} title={label}
      data-testid={testId}>
      <input ref={input} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled}
        aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className={cn(
        "flex items-center justify-center w-[22px] h-[22px] rounded-md border-2 transition-colors",
        "peer-focus-visible:ring-2 peer-focus-visible:ring-[#00C853] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0A1929]",
        on ? "bg-[#00C853] border-[#00C853] text-[#0A1929]" : "bg-[#0A1929] border-[#CFD8DC] hover:border-white")}>
        {checked ? <Check size={16} strokeWidth={3.5} /> : indeterminate ? <Minus size={16} strokeWidth={3.5} /> : null}
      </span>
    </label>
  );
}
