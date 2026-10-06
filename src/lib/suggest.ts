// Suggested items for a trip — pure (no DB, no Node APIs) so it's unit-testable.
//
// Two sources, merged and de-duplicated:
//   1. history — things that were on your OTHER trips but aren't on this one,
//      weighted toward trips of the same type or to the same destination.
//   2. common  — a small built-in catalog of things people usually bring, each
//      gated by a rule about this trip (length, type, lists, destination words).
// Anything already on the trip (by normalised name or alias) or dismissed for
// this trip is left out.

export interface SuggestItem { name: string; qty: number; perDay: boolean; listName: string | null }

export interface SuggestTrip {
  id: string;
  name: string;
  destination: string;
  tripTypeId: string | null;
  tripTypeName: string;
  startDate: string | null;
  days: number;
  listNames: string[];
  items: SuggestItem[];
}

export interface Suggestion {
  /** Stable per-name key; used for dismissals. "list:<name>" for a whole-list suggestion. */
  key: string;
  /** "item" adds one item; "list" attaches a whole master list (`listName`). */
  kind: "item" | "list";
  /** For kind "list": how many of its items you packed before. */
  count?: number;
  name: string;
  qty: number;
  perDay: boolean;
  source: "history" | "common";
  reason: string;
  /** The trip section it belongs in, when the trip has one by that name. */
  listName: string | null;
  score: number;
}

// --- names -------------------------------------------------------------------

const STOP = new Set(["a", "an", "the", "my", "your", "of", "and", "pair", "pairs", "set"]);

/** "Phone + Charger(s)" → "phone charger". Plurals folded, filler words dropped. */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("ies") ? `${w.slice(0, -3)}y`
      : w.length > 3 && w.endsWith("es") && /(ch|sh|ss|x)es$/.test(w) ? w.slice(0, -2)
      : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ")
    .trim();
}

/** True when `alias` appears in `name` as whole words ("sunscreen" ⊂ "sunscreen spf 50"). */
function containsWords(name: string, alias: string): boolean {
  if (!alias) return false;
  return name === alias || ` ${name} `.includes(` ${alias} `);
}

// --- common-sense catalog ----------------------------------------------------

interface Ctx {
  days: number;
  /** Lower-cased: trip name, trip type, destination and list names together. */
  text: string;
  month: number | null; // 1-12
  lists: string[];       // normalised list names on the trip
}

const has = (ctx: Ctx, ...words: string[]) => words.some((w) => containsWords(normName(ctx.text), normName(w)));
const hasList = (ctx: Ctx, ...names: string[]) => names.some((n) => ctx.lists.some((l) => containsWords(l, normName(n))));

const BEACH = ["beach", "island", "resort", "cruise", "lake", "pool", "tropical", "hawaii", "maui", "cabo",
  "cancun", "mexico", "caribbean", "bahamas", "jamaica", "florida", "miami", "key west", "aruba", "puerto rico",
  "san diego", "bali", "coast", "ocean", "swim", "snorkel"];
const COLD = ["ski", "snow", "winter", "snowboard", "cold", "alaska", "colorado", "aspen", "vail", "tahoe",
  "iceland", "canada", "mountain", "christmas"];
const WORK = ["business", "work", "conference", "meeting", "office", "client", "offsite", "summit"];
const OUTDOOR = ["camping", "camp", "hike", "hiking", "trail", "backpacking", "national park", "cabin", "fishing"];
const FORMAL = ["wedding", "gala", "formal", "funeral", "reunion", "party", "anniversary", "birthday"];
const ROAD = ["road trip", "drive", "driving", "car"];
const FLY = ["flight", "flying", "fly", "airport", "international", "abroad", "overseas", "europe", "japan",
  "london", "paris", "italy", "spain"];
const ABROAD = ["international", "abroad", "overseas", "europe", "japan", "london", "paris", "italy", "spain",
  "mexico", "cabo", "cancun", "bahamas", "jamaica", "aruba", "caribbean", "canada", "iceland", "bali"];

interface Rule {
  name: string;
  aliases?: string[];
  qty?: number;
  perDay?: boolean;
  /** Sort weight within the common group (higher first). */
  weight: number;
  when: (c: Ctx) => string | null; // reason, or null when it doesn't apply
}

const always = (why = "Almost everyone brings this") => () => why;

