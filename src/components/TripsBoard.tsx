"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { daysUntil, formatRange, todayIso, tripDays, tripPhase, type TripPhase } from "@/lib/trip-math";
import type { ListType, Trip, TripSummary, TripType } from "@/lib/types";
import { Chip, Empty, Label, Modal, Progress } from "./ui";

const SECTIONS: { phase: TripPhase; title: string }[] = [
  { phase: "active", title: "Happening now" },
  { phase: "upcoming", title: "Upcoming" },
  { phase: "undated", title: "No dates yet" },
  { phase: "past", title: "Past trips" },
];

export default function TripsBoard({
  trips, tripTypes, listTypes,
}: { trips: TripSummary[]; tripTypes: TripType[]; listTypes: ListType[] }) {
  const [creating, setCreating] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const today = todayIso();

  const grouped = useMemo(() => {
    const g = new Map<TripPhase, TripSummary[]>();
    for (const t of trips) {
      const p = tripPhase(t.startDate, t.endDate, today);
      g.set(p, [...(g.get(p) ?? []), t]);
    }
    // Most recent past trip first.
    g.get("past")?.reverse();
    return g;
  }, [trips, today]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Trips</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New trip</button>
      </div>

      {trips.length === 0 && (
        <Empty>
          <div className="mb-2 text-3xl">🧳</div>
          No trips yet. Create one and pick a trip type — its lists get copied in as your checklist.
        </Empty>
      )}

      {SECTIONS.map(({ phase, title }) => {
        const list = grouped.get(phase) ?? [];
        if (list.length === 0) return null;
        const collapsed = phase === "past" && !showPast;
        return (
          <section key={phase} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-[var(--muted)]">
                {title} · {list.length}
              </h2>
              {phase === "past" && (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPast((v) => !v)}>
                  {showPast ? "Hide" : "Show"}
                </button>
              )}
            </div>
            {!collapsed && (
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((t) => <TripCard key={t.id} trip={t} today={today} />)}
              </div>
            )}
          </section>
        );
      })}

      {creating && (
        <NewTripModal tripTypes={tripTypes} listTypes={listTypes} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

function TripCard({ trip, today }: { trip: TripSummary; today: string }) {
  const until = daysUntil(trip.startDate, today);
  const phase = tripPhase(trip.startDate, trip.endDate, today);
  const done = trip.total > 0 && trip.packed === trip.total;
  let when = "";
  if (phase === "upcoming" && until !== null) when = until === 1 ? "tomorrow" : `in ${until} days`;
  if (phase === "active") when = "now";

  return (
    <Link href={`/trips/${trip.id}`} className="card block p-4 transition hover:border-[var(--muted)]">
      <div className="flex items-start gap-3">
        <div className="text-[28px] leading-none">{trip.tripTypeIcon || "🧳"}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-bold">{trip.name}</div>
          <div className="truncate text-[13px] text-[var(--muted)]">
            {[trip.destination, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(" · ") ||
              trip.tripTypeName || "No details"}
          </div>
        </div>
        {when && (
          <span className="shrink-0 rounded-full bg-[var(--sunk)] px-2 py-0.5 text-[12px] font-semibold text-[var(--muted)]">
            {when}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Progress packed={trip.packed} total={trip.total} />
        <span className={`shrink-0 text-[12px] font-semibold ${done ? "text-[var(--good)]" : "text-[var(--muted)]"}`}>
          {done ? "✓ packed" : `${trip.packed}/${trip.total}`}
        </span>
      </div>
    </Link>
  );
}

function NewTripModal({
  tripTypes, listTypes, onClose,
}: { tripTypes: TripType[]; listTypes: ListType[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [tripTypeId, setTripTypeId] = useState(tripTypes[0]?.id ?? "");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const type = tripTypes.find((t) => t.id === tripTypeId);
  const required = listTypes.filter((l) => type?.listTypeIds.includes(l.id));
  const optional = listTypes.filter((l) => !type?.listTypeIds.includes(l.id));
  const days = tripDays(startDate || null, endDate || null);
  const itemCount = [...required, ...listTypes.filter((l) => extras.includes(l.id) && !required.includes(l))]
    .reduce((n, l) => n + l.items.length, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the trip a name");
    setBusy(true);
    try {
      const { trip } = await api<{ trip: Trip }>("/api/trips", "POST", {
        name, destination, tripTypeId: tripTypeId || null,
        startDate: startDate || null, endDate: endDate || null,
        extraListTypeIds: extras.filter((x) => !type?.listTypeIds.includes(x)),
      });
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="New trip" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <Label>Name</Label>
          <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Vegas for Mike's 40th" />
        </label>
        <label className="block">
          <Label>Destination</Label>
          <input className="field" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Optional" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <Label>Leave</Label>
            <input type="date" className="field" value={startDate} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="block min-w-0">
            <Label>Return</Label>
            <input type="date" className="field" value={endDate} min={startDate || undefined} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        <div>
          <Label>Trip type</Label>
          <div className="grid grid-cols-2 gap-2">
            {tripTypes.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTripTypeId(t.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[14px] font-semibold ${
                  t.id === tripTypeId ? "border-[var(--accent)] bg-[var(--sunk)]" : "border-[var(--line)]"
                }`}
              >
                <span className="text-[18px]">{t.icon}</span>
                <span className="truncate">{t.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTripTypeId("")}
              className={`rounded-xl border px-3 py-2 text-left text-[14px] font-semibold ${
                tripTypeId === "" ? "border-[var(--accent)] bg-[var(--sunk)]" : "border-[var(--line)]"
              }`}
            >
              ✏️ Blank
            </button>
          </div>
        </div>

        {required.length > 0 && (
          <div>
            <Label>Included lists</Label>
            <div className="flex flex-wrap gap-1.5">
              {required.map((l) => <Chip key={l.id} icon={l.icon} name={l.name} color={l.color} />)}
            </div>
          </div>
        )}

        {optional.length > 0 && (
          <div>
            <Label>Add more lists</Label>
            <div className="flex flex-wrap gap-1.5">
              {optional.map((l) => {
                const on = extras.includes(l.id);
                return (
                  <button
                    type="button"
                    key={l.id}
                    onClick={() => setExtras((x) => (on ? x.filter((i) => i !== l.id) : [...x, l.id]))}
                    className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${
                      on ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]" : "border-[var(--line)] text-[var(--muted)]"
                    }`}
                  >
                    {on ? "✓ " : "+ "}{l.icon} {l.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[13px] text-[var(--muted)]">
          {itemCount} items · {days} day{days === 1 ? "" : "s"} — per-day items (like socks) are multiplied by the trip length.
        </p>
        {error && <p className="text-[13px] text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create trip"}</button>
        </div>
      </form>
    </Modal>
  );
}
