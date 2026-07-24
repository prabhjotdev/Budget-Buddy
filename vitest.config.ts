import { defineConfig } from 'vitest/config';

// Unit-test configuration (kept separate from vite.config.ts so the PWA
// plugin and app build pipeline don't run during unit tests).
export default defineConfig({
  test: {
    // Pure-logic unit tests run in Node — no DOM needed.
    environment: 'node',
    // Only pick up unit tests under src. Playwright E2E specs live in /e2e
    // and are excluded so the two runners never overlap.
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'e2e'],
    globals: false,
  },
});
