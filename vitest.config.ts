import { defineConfig } from "vitest/config";

/**
 * Browser E2E and Firebase Emulator suites have their own explicit commands.
 * Keeping them out of the default unit suite makes `npm run test` fully local.
 */
export default defineConfig({
  test: {
    exclude: [
      ".agents/**",
      "tests/e2e/**",
      "tests/integration/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
});
