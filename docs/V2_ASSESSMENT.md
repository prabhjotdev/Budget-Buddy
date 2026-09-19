# Budget Buddy — Current-State Assessment (for V2 planning)

*Written 2026-09-19 from a full read of the codebase on `claude/vibrant-cori-5a7url`.*

This document answers three questions:

1. **What does the app do today?** (complete feature inventory)
2. **What's good and what's bad** about it as a base for a V2 rebuild?
3. **Are values updated correctly?** — results of exercising the money-flow
   logic with valid and invalid inputs, plus the tests added to lock the good
   behavior in and expose the bad.

> ⚠️ The older docs are stale. `README.md` is still the Vite template,
> `docs/ARCHITECTURE.md` describes a *bi-weekly budget-period* design that the
> app has since **replaced** with a *paycheck-cycle* model, and
> `docs/ENHANCEMENT_OPPORTUNITIES.md` claims "no test files exist" (there are
> now ~110 tests). Trust the code, not those docs.

---

## 1. Feature inventory

The app has quietly become **two apps in one repo**. Only the paycheck-cycle
system is reachable in the router; the original budget-period system still ships
in the bundle and the Redux store but has no routes.

### 1a. Live system — "Paycheck Cycle" budgeting

Every route below is guarded by `AuthGuard` (Google sign-in via Firebase Auth).

| Route | Page | What it does |
|---|---|---|
| `/paycheck` | **Cycle Dashboard** | Home screen for the active cycle: paycheck, bills reserved, minimum save, spending limit, spent, remaining. Actions: log spending, mark bills paid, edit paycheck, edit cycle, end cycle, withdraw from buffer, add-to-cycle spending. Start a new cycle when none is active. |
| — | **Start Cycle Wizard** | Multi-step setup: Paycheck → Payment methods → Bills (auto-filtered to those *due this cycle*, across monthly/bi-weekly/quarterly/semi-annual/annual/one-time) → Variable obligations ("Needs") → Savings (minimum save) → Allocate (split minimum save across buffer / emergency fund / goals) → Buffer-draw (only if short) → Review. Also runs in **edit mode** for an existing cycle. Buffer-draw offers tiered amounts (minimum/moderate/comfortable/custom) sized from historical average daily spend. |
| `/spending` | **Spending Logs** | List + filter spend transactions by current cycle or a date range (30/90/180/365/all). Pagination (20/page), edit/delete, month grouping, and a collapsible "Spending + Fixed Expenses" chart. |
| `/calendar` | **Bill Calendar** | Projects bills forward across months by frequency. |
| `/history` | **Cycle History** | Completed cycles with summary stats and end-of-cycle reflections. |
| `/buffer` | **Buffer** | A rainy-day "buffer" balance with deposits/withdrawals (each with a reason) and a transaction log. |
| `/emergency-fund` | **Emergency Fund** | Balance + optional goal (fixed amount, or *X months of expenses*), deposits/withdrawals. |
| `/savings-goals` | **Savings Goals** | Multiple named goals with target amount/date, per-goal deposits/withdrawals and transaction history. |
| `/loan-payoff` | **Loan Payoff** | Loans (balance, monthly payment, APR) with a **debt-snowball simulator** showing months and interest saved. |
| `/debt-tracking` | **Debt Tracking** | Personal IOUs ("I owe" / "they owe"), per person/item, mark paid, plus a split-bill helper. |
| `/wishlist` | **Wishlist** | Wants/needs with price, priority and purchase tracking, plus an affordability recommendation (safe/wait/save/not-recommended). |
| `/subscriptions` | **Subscriptions** | Bills flagged as subscriptions, with optional cancel-reminder dates. |
| `/manage` | **Manage hub** | Manage Bills, Payment Methods, Spending Tags, Variable Obligations, and the pay schedule. |
| `/settings` | **Settings** | Pay schedule (semi-monthly / bi-weekly), default minimum save, currency, timezone, theme (light/dark/system), full **JSON export/import**, and scoped **data reset**. |
| `/login` | **Login** | Google sign-in. |