const RULES: Rule[] = [
  // Everyday essentials
  { name: "Phone charger", aliases: ["phone charger", "phone and charger", "iphone charger", "phone cable", "charging cable", "lightning cable", "usb c cable"], weight: 10, when: always() },
  { name: "Toothbrush", weight: 10, when: always() },
  { name: "Toothpaste", weight: 9, when: always() },
  { name: "Deodorant", weight: 9, when: always() },
  { name: "Medications", aliases: ["medication", "medicine", "meds", "prescription", "pill"], weight: 9, when: always("Easy to forget, hard to replace") },
  { name: "Wallet / ID", aliases: ["wallet", "id", "driver license", "license"], weight: 10, when: always() },
  { name: "Underwear", qty: 1, perDay: true, weight: 9, when: always("One per day") },
  { name: "Socks", qty: 1, perDay: true, weight: 9, when: (c) => (has(c, ...BEACH) && c.days <= 3 ? null : "One pair per day") },
  { name: "Sleepwear", aliases: ["pajama", "pyjama", "pjs", "sleep clothe"], weight: 6, when: (c) => (c.days >= 2 ? "You're staying overnight" : null) },
  { name: "Hairbrush", aliases: ["brush", "comb"], weight: 4, when: (c) => (c.days >= 2 ? "You're staying overnight" : null) },
  { name: "Toiletry bag", aliases: ["dopp kit", "toiletry kit", "wash bag"], weight: 4, when: (c) => (c.days >= 2 ? "Keeps the bathroom things together" : null) },
  { name: "Laundry bag", aliases: ["dirty clothes bag"], weight: 5, when: (c) => (c.days >= 4 ? `${c.days}-day trip — somewhere for dirty clothes` : null) },
  { name: "Laundry detergent pods", aliases: ["detergent", "laundry soap"], qty: 2, weight: 4, when: (c) => (c.days >= 7 ? `${c.days} days is long enough for a wash` : null) },
  { name: "Power bank", aliases: ["battery pack", "portable charger"], weight: 4, when: (c) => (c.days >= 3 || has(c, ...FLY, ...OUTDOOR) ? "Phones die on travel days" : null) },
  { name: "Reusable water bottle", aliases: ["water bottle"], weight: 3, when: (c) => (has(c, ...OUTDOOR, ...BEACH) ? "Staying hydrated outside" : null) },

  // Flying / abroad
  { name: "Boarding pass", weight: 8, when: (c) => (hasList(c, "flying", "flight") || has(c, ...FLY) ? "You're flying" : null) },
  { name: "Headphones", aliases: ["earbud", "airpod", "headphone"], weight: 6, when: (c) => (hasList(c, "flying", "flight") || has(c, ...FLY) || c.days >= 3 ? "For the journey" : null) },
  { name: "Passport", weight: 9, when: (c) => (has(c, ...ABROAD) ? "Looks like an international trip" : null) },
  { name: "Travel adapter", aliases: ["plug adapter", "power adapter", "adapter"], weight: 6, when: (c) => (has(c, "europe", "london", "paris", "italy", "spain", "japan", "iceland", "bali", "overseas") ? "Different outlets abroad" : null) },

  // Beach / sun
  { name: "Sunscreen", aliases: ["sunblock", "spf"], weight: 9, when: (c) => (has(c, ...BEACH, ...OUTDOOR) || (c.month != null && c.month >= 5 && c.month <= 9) ? "Sun exposure" : null) },
  { name: "Swimsuit", aliases: ["swimsuit", "swim trunk", "bathing suit", "bikini", "swimwear"], qty: 2, weight: 9, when: (c) => (has(c, ...BEACH) ? "Beach/pool trip" : null) },
  { name: "Sunglasses", aliases: ["sunglasse", "shade"], weight: 7, when: (c) => (has(c, ...BEACH, ...ROAD, ...COLD) ? "Bright sun (or snow glare)" : null) },
  { name: "Flip-flops", aliases: ["flip flop", "sandal", "slide"], weight: 6, when: (c) => (has(c, ...BEACH) ? "Beach/pool trip" : null) },
  { name: "After-sun lotion", aliases: ["aloe", "after sun"], weight: 4, when: (c) => (has(c, ...BEACH) ? "For the day you forget sunscreen" : null) },
  { name: "Hat", aliases: ["cap", "sun hat"], weight: 5, when: (c) => (has(c, ...BEACH, ...OUTDOOR) ? "Sun protection" : null) },

  // Cold
  { name: "Warm jacket", aliases: ["coat", "jacket", "parka"], weight: 8, when: (c) => (has(c, ...COLD) || (c.month != null && (c.month === 12 || c.month <= 2)) ? "Cold weather" : null) },
  { name: "Gloves", aliases: ["glove", "mitten"], weight: 6, when: (c) => (has(c, ...COLD) ? "Cold weather" : null) },
  { name: "Beanie", aliases: ["beanie", "winter hat", "toque"], weight: 5, when: (c) => (has(c, ...COLD) ? "Cold weather" : null) },
  { name: "Lip balm", aliases: ["chapstick", "lip balm"], weight: 4, when: (c) => (has(c, ...COLD, ...BEACH) ? "Dry or sunny air" : null) },

  // Work
  { name: "Laptop + charger", aliases: ["laptop", "computer"], weight: 8, when: (c) => (has(c, ...WORK) ? "Work trip" : null) },
  { name: "Work badge", aliases: ["badge"], weight: 6, when: (c) => (has(c, ...WORK) ? "Work trip" : null) },
  { name: "Dress shoes", weight: 5, when: (c) => (has(c, ...WORK, ...FORMAL) ? "Dressier occasions" : null) },

  // Formal / events
  { name: "Formal outfit", aliases: ["suit", "formal wear", "gown", "tuxedo", "cocktail dress", "formal dress"], weight: 7, when: (c) => (has(c, ...FORMAL) ? "There's an event" : null) },
  { name: "Gift / card", aliases: ["gift", "gift card", "greeting card", "present"], weight: 5, when: (c) => (has(c, "wedding", "birthday", "anniversary", "party") ? "Celebrating someone" : null) },

  // Outdoors
  { name: "Bug spray", aliases: ["insect repellent", "bug repellent"], weight: 7, when: (c) => (has(c, ...OUTDOOR) ? "Outdoors" : null) },
  { name: "First-aid kit", aliases: ["first aid", "band aid", "bandage"], weight: 6, when: (c) => (has(c, ...OUTDOOR) || c.days >= 7 ? "Just in case" : null) },
  { name: "Headlamp", aliases: ["flashlight", "torch"], weight: 6, when: (c) => (has(c, ...OUTDOOR) ? "Dark campsites" : null) },
  { name: "Rain jacket", aliases: ["raincoat", "poncho", "rain shell"], weight: 5, when: (c) => (has(c, ...OUTDOOR) ? "Weather changes fast outdoors" : null) },

  // Road trips
  { name: "Car charger", aliases: ["car charger", "car adapter"], weight: 6, when: (c) => (has(c, ...ROAD) ? "Road trip" : null) },
  { name: "Snacks", aliases: ["snack"], weight: 5, when: (c) => (has(c, ...ROAD, ...FLY) ? "For the journey" : null) },
];

