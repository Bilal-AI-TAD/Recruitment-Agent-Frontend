"use client";

import React, { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** A textarea that grows with its content (from `minRows` up to `maxHeight`, then scrolls). */
export function AutoTextarea({ value, minRows = 3, maxHeight = 520, className, ...props }:
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; minRows?: number; maxHeight?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight + 2 > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);
  return <textarea ref={ref} value={value} rows={minRows} className={cn("resize-none", className)} {...props} />;
}
