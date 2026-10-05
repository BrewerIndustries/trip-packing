# 🧳 Trip Packing

Packing lists by trip type. Part of the Jarvis app family; **tailnet-only**.

| Env  | URL                                   | Branch | Port |
| ---- | ------------------------------------- | ------ | ---- |
| PROD | https://packing.dabrewer.dev          | `main` | 4840 |
| DEV  | https://packing.dev.dabrewer.dev      | `dev`  | 4850 |

## How it works

- **Lists** (`/lists`): reusable packing lists such as Essentials, Toiletries, Beach and Work.
  Each item has a quantity, and you can mark it **per day**, meaning it's multiplied by the
  trip length (socks, underwear).
- **Trip types** (`/trip-types`): Weekend Getaway, Business Trip, and so on. Tap a list's chip
  to mark it as required for that trip type.
- **Trips** (`/`): pick a trip type and dates. Every required list (plus any extras you add)
  is **copied** into the trip as its own checklist.
  - Check items off. The progress bar fills, and "Hide packed" shows only what's left.
  - **Ad hoc items** go into the trip's ✨ Extras section, or into any section. In an item's
    edit sheet, **Save for future trips** copies it into a master list.
  - **Add or remove a whole list** on one trip. Your master lists don't change.
  - **Change the dates** and per-day items re-scale. An item whose quantity you edited by
    hand keeps that quantity.
  - **Pull in updates**: because trips are snapshots, editing a master list later never
    rewrites a trip. If a trip's lists have grown since it was made (or its trip type now
    requires another list), a banner offers to add the new items. It only ever adds, and it
    never touches packed state. A list you removed from a trip on purpose isn't offered again.
  - **Duplicate** a trip ("same as last year"). The copy starts fully unpacked and per-day
    items scale to the new dates. **Mark all packed / Unpack all** (for the trip home).
- A fresh database is seeded with 9 lists and 5 trip types. You can edit or delete all of them.

## Integrations

`GET /api/summary` returns glanceable state for the HUD and Jarvis: the trip in progress or
the next upcoming one, its packed/total counts and the unpacked items.
(`?today=YYYY-MM-DD` overrides the date.)

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
