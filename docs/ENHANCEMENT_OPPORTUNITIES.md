# Enhancement Opportunities

This document captures potential feature enhancements for Budget-Buddy, organized by priority and impact.

---

## 1. Incomplete / In-Progress Features (Highest Priority)

These are features that are partially built or already designed but not yet implemented.

| Feature | Current State | Enhancement |
|---|---|---|
| **Data Import** | Modal exists but functionality is incomplete | Complete CSV/JSON import for transactions, bills, and cycles |
| **Mobile Bottom Nav** | Hamburger menu only | Add 4-tab bottom navigation bar + "More" bottom sheet (see `UI_OPTIMIZATION.md` Phase 2) |
| **Paycheck Dashboard Redesign** | Basic stats grid | Full hero card redesign with mobile action row (see `PAYCHECK_REDESIGN.md` — all 6 phases pending) |

---

## 2. Analytics & Insights

The historical data already exists in Firestore. These enhancements surface it more meaningfully.

- **Spending Trends:** Month-over-month or cycle-over-cycle comparison charts (e.g., "you spent 20% more on groceries this cycle")
- **Predictive Budgeting:** Based on historical cycles, suggest budget allocations for the next paycheck
- **Bill Forecast:** Show a 3–6 month projection of upcoming bills on the calendar
- **Tag-based Reporting:** Breakdown charts by spending tags across multiple cycles
- **Savings Rate Tracker:** Show what percentage of each paycheck goes to savings vs. spending

---

## 3. Notifications & Reminders

The app is already a PWA, so push notifications are supported without additional infrastructure.

- **Bill Due Reminders:** Push notifications before bill due dates (configurable days-in-advance)
- **Subscription Renewal Alerts:** Alert before cancel-reminder dates on subscriptions
- **Savings Goal Milestones:** Notify when a goal reaches 25%, 50%, 75%, and 100%
- **Low Buffer Warning:** Alert when the buffer balance drops below a user-configurable threshold
- **Overspending Alert:** Notify when spending exceeds a set percentage of the paycheck budget

---

## 4. Offline & PWA Improvements

The PWA plugin is already configured but no offline strategy is implemented.

- **Offline-First Mode:** Add service worker caching so users can view their data without an internet connection
- **Background Sync:** Queue spending logs and other writes made offline, then sync automatically when reconnected

---

## 5. Data & Interoperability

- **Export to CSV/PDF:** Export cycle history or spending logs as a spreadsheet or printable report
- **Bank Sync:** Auto-import transactions from bank accounts via a service like Plaid to reduce manual logging
- **Recurring Transaction Auto-Logging:** Automatically create spending log entries for recurring transactions on their scheduled dates

---

## 6. Collaboration & Multi-User

- **Shared Budgets:** Allow two users (e.g., partners) to share a paycheck cycle and view each other's spending logs in real time
- **Household View:** Aggregate multiple income sources and paycheck cycles into a single household overview dashboard

---

## 7. Payment Methods Enhancements

- **Credit Card Utilization Warnings:** Alert when a card's balance exceeds a configurable percentage of its credit limit
- **Statement Period Tracking:** Track credit card statement cycles separately from pay cycles for more accurate due-date management
- **Auto-suggest Payment Method:** Based on spending tags or categories, suggest which payment method to use when logging a transaction

---

## 8. Testing Infrastructure

No test files currently exist in the codebase. Adding tests would significantly improve stability and confidence when making changes.

- **Unit & Integration Tests:** Cover Redux slices, utility functions, and key components (e.g., date calculation utils, currency formatting, cycle logic)
- **E2E Tests:** Use Playwright or Cypress to cover critical user flows such as login → create cycle → log spending → mark bill paid

---

## 9. UX Polish

These are documented in `UI_OPTIMIZATION.md` Phase 3 but captured here for completeness.

- **Animated Transitions:** Smooth page and modal transitions for a more polished feel
- **Tooltips:** Contextual help text for less obvious features (buffer, emergency fund, pay schedule)
- **Breadcrumbs:** Better navigation context, especially for nested or deep views
- **Active Section Highlighting:** Sidebar section headers highlight based on the current route

---

## Top 3 Recommendations

1. **Complete the mobile bottom navigation** — biggest UX win for mobile users; already fully designed in `UI_OPTIMIZATION.md`
2. **Add push notification reminders for bills** — high practical value, PWA infrastructure is already in place
3. **Spending trend analytics across cycles** — the data already exists in Firestore, it just needs visualization

---

*Last updated: 2026-03-05*
