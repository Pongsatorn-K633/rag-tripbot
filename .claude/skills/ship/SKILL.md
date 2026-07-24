---
name: ship
description: Commit + push, then sync trip data to the prod DB when the authoring JSON changed — the safe version of "commit and push and make the DB up to date".
---

# /ship — commit, push, and keep the DBs in sync

Follow these steps IN ORDER. The goal: after /ship finishes, GitHub, Vercel,
the dev DB, and the prod DB all agree. Full background: `docs/pre-planned-trip/migrate-to-prod.md`.

**Direction of truth: the DEV DB is canonical** (that's where authoring happens
— dashboard edits, scripts). The JSON is its snapshot; prod is downstream.

## 0. Snapshot dev → JSON

1. FIRST check for uncommitted hand-edits: `git status --short docs/pre-planned-trip/`.
   If the JSON already has uncommitted changes, STOP and ask the user which wins
   — a snapshot would silently overwrite direct file edits.
2. Export the dev DB into the authoring JSON:

```bash
npx tsx scripts/export-dopamichi.ts
```

3. `git diff --stat` the JSON. No diff → dev and JSON already agreed. A diff →
   that's the content this ship will carry to prod; skim it for surprises
   (fields the user didn't knowingly change).

## 1. Commit + push

1. `git status` — review what's changing. Never commit `scripts/` one-off leftovers.
2. Commit with a message following the repo's style (scope prefix, body bullets),
   ending with the standard `Co-Authored-By` line. Push to `origin main`.
3. If `next.config.ts` or `tsconfig.json` changed, remind the user to restart
   their dev server.

## 2. Decide whether prod data needs syncing

Check whether trip-authoring data changed in what was just pushed:

```bash
git diff --name-only <pushed-range> -- docs/pre-planned-trip/*.json
```

(Use the pre-push HEAD..HEAD range; if unsure, ask git log for the commits just pushed.)

- **No JSON changed** → done. Say explicitly: "code-only push, DBs untouched and
  still in sync."
- **JSON changed** → continue to step 3.

## 3. Sync prod (destructive — announce before running)

Announce first: the import **delete-recreates the template and cascades any
prod Trips linked to it** (user duplicates + the share-code bridge; the share
code re-mints). Pre-launch this is acceptable; if the project has launched,
STOP and get explicit confirmation instead.

Then, if a Vercel deploy is required for schema-shaped changes (new fields the
old code can't render — rare), wait for the deploy to go green FIRST. Plain
content edits don't need to wait.

Run:

```bash
USE_PROD_DB=1 npx tsx scripts/import-dopamichi.ts docs/pre-planned-trip/Dopamichi-update.json --publish
```

Confirm the output shows `TARGETING PRODUCTION DB`, the expected share code
(TKY-001), and a sane availability derivation.

## 4. Verify sync (when anything feels off)

Dump both DBs and diff (the committed helper `scripts/dump-tky.ts` does one
side per run: plain = dev, `USE_PROD_DB=1` = prod, `DUMP_TO=<path>` picks the
output file). Normalization noise (key order, `null` vs `{en:null,th:null}`)
is harmless; only content differences matter.

## Edge cases

- **Prod-dashboard edits**: step 0 snapshots DEV — an edit made only on the
  prod dashboard is NOT captured and the import will revert it. If the user
  mentions editing on prod, first pull that content dev-ward (dump-diff, then
  apply to dev) before shipping.
- The Kyoto demo trip (v2, no sourceFile) is outside this flow entirely.
