"use client";

import { useEffect } from "react";
import { COLORS, COLOR_KEYS, type ColorKey } from "@/lib/types";

export function Modal({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
          <h2 className="text-[16px] font-bold">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">{children}</span>;
}

export function Progress({ packed, total, big }: { packed: number; total: number; big?: boolean }) {
  const pct = total ? Math.round((packed / total) * 100) : 0;
  const done = total > 0 && packed === total;
  return (
    <div className={`w-full overflow-hidden rounded-full bg-[var(--sunk)] ${big ? "h-3" : "h-2"}`}>
      <div
        className="bar-fill h-full rounded-full"
        style={{ width: `${pct}%`, background: done ? "var(--good)" : "var(--accent)" }}
      />
    </div>
  );
}

export function Chip({ icon, name, color }: { icon: string; name: string; color: ColorKey }) {
  const c = COLORS[color];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
      style={{ background: c.chip, color: c.ink }}
    >
      <span aria-hidden>{icon}</span>
      {name}
    </span>
  );
}

const ICONS = ["🎒", "🪥", "👕", "🔌", "✈️", "🏖️", "💼", "🧣", "🏕️", "👶", "🐶", "💊", "📷", "🎿", "⛳", "🏋️", "🍼", "🚗", "🏝️", "⛷️", "🏙️", "🎉", "💍", "🚢"];

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input
        className="field !w-14 text-center"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Icon"
        maxLength={8}
      />
      {ICONS.map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`h-8 w-8 rounded-lg text-[17px] ${value === i ? "bg-[var(--sunk)] ring-2 ring-[var(--accent)]" : "hover:bg-[var(--sunk)]"}`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (v: ColorKey) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          aria-label={k}
          className={`h-7 w-7 rounded-full ${value === k ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--card)]" : ""}`}
          style={{ background: COLORS[k].dot }}
        />
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] px-6 py-10 text-center text-[var(--muted)]">
      {children}
    </div>
  );
}

/**
 * Quantity with its mode: "Count" is a fixed number; "Per day" is an amount per
 * day of the trip, so the packed quantity follows the trip's length.
 * `days` (when known) shows what a per-day amount works out to.
 */
export function QtyField({
  qty, perDay, onQty, onPerDay, days, compact,
}: {
  qty: number; perDay: boolean; onQty: (n: number) => void; onPerDay: (b: boolean) => void;
  days?: number; compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg bg-[var(--sunk)] p-0.5 text-[13px]" role="radiogroup" aria-label="Quantity type">
        {([["Count", false], ["Per day", true]] as const).map(([label, v]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={perDay === v}
            onClick={() => onPerDay(v)}
            className={`rounded-md px-2.5 py-1 font-semibold ${
              perDay === v ? "bg-[var(--card)] shadow-sm" : "text-[var(--muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="number" min={1} max={999}
        className={`field !w-16 ${compact ? "!bg-[var(--card)]" : ""}`}
        value={qty}
        onChange={(e) => onQty(Math.max(1, Number(e.target.value) || 1))}
        aria-label={perDay ? "Quantity per day" : "Quantity"}
      />
      {perDay && (
        <span className="text-[12px] text-[var(--muted)]">
          per day{days ? ` → ${qty * days} for ${days} day${days === 1 ? "" : "s"}` : ""}
        </span>
      )}
    </div>
  );
}

/** "×2" for a count, "2/day" for a per-day amount (nothing for a single item). */
export function qtyLabel(qty: number, perDay: boolean): string {
  if (perDay) return `${qty}/day`;
  return qty > 1 ? `×${qty}` : "";
}
