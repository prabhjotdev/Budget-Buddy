# Paycheck Dashboard UI Redesign

## Design Decisions

- **Desktop:** Concept A — hero remaining-amount card + contextual in-column layout
- **Mobile:** Concept A1 — same hero, action row pinned directly below hero (always visible on open)

---

## Current Layout (top → bottom)

| # | Section | Component |
|---|---|---|
| 1 | Over-budget alert | inline JSX |
| 2 | 4-stat grid: Remaining / Spent / Bills / Saving | inline JSX (4 `<Card>`) |
| 3 | Spending Progress card (bar + cycle timeline) | inline JSX |
| 4 | 2-col: Bills This Cycle \| Recent Spending | `CycleBillsList` + `SpendingSummary` |
| 5 | **Quick Actions card** ← the buried problem | inline JSX |
| 6 | Paycheck Breakdown card | inline JSX |

**Problem:** Quick Actions sit below all content — invisible on mobile without scrolling.
The 4-stat grid dilutes focus; "Remaining to Spend" deserves to be the hero.

---

## Target Layout

### Desktop (≥ md)

```
┌────────────────────────────────────────────────────────────────┐
│  [alert banner — over budget, if applicable]                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────┐  ┌──────────────────┐   │
│  │  HERO CARD                       │  │  BILLS           │   │
│  │                                  │  │                  │   │
│  │  Left to spend                   │  │  ████████░░░░    │   │
│  │  $847.50                         │  │  4 of 7 paid     │   │
│  │                                  │  │                  │   │
│  │  ████████████░░░░░░░░  42%       │  │  Netflix  $15 →  │   │
│  │  $652 spent · $1,500 limit       │  │  Gym      $35 →  │   │
│  │                                  │  │  Spotify  $10 →  │   │
│  │  $84.75/day  ·  10 days left     │  │                  │   │
│  │                                  │  │  [View all]      │   │
│  │  [+  Log Spending  ]             │  └──────────────────┘   │
│  └──────────────────────────────────┘                         │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  BREAKDOWN                                   $3,200 ✏  │   │
│  │  Bills  ████████████████░░░░░░░░  $1,400  ·  44%       │   │
│  │  Save   ████░░░░░░░░░░░░░░░░░░░░  $  300  ·   9%       │   │
│  │  Spend  ████████████████████░░░░  $1,500  ·  47%       │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  RECENT SPENDING                          [View All →] │   │
│  │  Lunch · Food         $14.50                   Today   │   │
│  │  Gas · Transport      $45.00                Yesterday  │   │
│  │  Amazon · Shopping    $23.99                  Feb 20   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  MORE ACTIONS                                          │   │
│  │  [Use Buffer]  [Edit Cycle]  [End Cycle]               │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Mobile (< md) — Concept A1

```
┌─────────────────────┐
│  [alert — if any]   │
├─────────────────────┤
│  ┌─────────────────┐│  ← HERO CARD
│  │  Left to spend  ││
│  │                 ││
│  │    $847.50      ││
│  │                 ││
│  │  ███████░░░  42%││
│  │  $652 of $1,500 ││
│  │                 ││
│  │  $84.75 / day   ││
│  │  10 days left   ││
│  └─────────────────┘│
│                     │
│  [+  Log Spending  ]│  ← ACTION ROW (always visible)
│  ┌───────┐ ┌───────┐│
│  │✓ Bill │ │Buffer ││
│  └───────┘ └───────┘│
│                     │
│  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │  ← scroll boundary
│  ┌───────┐ ┌───────┐│
│  │ Bills │ │ Saved ││
│  │ 4/7   │ │ $300  ││
│  │ paid  │ │  ✓    ││
│  └───────┘ └───────┘│
│                     │
│  RECENT SPENDING    │
│  Lunch    $14.50    │
│  Gas      $45.00    │
│  [View all →]       │
│                     │
│  ▾ Breakdown        │  ← collapsible
│  ▾ More Actions     │  ← collapsible
│                     │
│  🏠   💸   💰   ···│
└─────────────────────┘
```

---

## Section Mapping: Current → New

| Current section | Desktop (new) | Mobile (new) |
|---|---|---|
| Remaining to Spend card | Merged into **Hero Card** | Merged into **Hero Card** |
| Spent This Cycle card | Merged into Hero Card (sub-text) | Merged into Hero Card (sub-text) |
| Bills Reserved card | Removed — shown in Bills column | Compact **Bills mini-card** |
| Saving This Cycle card | Removed — shown in Breakdown bar | Compact **Saved mini-card** |
| Spending Progress card | Merged into Hero Card | Merged into Hero Card |
| Cycle timeline | Merged into Hero Card (sub-text) | Merged into Hero Card (sub-text) |
| **Quick Actions (buried)** | Log Spending in Hero; others in More Actions | **Action row below hero** |
| Bills This Cycle | Right column | Below action row (scrollable) |
| Recent Spending | Full-width below | Below mini-cards (scrollable) |
| Paycheck Breakdown | Full-width below | **Collapsible** (bottom) |

---

## Phases

### Phase 1 — Hero Card
**File:** `CycleDashboard.tsx`

Replace the 4-stat grid + Spending Progress card with a single `HeroCard` component:

- Large "Left to spend" label + remaining amount (green / red if over)
- Spending progress bar with `$X spent · $Y limit` labels
- `$Z/day · N days left` subtitle line
- On **desktop only**: `[+ Log Spending]` button inside the card
- Carries over the over-budget colour states

Stat cards (Spent This Cycle, Bills Reserved, Saving This Cycle) are removed from the grid.
The "Spending Progress" card is removed as a standalone section.

---

### Phase 2 — Mobile Action Row
**File:** `CycleDashboard.tsx`

On mobile (`md:hidden`), render an action row immediately after the hero card:

- `[+ Log Spending]` — full-width indigo primary button
- `[✓ Mark Bill Paid]` + `[Use Buffer]` — equal-width outlined secondary buttons side by side
- Buffer button disabled if `buffer.totalAmount <= 0` (same logic as today)

On desktop (`hidden md:block`), the Log Spending button is already inside the hero card.
The standalone "Quick Actions" card is replaced by a slimmer "More Actions" row at the bottom
containing only the less-common actions: Use Buffer, Edit Cycle, End Cycle.

---

### Phase 3 — Compact Supporting Stats (mobile)
**File:** `CycleDashboard.tsx`

Below the action row on mobile, add two compact stat cards in a 2-column grid:

- **Bills card:** "X/Y paid" headline, mini progress bar, tap navigates to Bills section
- **Saved card:** amount headline, ✓ checkmark if minimum save is met

These replace the removed Bills Reserved and Saving This Cycle stat cards on mobile.
On desktop these don't appear — the bills column and breakdown bar carry this information.

---

### Phase 4 — Desktop Two-Column Layout
**File:** `CycleDashboard.tsx`

On desktop, restructure the main content into a two-column grid:

- **Left column (wider):** Hero Card → Breakdown Bar → Recent Spending
- **Right column:** Bills This Cycle (full height of the left column)

Bills move from the 2-col `[Bills | Recent Spending]` row to a dedicated right-hand column.
Recent Spending moves to the left column below the Breakdown Bar.

---

### Phase 5 — Breakdown Bar Redesign
**File:** `CycleDashboard.tsx`

Replace the line-item arithmetic table (Paycheck − Bills − Save = Spend) with a segmented
horizontal allocation bar:

```
$3,200 paycheck  ✏
┌──────────────────────────────────────────────────────────────┐
│  BILLS  ████████████████████  $1,400 · 44%                   │
│  SAVE   ████████              $  300 ·  9%                   │
│  SPEND  ████████████████████████████  $1,500 · 47%           │
└──────────────────────────────────────────────────────────────┘
```

Each row has: label, filled progress bar, amount, percentage.
Edit paycheck (pencil icon) stays in the section header.
On mobile this section becomes a `<details>` collapsible to save vertical space.

---

### Phase 6 — More Actions Row
**File:** `CycleDashboard.tsx`

Remove the "Quick Actions" card entirely.
Replace with a compact, low-prominence "More Actions" row at the very bottom:

```
[Use Buffer]   [Edit Cycle]   [End Cycle]
```

- Ghost/outlined buttons, smaller than the primary action
- On mobile this becomes a `<details>` collapsible labelled "More Actions"
- Mirrors the "settings/admin" feel — infrequent, not prominent

---

## File Change Summary

| File | Changes |
|---|---|
| `CycleDashboard.tsx` | Major restructure across all 6 phases |
| `CycleBillsList.tsx` | Minor — accept optional `compact` prop for mobile mini-card variant |
| `SpendingSummary.tsx` | Minor — no structural change needed |

No new files are strictly required; all changes are contained within `CycleDashboard.tsx`
with optional prop additions to the two child components.
