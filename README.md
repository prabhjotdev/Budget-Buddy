# Budget Buddy

**Paycheck-based budgeting made simple.**

Budget Buddy is an installable web app (PWA) for managing money one paycheck at a time. Instead of a single monthly budget, you plan each pay cycle: split your paycheck into **Bills · Save · Spend**, track spending against a per-cycle limit, and carry unused money forward with a buffer. It also handles bills and subscriptions, an emergency fund, savings goals, loan payoff, and shared-debt tracking.

Data is stored per-user in Firebase (Google sign-in + Cloud Firestore) and syncs across devices in real time.

---

## Features

- **Paycheck cycle dashboard** — a hero "left to spend" figure, spending progress, days-left/daily pace, and a Bills / Save / Spend breakdown of each paycheck.
- **Spending logs** — quickly log spending, tag it, and review recent activity per cycle.
- **Bills & bill calendar** — track recurring bills, mark them paid, and see due dates on a calendar.
- **Subscriptions** — keep recurring subscriptions in one place.
- **Buffer** — roll leftover money forward and pull from it mid-cycle when you need to.
- **Emergency fund** — set a target and track deposits and withdrawals.
- **Savings goals** — fund multiple goals and watch progress toward each.
- **Loan payoff** — plan payoff with a snowball calculator.
- **Debt tracking** — record shared/split bills and track who owes what.
- **Wishlist** — park purchases you're considering and mark them when bought.
- **Cycle history** — review past paycheck cycles.
- **CSV import** — import transactions from a CSV file.
- **Data export / import & reset** — back up or clear your data from Settings.
- **Light & dark themes** and a mobile-friendly, installable PWA with offline caching.

---

## Tech stack

| Area | Technology |
|------|------------|
| UI | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build | [Vite 7](https://vite.dev/) + [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) |
| State | [Redux Toolkit](https://redux-toolkit.js.org/) + [React Redux](https://react-redux.js.org/) |
| Routing | [React Router 7](https://reactrouter.com/) |
| Backend | [Firebase](https://firebase.google.com/) — Authentication (Google) + Cloud Firestore |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Charts | [Recharts](https://recharts.org/) |
| Icons | [lucide-react](https://lucide.dev/) |
| Dates | [date-fns](https://date-fns.org/) |
| Testing | [Vitest](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (E2E) |
| Hosting | Firebase Hosting (CI via GitHub Actions) |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ and npm
- A [Firebase](https://console.firebase.google.com/) project with **Google Authentication** and **Cloud Firestore** enabled

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase

Copy the example env file and fill in the values from your Firebase project settings:

```bash
cp .env.example .env
```

```dotenv
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> Enable **Google** as a sign-in provider under Firebase Authentication, and create a **Cloud Firestore** database. Firestore security rules and indexes live in `firestore.rules` and `firestore.indexes.json`.

### 3. Run the app

```bash
npm run dev
```

The app runs on the Vite dev server (default [http://localhost:5173](http://localhost:5173)).

---

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` / `npm run test:unit` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

---

## Testing

- **Unit tests** (Vitest) cover core logic such as date/period math, currency formatting, rollover/buffer calculations, the loan snowball calculator, and CSV parsing.
- **End-to-end tests** (Playwright) cover user-facing flows such as authentication.

```bash
npm run test:unit   # unit tests
npm run test:e2e    # end-to-end tests
```

---

## Project structure

```
src/
├── app/            # Redux store, typed hooks, router
├── components/     # Shared UI, layout, and modal components
├── constants/      # Routes, default categories, etc.
├── context/        # React context (e.g. theme)
├── features/       # Feature modules (slice + components), e.g.:
│   ├── paycheck/       # Cycles, bills, spending, buffer, wishlist, subscriptions
│   ├── emergencyFund/  # Emergency fund
│   ├── savingsGoals/   # Savings goals
│   ├── loanPayoff/     # Loan payoff + snowball calculator
│   ├── debtTracking/   # Shared/split debt tracking
│   ├── auth/           # Authentication
│   └── settings/       # Settings, data export/import/reset
├── services/firebase/  # Firestore data access per collection
└── utils/          # Date, currency, rollover, CSV helpers
```

Additional design notes and data schemas live in [`docs/`](docs/) — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Deployment

The app deploys to **Firebase Hosting**. Pushing to `main` triggers the GitHub Actions workflow in [`.github/workflows/firebase-deploy.yml`](.github/workflows/firebase-deploy.yml), which lints, tests, builds, and deploys.

The workflow expects the Firebase config (`VITE_FIREBASE_*`) and a `FIREBASE_SERVICE_ACCOUNT` to be set as repository secrets.

To build and deploy manually:

```bash
npm run build
npx firebase deploy
```

---

## License

Released under the [MIT License](LICENSE).
