import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests live in tests/ and run in the Node environment by default.
    // Tests that exercise browser APIs opt into jsdom with a per-file
    // `// @vitest-environment jsdom` pragma.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