/** Is something matching this name (or any alias) already on the trip? */
function alreadyOn(onTrip: string[], name: string, aliases: string[] = []): boolean {
  const cands = [name, ...aliases].map(normName).filter(Boolean);
  // One direction only: "sunscreen spf 50" covers "sunscreen", but a bare
  // "phone" on the trip must not count as a phone charger.
  return onTrip.some((t) => cands.some((a) => containsWords(t, a)));
}

export function commonSuggestions(trip: SuggestTrip): Suggestion[] {
  const ctx: Ctx = {
    days: trip.days,
    text: [trip.name, trip.tripTypeName, trip.destination, ...trip.listNames].join(" "),
    month: trip.startDate ? Number(trip.startDate.slice(5, 7)) : null,
    lists: trip.listNames.map(normName),
  };
  const onTrip = trip.items.map((i) => normName(i.name));
  const out: Suggestion[] = [];
  for (const r of RULES) {
    const reason = r.when(ctx);
    if (!reason || alreadyOn(onTrip, r.name, r.aliases)) continue;
    out.push({
      key: normName(r.name), kind: "item", name: r.name, qty: r.qty ?? 1, perDay: Boolean(r.perDay),
      source: "common", reason, listName: null, score: r.weight,
    });
  }
  return out;
}

// --- history -----------------------------------------------------------------

/**
 * Items from other trips that this one lacks. Each other trip that carried it
 * counts 1, +1 if it was the same trip type, +2 if to the same destination.
 * Needs a score of 2+ (e.g. two trips, or one trip to the same place) so a
 * one-off from an unrelated trip doesn't show up.
 */
