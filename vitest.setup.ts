// Setup for the jsdom "components" Vitest project (see vitest.config.ts).
// Registers jest-dom matchers (toBeInTheDocument, toBeDisabled, ...) and
// unmounts rendered components between tests so they don't leak into each
// other.
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
