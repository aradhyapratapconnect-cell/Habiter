import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run TS tests with vitest. tests/unit/schema.test.mjs uses Node's
    // built-in test runner and is run separately via `node --test`.
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
