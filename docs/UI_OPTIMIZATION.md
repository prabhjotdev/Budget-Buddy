# UI Optimization Plan

## Problem Statement

The app currently has **10 flat navigation items** in a single unsorted list. There is no visual hierarchy, two items share the same icon, and the mobile experience relies on a clunky hamburger-triggered full-height sidebar overlay. Every nav item feels equally important, creating cognitive overload.

---

## Phases

### Phase 1 — Grouped Sidebar (Desktop) ✅
### Phase 2 — Mobile Bottom Tab Bar
### Phase 3 — Visual Polish & Collapsed State

---

## Phase 1: Grouped Sidebar

**Files changed:** `src/components/layout/Sidebar.tsx`

### What changes

Replace the flat `navItems` array with a grouped structure of three sections, move admin items to a dedicated bottom utility area, and fix the duplicate icon.

#### Navigation Groups

| Section | Items |
|---|---|
| **OVERVIEW** | Paycheck, Spending, Bill Calendar |
| **SAFETY NET** | Buffer, Emergency Fund, Savings Goals |
| **PLANNING** | Wishlist, History |
| *(bottom utility)* | Settings, Manage |

#### Icon Fix

Both Buffer and Emergency Fund previously used `ShieldCheck`. Updated to:
- **Buffer** → `Umbrella` (cushion/protection metaphor)
- **Emergency Fund** → `ShieldCheck` (security/fully protected)

#### Wireframe

```
┌────────────────────────────┐
│ 💰 Budget Buddy          ☰ │
├────────────────────────────┤
│  OVERVIEW                  │
│  📅 Paycheck               │
│  💸 Spending               │
│  📆 Bill Calendar          │
│                            │
│  SAFETY NET                │
│  ☂  Buffer                 │
│  🛡 Emergency Fund         │
│  🎯 Savings Goals          │
│                            │
│  PLANNING                  │
│  ❤️  Wishlist               │
│  📋 History                │
│                            │
│ ── ── ── ── ── ── ── ──   │
│  ⚙️  Settings               │
│  🔧 Manage                 │
├────────────────────────────┤
│ [avatar] Name    Sign out  │
└────────────────────────────┘
```

#### Collapsed sidebar (icon-only mode)

Section labels are hidden in collapsed mode. Icons and tooltips remain.

```
┌──────┐
│  💰  │
├──────┤
│  📅  │
│  💸  │
│  📆  │
│ ──── │
│  ☂   │
│  🛡  │
│  🎯  │
│ ──── │
│  ❤️   │
│  📋  │
│ ──── │
│  ⚙️   │
│  🔧  │
├──────┤
│  👤  │
└──────┘
```

---

## Phase 2: Mobile Bottom Tab Bar

**Files changed:** `src/components/layout/Sidebar.tsx`, `src/components/layout/AppLayout.tsx`

### What changes

On mobile (`< md` breakpoint), replace the hamburger-triggered sidebar overlay with a fixed bottom tab bar. The bottom bar holds 4 top-level tabs:

| Tab | Icon | Links to |
|---|---|---|
| **Home** | `Calendar` | `/paycheck` |
| **Spend** | `Receipt` | `/spending` |
| **Save** | `PiggyBank` | `/savings-goals` (with sub-nav) |
| **More** | `MoreHorizontal` | Opens bottom sheet |

**"More" bottom sheet** slides up from the bottom and contains:
- Bill Calendar
- Wishlist
- History
- Buffer
- Emergency Fund
- Manage
- Settings

#### Wireframe

```
┌────────────────────────┐
│  Budget Buddy      👤  │
├────────────────────────┤
│                        │
│      (page content)    │
│                        │
├────────────────────────┤
│  🏠    💸    💰   ···  │
│ Home  Spend  Save  More│
│  ●                     │
└────────────────────────┘

"More" bottom sheet:
┌────────────────────────┐
│  ╱╲  More              │
│ ─────────────────────  │
│  📆 Bill Calendar      │
│  ❤️  Wishlist           │
│  📋 History            │
│  ☂  Buffer             │
│  🛡 Emergency Fund     │
│  🔧 Manage             │
│  ⚙️  Settings           │
└────────────────────────┘
```

### Header on mobile

Replace the hamburger menu button in the header with a simple avatar/user icon that links to Settings, since navigation moves to the bottom bar.

---

## Phase 3: Visual Polish & Collapsed State

**Files changed:** `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`

### What changes

1. **Dividers between groups in collapsed mode** — thin horizontal rules between icon clusters so grouping is still visible without labels
2. **Tooltips on collapsed icons** — native `title` attribute or a lightweight tooltip component so collapsed icons are still discoverable
3. **Active section highlight** — when a nav item is active, subtly highlight its section label as well
4. **Header breadcrumb** — show current section name (e.g. "Safety Net › Emergency Fund") in the header for orientation
5. **Smooth transitions** — ensure section labels animate in/out gracefully when toggling collapsed state

#### Collapsed state with dividers

```
┌──────┐
│  💰  │
├──────┤  ← OVERVIEW group
│  📅  │
│  💸  │
│  📆  │
│ ──── │  ← divider
│  ☂   │  ← SAFETY NET group
│  🛡  │
│  🎯  │
│ ──── │  ← divider
│  ❤️   │  ← PLANNING group
│  📋  │
│ ──── │  ← divider
│  ⚙️   │  ← utility
│  🔧  │
├──────┤
│  👤  │
└──────┘
```

---

## Summary of All Changes

| Phase | Change | Files | Effort |
|---|---|---|---|
| 1 | Group nav into 3 labeled sections | `Sidebar.tsx` | Low |
| 1 | Fix duplicate ShieldCheck icon (Buffer → Umbrella) | `Sidebar.tsx` | Low |
| 1 | Move Settings + Manage to bottom utility area | `Sidebar.tsx` | Low |
| 2 | Mobile bottom tab bar (4 tabs) | `Sidebar.tsx`, `AppLayout.tsx` | Medium |
| 2 | "More" bottom sheet for secondary nav on mobile | `Sidebar.tsx` | Medium |
| 2 | Replace hamburger with avatar icon on mobile header | `Header.tsx` | Low |
| 3 | Dividers between icon groups in collapsed mode | `Sidebar.tsx` | Low |
| 3 | Tooltips on collapsed sidebar icons | `Sidebar.tsx` | Low |
| 3 | Active section label highlight | `Sidebar.tsx` | Low |
| 3 | Header breadcrumb for orientation | `Header.tsx` | Medium |
| 3 | Smooth section label transitions | `Sidebar.tsx` | Low |
