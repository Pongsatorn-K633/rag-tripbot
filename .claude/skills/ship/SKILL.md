---
name: ship
description: Commit + push, then sync trip content from the prod DB (canonical) into git + the dev DB — the safe version of "commit and push and make the DBs up to date".
---

# /ship — commit, push, and keep the DBs in sync

Follow these steps IN ORDER. The goal: after /ship finishes, GitHub, Vercel,
the prod DB, and the dev DB all agree. Full background: `docs/pre-planned-trip/migrate-to-prod.md`.

**Direction of truth: the PROD DB is canonical for trip content** — the admin
authors live on the prod dashboard (dopamichi.com/admin). The JSON is prod's
versioned snapshot in git; the dev DB is a follower kept in sync for local
testing. (Flipped from dev-canonical on 2026-07-24 — authoring moved to prod.)

## 0. Snapshot prod → JSON

The snapshot lives at `data/snapshots/tokyo-nagano.json` — **machine-managed,
never hand-edited** (by humans or AI): only `export-dopamichi.ts` writes it,
only `import-dopamichi.ts` reads it.

1. FIRST check for uncommitted hand-edits: `git status --short data/snapshots/`.
   If the JSON already has uncommitted changes, STOP and ask the user which wins
   — a snapshot would silently overwrite direct file edits (if the hand-edit is
   the intended content, jump to the "hand-edited JSON" edge case below).
2. Export the prod DB into the authoring JSON:

```bash
USE_PROD_DB=1 npx tsx scripts/export-dopamichi.ts
```

3. `git diff --stat` the JSON. No diff → prod and JSON already agreed. A diff →
   that's the content authored on prod since the last ship; skim it for
   surprises (fields the user didn't knowingly change).

## 1. Commit + push

1. `git status` — review what's changing. Never commit `scripts/` one-off leftovers.
2. Commit with a message following the repo's style (scope prefix, body bullets),
   ending with the standard `Co-Authored-By` line. Push to `origin main`.
3. If `next.config.ts` or `tsconfig.json` changed, remind the user to restart
   their dev server.

## 2. Decide whether the dev DB needs syncing

Check whether trip-authoring data changed in what was just pushed:

```bash
git diff --name-only <pushed-range> -- data/snapshots/*.json
```

(Use the pre-push HEAD..HEAD range; if unsure, ask git log for the commits just pushed.)

- **No JSON changed** → done. Say explicitly: "code-only push, DBs untouched and
  still in sync."
- **JSON changed** → continue to step 3.

## 3. Sync dev

```bash
npx tsx scripts/import-dopamichi.ts data/snapshots/tokyo-nagano.json --publish
```

No `USE_PROD_DB` → hits the isolated dev branch. The import **updates the
template in place** (matched by `sourceFile`): dev test trips survive, the
share code is kept, and the LINE bridge Trip is re-synced.

Confirm the output shows the dev host (`spring-sunset`), `Updated`, the
expected share code (TKY-001), and a sane availability derivation.

## 4. Verify sync (when anything feels off)

Dump both DBs and diff (the committed helper `scripts/dump-tky.ts` does one
side per run: plain = dev, `USE_PROD_DB=1` = prod, `DUMP_TO=<path>` picks the
output file). Normalization noise (key order, `null` vs `{en:null,th:null}`)
is harmless; only content differences matter.

## Edge cases

- **Hand-edited JSON / transformer output** (the JSON file is newer than prod
  — the one case where content flows INTO prod): first dump prod
  (`USE_PROD_DB=1 DUMP_TO=<scratch> npx tsx scripts/dump-tky.ts`) and diff it
  against the last committed JSON — if prod also changed since the last ship,
  reconcile by hand before continuing. Then import into PROD:

  ```bash
  USE_PROD_DB=1 npx tsx scripts/import-dopamichi.ts data/snapshots/tokyo-nagano.json --publish
  ```

  (Safe: update-in-place — user trips, their edits, and the share code all
  survive.) Then run step 3 to sync dev, and commit the JSON. For
  schema-shaped JSON (new fields old prod code can't render — rare), wait for
  the Vercel deploy to go green BEFORE the prod import. Dashboard-authored
  content can never have this problem — prod's own code authored it.
- **Accidentally authored on the dev dashboard**: a dev-only edit is invisible
  to the prod snapshot, and step 3 will revert it. Export dev
  (`npx tsx scripts/export-dopamichi.ts`, no flag), diff against the prod
  snapshot, reconcile by hand, then treat the merged file as hand-edited JSON
  (bullet above).
- The Kyoto demo trip (v2, no sourceFile) is outside this flow entirely.
