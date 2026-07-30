import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit-test configuration (kept separate from vite.config.ts so the PWA
// plugin and app build pipeline don't run during unit tests). Split into two
// projects so pure-logic tests keep running fast in Node, while React
// component tests get a DOM (happy-dom) + Testing Library. Both are run by
// `npm run test:unit` (vitest run). Playwright E2E specs live in /e2e and are
// excluded so the runners never overlap.
//
// happy-dom is used (not jsdom) because jsdom pulls in undici, which calls
// worker_threads.markAsUncloneable at import time — an API only present on
// Node >= 20.19, so it crashes on the CI runner's Node 20.x. happy-dom has no
// such dependency and works across the Node versions CI uses.
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
        // React component tests run in happy-dom. `*.test.tsx` files use the
        // Testing Library helpers and rely on globals + jest-dom matchers
        // registered in vitest.setup.ts. The react plugin transforms JSX.
        plugins: [react()],
        test: {
          name: 'components',
          environment: 'happy-dom',
          include: ['src/**/*.test.tsx'],
          exclude: ['node_modules', 'dist', 'e2e'],
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
