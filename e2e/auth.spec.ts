import { test, expect } from '@playwright/test';

// These E2E tests exercise the public, unauthenticated surface of the app:
// the login page and the auth-guard redirects. They run against a dev server
// booted with dummy Firebase config (see playwright.config.ts), so no real
// Google sign-in or Firebase project is required.

test.describe('Login page', () => {
  test('renders the branded sign-in screen', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle(/Budget Buddy/);
    await expect(page.getByRole('heading', { name: 'Budget Buddy' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continue with google/i })
    ).toBeVisible();
    await expect(page.getByText(/paycheck-based budgeting made simple/i)).toBeVisible();
  });
});

test.describe('Auth guard', () => {
  test('redirects an unauthenticated user from a protected route to /login', async ({
    page,
  }) => {
    await page.goto('/paycheck');

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('button', { name: /continue with google/i })
    ).toBeVisible();
  });

  test('redirects an unknown route to /login when unauthenticated', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Budget Buddy' })).toBeVisible();
  });
});
