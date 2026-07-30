import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit-test configuration (kept separate from vite.config.ts so the PWA
// plugin and app build pipeline don't run during unit tests). Split into two
// projects so pure-logic tests keep running fast in Node, while React
// component tests get a jsdom DOM + Testing Library. Both are run by
// `npm run test:unit` (vitest run). Playwright E2E specs live in /e2e and are
// excluded so the runners never overlap.
export default defineConfig({
  test: {
    projects: [
      {
        // Pure-logic unit tests run in Node — no DOM needed. `*.test.ts` files
        // import { describe, it, expect } from 'vitest' explicitly.
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['node_modules', 'dist', 'e2e'],
          globals: false,
        },
      },
      {
        // React component tests run in jsdom. `*.test.tsx` files use the
        // Testing Library helpers and rely on globals + jest-dom matchers
        // registered in vitest.setup.ts. The react plugin transforms JSX.
        plugins: [react()],
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          exclude: ['node_modules', 'dist', 'e2e'],
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
