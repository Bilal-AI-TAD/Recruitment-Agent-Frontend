"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const GAP = 6;
const MARGIN = 8;

/** A small button that shows a panel on hover, focus or tap (click pins it; Escape / outside click closes).
 *  The panel is rendered in a portal with fixed positioning, so it is never clipped by a scrolling table and never
 *  pushes the surrounding layout; it flips above the button when there is no room below. */
export function InfoPopover({ label, children, className = "", panelClassName = "", testId }: {
  label: React.ReactNode; children: React.ReactNode; className?: string; panelClassName?: string; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const place = useCallback(() => {
    const b = button.current?.getBoundingClientRect();
    const p = panel.current;
    if (!b || !p) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.min(Math.max(b.left, MARGIN), Math.max(MARGIN, vw - p.offsetWidth - MARGIN));
    const below = b.bottom + GAP;
    const top = below + p.offsetHeight > vh - MARGIN && b.top - GAP - p.offsetHeight > MARGIN
      ? b.top - GAP - p.offsetHeight : below;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setPinned(false); button.current?.focus(); }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !panel.current?.contains(t)) { setOpen(false); setPinned(false); }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const show = () => { if (hideTimer.current) clearTimeout(hideTimer.current); setOpen(true); };
  const hideSoon = () => {
    if (pinned) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <>
      <button ref={button} type="button" className={className} aria-expanded={open} aria-describedby={open ? id : undefined}
        data-testid={testId}
        onMouseEnter={(e) => { if (e.nativeEvent instanceof MouseEvent) show(); }} onMouseLeave={hideSoon}
        onFocus={show} onBlur={() => { if (!pinned) setOpen(false); }}
        onClick={() => { setPinned((p) => !p || !open); setOpen((o) => !(o && pinned)); }}>
        {label}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div ref={panel} id={id} role="tooltip" onMouseEnter={show} onMouseLeave={hideSoon}
          data-testid={testId ? `${testId}-panel` : undefined}
          style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className={cn("z-[60] w-72 max-w-[calc(100vw-16px)] rounded-lg border border-yellow-500/40 bg-[#0F2236] p-3",
            "text-xs text-[#E0E0E0] shadow-xl", panelClassName)}>
          {children}
        </div>,
        document.body)}
    </>
  );
}
