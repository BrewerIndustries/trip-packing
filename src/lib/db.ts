import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { randomUUID } from "crypto";
import {
  colorOf,
  type ListItem, type ListType, type Trip, type TripItem, type TripList,
  type TripSummary, type TripType,
} from "./types";
import { isIsoDate, packQty, tripDays } from "./trip-math";
import { seed } from "./seed";

const DB_PATH = process.env.PACKING_DB_PATH ?? join(process.cwd(), "data", "packing.db");

// Next.js reloads modules in dev; cache the handle so migrations run once.
const globalForDb = globalThis as unknown as { _packingDb?: Database.Database };

function init(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    -- Master data: reusable lists and the trip types that require them.
    CREATE TABLE IF NOT EXISTS list_types (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      icon      TEXT NOT NULL DEFAULT '🧳',
      color     TEXT NOT NULL DEFAULT 'slate',
      position  INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS list_items (
      id           TEXT PRIMARY KEY,
      list_type_id TEXT NOT NULL REFERENCES list_types(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      qty          INTEGER NOT NULL DEFAULT 1,
      per_day      INTEGER NOT NULL DEFAULT 0,
      note         TEXT NOT NULL DEFAULT '',
      position     INTEGER NOT NULL DEFAULT 0,
      createdAt    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_list_items_type ON list_items(list_type_id);

    CREATE TABLE IF NOT EXISTS trip_types (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      icon      TEXT NOT NULL DEFAULT '✈️',
      position  INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trip_type_lists (
      trip_type_id TEXT NOT NULL REFERENCES trip_types(id) ON DELETE CASCADE,
      list_type_id TEXT NOT NULL REFERENCES list_types(id) ON DELETE CASCADE,
      PRIMARY KEY (trip_type_id, list_type_id)
    );

    -- Trips. Lists + items are COPIED in when a trip is created, so editing a
    -- master list later never rewrites a trip's checklist (see syncTrip()).
    CREATE TABLE IF NOT EXISTS trips (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      destination    TEXT NOT NULL DEFAULT '',
      trip_type_id   TEXT REFERENCES trip_types(id) ON DELETE SET NULL,
      trip_type_name TEXT NOT NULL DEFAULT '',
      trip_type_icon TEXT NOT NULL DEFAULT '',
      start_date     TEXT,
      end_date       TEXT,
      note           TEXT NOT NULL DEFAULT '',
      createdAt      TEXT NOT NULL,
      updatedAt      TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trip_lists (
      id           TEXT PRIMARY KEY,
      trip_id      TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      list_type_id TEXT REFERENCES list_types(id) ON DELETE SET NULL,
      name         TEXT NOT NULL,
      icon         TEXT NOT NULL,
      color        TEXT NOT NULL,
      position     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_trip_lists_trip ON trip_lists(trip_id);
    CREATE TABLE IF NOT EXISTS trip_items (
      id             TEXT PRIMARY KEY,
      trip_id        TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      trip_list_id   TEXT REFERENCES trip_lists(id) ON DELETE CASCADE,
      source_item_id TEXT REFERENCES list_items(id) ON DELETE SET NULL,
      name           TEXT NOT NULL,
      qty            INTEGER NOT NULL DEFAULT 1,
      per_day        INTEGER,
      note           TEXT NOT NULL DEFAULT '',
      packed         INTEGER NOT NULL DEFAULT 0,
      position       INTEGER NOT NULL DEFAULT 0,
      createdAt      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_trip_items_trip ON trip_items(trip_id);
    -- Lists the user deliberately removed from a trip, so sync stops offering them.
    CREATE TABLE IF NOT EXISTS trip_dismissed_lists (
      trip_id      TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      list_type_id TEXT NOT NULL REFERENCES list_types(id) ON DELETE CASCADE,
      PRIMARY KEY (trip_id, list_type_id)
    );
  `);

  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM list_types`).get() as { n: number };
  const { t } = db.prepare(`SELECT COUNT(*) AS t FROM trip_types`).get() as { t: number };
  if (n === 0 && t === 0) seed(db);

  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb._packingDb) globalForDb._packingDb = init();
  return globalForDb._packingDb;
}

// --- input helpers -----------------------------------------------------------

const now = () => new Date().toISOString();
function text(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function qtyOf(v: unknown, fallback = 1): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 999) : fallback;
}
function dateOrNull(v: unknown): string | null {
  return isIsoDate(v) ? v : null;
}
function nextPos(table: string, where = "1", args: unknown[] = []): number {
  const row = getDb()
    .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM ${table} WHERE ${where}`)
    .get(...args) as { p: number };
  return row.p;
}

// --- row shapes --------------------------------------------------------------

interface ListTypeRow { id: string; name: string; icon: string; color: string; position: number }
interface ListItemRow {
  id: string; list_type_id: string; name: string; qty: number; per_day: number;
  note: string; position: number;
}
interface TripTypeRow { id: string; name: string; icon: string; position: number }
interface TripRow {
  id: string; name: string; destination: string; trip_type_id: string | null;
  trip_type_name: string; trip_type_icon: string; start_date: string | null;
  end_date: string | null; note: string; createdAt: string; updatedAt: string;
}
interface TripListRow {
  id: string; trip_id: string; list_type_id: string | null; name: string;
  icon: string; color: string; position: number;
}
interface TripItemRow {
  id: string; trip_id: string; trip_list_id: string | null; source_item_id: string | null;
  name: string; qty: number; per_day: number | null; note: string; packed: number;
  position: number;
}

const toListItem = (r: ListItemRow): ListItem => ({
  id: r.id, listTypeId: r.list_type_id, name: r.name, qty: r.qty,
  perDay: r.per_day === 1, note: r.note, position: r.position,
});
const toTripList = (r: TripListRow): TripList => ({
  id: r.id, tripId: r.trip_id, listTypeId: r.list_type_id, name: r.name,
  icon: r.icon, color: colorOf(r.color), position: r.position,
});
const toTripItem = (r: TripItemRow): TripItem => ({
  id: r.id, tripId: r.trip_id, tripListId: r.trip_list_id, sourceItemId: r.source_item_id,
  name: r.name, qty: r.qty, perDay: r.per_day, note: r.note, packed: r.packed === 1,
  position: r.position,
});

// =============================================================================
// List types + their items
// =============================================================================

export function listListTypes(): ListType[] {
  const db = getDb();
  const types = db.prepare(`SELECT * FROM list_types ORDER BY position, name`).all() as ListTypeRow[];
  const items = db.prepare(`SELECT * FROM list_items ORDER BY position, createdAt`).all() as ListItemRow[];
  const links = db.prepare(`SELECT * FROM trip_type_lists`).all() as { trip_type_id: string; list_type_id: string }[];
  return types.map((t) => ({
    id: t.id, name: t.name, icon: t.icon, color: colorOf(t.color), position: t.position,
    items: items.filter((i) => i.list_type_id === t.id).map(toListItem),
    tripTypeIds: links.filter((l) => l.list_type_id === t.id).map((l) => l.trip_type_id),
  }));
}

export interface ListTypeInput { name?: unknown; icon?: unknown; color?: unknown }

export function createListType(input: ListTypeInput): string | null {
  const name = text(input.name, 80);
  if (!name) return null;
  const id = randomUUID();
  const ts = now();
  getDb()
    .prepare(`INSERT INTO list_types (id,name,icon,color,position,createdAt,updatedAt)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id, name, text(input.icon, 16) || "🧳", colorOf(input.color), nextPos("list_types"), ts, ts);
  return id;
}

export function updateListType(id: string, input: ListTypeInput): boolean {
  const cur = getDb().prepare(`SELECT * FROM list_types WHERE id = ?`).get(id) as ListTypeRow | undefined;
  if (!cur) return false;
  getDb()
    .prepare(`UPDATE list_types SET name=?, icon=?, color=?, updatedAt=? WHERE id=?`)
    .run(
      input.name !== undefined ? text(input.name, 80) || cur.name : cur.name,
      input.icon !== undefined ? text(input.icon, 16) || cur.icon : cur.icon,
      input.color !== undefined ? colorOf(input.color) : cur.color,
      now(), id,
    );
  return true;
}

/** Deleting a list type leaves trips alone — their copied sections stay as snapshots. */
export function deleteListType(id: string): boolean {
  return getDb().prepare(`DELETE FROM list_types WHERE id = ?`).run(id).changes > 0;
}

export interface ListItemInput { name?: unknown; qty?: unknown; perDay?: unknown; note?: unknown }

export function createListItem(listTypeId: string, input: ListItemInput): ListItem | null {
  const name = text(input.name);
  if (!name) return null;
  if (!getDb().prepare(`SELECT 1 FROM list_types WHERE id = ?`).get(listTypeId)) return null;
  const row: ListItemRow = {
    id: randomUUID(), list_type_id: listTypeId, name, qty: qtyOf(input.qty),
    per_day: input.perDay ? 1 : 0, note: text(input.note, 500),
    position: nextPos("list_items", "list_type_id = ?", [listTypeId]),
  };
  getDb()
    .prepare(`INSERT INTO list_items (id,list_type_id,name,qty,per_day,note,position,createdAt)
              VALUES (@id,@list_type_id,@name,@qty,@per_day,@note,@position,@createdAt)`)
    .run({ ...row, createdAt: now() });
  return toListItem(row);
}

export function updateListItem(id: string, input: ListItemInput): boolean {
  const cur = getDb().prepare(`SELECT * FROM list_items WHERE id = ?`).get(id) as ListItemRow | undefined;
  if (!cur) return false;
  getDb()
    .prepare(`UPDATE list_items SET name=?, qty=?, per_day=?, note=? WHERE id=?`)
    .run(
      input.name !== undefined ? text(input.name) || cur.name : cur.name,
      input.qty !== undefined ? qtyOf(input.qty, cur.qty) : cur.qty,
      input.perDay !== undefined ? (input.perDay ? 1 : 0) : cur.per_day,
      input.note !== undefined ? text(input.note, 500) : cur.note,
      id,
    );
  return true;
}

export function deleteListItem(id: string): boolean {
  return getDb().prepare(`DELETE FROM list_items WHERE id = ?`).run(id).changes > 0;
}

/**
 * Rewrite positions 0..n-1 for one ordered group. `scope` names the table and
 * the parent column that every id must share, so ids from another group are
 * ignored rather than moved.
 */
export function reorder(
  kind: "list_types" | "trip_types" | "list_items" | "trip_items",
  orderedIds: string[],
): boolean {
  const db = getDb();
  const ids = orderedIds.filter((s) => typeof s === "string" && s);
  if (ids.length === 0) return false;
  const parentCol =
    kind === "list_items" ? "list_type_id" : kind === "trip_items" ? "trip_id" : null;
  const tx = db.transaction(() => {
    if (parentCol) {
      const first = db.prepare(`SELECT ${parentCol} AS p FROM ${kind} WHERE id = ?`).get(ids[0]) as
        | { p: string } | undefined;
      if (!first) return;
      const upd = db.prepare(`UPDATE ${kind} SET position = ? WHERE id = ? AND ${parentCol} = ?`);
      ids.forEach((id, i) => upd.run(i, id, first.p));
    } else {
      const upd = db.prepare(`UPDATE ${kind} SET position = ? WHERE id = ?`);
      ids.forEach((id, i) => upd.run(i, id));
    }
  });
  tx();
  return true;
}

// =============================================================================
// Trip types
// =============================================================================

export function listTripTypes(): TripType[] {
  const db = getDb();
  const types = db.prepare(`SELECT * FROM trip_types ORDER BY position, name`).all() as TripTypeRow[];
  const links = db.prepare(`SELECT * FROM trip_type_lists`).all() as { trip_type_id: string; list_type_id: string }[];
  return types.map((t) => ({
    id: t.id, name: t.name, icon: t.icon, position: t.position,
    listTypeIds: links.filter((l) => l.trip_type_id === t.id).map((l) => l.list_type_id),
  }));
}

export interface TripTypeInput { name?: unknown; icon?: unknown; listTypeIds?: unknown }

export function createTripType(input: TripTypeInput): string | null {
  const name = text(input.name, 80);
  if (!name) return null;
  const id = randomUUID();
  const ts = now();
  const db = getDb();
  db.transaction(() => {
    db.prepare(`INSERT INTO trip_types (id,name,icon,position,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`)
      .run(id, name, text(input.icon, 16) || "✈️", nextPos("trip_types"), ts, ts);
    if (Array.isArray(input.listTypeIds)) setTripTypeLists(id, input.listTypeIds);
  })();
  return id;
}

export function updateTripType(id: string, input: TripTypeInput): boolean {
  const db = getDb();
  const cur = db.prepare(`SELECT * FROM trip_types WHERE id = ?`).get(id) as TripTypeRow | undefined;
  if (!cur) return false;
  db.transaction(() => {
    db.prepare(`UPDATE trip_types SET name=?, icon=?, updatedAt=? WHERE id=?`).run(
      input.name !== undefined ? text(input.name, 80) || cur.name : cur.name,
      input.icon !== undefined ? text(input.icon, 16) || cur.icon : cur.icon,
      now(), id,
    );
    if (Array.isArray(input.listTypeIds)) setTripTypeLists(id, input.listTypeIds);
  })();
  return true;
}

function setTripTypeLists(tripTypeId: string, listTypeIds: unknown[]) {
  const db = getDb();
  db.prepare(`DELETE FROM trip_type_lists WHERE trip_type_id = ?`).run(tripTypeId);
  const exists = db.prepare(`SELECT 1 FROM list_types WHERE id = ?`);
  const ins = db.prepare(`INSERT OR IGNORE INTO trip_type_lists (trip_type_id, list_type_id) VALUES (?, ?)`);
  for (const l of listTypeIds) {
    if (typeof l === "string" && exists.get(l)) ins.run(tripTypeId, l);
  }
}

/** Toggle one cell of the trip-type × list-type matrix. */
export function setRequirement(tripTypeId: string, listTypeId: string, required: boolean): boolean {
  const db = getDb();
  if (!db.prepare(`SELECT 1 FROM trip_types WHERE id = ?`).get(tripTypeId)) return false;
  if (!db.prepare(`SELECT 1 FROM list_types WHERE id = ?`).get(listTypeId)) return false;
  if (required) {
    db.prepare(`INSERT OR IGNORE INTO trip_type_lists (trip_type_id, list_type_id) VALUES (?, ?)`)
      .run(tripTypeId, listTypeId);
  } else {
    db.prepare(`DELETE FROM trip_type_lists WHERE trip_type_id = ? AND list_type_id = ?`)
      .run(tripTypeId, listTypeId);
  }
  return true;
}

export function deleteTripType(id: string): boolean {
  return getDb().prepare(`DELETE FROM trip_types WHERE id = ?`).run(id).changes > 0;
}

// =============================================================================
// Trips
// =============================================================================

const SUMMARY_SQL = `
  SELECT t.*,
    (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id) AS total,
    (SELECT COUNT(*) FROM trip_items i WHERE i.trip_id = t.id AND i.packed = 1) AS packedCount
  FROM trips t`;

type SummaryRow = TripRow & { total: number; packedCount: number };

function toSummary(r: SummaryRow): TripSummary {
  return {
    id: r.id, name: r.name, destination: r.destination, tripTypeId: r.trip_type_id,
    tripTypeName: r.trip_type_name, tripTypeIcon: r.trip_type_icon,
    startDate: r.start_date, endDate: r.end_date, note: r.note,
    total: r.total, packed: r.packedCount, createdAt: r.createdAt,
  };
}

/** Every trip, soonest first; undated trips sort last (newest first among them). */
export function listTrips(): TripSummary[] {
  const rows = getDb()
    .prepare(`${SUMMARY_SQL} ORDER BY t.start_date IS NULL, t.start_date, t.createdAt DESC`)
    .all() as SummaryRow[];
  return rows.map(toSummary);
}

export function getTrip(id: string): Trip | null {
  const db = getDb();
  const row = db.prepare(`${SUMMARY_SQL} WHERE t.id = ?`).get(id) as SummaryRow | undefined;
  if (!row) return null;
  const lists = db.prepare(`SELECT * FROM trip_lists WHERE trip_id = ? ORDER BY position`).all(id) as TripListRow[];
  const items = db
    .prepare(`SELECT * FROM trip_items WHERE trip_id = ? ORDER BY position, createdAt`)
    .all(id) as TripItemRow[];
  return { ...toSummary(row), lists: lists.map(toTripList), items: items.map(toTripItem) };
}

function tripRow(id: string): TripRow | undefined {
  return getDb().prepare(`SELECT * FROM trips WHERE id = ?`).get(id) as TripRow | undefined;
}

export interface TripInput {
  name?: unknown; destination?: unknown; tripTypeId?: unknown;
  startDate?: unknown; endDate?: unknown; note?: unknown;
  /** Extra list types to attach on top of the trip type's required lists. */
  extraListTypeIds?: unknown;
}

/**
 * Create a trip and copy in every list its trip type requires (plus any extras).
 * Per-day items are multiplied by the trip's length.
 */
export function createTrip(input: TripInput): string | null {
  const name = text(input.name, 120);
  if (!name) return null;
  const db = getDb();

  let tripType: TripTypeRow | undefined;
  if (typeof input.tripTypeId === "string" && input.tripTypeId) {
    tripType = db.prepare(`SELECT * FROM trip_types WHERE id = ?`).get(input.tripTypeId) as TripTypeRow | undefined;
  }
  let start = dateOrNull(input.startDate);
  let end = dateOrNull(input.endDate);
  if (start && end && end < start) [start, end] = [end, start];
  if (!start && end) [start, end] = [end, null];

  const id = randomUUID();
  const ts = now();
  db.transaction(() => {
    db.prepare(`INSERT INTO trips (id,name,destination,trip_type_id,trip_type_name,trip_type_icon,
                start_date,end_date,note,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, name, text(input.destination, 120), tripType?.id ?? null, tripType?.name ?? "",
        tripType?.icon ?? "", start, end, text(input.note, 1000), ts, ts);

    const listIds: string[] = [];
    if (tripType) {
      const req = db
        .prepare(`SELECT l.id FROM trip_type_lists x JOIN list_types l ON l.id = x.list_type_id
                  WHERE x.trip_type_id = ? ORDER BY l.position, l.name`)
        .all(tripType.id) as { id: string }[];
      listIds.push(...req.map((r) => r.id));
    }
    if (Array.isArray(input.extraListTypeIds)) {
      for (const l of input.extraListTypeIds) if (typeof l === "string" && !listIds.includes(l)) listIds.push(l);
    }
    for (const l of listIds) attachListInTx(id, l);
  })();
  return id;
}

export function updateTrip(id: string, input: TripInput): boolean {
  const db = getDb();
  const cur = tripRow(id);
  if (!cur) return false;
  let start = input.startDate !== undefined ? dateOrNull(input.startDate) : cur.start_date;
  let end = input.endDate !== undefined ? dateOrNull(input.endDate) : cur.end_date;
  if (start && end && end < start) [start, end] = [end, start];
  if (!start && end) [start, end] = [end, null];

  db.transaction(() => {
    db.prepare(`UPDATE trips SET name=?, destination=?, start_date=?, end_date=?, note=?, updatedAt=? WHERE id=?`)
      .run(
        input.name !== undefined ? text(input.name, 120) || cur.name : cur.name,
        input.destination !== undefined ? text(input.destination, 120) : cur.destination,
        start, end,
        input.note !== undefined ? text(input.note, 1000) : cur.note,
        now(), id,
      );
    // Dates moved → re-scale every per-day item to the new trip length.
    if (start !== cur.start_date || end !== cur.end_date) {
      const days = tripDays(start, end);
      db.prepare(`UPDATE trip_items SET qty = per_day * ? WHERE trip_id = ? AND per_day IS NOT NULL`)
        .run(days, id);
    }
  })();
  return true;
}

export function deleteTrip(id: string): boolean {
  return getDb().prepare(`DELETE FROM trips WHERE id = ?`).run(id).changes > 0;
}

/** Copy a trip's checklist into a new trip (all unpacked), e.g. "same as last year". */
export function duplicateTrip(id: string, input: TripInput): string | null {
  const db = getDb();
  const src = tripRow(id);
  if (!src) return null;
  const newId = randomUUID();
  const ts = now();
  let start = dateOrNull(input.startDate);
  let end = dateOrNull(input.endDate);
  if (start && end && end < start) [start, end] = [end, start];
  if (!start && end) [start, end] = [end, null];
  const days = tripDays(start, end);

  db.transaction(() => {
    db.prepare(`INSERT INTO trips (id,name,destination,trip_type_id,trip_type_name,trip_type_icon,
                start_date,end_date,note,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(newId, text(input.name, 120) || `${src.name} (copy)`,
        input.destination !== undefined ? text(input.destination, 120) : src.destination,
        src.trip_type_id, src.trip_type_name, src.trip_type_icon, start, end, src.note, ts, ts);

    const listMap = new Map<string, string>();
    const lists = db.prepare(`SELECT * FROM trip_lists WHERE trip_id = ? ORDER BY position`).all(id) as TripListRow[];
    const insList = db.prepare(`INSERT INTO trip_lists (id,trip_id,list_type_id,name,icon,color,position)
                                VALUES (?,?,?,?,?,?,?)`);
    for (const l of lists) {
      const lid = randomUUID();
      listMap.set(l.id, lid);
      insList.run(lid, newId, l.list_type_id, l.name, l.icon, l.color, l.position);
    }
    const items = db.prepare(`SELECT * FROM trip_items WHERE trip_id = ? ORDER BY position`).all(id) as TripItemRow[];
    const insItem = db.prepare(`INSERT INTO trip_items (id,trip_id,trip_list_id,source_item_id,name,qty,per_day,
                                note,packed,position,createdAt) VALUES (?,?,?,?,?,?,?,?,0,?,?)`);
    for (const i of items) {
      insItem.run(randomUUID(), newId, i.trip_list_id ? listMap.get(i.trip_list_id) ?? null : null,
        i.source_item_id, i.name, i.per_day != null ? i.per_day * days : i.qty, i.per_day, i.note,
        i.position, ts);
    }
  })();
  return newId;
}

// --- lists on a trip -----------------------------------------------------------

/** Must run inside a transaction. Returns the trip_list id, or null if missing/already attached. */
function attachListInTx(tripId: string, listTypeId: string): string | null {
  const db = getDb();
  const trip = tripRow(tripId);
  const lt = db.prepare(`SELECT * FROM list_types WHERE id = ?`).get(listTypeId) as ListTypeRow | undefined;
  if (!trip || !lt) return null;
  if (db.prepare(`SELECT 1 FROM trip_lists WHERE trip_id = ? AND list_type_id = ?`).get(tripId, listTypeId)) {
    return null;
  }
  db.prepare(`DELETE FROM trip_dismissed_lists WHERE trip_id = ? AND list_type_id = ?`).run(tripId, listTypeId);
  const tlId = randomUUID();
  db.prepare(`INSERT INTO trip_lists (id,trip_id,list_type_id,name,icon,color,position) VALUES (?,?,?,?,?,?,?)`)
    .run(tlId, tripId, lt.id, lt.name, lt.icon, lt.color, nextPos("trip_lists", "trip_id = ?", [tripId]));

  const days = tripDays(trip.start_date, trip.end_date);
  const items = db
    .prepare(`SELECT * FROM list_items WHERE list_type_id = ? ORDER BY position, createdAt`)
    .all(listTypeId) as ListItemRow[];
  const ins = db.prepare(`INSERT INTO trip_items (id,trip_id,trip_list_id,source_item_id,name,qty,per_day,
                          note,packed,position,createdAt) VALUES (?,?,?,?,?,?,?,?,0,?,?)`);
  const ts = now();
  items.forEach((it, i) => {
    ins.run(randomUUID(), tripId, tlId, it.id, it.name, packQty(it.qty, it.per_day === 1, days),
      it.per_day === 1 ? it.qty : null, it.note, i, ts);
  });
  return tlId;
}

export function attachList(tripId: string, listTypeId: string): string | null {
  return getDb().transaction(() => attachListInTx(tripId, listTypeId))();
}

/**
 * Remove a whole section (and its items) from one trip. Master list untouched.
 * Remembered as dismissed so sync won't offer it back as "now required".
 */
export function detachList(tripListId: string): boolean {
  const db = getDb();
  const tl = db.prepare(`SELECT * FROM trip_lists WHERE id = ?`).get(tripListId) as TripListRow | undefined;
  if (!tl) return false;
  db.transaction(() => {
    if (tl.list_type_id) {
      db.prepare(`INSERT OR IGNORE INTO trip_dismissed_lists (trip_id, list_type_id) VALUES (?, ?)`)
        .run(tl.trip_id, tl.list_type_id);
    }
    db.prepare(`DELETE FROM trip_lists WHERE id = ?`).run(tripListId);
  })();
  return true;
}

export interface SyncPreview {
  /** Items in master lists the trip doesn't have yet, per section. */
  newItems: { tripListId: string; listName: string; itemId: string; name: string; qty: number }[];
  /** Lists the trip type now requires that the trip doesn't carry. */
  newLists: { listTypeId: string; name: string; icon: string; count: number }[];
}

/** What "pull in updates" would add — computed without writing. */
export function previewSync(tripId: string): SyncPreview | null {
  const db = getDb();
  const trip = tripRow(tripId);
  if (!trip) return null;
  const days = tripDays(trip.start_date, trip.end_date);
  const lists = db
    .prepare(`SELECT * FROM trip_lists WHERE trip_id = ? AND list_type_id IS NOT NULL ORDER BY position`)
    .all(tripId) as TripListRow[];
  const have = new Set(
    (db.prepare(`SELECT source_item_id FROM trip_items WHERE trip_id = ? AND source_item_id IS NOT NULL`)
      .all(tripId) as { source_item_id: string }[]).map((r) => r.source_item_id),
  );
  const masterItems = db.prepare(`SELECT * FROM list_items WHERE list_type_id = ? ORDER BY position, createdAt`);

  const newItems: SyncPreview["newItems"] = [];
  for (const l of lists) {
    for (const it of masterItems.all(l.list_type_id) as ListItemRow[]) {
      if (!have.has(it.id)) {
        newItems.push({ tripListId: l.id, listName: l.name, itemId: it.id, name: it.name,
          qty: packQty(it.qty, it.per_day === 1, days) });
      }
    }
  }

  const newLists: SyncPreview["newLists"] = [];
  if (trip.trip_type_id) {
    const attached = new Set<string | null>(lists.map((l) => l.list_type_id));
    for (const d of db.prepare(`SELECT list_type_id FROM trip_dismissed_lists WHERE trip_id = ?`)
      .all(tripId) as { list_type_id: string }[]) attached.add(d.list_type_id);
    const req = db
      .prepare(`SELECT l.*, (SELECT COUNT(*) FROM list_items i WHERE i.list_type_id = l.id) AS cnt
                FROM trip_type_lists x JOIN list_types l ON l.id = x.list_type_id
                WHERE x.trip_type_id = ? ORDER BY l.position, l.name`)
      .all(trip.trip_type_id) as (ListTypeRow & { cnt: number })[];
    for (const l of req) {
      if (!attached.has(l.id)) newLists.push({ listTypeId: l.id, name: l.name, icon: l.icon, count: l.cnt });
    }
  }
  return { newItems, newLists };
}

/**
 * Pull master-list changes into a trip: add items that appeared in its attached
 * lists, and attach lists its trip type has started requiring. Never removes or
 * edits anything already on the trip — packed state is sacred.
 */
export function syncTrip(tripId: string): { items: number; lists: number } | null {
  const preview = previewSync(tripId);
  if (!preview) return null;
  const db = getDb();
  const trip = tripRow(tripId)!;
  const days = tripDays(trip.start_date, trip.end_date);
  const getItem = db.prepare(`SELECT * FROM list_items WHERE id = ?`);
  const ins = db.prepare(`INSERT INTO trip_items (id,trip_id,trip_list_id,source_item_id,name,qty,per_day,
                          note,packed,position,createdAt) VALUES (?,?,?,?,?,?,?,?,0,?,?)`);
  let lists = 0;
  db.transaction(() => {
    const ts = now();
    for (const n of preview.newItems) {
      const it = getItem.get(n.itemId) as ListItemRow | undefined;
      if (!it) continue;
      ins.run(randomUUID(), tripId, n.tripListId, it.id, it.name, packQty(it.qty, it.per_day === 1, days),
        it.per_day === 1 ? it.qty : null, it.note, nextPos("trip_items", "trip_id = ?", [tripId]), ts);
    }
    for (const l of preview.newLists) if (attachListInTx(tripId, l.listTypeId)) lists++;
  })();
  return { items: preview.newItems.length, lists };
}

// --- items on a trip -----------------------------------------------------------

export interface TripItemInput {
  name?: unknown; qty?: unknown; note?: unknown; packed?: unknown; tripListId?: unknown;
}

/** Add an ad hoc item. `tripListId` null/omitted → the trip's Extras section. */
export function addTripItem(tripId: string, input: TripItemInput): TripItem | null {
  const name = text(input.name);
  if (!name || !tripRow(tripId)) return null;
  const db = getDb();
  let listId: string | null = null;
  if (typeof input.tripListId === "string" && input.tripListId) {
    if (!db.prepare(`SELECT 1 FROM trip_lists WHERE id = ? AND trip_id = ?`).get(input.tripListId, tripId)) return null;
    listId = input.tripListId;
  }
  const row: TripItemRow = {
    id: randomUUID(), trip_id: tripId, trip_list_id: listId, source_item_id: null, name,
    qty: qtyOf(input.qty), per_day: null, note: text(input.note, 500), packed: 0,
    position: nextPos("trip_items", "trip_id = ?", [tripId]),
  };
  db.prepare(`INSERT INTO trip_items (id,trip_id,trip_list_id,source_item_id,name,qty,per_day,note,packed,position,createdAt)
              VALUES (@id,@trip_id,@trip_list_id,@source_item_id,@name,@qty,@per_day,@note,@packed,@position,@createdAt)`)
    .run({ ...row, createdAt: now() });
  touchTrip(tripId);
  return toTripItem(row);
}

export function updateTripItem(id: string, input: TripItemInput): TripItem | null {
  const db = getDb();
  const cur = db.prepare(`SELECT * FROM trip_items WHERE id = ?`).get(id) as TripItemRow | undefined;
  if (!cur) return null;
  const qtyChanged = input.qty !== undefined && qtyOf(input.qty, cur.qty) !== cur.qty;
  const next: TripItemRow = {
    ...cur,
    name: input.name !== undefined ? text(input.name) || cur.name : cur.name,
    qty: input.qty !== undefined ? qtyOf(input.qty, cur.qty) : cur.qty,
    // A hand-edited quantity stops scaling with the trip's dates.
    per_day: qtyChanged ? null : cur.per_day,
    note: input.note !== undefined ? text(input.note, 500) : cur.note,
    packed: input.packed !== undefined ? (input.packed ? 1 : 0) : cur.packed,
  };
  db.prepare(`UPDATE trip_items SET name=@name, qty=@qty, per_day=@per_day, note=@note, packed=@packed WHERE id=@id`)
    .run(next);
  touchTrip(cur.trip_id);
  return toTripItem(next);
}

export function deleteTripItem(id: string): boolean {
  return getDb().prepare(`DELETE FROM trip_items WHERE id = ?`).run(id).changes > 0;
}

/** Mark every item on a trip packed / unpacked (e.g. "unpack all" for the return leg). */
export function setAllPacked(tripId: string, packed: boolean): number {
  const n = getDb().prepare(`UPDATE trip_items SET packed = ? WHERE trip_id = ?`).run(packed ? 1 : 0, tripId).changes;
  touchTrip(tripId);
  return n;
}

/**
 * Copy an ad hoc trip item into a master list so future trips get it. The trip
 * item moves into that list's section on this trip (if the trip carries it) and
 * is linked to the new master item so a later sync won't duplicate it.
 */
export function promoteTripItem(id: string, listTypeId: string): ListItem | null {
  const db = getDb();
  const cur = db.prepare(`SELECT * FROM trip_items WHERE id = ?`).get(id) as TripItemRow | undefined;
  if (!cur) return null;
  let created: ListItem | null = null;
  db.transaction(() => {
    created = createListItem(listTypeId, { name: cur.name, qty: cur.qty, note: cur.note });
    if (!created) return;
    const section = db
      .prepare(`SELECT id FROM trip_lists WHERE trip_id = ? AND list_type_id = ?`)
      .get(cur.trip_id, listTypeId) as { id: string } | undefined;
    db.prepare(`UPDATE trip_items SET source_item_id = ?, trip_list_id = COALESCE(?, trip_list_id) WHERE id = ?`)
      .run(created.id, section?.id ?? null, id);
  })();
  return created;
}

function touchTrip(id: string) {
  getDb().prepare(`UPDATE trips SET updatedAt = ? WHERE id = ?`).run(now(), id);
}