export function historySuggestions(trip: SuggestTrip, others: SuggestTrip[]): Suggestion[] {
  const onTrip = trip.items.map((i) => normName(i.name));
  const dest = normName(trip.destination);
  const agg = new Map<string, {
    item: SuggestItem; score: number; trips: number; sameType: number; sameDest: number; lastStart: string;
    adHoc: boolean;
  }>();
  for (const o of others) {
    if (o.id === trip.id) continue;
    const sameType = Boolean(trip.tripTypeId && o.tripTypeId === trip.tripTypeId);
    const sameDest = Boolean(dest && normName(o.destination) === dest);
    const seen = new Set<string>();
    for (const it of o.items) {
      const k = normName(it.name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const cur = agg.get(k) ?? { item: it, score: 0, trips: 0, sameType: 0, sameDest: 0, lastStart: "", adHoc: false };
      // Something you added by hand (not from a list) is a stronger, more personal signal.
      if (!it.listName) cur.adHoc = true;
      cur.trips += 1;
      cur.score += 1 + (sameType ? 1 : 0) + (sameDest ? 2 : 0);
      if (sameType) cur.sameType += 1;
      if (sameDest) cur.sameDest += 1;
      // Keep the most recent trip's version (name/qty/mode).
      const start = o.startDate ?? "";
      if (start >= cur.lastStart) { cur.item = it; cur.lastStart = start; }
      agg.set(k, cur);
    }
  }
  const out: Suggestion[] = [];
  for (const [k, a] of agg) {
    if (a.score < 2 || alreadyOn(onTrip, a.item.name)) continue;
    const reason = a.sameDest
      ? `Packed last time you went to ${trip.destination}`
      : a.sameType && trip.tripTypeName
        ? `On ${a.sameType} of your past ${trip.tripTypeName} trips`
        : `On ${a.trips} of your past trips`;
    out.push({
      key: k, kind: "item", name: a.item.name, qty: a.item.qty, perDay: a.item.perDay,
      source: "history", reason,
      // Where it lived last time: used to file it into the same section, or to
      // offer that whole list when the trip doesn't carry it.
      listName: a.item.listName,
      score: 100 + a.score + (a.adHoc ? 0.5 : 0), // history outranks generic advice
    });
  }
  return out;
}

const LIST_MIN = 3;

/**
 * Both sources, best first, minus anything dismissed for this trip. When 3+
 * history items came from one master list the trip doesn't carry (and that
 * list still exists — `masterLists`), they collapse into one "add the list" row.
 */
export function suggestFor(
  trip: SuggestTrip, others: SuggestTrip[], dismissed: string[] = [], limit = 12, masterLists: string[] = [],
): Suggestion[] {
  const gone = new Set(dismissed);
  const byKey = new Map<string, Suggestion>();
  const history = historySuggestions(trip, others);
  const groups = new Map<string, Suggestion[]>();
  for (const h of history) {
    if (h.listName && !trip.listNames.includes(h.listName) && masterLists.includes(h.listName)) {
      groups.set(h.listName, [...(groups.get(h.listName) ?? []), h]);
    }
  }
  const collapsed = new Set<string>();
  const listRows: Suggestion[] = [];
  for (const [name, hs] of groups) {
    if (hs.length < LIST_MIN) continue;
    for (const h of hs) collapsed.add(h.key);
    const best = hs.reduce((a, b) => (b.score > a.score ? b : a));
    listRows.push({
      key: `list:${normName(name)}`, kind: "list", name: `${name} list`, qty: 1, perDay: false,
      source: "history", listName: name, count: hs.length,
      reason: /went to /.test(best.reason)
        ? `${hs.length} items you took to ${trip.destination} last time`
        : /past (.+) trips$/.test(best.reason) && trip.tripTypeName
          ? `${hs.length} items from your past ${trip.tripTypeName} trips`
          : `${hs.length} items from your past trips`,
      score: best.score + 0.25,
    });
  }
  for (const h of history) {
    // A section the trip has → file it there; otherwise Extras.
    if (h.listName && !trip.listNames.includes(h.listName)) h.listName = null;
  }
  // A common-sense item that's inside an offered list is already covered by that row.
  const common = commonSuggestions(trip).filter((c) => !collapsed.has(c.key));
  for (const s of [...listRows, ...history.filter((h) => !collapsed.has(h.key)), ...common]) {
    if (gone.has(s.key)) continue;
    const prev = byKey.get(s.key);
    if (!prev || s.score > prev.score) byKey.set(s.key, s);
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}
