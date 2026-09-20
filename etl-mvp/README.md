# Budget Buddy — CSV Import ETL (MVP)

A tiny, **dependency-free Java** proof-of-concept for the V2 bank-statement import pipeline.
No Spring, no database, no frontend — just the risky part: read CSVs from a folder, dedup
and reconcile them, store them, and archive the file.

This is a throwaway spike to prove the loop works. The real version maps onto the design in
[`../docs/V2_ASSESSMENT.md`](../docs/V2_ASSESSMENT.md) (Spring Boot service, Postgres, the
`Transaction`/`ImportBatch` tables).

## Run it

```bash
./test.sh   # compiles everything and runs the self-test (the important one)
./run.sh     # runs the demo against ./data using data/samples/*.csv
```

Requires a JDK (built/tested on Java 21). Run `./run.sh` twice — the second run reports every
row as a duplicate, which is the point.

## The folder lifecycle

```
data/
  inbox/       <- drop bank CSVs here (named per account, e.g. chequing.csv)
  processing/  <- a file is moved here the instant it is picked up (claim)
  archive/     <- success: file moved here, timestamped
  error/       <- a malformed file lands here; nothing is imported from it
  store.tsv    <- stand-in for the Postgres transactions table
```

## How dedup works (the whole reason this exists)

Every transaction keeps **two** descriptions:
- `rawDescription` — exactly what the bank exported. Never edited. **Dedup keys use this.**
- `label` — the user-facing name. Rename it freely; it is never part of any key.

Two keys guard against duplicates:
1. **Content key** = `sha256(account | date | amount | rawDescription)` → re-importing the
   same file is a no-op (idempotent).
2. **Reconciliation key** = `account | date | amount` (description ignored) → an imported bank
   row matches an existing **manual** entry even if you named it differently, so it is not
   duplicated.

Money is `BigDecimal` throughout — never `double` — so totals never drift off the cent.

## What the self-test proves

- A manual "Coffee $5.00" entry is **matched** by an imported "STARBUCKS $5.00" row (same
  date+amount, different description) → not duplicated.
- Genuinely new rows are inserted.
- Re-importing the same file inserts nothing.
- A known row in a later file is recognized as a duplicate.
- A malformed file is routed to `error/` and imports nothing.

## Known limitations (deliberate, for the MVP)

- **Same-day, same-amount collisions:** two *real* distinct $5.00 charges on one day at the
  same account collapse to one, because there is no bank transaction id. The fix is to use a
  bank reference/running-balance column when present (the `externalId` field is already there
  for it) — check what your CSV exports include.
- Amount **sign** is taken as-is; real banks differ (credit-card CSVs often flip signs) and
  need a per-bank normalization rule.
- The store is a flat file, single-user, no concurrency beyond the atomic file-move claim.
- One CSV layout (`date,amount,description`); real banks need a per-bank parser profile.
