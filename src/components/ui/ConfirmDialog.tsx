"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

/** A small modal confirmation. Escape or the backdrop cancels; focus starts on Cancel (the safe choice). */
export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, busy = false,
  variant = "danger", testId = "confirm-dialog" }: {
  open: boolean; title: string; message: React.ReactNode; confirmLabel: string; onConfirm: () => void;
  onCancel: () => void; busy?: boolean; variant?: "danger" | "primary"; testId?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby={`${testId}-title`} data-testid={testId}
        className="relative w-full max-w-md rounded-2xl border border-[#2A3F5E] bg-[#1a2a3a] p-6 shadow-2xl">
        <h3 id={`${testId}-title`} className="text-lg font-semibold text-white mb-2">{title}</h3>
        <div className="text-sm text-[#B0BEC5] mb-5">{message}</div>
        <div className="flex justify-end gap-3">
          <Button data-cancel variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} isLoading={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
