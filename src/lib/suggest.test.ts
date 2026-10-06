import { test } from "node:test";
import assert from "node:assert/strict";
import { commonSuggestions, historySuggestions, normName, suggestFor, type SuggestTrip } from "./suggest.ts";

const trip = (o: Partial<Omit<SuggestTrip, "items">> & { items?: [string, string?][] }): SuggestTrip => ({
  id: o.id ?? "t", name: o.name ?? "Trip", destination: o.destination ?? "", tripTypeId: o.tripTypeId ?? null,
  tripTypeName: o.tripTypeName ?? "", startDate: o.startDate ?? null, days: o.days ?? 3,
  listNames: o.listNames ?? [],
  items: (o.items ?? []).map(([name, listName]) => ({ name, qty: 1, perDay: false, listName: listName ?? null })),
});
const names = (xs: { name: string }[]) => xs.map((x) => x.name);

test("normName folds case, punctuation, plurals and filler", () => {
  assert.equal(normName("Phone + Chargers"), "phone charger");
  assert.equal(normName("The Swim Trunks"), "swim trunk");
  assert.equal(normName("Batteries"), "battery");
  assert.equal(normName("Glasses"), "glass");
  assert.equal(normName("Dress"), "dress");
});

test("common: essentials suggested, already-packed ones (incl. aliases) skipped", () => {
  const s = names(commonSuggestions(trip({ items: [["Phone + charger"], ["Toothbrush"], ["Meds"]] })));
  assert.ok(s.includes("Toothpaste"));
  assert.ok(!s.includes("Phone charger"), "alias 'phone and charger' covers it");
  assert.ok(!s.includes("Toothbrush"));
  assert.ok(!s.includes("Medications"), "alias 'meds'");
});

test("common: an alias doesn't over-match a different item", () => {
  // "Laptop + charger" must not count as a phone charger.
  assert.ok(names(commonSuggestions(trip({ items: [["Laptop + charger"]] }))).includes("Phone charger"));
  // A bare "Phone" isn't a charger either; "Credit card" isn't a gift card.
  assert.ok(names(commonSuggestions(trip({ items: [["Phone"]] }))).includes("Phone charger"));
  const wed = names(commonSuggestions(trip({ name: "Wedding", items: [["Credit card"], ["Dress shirts"]] })));
  assert.ok(wed.includes("Gift / card"));
  assert.ok(wed.includes("Formal outfit"));
  // …but a more specific item does cover the generic one.
  assert.ok(!names(commonSuggestions(trip({ destination: "Cabo", items: [["Sunscreen SPF 50"]] }))).includes("Sunscreen"));
});

test("common: context rules fire on trip text, length and month", () => {
  const beach = names(commonSuggestions(trip({ destination: "Cabo", days: 5 })));
  for (const n of ["Sunscreen", "Swimsuit", "Flip-flops", "Passport", "Laundry bag"]) assert.ok(beach.includes(n), n);
  assert.ok(!beach.includes("Gloves"));

  const ski = names(commonSuggestions(trip({ tripTypeName: "Winter Trip", days: 2, startDate: "2027-01-10" })));
  for (const n of ["Warm jacket", "Gloves", "Beanie"]) assert.ok(ski.includes(n), n);
  assert.ok(!ski.includes("Laundry bag"), "2 days is too short");

  const work = names(commonSuggestions(trip({ name: "Chicago conference", listNames: ["Flying"] })));
  for (const n of ["Laptop + charger", "Boarding pass", "Dress shoes"]) assert.ok(work.includes(n), n);
});

test("common: per-day essentials keep their mode", () => {
  const u = commonSuggestions(trip({})).find((s) => s.name === "Underwear")!;
  assert.equal(u.perDay, true);
  assert.equal(u.qty, 1);
});

test("history: needs 2+ points; same destination and type weigh more", () => {
  const cur = trip({ id: "now", destination: "Cabo", tripTypeId: "beach", tripTypeName: "Beach Vacation", listNames: ["Beach"] });
  const others = [
    trip({ id: "a", destination: "Cabo", items: [["Snorkel", "Beach"]] }),                       // same dest → 3
    trip({ id: "b", tripTypeId: "beach", items: [["Kindle"]] }),                                 // same type → 2
    trip({ id: "c", items: [["Golf clubs"]] }),                                                  // 1 → hidden
    trip({ id: "d", items: [["Umbrella"]] }), trip({ id: "e", items: [["Umbrella"]] }),          // 2 trips → 2
  ];
  const h = historySuggestions(cur, others);
  assert.deepEqual(names(h).sort(), ["Kindle", "Snorkel", "Umbrella"]);
  const snorkel = h.find((x) => x.name === "Snorkel")!;
  assert.match(snorkel.reason, /last time you went to Cabo/);
  assert.equal(snorkel.listName, "Beach", "remembers the section it lived in");
  assert.match(h.find((x) => x.name === "Kindle")!.reason, /Beach Vacation/);
});

test("history: items already on the trip are skipped (fuzzy name)", () => {
  const cur = trip({ id: "now", items: [["Umbrellas"]] });
  const h = historySuggestions(cur, [trip({ id: "a", items: [["Umbrella"]] }), trip({ id: "b", items: [["umbrella"]] })]);
  assert.equal(h.length, 0);
});

test("suggestFor: history first, de-duped against common, dismissals honoured, limit", () => {
  const cur = trip({ id: "now", destination: "Cabo" });
  const others = [trip({ id: "a", destination: "Cabo", items: [["Sunscreen"], ["Snorkel"]] })];
  const all = suggestFor(cur, others);
  assert.equal(all[0].source, "history");
  assert.equal(all.filter((s) => s.key === "sunscreen").length, 1, "no duplicate across sources");
  assert.equal(all.find((s) => s.key === "sunscreen")!.source, "history");
  const after = suggestFor(cur, others, ["snorkel", "sunscreen"]);
  assert.ok(!after.some((s) => s.key === "snorkel" || s.key === "sunscreen"));
  assert.equal(suggestFor(cur, others, [], 3).length, 3);
});

test("suggestFor: 3+ items from a list the trip lacks collapse into one 'add list' row", () => {
  const cur = trip({ id: "now", destination: "Cabo", items: [["Toothbrush"]] });
  const beachItems: [string, string?][] = [["Beach towel", "Beach"], ["Snorkel", "Beach"], ["Swim fins", "Beach"], ["Kindle"]];
  const others = [trip({ id: "a", destination: "Cabo", items: beachItems })];
  const s = suggestFor(cur, others, [], 12, ["Beach"]);
  const row = s.find((x) => x.kind === "list")!;
  assert.equal(row.name, "Beach list");
  assert.equal(row.count, 3);
  assert.ok(!s.some((x) => x.name === "Snorkel"), "folded into the list row");
  assert.ok(s.some((x) => x.name === "Kindle"), "ad hoc items stay separate");
  assert.ok(!s.some((x) => x.name === "Beach towel" || x.key === "snorkel"), "no common duplicates of the list's items");
  // Deleted master list → can't attach it, so the items come back individually.
  const gone = suggestFor(cur, others, [], 12, []);
  assert.ok(!gone.some((x) => x.kind === "list"));
  assert.ok(gone.some((x) => x.name === "Snorkel"));
  // Ad hoc beats list items at equal history weight.
  const h = historySuggestions(cur, others);
  assert.equal(h.sort((a, b) => b.score - a.score)[0].name, "Kindle");
});
