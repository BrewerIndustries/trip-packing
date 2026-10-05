# Trip Packing — notes for Claude

Packing lists by trip type. Next.js 16 + React 19 + Tailwind v4 + better-sqlite3. Sibling of
savings-tracker and soundboard; same deploy shape. **Tailnet-only, no auth layer.** Don't add
public DNS or a public route.

## Model (src/lib/db.ts)
- `list_types` → `list_items` (qty, `per_day` flag). `trip_types` ↔ `list_types` via
  `trip_type_lists` (the "required lists" matrix).
- `trips` → `trip_lists` (section **snapshots**: name, icon and color copied; `list_type_id` is
  SET NULL if the master is deleted) → `trip_items` (`source_item_id` links to the master item;
  null = ad hoc; `trip_list_id` null = the Extras section; `per_day` = base qty when scaling,
  nulled when the user hand-edits qty).
- **Snapshot rule:** creating a trip or attaching a list COPIES items in. Master edits never
  mutate trips. `previewSync`/`syncTrip` only ADD (missing master items by `source_item_id`,
  plus lists the trip type now requires). Never remove items or reset packed state.
- `trip_dismissed_lists` records lists the user removed from a trip so sync won't re-offer
  them. Attaching the list again clears the record.
- Date maths lives in `src/lib/trip-math.ts` (pure, tested): `tripDays` counts both ends;
  `packQty` multiplies per-day items.

## UI
Server pages read the DB directly and pass the data to client components (`TripsBoard`,
`TripView`, `ListsEditor`, `TripTypesEditor`). Those mutate through `/api/*` and then reload
from the API. Packing toggles are optimistic. Light and dark come from CSS tokens in
globals.css. Mobile-first: check for horizontal overflow at 375px.

## Conventions
- Route handlers: `params` is a Promise (`await ctx.params`). Helpers are in `src/lib/http.ts`.
- `better-sqlite3` is native: it's in `serverExternalPackages`, the server builds as `dan`,
  and Linux uses `npm install`, not `npm ci`.
- Ports: prod 4840, dev 4850. Dev `.env` has `JARVIS_ENV=dev` (amber banner).
- Update README.md after meaningful changes (house rule). Work on `dev`; `main` only via an
  approved PR.
