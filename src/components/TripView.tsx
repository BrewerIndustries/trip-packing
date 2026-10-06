"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { fmtAmount, formatRange, tripDays } from "@/lib/trip-math";
import type { ListType, Trip, TripItem, TripList } from "@/lib/types";
import { Chip, Empty, Label, Modal, Progress, QtyField } from "./ui";
import type { SyncPreview } from "@/lib/db";
import type { Suggestion } from "@/lib/suggest";
import { SwipeRow, UndoToast, useDeferredDelete } from "./swipe";

const EXTRAS = "__extras";

export default function TripView({ initial, listTypes }: { initial: Trip; listTypes: ListType[] }) {
  const router = useRouter();
  const [trip, setTrip] = useState(initial);
  const [hidePacked, setHidePacked] = useState(false);
  const [editingItem, setEditingItem] = useState<TripItem | null>(null);
  const [editingTrip, setEditingTrip] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sync, setSync] = useState<SyncPreview | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const { trip: t } = await api<{ trip: Trip }>(`/api/trips/${initial.id}`);
    setTrip(t);
    setSync(await api<SyncPreview>(`/api/trips/${initial.id}/sync`));
  }, [initial.id]);

  // Check once on open whether the master lists grew since this trip was made.
  useEffect(() => {
    api<SyncPreview>(`/api/trips/${initial.id}/sync`).then(setSync).catch(() => {});
  }, [initial.id]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
      await reload().catch(() => {});
    }
  }, [reload]);

  // Swipe-to-delete: the row disappears now; the DELETE goes out after the Undo window.
  const del = useDeferredDelete(useCallback(async (id: string) => {
    await fetch(`/api/trip-items/${id}`, { method: "DELETE", keepalive: true });
    reload().catch(() => {});
  }, [reload]));
  const items = useMemo(() => trip.items.filter((i) => i.id !== del.pendingId), [trip.items, del.pendingId]);

  const packed = items.filter((i) => i.packed).length;
  const total = items.length;
  const done = total > 0 && packed === total;
  const days = tripDays(trip.startDate, trip.endDate);

  const sections = useMemo(() => {
    const out: { list: TripList | null; key: string; items: TripItem[] }[] = trip.lists.map((l) => ({
      list: l, key: l.id, items: items.filter((i) => i.tripListId === l.id),
    }));
    out.push({ list: null, key: EXTRAS, items: items.filter((i) => i.tripListId === null) });
    return out;
  }, [trip.lists, items]);

  async function toggle(item: TripItem) {
    // Optimistic: flip locally, then persist; roll back via reload on failure.
    setTrip((t) => ({ ...t, items: t.items.map((i) => (i.id === item.id ? { ...i, packed: !i.packed } : i)) }));
    try {
      await api(`/api/trip-items/${item.id}`, "PATCH", { packed: !item.packed });
    } catch (e) {
      setError((e as Error).message);
      reload().catch(() => {});
    }
  }

  const pendingSync = (sync?.newItems.length ?? 0) + (sync?.newLists.length ?? 0);
  const attachedIds = new Set(trip.lists.map((l) => l.listTypeId));

  return (
    <div>
      <Link href="/" className="text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← Trips</Link>

      <div className="mt-2 flex items-start gap-3">
        <div className="text-[38px] leading-none">{trip.tripTypeIcon || "🧳"}</div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{trip.name}</h1>
          <p className="text-[14px] text-[var(--muted)]">
            {[trip.destination, formatRange(trip.startDate, trip.endDate),
              trip.startDate ? `${days} day${days === 1 ? "" : "s"}` : "", trip.tripTypeName]
              .filter(Boolean).join(" · ") || "No details yet"}
          </p>
          {trip.note && <p className="mt-1 whitespace-pre-wrap text-[14px]">{trip.note}</p>}
        </div>
        <div className="relative">
          <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Trip menu">⋯</button>
          {menu && (
            <div className="card absolute right-0 z-30 mt-1 w-52 overflow-hidden p-1 shadow-lg" onMouseLeave={() => setMenu(false)}>
              {[
                ["✏️ Edit trip", () => setEditingTrip(true)],
                ["➕ Add a list", () => setAddingList(true)],
                ["✓ Mark all packed", () => run(() => api(`/api/trips/${trip.id}/pack-all`, "POST", { packed: true }))],
                ["↺ Unpack all", () => run(() => api(`/api/trips/${trip.id}/pack-all`, "POST", { packed: false }))],
                ["⧉ Duplicate trip", async () => {
                  const { trip: copy } = await api<{ trip: Trip }>(`/api/trips/${trip.id}/duplicate`, "POST", {});
                  router.push(`/trips/${copy.id}`);
                }],
                ["🗑 Delete trip", async () => {
                  if (!confirm(`Delete "${trip.name}"? This can't be undone.`)) return;
                  await api(`/api/trips/${trip.id}`, "DELETE");
                  router.push("/");
                  router.refresh();
                }],
              ].map(([label, fn]) => (
                <button
                  key={label as string}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-[var(--sunk)] ${
                    (label as string).includes("Delete") ? "text-[var(--danger)]" : ""
                  }`}
                  onClick={() => { setMenu(false); (fn as () => void)(); }}
                >
                  {label as string}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`card mt-4 p-4 ${done ? "all-packed" : ""}`}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[15px] font-bold">
            {done ? "🎉 All packed!" : `${packed} of ${total} packed`}
          </span>
          <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
            <input type="checkbox" checked={hidePacked} onChange={(e) => setHidePacked(e.target.checked)} />
            Hide packed
          </label>
        </div>
        <Progress packed={packed} total={total} big />
      </div>

      {pendingSync > 0 && sync && (
        <div className="card mt-3 flex flex-wrap items-center gap-3 border-[var(--accent)] p-3 text-[14px]">
          <span className="flex-1">
            Your lists changed since this trip was made:{" "}
            {[
              sync.newItems.length && `${sync.newItems.length} new item${sync.newItems.length === 1 ? "" : "s"}`,
              sync.newLists.length && `${sync.newLists.map((l) => l.name).join(", ")} now required`,
            ].filter(Boolean).join(" · ")}
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => run(() => api(`/api/trips/${trip.id}/sync`, "POST"))}>
            Pull in updates
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-[13px] text-[var(--danger)]">{error}</p>}

      <QuickAdd trip={trip} onAdd={(b) => run(() => api(`/api/trips/${trip.id}/items`, "POST", b))} />

      <Suggestions
        trip={trip}
        onAdd={(b) => run(() => api(`/api/trips/${trip.id}/items`, "POST", b))}
        onAddList={(name) => {
          const lt = listTypes.find((l) => l.name === name);
          return lt ? run(() => api(`/api/trips/${trip.id}/lists`, "POST", { listTypeId: lt.id })) : Promise.resolve();
        }}
      />

      {total === 0 && trip.lists.length === 0 && (
        <div className="mt-4">
          <Empty>Nothing on this trip yet. Add items above, or <button className="font-semibold text-[var(--accent)]" onClick={() => setAddingList(true)}>add a list</button>.</Empty>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {sections.map(({ list, key, items }) => {
          if (!list && items.length === 0) return null;
          const shown = hidePacked ? items.filter((i) => !i.packed) : items;
          const secPacked = items.filter((i) => i.packed).length;
          return (
            <section key={key} className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
                {list ? <Chip icon={list.icon} name={list.name} color={list.color} /> : <Chip icon="✨" name="Extras" color="slate" />}
                <span className="text-[12px] font-semibold text-[var(--muted)]">
                  {secPacked}/{items.length}
                </span>
                {list && (
                  <button
                    className="icon-btn ml-auto !h-7 !w-7 text-[13px]"
                    aria-label={`Remove ${list.name} from this trip`}
                    title="Remove this list from the trip"
                    onClick={() => {
                      if (confirm(`Remove "${list.name}" and its ${items.length} items from this trip? Your master list is not affected.`)) {
                        run(() => api(`/api/trip-lists/${list.id}`, "DELETE"));
                      }
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              {shown.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-[var(--muted)]">
                  {items.length === 0 ? "This list is empty." : "All packed ✓"}
                </p>
              ) : (
                <ul>
                  {shown.map((i) => (
                    <SwipeRow key={i.id} label={i.name} onDelete={() => del.remove(i.id, i.name)}
                      className="border-b border-[var(--line)] last:border-b-0">
                     <div className="flex items-center gap-3 px-4 py-2">
                      <button
                        className={`check ${i.packed ? "on" : ""}`}
                        onClick={() => toggle(i)}
                        aria-label={`${i.packed ? "Unpack" : "Pack"} ${i.name}`}
                        aria-pressed={i.packed}
                      >
                        {i.packed && "✓"}
                      </button>
                      <button className="min-w-0 flex-1 py-1 text-left" onClick={() => toggle(i)}>
                        <span className={`text-[15px] ${i.packed ? "packed-name" : ""}`}>{i.name}</span>
                        {(i.qty > 1 || i.perDay != null) && <span className="ml-1.5 text-[13px] font-semibold text-[var(--muted)]">×{i.qty}</span>}
                        {i.perDay != null && (
                          <span className="ml-1.5 rounded bg-[var(--sunk)] px-1 py-px text-[11px] font-semibold text-[var(--muted)]" title={`${fmtAmount(i.perDay)} per day × ${days} days, rounded up`}>
                            {fmtAmount(i.perDay)}/day
                          </span>
                        )}
                        {i.note && <span className="block truncate text-[12px] text-[var(--muted)]">{i.note}</span>}
                      </button>
                      <button className="icon-btn" onClick={() => setEditingItem(i)} aria-label={`Edit ${i.name}`}>✎</button>
                     </div>
                    </SwipeRow>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <button className="btn" onClick={() => setAddingList(true)}>+ Add a list to this trip</button>
      </div>

      {del.pending && <UndoToast label={del.pending.label} onUndo={del.undo} />}

      {editingItem && (
        <ItemModal
          item={editingItem}
          trip={trip}
          listTypes={listTypes}
          onClose={() => setEditingItem(null)}
          onDone={async (fn) => { setEditingItem(null); await run(fn); }}
        />
      )}
      {editingTrip && (
        <EditTripModal trip={trip} onClose={() => setEditingTrip(false)} onSave={async (b) => {
          setEditingTrip(false);
          await run(() => api(`/api/trips/${trip.id}`, "PATCH", b));
        }} />
      )}
      {addingList && (
        <Modal title="Add a list to this trip" onClose={() => setAddingList(false)}>
          {listTypes.filter((l) => !attachedIds.has(l.id)).length === 0 ? (
            <p className="text-[14px] text-[var(--muted)]">Every list is already on this trip. Make new ones on the <Link className="text-[var(--accent)]" href="/lists">Lists</Link> tab.</p>
          ) : (
            <div className="grid gap-2">
              {listTypes.filter((l) => !attachedIds.has(l.id)).map((l) => (
                <button
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2.5 text-left hover:border-[var(--accent)]"
                  onClick={async () => {
                    setAddingList(false);
                    await run(() => api(`/api/trips/${trip.id}/lists`, "POST", { listTypeId: l.id }));
                  }}
                >
                  <Chip icon={l.icon} name={l.name} color={l.color} />
                  <span className="text-[13px] text-[var(--muted)]">{l.items.length} items</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function QuickAdd({ trip, onAdd }: {
  trip: Trip;
  onAdd: (b: { name: string; qty: number; perDay: boolean; tripListId: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [perDay, setPerDay] = useState(false);
  const [section, setSection] = useState(EXTRAS);
  return (
    <form
      className="card mt-3 flex flex-wrap items-center gap-2 p-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await onAdd({ name, qty, perDay, tripListId: section === EXTRAS ? null : section });
        setName("");
        setQty(1);
        setPerDay(false);
      }}
    >
      <input
        className="field min-w-0 flex-1 basis-40"
        placeholder="Add an item to this trip…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="New item"
      />
      <select className="field !w-auto max-w-[40%]" value={section} onChange={(e) => setSection(e.target.value)} aria-label="Section">
        <option value={EXTRAS}>✨ Extras</option>
        {trip.lists.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
      </select>
      <div className="flex basis-full items-center gap-2">
        <div className="min-w-0 flex-1">
          <QtyField qty={qty} perDay={perDay} onQty={setQty} onPerDay={(b) => { setPerDay(b); if (!b) setQty((q) => Math.max(1, Math.ceil(q))); }} days={tripDays(trip.startDate, trip.endDate)} />
        </div>
        <button className="btn btn-primary self-start" disabled={!name.trim()}>Add</button>
      </div>
    </form>
  );
}

function ItemModal({
  item, trip, listTypes, onClose, onDone,
}: {
  item: TripItem; trip: Trip; listTypes: ListType[]; onClose: () => void;
  onDone: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [perDay, setPerDay] = useState(item.perDay != null);
  const [qty, setQty] = useState(item.perDay ?? item.qty);
  const [note, setNote] = useState(item.note);
  const days = tripDays(trip.startDate, trip.endDate);
  // Flipping the mode converts the number so the packed total stays put:
  // 8 (count) on a 4-day trip ↔ 2 per day.
  const switchMode = (toPerDay: boolean) => {
    if (toPerDay === perDay) return;
    // Per day is exact now (8 on 16 days → 0.5/day); back to a count rounds up.
    setQty((q) => (toPerDay ? Math.max(0.1, Math.round((q / days) * 100) / 100) : Math.max(1, Math.ceil(q * days - 1e-9))));
    setPerDay(toPerDay);
  };
  const section = trip.lists.find((l) => l.id === item.tripListId);
  const [promoteTo, setPromoteTo] = useState(section?.listTypeId ?? listTypes[0]?.id ?? "");

  return (
    <Modal title="Edit item" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onDone(() => api(`/api/trip-items/${item.id}`, "PATCH", { name, qty, perDay, note }));
        }}
      >
        <label className="block"><Label>Name</Label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div><Label>Quantity</Label>
          <QtyField qty={qty} perDay={perDay} onQty={setQty} onPerDay={switchMode} days={days} />
          <span className="mt-1 block text-[12px] text-[var(--muted)]">
            {perDay ? "Follows the trip's length — changing the dates updates it." : "Stays the same however long the trip is."}
          </span>
        </div>
        <label className="block"><Label>Note</Label>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>

        {item.sourceItemId === null && listTypes.length > 0 && (
          <div className="rounded-xl bg-[var(--sunk)] p-3">
            <Label>Save for future trips</Label>
            <div className="flex gap-2">
              <select className="field min-w-0 flex-1" value={promoteTo} onChange={(e) => setPromoteTo(e.target.value)}>
                {listTypes.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
              </select>
              <button
                type="button"
                className="btn"
                onClick={() => onDone(() => api(`/api/trip-items/${item.id}/promote`, "POST", { listTypeId: promoteTo }))}
              >
                Add to list
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onDone(() => api(`/api/trip-items/${item.id}`, "DELETE"))}
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary">Save</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function EditTripModal({
  trip, onClose, onSave,
}: { trip: Trip; onClose: () => void; onSave: (b: Record<string, unknown>) => void }) {
  const [name, setName] = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination);
  const [startDate, setStart] = useState(trip.startDate ?? "");
  const [endDate, setEnd] = useState(trip.endDate ?? "");
  const [note, setNote] = useState(trip.note);
  return (
    <Modal title="Edit trip" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name, destination, startDate: startDate || null, endDate: endDate || null, note });
        }}
      >
        <label className="block"><Label>Name</Label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block"><Label>Destination</Label>
          <input className="field" value={destination} onChange={(e) => setDestination(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0"><Label>Leave</Label>
            <input type="date" className="field" value={startDate} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="block min-w-0"><Label>Return</Label>
            <input type="date" className="field" value={endDate} min={startDate || undefined} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <p className="text-[12px] text-[var(--muted)]">Changing dates re-scales per-day items (socks, underwear…).</p>
        <label className="block"><Label>Notes</Label>
          <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

/** "Suggested" — things from your past trips and common sense that this trip lacks. */
function Suggestions({ trip, onAdd, onAddList }: {
  trip: Trip;
  onAdd: (b: { name: string; qty: number; perDay: boolean; tripListId: string | null }) => Promise<void>;
  onAddList: (listName: string) => Promise<void>;
}) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [open, setOpen] = useState(true);
  const [dismissedAny, setDismissedAny] = useState(false);
  // Refetch whenever the trip's contents change (an add removes its suggestion).
  const fingerprint = trip.items.map((i) => i.name).join("|") + trip.lists.map((l) => l.id).join("|");

  useEffect(() => {
    let alive = true;
    api<{ suggestions: Suggestion[] }>(`/api/trips/${trip.id}/suggestions`)
      .then((r) => { if (alive) setList(r.suggestions); })
      .catch(() => {});
    return () => { alive = false; };
  }, [trip.id, fingerprint]);

  if (!list || (list.length === 0 && !dismissedAny)) return null;

  const dismiss = async (s: Suggestion) => {
    setList((l) => l?.filter((x) => x.key !== s.key) ?? null);
    setDismissedAny(true);
    await api(`/api/trips/${trip.id}/suggestions`, "POST", { dismiss: s.key }).catch(() => {});
  };
  const add = async (s: Suggestion) => {
    setList((l) => l?.filter((x) => x.key !== s.key) ?? null);
    if (s.kind === "list" && s.listName) return onAddList(s.listName);
    const section = s.listName ? trip.lists.find((l) => l.name === s.listName) : undefined;
    await onAdd({ name: s.name, qty: s.qty, perDay: s.perDay, tripListId: section?.id ?? null });
  };
  const restore = async () => {
    await api(`/api/trips/${trip.id}/suggestions`, "DELETE").catch(() => {});
    setDismissedAny(false);
    const r = await api<{ suggestions: Suggestion[] }>(`/api/trips/${trip.id}/suggestions`);
    setList(r.suggestions);
  };

  return (
    <section className="card mt-3 overflow-hidden">
      <button
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-[15px] font-bold">💡 Suggested</span>
        <span className="text-[12px] font-semibold text-[var(--muted)]">{list.length}</span>
        <span className="ml-auto text-[12px] text-[var(--muted)]">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <>
          {list.length === 0 ? (
            <p className="border-t border-[var(--line)] px-4 py-3 text-[13px] text-[var(--muted)]">Nothing else to suggest.</p>
          ) : (
            <ul className="border-t border-[var(--line)]">
              {list.map((s) => (
                <li key={s.key} className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px]">
                      {s.kind === "list" && <span aria-hidden>📋 </span>}
                      {s.name}
                      {(s.qty > 1 || s.perDay) && (
                        <span className="ml-1.5 text-[13px] font-semibold text-[var(--muted)]">{s.perDay ? `${fmtAmount(s.qty)}/day` : `×${s.qty}`}</span>
                      )}
                    </div>
                    <div className="line-clamp-2 text-[12px] leading-snug text-[var(--muted)]">
                      {s.source === "history" ? "🕘 " : ""}{s.reason}
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={() => add(s)} aria-label={`Add ${s.name}`}>
                    {s.kind === "list" ? "+ Add list" : "+ Add"}
                  </button>
                  <button className="icon-btn" onClick={() => dismiss(s)} aria-label={`Dismiss ${s.name}`} title="Not for this trip">✕</button>
                </li>
              ))}
            </ul>
          )}
          {dismissedAny && (
            <div className="border-t border-[var(--line)] px-4 py-2 text-right">
              <button className="text-[12px] font-semibold text-[var(--accent)]" onClick={restore}>Show dismissed</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
