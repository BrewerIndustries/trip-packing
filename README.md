# 🧳 Trip Packing

Packing lists by trip type. Part of the Jarvis app family; **tailnet-only**.

| Env  | URL                                   | Branch | Port |
| ---- | ------------------------------------- | ------ | ---- |
| PROD | https://packing.dabrewer.dev          | `main` | 4840 |
| DEV  | https://packing.dev.dabrewer.dev      | `dev`  | 4850 |

## How it works

- **Lists** (`/lists`): reusable packing lists such as Essentials, Toiletries, Beach and Work.
- **Count / Per day**: every item has a quantity and one of two modes, on master lists and on
  trips alike. **Count** is a fixed number: 1 umbrella, 2 swimsuits, however long the trip.
  **Per day** is an amount per day, so 1/day of socks on a 4-day trip packs 4, and the number
  follows the trip if its dates change. On a trip, per-day items show the total plus a "1/day"
  tag. Switching an item's mode keeps its packed total (8 as a count ↔ 2/day on a 4-day trip).
- **Trip types** (`/trip-types`): Weekend Getaway, Business Trip, and so on. Tap a list's chip
  to mark it as required for that trip type.
- **Trips** (`/`): pick a trip type and dates. Every required list (plus any extras you add)
  is **copied** into the trip as its own checklist.
  - Check items off. The progress bar fills, and "Hide packed" shows only what's left.
  - **Ad hoc items** go into the trip's ✨ Extras section, or into any section, as a Count or Per day. In an item's
    edit sheet, **Save for future trips** copies it into a master list.
  - **Add or remove a whole list** on one trip. Your master lists don't change.
  - **Change the dates** and per-day items re-scale. Count items never change.
  - **Pull in updates**: because trips are snapshots, editing a master list later never
    rewrites a trip. If a trip's lists have grown since it was made (or its trip type now
    requires another list), a banner offers to add the new items. It only ever adds, and it
    never touches packed state. A list you removed from a trip on purpose isn't offered again.
  - **Duplicate** a trip ("same as last year"). The copy starts fully unpacked and per-day
    items scale to the new dates. **Mark all packed / Unpack all** (for the trip home).
- A fresh database is seeded with 9 lists and 5 trip types. You can edit or delete all of them.

## Integrations

`GET /api/summary` returns glanceable state: the trip in progress or the next upcoming one,
its packed/total counts and the unpacked items. (`?today=YYYY-MM-DD` overrides the date.)

- **HUD**: the "Next trip" card (jarvis-hud `TripCard`) reads `/api/summary`. It shows while a
  trip is under way or starts within 14 days, and tapping it opens the checklist.
- **Jarvis**: the `packing` tool (Jarvis `tools/packing.py`) uses the full API: what's left,
  add, pack and unpack, create a trip, add a list.

## Stack

Next.js 16 (App Router) + React 19 + Tailwind v4 + `better-sqlite3`. Same shape as
savings-tracker and soundboard. There's no auth: access is limited to the tailnet by DNS (an A record → the
Tailscale IP) **and** by nginx (`allow 100.64.0.0/10; deny all`).

```bash
npm install
npm run dev        # http://localhost:4850 (uses ./data/packing.db)
npm test           # unit tests for the date/quantity maths
npm run lint && npx tsc --noEmit
```

Deploy: see [deploy/README.md](deploy/README.md).
