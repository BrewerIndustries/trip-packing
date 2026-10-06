"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Swipe-left-to-delete for list rows, plus a delete that waits a few seconds
// behind an Undo toast. Undo just cancels — nothing is re-created — so an
// undone item keeps its id, master-list link and packed state.

const OPEN_AT = 88;        // px the row rests at when the Delete button is revealed
const FULL_SWIPE = 0.45;   // fraction of the row width that deletes on release

/** A row that slides left to reveal Delete; a long swipe deletes outright. */
export function SwipeRow({
  onDelete, label, children, className = "",
}: { onDelete: () => void; label: string; children: React.ReactNode; className?: string }) {
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; dir: "x" | "y" | null } | null>(null);
  const moved = useRef(false);
  const row = useRef<HTMLLIElement>(null);

  const settle = (to: number) => { setAnim(true); setDx(to); };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, base: dx, dir: null };
    moved.current = false;
    setAnim(false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.dir) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      // Decide once: vertical drags scroll the page, horizontal ones swipe.
      s.dir = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (s.dir === "x") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (s.dir !== "x") return;
    moved.current = true;
    setDx(Math.min(0, s.base + mx));
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s || s.dir !== "x") return;
    const w = row.current?.offsetWidth ?? 320;
    if (-dx > w * FULL_SWIPE) {
      settle(-w);
      setTimeout(onDelete, 160);
    } else if (-dx > OPEN_AT / 2) {
      settle(-OPEN_AT);
    } else {
      settle(0);
    }
  };
  // A drag must not also count as a tap on the row (which would pack it).
  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current) {
      e.stopPropagation();
      e.preventDefault();
      moved.current = false;
    } else if (dx !== 0) {
      e.stopPropagation();
      settle(0);
    }
  };

  // Close when the user taps or swipes another row.
  useEffect(() => {
    if (dx === 0) return;
    const close = (ev: PointerEvent) => {
      if (row.current && !row.current.contains(ev.target as Node)) settle(0);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [dx]);

  return (
    <li ref={row} className={`relative overflow-hidden ${className}`}>
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-[var(--danger)] px-5 text-[14px] font-semibold text-white"
        style={{ width: Math.max(OPEN_AT, -dx) }}
        onClick={() => { settle(-(row.current?.offsetWidth ?? 320)); setTimeout(onDelete, 160); }}
        aria-label={`Delete ${label}`}
        tabIndex={dx === 0 ? -1 : 0}
      >
        Delete
      </button>
      <div
        className="relative bg-[var(--card)]"
        style={{
          transform: `translateX(${dx}px)`,
          transition: anim ? "transform 160ms ease-out" : "none",
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </li>
  );
}

const UNDO_MS = 5000;

/**
 * Hide an item now, really delete it after a few seconds unless undone. Only
 * one delete is pending at a time; starting another commits the previous one.
 * A pending delete is also committed if the page goes away.
 */
export function useDeferredDelete(commit: (id: string) => Promise<unknown>) {
  const [pending, setPending] = useState<{ id: string; label: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef<{ id: string; label: string } | null>(null);
  const commitRef = useRef(commit);
  useEffect(() => { commitRef.current = commit; }, [commit]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = current.current;
    current.current = null;
    setPending(null);
    if (p) commitRef.current(p.id).catch(() => {});
  }, []);

  const remove = useCallback((id: string, label: string) => {
    flush();
    current.current = { id, label };
    setPending({ id, label });
    timer.current = setTimeout(flush, UNDO_MS);
  }, [flush]);

  const undo = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    current.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); flush(); };
  }, [flush]);

  return { pendingId: pending?.id ?? null, pending, remove, undo };
}

export function UndoToast({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4" role="status">
      <div className="flex max-w-full items-center gap-3 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[14px] text-[var(--bg)] shadow-lg">
        <span className="truncate">Deleted {label}</span>
        <button className="shrink-0 font-bold text-[var(--accent)]" onClick={onUndo}>Undo</button>
      </div>
    </div>
  );
}
