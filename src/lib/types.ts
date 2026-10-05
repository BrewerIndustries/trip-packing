// Shared shapes for server (db.ts) and client components.

export interface ListItem {
  id: string;
  listTypeId: string;
  name: string;
  /** Fixed quantity, or the per-day quantity when `perDay` is set. */
  qty: number;
  perDay: boolean;
  note: string;
  position: number;
}

export interface ListType {
  id: string;
  name: string;
  icon: string;
  color: ColorKey;
  position: number;
  items: ListItem[];
  /** Trip types that require this list. */
  tripTypeIds: string[];
}

export interface TripType {
  id: string;
  name: string;
  icon: string;
  position: number;
  /** List types this trip type requires. */
  listTypeIds: string[];
}

export interface TripItem {
  id: string;
  tripId: string;
  /** Section it sits in; null = the trip's "Extras" (ad hoc) section. */
  tripListId: string | null;
  /** The master list item it was copied from; null = ad hoc. */
  sourceItemId: string | null;
  name: string;
  qty: number;
  /** Per-day base quantity when the item scales with trip length. */
  perDay: number | null;
  note: string;
  packed: boolean;
  position: number;
}

/** A list attached to a trip — a snapshot of the list type's name/icon/color. */
export interface TripList {
  id: string;
  tripId: string;
  /** null once the master list type has been deleted (the snapshot survives). */
  listTypeId: string | null;
  name: string;
  icon: string;
  color: ColorKey;
  position: number;
}

export interface TripSummary {
  id: string;
  name: string;
  destination: string;
  tripTypeId: string | null;
  tripTypeName: string;
  tripTypeIcon: string;
  startDate: string | null;
  endDate: string | null;
  note: string;
  total: number;
  packed: number;
  createdAt: string;
}

export interface Trip extends TripSummary {
  lists: TripList[];
  items: TripItem[];
}

// --- colors ------------------------------------------------------------------

export const COLORS = {
  slate:  { chip: "#e8eaee", ink: "#3a4150", dot: "#7b8496" },
  blue:   { chip: "#dde9fb", ink: "#1f4c8f", dot: "#4a86e0" },
  teal:   { chip: "#d7f1ee", ink: "#14625a", dot: "#2bb3a3" },
  green:  { chip: "#def3dc", ink: "#2d6427", dot: "#58b350" },
  yellow: { chip: "#fbf0cf", ink: "#7a5a06", dot: "#e0b02c" },
  orange: { chip: "#fde5d3", ink: "#8c4310", dot: "#ec8a3e" },
  red:    { chip: "#fbdede", ink: "#8f2222", dot: "#e05454" },
  pink:   { chip: "#fbe0ef", ink: "#8a2460", dot: "#de5aa5" },
  purple: { chip: "#ebe2fa", ink: "#4d2c8a", dot: "#8c62d9" },
} as const;

export type ColorKey = keyof typeof COLORS;
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];

export function colorOf(v: unknown): ColorKey {
  return typeof v === "string" && v in COLORS ? (v as ColorKey) : "slate";
}
