# Migrate a pre-planned trip → production

The dev `dev` branch and production are separate Neon databases. A trip imported on
`dev` is **not** in production. The clean way to migrate is to **re-import the JSON into
prod** (the JSON is the source of truth — the dev row was created from it). This avoids
copying DB rows/IDs across branches.

> ⚠️ **Order matters.** Deploy the V3 code to prod **before** importing V3 data, or prod
> runs old code against a V3 row and crashes (the "client-side exception" error).

## Steps

### 1. (Only if you edited in the *editor*) export the current JSON
If you changed the trip in the admin **editor** (not just the JSON file), export the live
state first: **Admin → Dashboard → Pre-planned → ⬇ JSON** on the card, and save it over
`data/snapshots/tokyo-nagano.json` (or anywhere).
If the JSON file is already current, skip this.

### 2. Deploy the V3 code to production
Commit + push → wait for the Vercel deploy to finish and `dopamichi.com` to be live.
**Do not continue until the deploy is live.**

### 3. Import into production
Runs locally but connects to the **prod** Neon DB via `.env`. Syntax depends on your shell:

**Git Bash:**
```bash
USE_PROD_DB=1 npx tsx scripts/import-dopamichi.ts data/snapshots/tokyo-nagano.json --publish
```

**PowerShell:**
```powershell
$env:USE_PROD_DB="1"; npx tsx scripts/import-dopamichi.ts data/snapshots/tokyo-nagano.json --publish; $env:USE_PROD_DB=$null
```

- `USE_PROD_DB=1` → loads `.env` (prod) and unlocks the safety guard; prints `⚠️ TARGETING PRODUCTION DB`.
- `--publish` → goes live on `/pre-planned`. **Omit `--publish`** to import as a **draft**
  first (review in admin, then publish from the dashboard).
- The JSON path arg is optional — it defaults to `data/snapshots/tokyo-nagano.json`
  (the machine-managed snapshot — never hand-edit that file; put hand-edited/transformer
  JSON anywhere else and pass its path).
- Idempotent by `sourceFile`: re-running **updates** the trip instead of duplicating it.

### 4. Verify
Open `dopamichi.com/pre-planned` (or Admin → Dashboard if you imported as a draft).

## Notes
- **Everyday dev imports are unchanged** — `npx tsx scripts/import-dopamichi.ts --publish`
  (no `USE_PROD_DB`) still targets the isolated `dev` branch via `.env.local`.
- In **PowerShell**, the trailing `$env:USE_PROD_DB=$null` clears the flag so your next dev
  import doesn't accidentally hit prod. In **Git Bash** the `VAR=1` prefix applies to only
  that one command, so no cleanup is needed.
- The `dev` branch is a copy-on-write clone of prod, so both already have the system user +
  categories the import needs.

## Keeping JSON ↔ dev ↔ prod in sync (rules learned the hard way, 2026-07)

There are THREE copies of a trip's content: the **JSON file** (authoring source),
the **dev DB**, and the **prod DB**. Every drift incident so far came from editing
one copy and forgetting the others.

**The rules:**

1. **The PROD DB is canonical; the JSON is its snapshot; dev follows.**
   *(Flipped from dev-canonical on 2026-07-24 — authoring moved to the live
   prod dashboard.)* The `/ship` skill automates the flow:
   `USE_PROD_DB=1 scripts/export-dopamichi.ts` snapshots prod → JSON, then
   commit/push, then (JSON changed ⇒) dev import. Author on the prod
   dashboard freely — /ship carries it into git + dev.
2. **Never author on the DEV dashboard.** A dev-only edit is invisible to the
   prod snapshot and the next dev import reverts it. Dev is for testing code
   against a copy of real content, not for authoring. If it happens anyway,
   export dev, diff against the prod snapshot, and reconcile before shipping.
   The one sanctioned dev-ward-first path is **hand-edited/transformer JSON**,
   which imports to prod deliberately (see the /ship edge cases).
3. **The import UPDATES the template in place** (matched by `sourceFile`) — user
   duplicates + their edits survive, the shareCode is kept, and the LINE bridge
   Trip is content-synced via `syncBridgeTrip()`. (Before 2026-07 it
   delete-recreated and cascaded linked Trips; that was fixed so re-imports are
   safe after launch.) A user's duplicated Trip keeps its own itinerary copy and
   does NOT receive the update — by design.
4. **In-app-authored fields ride on preservation, not the JSON** — the single
   `coverImage` always carries over from the prior row; the `cover_images`
   gallery comes from the JSON *when present*, else carries over. Never leave
   placeholder strings like `"(fill in app)"` in the JSON: one import shipped
   that to prod and wiped the gallery (fixed by storing the real URLs in the
   JSON, which is now the norm).
5. **Data errors in the JSON propagate everywhere** — the KIX/Narita airport
   contradiction (Day 1 says "ถึง Narita", airports said KIX) originated in the
   authored JSON and spread to both DBs via import. When editing the JSON,
   sanity-check fields that don't visibly render (airports feed the duplicate
   flow's flight picker, not the preview header).
6. **Verify sync after any incident:** dump both DBs and diff (any session can
   script this in a minute). Normalization noise (key order, `null` vs
   `{en:null,th:null}`) is harmless — only content differences matter.
