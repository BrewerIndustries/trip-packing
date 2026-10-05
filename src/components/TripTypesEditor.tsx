"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { COLORS, type ListType, type TripType } from "@/lib/types";
import { Empty, IconPicker, Label, Modal } from "./ui";

export default function TripTypesEditor({ initial, listTypes }: { initial: TripType[]; listTypes: ListType[] }) {
  const [types, setTypes] = useState(initial);
  const [editing, setEditing] = useState<TripType | "new" | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setTypes((await api<{ tripTypes: TripType[] }>("/api/trip-types")).tripTypes);
  }, []);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); }
    await reload().catch(() => {});
  }, [reload]);

  function toggle(t: TripType, listTypeId: string) {
    const required = !t.listTypeIds.includes(listTypeId);
    // Optimistic flip so the matrix feels instant.
    setTypes((all) => all.map((x) => x.id !== t.id ? x : {
      ...x, listTypeIds: required ? [...x.listTypeIds, listTypeId] : x.listTypeIds.filter((i) => i !== listTypeId),
    }));
    run(() => api("/api/requirements", "PUT", { tripTypeId: t.id, listTypeId, required }));
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= types.length) return;
    const next = [...types];
    [next[idx], next[j]] = [next[j], next[idx]];
    setTypes(next);
    run(() => api("/api/reorder", "POST", { kind: "trip_types", ids: next.map((t) => t.id) }));
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Trip types</h1>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>+ New trip type</button>
      </div>
      <p className="mb-4 text-[14px] text-[var(--muted)]">
        Tap a list to toggle whether this kind of trip requires it. New trips of that type start with every required list.
      </p>
      {error && <p className="mb-3 text-[13px] text-[var(--danger)]">{error}</p>}
      {types.length === 0 && <Empty>No trip types yet — make one like “Beach Vacation”.</Empty>}

      <div className="space-y-3">
        {types.map((t, idx) => {
          const count = listTypes.filter((l) => t.listTypeIds.includes(l.id)).reduce((n, l) => n + l.items.length, 0);
          return (
            <section key={t.id} className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[24px] leading-none">{t.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-bold">{t.name}</div>
                  <div className="text-[12px] text-[var(--muted)]">
                    {t.listTypeIds.length} list{t.listTypeIds.length === 1 ? "" : "s"} · {count} items
                  </div>
                </div>
                <button className="icon-btn" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Move up">↑</button>
                <button className="icon-btn" disabled={idx === types.length - 1} onClick={() => move(idx, 1)} aria-label="Move down">↓</button>
                <button className="icon-btn" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>✎</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {listTypes.map((l) => {
                  const on = t.listTypeIds.includes(l.id);
                  const c = COLORS[l.color];
                  return (
                    <button
                      key={l.id}
                      onClick={() => toggle(t, l.id)}
                      aria-pressed={on}
                      className="rounded-full border px-2.5 py-1 text-[13px] font-semibold transition"
                      style={on
                        ? { background: c.chip, color: c.ink, borderColor: c.dot }
                        : { background: "transparent", color: "var(--muted)", borderColor: "var(--line)", opacity: 0.75 }}
                    >
                      {on ? "✓" : "+"} {l.icon} {l.name}
                    </button>
                  );
                })}
                {listTypes.length === 0 && <span className="text-[13px] text-[var(--muted)]">Make some lists first.</span>}
              </div>
            </section>
          );
        })}
      </div>

      {editing && (
        <TripTypeModal
          type={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (b) => {
            const target = editing;
            setEditing(null);
            await run(() => target === "new"
              ? api("/api/trip-types", "POST", b)
              : api(`/api/trip-types/${target.id}`, "PATCH", b));
          }}
          onDelete={editing === "new" ? undefined : async () => {
            const target = editing;
            if (!confirm(`Delete the "${target.name}" trip type? Existing trips keep their lists.`)) return;
            setEditing(null);
            await run(() => api(`/api/trip-types/${target.id}`, "DELETE"));
          }}
        />
      )}
    </div>
  );
}

function TripTypeModal({
  type, onClose, onSave, onDelete,
}: { type: TripType | null; onClose: () => void; onSave: (b: { name: string; icon: string }) => void; onDelete?: () => void }) {
  const [name, setName] = useState(type?.name ?? "");
  const [icon, setIcon] = useState(type?.icon ?? "✈️");
  return (
    <Modal title={type ? "Edit trip type" : "New trip type"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave({ name, icon }); }}>
        <label className="block"><Label>Name</Label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Road Trip, Wedding" />
        </label>
        <div><Label>Icon</Label><IconPicker value={icon} onChange={setIcon} /></div>
        <div className="flex items-center justify-between gap-2">
          {onDelete ? <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!name.trim()}>Save</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
