import type Database from "better-sqlite3";
import { randomUUID } from "crypto";

// Starter lists + trip types for a brand-new database, so a fresh deploy is
// usable on day one. Everything is editable/deletable like user data.
// Items: [name, qty, perDay?]
type SeedItem = [string, number, boolean?];

const LISTS: { key: string; name: string; icon: string; color: string; items: SeedItem[] }[] = [
  { key: "essentials", name: "Essentials", icon: "🎒", color: "blue", items: [
    ["Phone + charger", 1], ["Wallet / ID", 1], ["Keys", 1], ["Medications", 1],
    ["Glasses / contacts", 1], ["Headphones", 1], ["Water bottle", 1],
  ] },
  { key: "toiletries", name: "Toiletries", icon: "🪥", color: "teal", items: [
    ["Toothbrush", 1], ["Toothpaste", 1], ["Deodorant", 1], ["Razor", 1],
    ["Shampoo / conditioner", 1], ["Hairbrush", 1], ["Sunscreen", 1], ["Lip balm", 1],
  ] },
  { key: "clothes", name: "Clothes", icon: "👕", color: "purple", items: [
    ["Underwear", 1, true], ["Socks", 1, true], ["T-shirts", 1, true], ["Pants / shorts", 2],
    ["Sleepwear", 1], ["Jacket", 1], ["Comfortable shoes", 1],
  ] },
  { key: "tech", name: "Tech", icon: "🔌", color: "slate", items: [
    ["Laptop + charger", 1], ["Power bank", 1], ["Watch charger", 1], ["Travel adapter", 1],
  ] },
  { key: "flying", name: "Flying", icon: "✈️", color: "yellow", items: [
    ["Boarding pass", 1], ["Passport", 1], ["Neck pillow", 1], ["Snacks", 1],
  ] },
  { key: "beach", name: "Beach", icon: "🏖️", color: "orange", items: [
    ["Swimsuit", 2], ["Beach towel", 1], ["Sunglasses", 1], ["Flip-flops", 1],
    ["Hat", 1], ["After-sun lotion", 1],
  ] },
  { key: "work", name: "Work", icon: "💼", color: "green", items: [
    ["Work laptop", 1], ["Badge", 1], ["Dress shirts", 1, true], ["Dress shoes", 1], ["Notebook + pen", 1],
  ] },
  { key: "cold", name: "Cold Weather", icon: "🧣", color: "red", items: [
    ["Winter coat", 1], ["Gloves", 1], ["Beanie", 1], ["Thermal layers", 2], ["Warm socks", 1, true],
  ] },
  { key: "camping", name: "Camping", icon: "🏕️", color: "pink", items: [
    ["Tent", 1], ["Sleeping bag", 1], ["Headlamp", 1], ["Bug spray", 1], ["First-aid kit", 1],
    ["Camp stove + fuel", 1],
  ] },
];

const TRIP_TYPES: { name: string; icon: string; lists: string[] }[] = [
  { name: "Weekend Getaway", icon: "🚗", lists: ["essentials", "toiletries", "clothes"] },
  { name: "Beach Vacation", icon: "🏝️", lists: ["essentials", "toiletries", "clothes", "flying", "beach"] },
  { name: "Business Trip", icon: "💼", lists: ["essentials", "toiletries", "clothes", "tech", "flying", "work"] },
  { name: "Winter Trip", icon: "⛷️", lists: ["essentials", "toiletries", "clothes", "cold"] },
  { name: "Camping", icon: "🏕️", lists: ["essentials", "toiletries", "clothes", "camping"] },
];

export function seed(db: Database.Database) {
  const ts = new Date().toISOString();
  const insList = db.prepare(`INSERT INTO list_types (id,name,icon,color,position,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)`);
  const insItem = db.prepare(`INSERT INTO list_items (id,list_type_id,name,qty,per_day,note,position,createdAt)
                              VALUES (?,?,?,?,?,'',?,?)`);
  const insType = db.prepare(`INSERT INTO trip_types (id,name,icon,position,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`);
  const insLink = db.prepare(`INSERT INTO trip_type_lists (trip_type_id,list_type_id) VALUES (?,?)`);

  db.transaction(() => {
    const ids = new Map<string, string>();
    LISTS.forEach((l, li) => {
      const id = randomUUID();
      ids.set(l.key, id);
      insList.run(id, l.name, l.icon, l.color, li, ts, ts);
      l.items.forEach(([name, qty, perDay], ii) => insItem.run(randomUUID(), id, name, qty, perDay ? 1 : 0, ii, ts));
    });
    TRIP_TYPES.forEach((t, ti) => {
      const id = randomUUID();
      insType.run(id, t.name, t.icon, ti, ts, ts);
      for (const k of t.lists) insLink.run(id, ids.get(k)!);
    });
  })();
}