Cross-cutting building blocks: **Payment Methods** (credit/debit/cash, with
credit-card balance/statement/due dates and a default), **Spending Tags**
(custom + predefined, usage-count sorted), **Variable Obligations**
(non-dated recurring needs like gas/groceries with per-cycle estimates and
tracking), **PWA** install (icons + `vite-plugin-pwa`), and **theming**.

### 1b. Legacy system — present in code, NOT routed (dead weight)

Fully built but unreachable: budget periods, transactions, categories,
templates, income sources, recurring transactions, the old dashboard, and their
modals (`AddTransactionModal`, `CategoryModal`, `CreateBudgetPeriodModal`,
`EditAllocationModal`, `ImportTransactionsModal`) plus the rollover utilities.
All nine legacy reducers are still registered in the store. This is the
pre-pivot v1.

---

## 2. What's good (keep for V2)

- **A coherent, opinionated model.** The paycheck-cycle framing (reserve bills →
  reserve obligations → save → spend what's left, with a buffer to cover gaps)
  is a genuinely useful mental model, not a generic ledger.
- **Clean architecture.** Feature-folder structure, Redux Toolkit slices,
  normalized state (`byId`/`allIds`), and a service layer that isolates every
  Firestore call. Swapping the backend later is realistic.
- **TypeScript end-to-end** with well-defined domain models.
- **Careful date handling** — dates are parsed as local time (noon) to dodge the
  classic UTC off-by-one, and bill projection handles six frequencies plus
  short-month clamping.
- **Real tests on the gnarliest pure logic**: snowball simulator, rollover,
  CSV parsing, currency formatting, date math, fixed-expense aggregation.
- **Operational niceties**: full JSON backup/restore, scoped data reset, dark
  mode, responsive layout + mobile nav, installable PWA.

## 3. What's bad (fix or decide in V2)

1. **Two parallel systems.** The dead legacy stack inflates the bundle, doubles
   the domain concepts (there are two notions of user settings), and confuses
   anyone reading the store. **V2 should commit to the paycheck model and delete
   the rest.**
2. **Money math lives in components, written as absolute overwrites.**
   `LogSpendingModal` / `EditSpendingModal` compute `totalSpent` and
   `remainingToSpend` on the client and *overwrite* the cycle. There is no
   atomic `increment()` (the legacy code actually used it) and no server-side
   recomputation. Two devices, a double-submit, or an offline replay can produce
   a **lost update** and silently wrong balances.
3. **No rounding to cents on accumulation.** Totals are built with raw float
   addition, so they drift (`0.1 + 0.2 = 0.30000000000000004`). Display rounds,
   but the *stored* number rots over many transactions.
4. **Lenient input parsing.** `parseCurrencyInput` accepts negatives and
   malformed values (`"1.2.3"` → `1.2`, `"12-34"` → `12`), and the amount fields
   are raw `type="number"` inputs with no upper bound and unbounded decimals.
   Bad input silently becomes `0` rather than being rejected.
5. **Errors aren't surfaced.** Failures are `console.error` only. Slices keep an
   `error` field but most flows swallow it — there is no toast/notification
   system wired up.
6. **Thin coverage where it matters most.** Before this pass, *zero* tests
   touched a Redux reducer, the cycle math, or any form/modal — exactly the
   money-critical paths. (Addressed in part below.)
7. **Multi-step flows aren't atomic.** The wizard fires a *sequence* of awaited
   dispatches (create cycle, then deposit to buffer, emergency fund, each goal).
   If a later step fails, earlier writes have already committed with no rollback.
8. **Backup/restore & reset are incomplete for newer features.** `resetPaycheckData`
   and the export list don't include `savingsGoals`, `loans`, or `debtTracking`,
   so a "reset" or "backup" misses the newest data.
9. **Monolithic components.** `StartCycleWizard.tsx` is ~2,100 lines with heavy
   logic embedded in JSX — hard to test and to change safely.

---

## 4. Value-update correctness (proper vs. bad inputs)

I traced how each amount flows from input → Redux → the derived cycle numbers,
with both valid and hostile inputs.

### Where values ARE updated correctly

- **Cycle creation** (`StartCycleWizard`): `spendingLimit =
  max(0, paycheck − bills − obligations − minimumSave + bufferDraw)`, and
  `remainingToSpend` starts at `spendingLimit`. Correct, and the limit is
  clamped so it never goes negative.
- **Logging a discretionary spend** (`LogSpendingModal`): reduces
  `remainingToSpend` by the amount using *discretionary* spend
  (`totalSpent − variableObligationsSpent`). Correct. Submit is blocked for
  `amount ≤ 0` and with no payment method.
- **Logging an obligation spend**: updates the obligation tally,
  `variableObligationsSpent`, and `totalSpent`, and **leaves `remainingToSpend`
  untouched** — obligation money is a separate pool. Correct.
- **Cycle edit via the wizard**: recomputes remaining from discretionary spend,
  consistent with creation. Correct.
- **Reducers** (cycles, spending, debt, etc.): the pure state transitions are
  sound — verified by the new tests.

### Confirmed bug — editing/deleting a spend corrupts the cycle

`EditSpendingModal` (both `handleSubmit` and `handleDelete`) computes:

```
newRemaining = spendingLimit − (cycle.totalSpent ± amount)
```

but the log path (correctly) uses **discretionary** spend, not the full
`totalSpent`. Two concrete failures:

- **(a) Any edit/delete when the cycle has obligation spend** sets
  `remainingToSpend` too low by exactly the obligation total.
  *Repro:* limit `$500`, discretionary `$100`, obligation `$50` (`totalSpent
  $150`, remaining `$400`). Edit a discretionary tx `$100 → $120`. Correct
  remaining is `$380`; the app writes `$330` — off by the `$50` obligation.
- **(b) Editing/deleting an *obligation* transaction** is treated as
  discretionary: it wrongly moves `remainingToSpend` **and** never adjusts the
  obligation's `amountSpent` / `variableObligationsSpent`, so obligation budgets
  drift out of sync.

The fix is to route both paths through one shared helper (added as
`src/features/paycheck/cycleSpendingMath.ts`) so edit mirrors log. This has
**not** been wired into the components yet — see "Recommended next step".

### Bad-input findings

- Negative amounts are rejected by the log/edit *forms* (button disabled at
  `≤ 0`), **but** `parseCurrencyInput` and the wizard's bill/obligation number
  fields accept negatives — a negative bill would *inflate* the spending limit.
- Malformed currency strings truncate rather than reject (documented in tests).
- No cent-rounding means long-lived cycles accumulate float dust.

---

## 5. Tests added in this pass

All additive, all green (`npm run test:unit` → **111 passing**, was 78), lint
and `tsc -b` clean.

| File | Covers |
|---|---|
| `src/features/paycheck/paycheckCyclesSlice.test.ts` | Reducer value updates: spending, obligation pool invariant, cycle activation/completion, bill create/update/delete sync. |
| `src/features/paycheck/spendingTransactionsSlice.test.ts` | Create (date-sorted insert + cycle index), merge-update, delete cleanup, per-cycle clear, cycle refetch re-sort. |
| `src/features/paycheck/cycleSpendingMath.ts` + `.test.ts` | **New shared money helper** encoding the *correct* derivation (spending limit, discretionary vs. obligation, cents rounding, input sanitizing). Tests prove the edit-path discrepancy above and lock in no-drift arithmetic. |
| `src/utils/currency.test.ts` (extended) | Characterization of lenient/hostile parsing (negatives, double decimals, embedded minus, scientific, whitespace). |

### Still worth adding (not done here)

- Component tests for `LogSpendingModal` / `EditSpendingModal` (render + submit
  with a mocked store) once the edit-path fix lands.
- Wizard end-to-end math (bills due-this-cycle filtering across frequencies).
- A Playwright flow: sign in → start cycle → log spend → mark bill paid.

---

## 6. Recommended next step

Wire `cycleSpendingMath.ts` into `LogSpendingModal`, `EditSpendingModal` and the
wizard so all three share one derivation, which fixes the edit/delete bug and
removes float drift. It's a contained change fully covered by the new tests —
left out of this pass because it changes live money behavior and should be an
explicit decision.
