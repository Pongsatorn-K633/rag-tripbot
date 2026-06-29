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
`docs/pre-planned-trip/Dopamichi-update.json` (or anywhere).
If the JSON file is already current, skip this.

### 2. Deploy the V3 code to production
Commit + push → wait for the Vercel deploy to finish and `dopamichi.com` to be live.
**Do not continue until the deploy is live.**

### 3. Import into production
Runs locally but connects to the **prod** Neon DB via `.env`. Syntax depends on your shell:

**Git Bash:**
```bash
USE_PROD_DB=1 npx tsx scripts/import-dopamichi.ts docs/pre-planned-trip/Dopamichi-update.json --publish
```

**PowerShell:**
```powershell
$env:USE_PROD_DB="1"; npx tsx scripts/import-dopamichi.ts docs/pre-planned-trip/Dopamichi-update.json --publish; $env:USE_PROD_DB=$null
```

- `USE_PROD_DB=1` → loads `.env` (prod) and unlocks the safety guard; prints `⚠️ TARGETING PRODUCTION DB`.
- `--publish` → goes live on `/pre-planned`. **Omit `--publish`** to import as a **draft**
  first (review in admin, then publish from the dashboard).
- The JSON path arg is optional — it defaults to `docs/pre-planned-trip/Dopamichi-update.json`.
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
