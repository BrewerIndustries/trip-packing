"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { ColorKey, ListItem, ListType, TripType } from "@/lib/types";
import { Chip, ColorPicker, Empty, IconPicker, Label, Modal, QtyField, qtyLabel } from "./ui";

export default function ListsEditor({ initial, tripTypes }: { initial: ListType[]; tripTypes: TripType[] }) {
  const [lists, setLists] = useState(initial);
  const [editing, setEditing] = useState<ListType | "new" | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLists((await api<{ listTypes: ListType[] }>("/api/list-types")).listTypes);
  }, []);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); }
    await reload().catch(() => {});
  }, [reload]);

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= lists.length) return;
    const next = [...lists];
    [next[idx], next[j]] = [next[j], next[idx]];
    setLists(next);
    run(() => api("/api/reorder", "POST", { kind: "list_types", ids: next.map((l) => l.id) }));
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Lists</h1>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>+ New list</button>
      </div>
      <p className="mb-4 text-[14px] text-[var(--muted)]">
        Reusable packing lists. Trip types pick which of these they need; a new trip copies them in.
        Editing a list here doesn&apos;t change existing trips — they can pull in updates.
      </p>
      {error && <p className="mb-3 text-[13px] text-[var(--danger)]">{error}</p>}
      {lists.length === 0 && <Empty>No lists yet — make one like “Toiletries” or “Beach”.</Empty>}

      <div className="space-y-4">
        {lists.map((l, idx) => (
          <ListCard
            key={l.id}
            list={l}
            tripTypes={tripTypes}
            first={idx === 0}
            last={idx === lists.length - 1}
            onMove={(d) => move(idx, d)}
            onEdit={() => setEditing(l)}
            run={run}
          />
        ))}
      </div>

      {editing && (
        <ListTypeModal
          list={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (b) => {
            const target = editing;
            setEditing(null);
            await run(() => target === "new"
              ? api("/api/list-types", "POST", b)
              : api(`/api/list-types/${target.id}`, "PATCH", b));
          }}
          onDelete={editing === "new" ? undefined : async () => {
            const target = editing;
            if (!confirm(`Delete the "${target.name}" list? Existing trips keep their copy.`)) return;
            setEditing(null);
            await run(() => api(`/api/list-types/${target.id}`, "DELETE"));
          }}
        />
      )}
    </div>
  );
}

function ListCard({
  list, tripTypes, first, last, onMove, onEdit, run,
}: {
  list: ListType; tripTypes: TripType[]; first: boolean; last: boolean;
  onMove: (d: -1 | 1) => void; onEdit: () => void; run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [perDay, setPerDay] = useState(false);
  const usedBy = tripTypes.filter((t) => list.tripTypeIds.includes(t.id));

  function moveItem(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= list.items.length) return;
    const ids = list.items.map((i) => i.id);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    run(() => api("/api/reorder", "POST", { kind: "list_items", ids }));
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <Chip icon={list.icon} name={list.name} color={list.color} />
        <span className="text-[12px] text-[var(--muted)]">{list.items.length} items</span>
        <div className="ml-auto flex items-center">
          <button className="icon-btn" disabled={first} onClick={() => onMove(-1)} aria-label="Move list up">↑</button>
          <button className="icon-btn" disabled={last} onClick={() => onMove(1)} aria-label="Move list down">↓</button>
          <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${list.name}`}>✎</button>
        </div>
        <div className="w-full text-[12px] text-[var(--muted)]">
          {usedBy.length ? <>Required by {usedBy.map((t) => `${t.icon} ${t.name}`).join(", ")}</> : "Not required by any trip type (can still be added to a trip)"}
        </div>
      </div>
      <ul>
        {list.items.map((i, idx) => (
          <ItemRow
            key={i.id}
            item={i}
            first={idx === 0}
            last={idx === list.items.length - 1}
            onMove={(d) => moveItem(idx, d)}
            run={run}
          />
        ))}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2 bg-[var(--sunk)] px-3 py-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await run(() => api(`/api/list-types/${list.id}/items`, "POST", { name, qty, perDay }));
          setName(""); setQty(1); setPerDay(false);
        }}
      >
        <input className="field min-w-0 flex-1 basis-36 !bg-[var(--card)]" placeholder="Add item…" value={name} onChange={(e) => setName(e.target.value)} aria-label={`New item for ${list.name}`} />
        <QtyField qty={qty} perDay={perDay} onQty={setQty} onPerDay={setPerDay} compact />
        <button className="btn btn-sm" disabled={!name.trim()}>Add</button>
      </form>
    </section>
  );
}

function ItemRow({
  item, first, last, onMove, run,
}: { item: ListItem; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty);
  const [perDay, setPerDay] = useState(item.perDay);
  const [note, setNote] = useState(item.note);

  if (editing) {
    return (
      <li className="border-b border-[var(--line)] px-3 py-2">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setEditing(false);
            await run(() => api(`/api/list-items/${item.id}`, "PATCH", { name, qty, perDay, note }));
          }}
        >
          <input className="field min-w-0 flex-1 basis-36" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Name" />
          <QtyField qty={qty} perDay={perDay} onQty={setQty} onPerDay={setPerDay} />
          <input className="field basis-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
          <div className="flex w-full justify-between gap-2">
            <button type="button" className="btn btn-sm btn-danger" onClick={() => run(() => api(`/api/list-items/${item.id}`, "DELETE"))}>Delete</button>
            <div className="flex gap-2">
              <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-sm btn-primary">Save</button>
            </div>
          </div>
        </form>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-1.5">
      <button className="min-w-0 flex-1 py-1 text-left" onClick={() => setEditing(true)}>
        <span className="text-[15px]">{item.name}</span>
        {qtyLabel(item.qty, item.perDay) && (
          <span className="ml-1.5 text-[13px] font-semibold text-[var(--muted)]">{qtyLabel(item.qty, item.perDay)}</span>
        )}
        {item.note && <span className="block truncate text-[12px] text-[var(--muted)]">{item.note}</span>}
      </button>
      <button className="icon-btn" disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${item.name} up`}>↑</button>
      <button className="icon-btn" disabled={last} onClick={() => onMove(1)} aria-label={`Move ${item.name} down`}>↓</button>
    </li>
  );
}

function ListTypeModal({
  list, onClose, onSave, onDelete,
}: {
  list: ListType | null; onClose: () => void;
  onSave: (b: { name: string; icon: string; color: ColorKey }) => void; onDelete?: () => void;
}) {
  const [name, setName] = useState(list?.name ?? "");
  const [icon, setIcon] = useState(list?.icon ?? "🎒");
  const [color, setColor] = useState<ColorKey>(list?.color ?? "blue");
  return (
    <Modal title={list ? "Edit list" : "New list"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave({ name, icon, color }); }}>
        <label className="block"><Label>Name</Label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Baby, Golf, Formal" />
        </label>
        <div><Label>Icon</Label><IconPicker value={icon} onChange={setIcon} /></div>
        <div><Label>Color</Label><ColorPicker value={color} onChange={setColor} /></div>
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
