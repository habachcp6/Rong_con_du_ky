import { defineConfig } from "vitest/config";

/** Firebase Emulator-backed rule tests; invoked only by `npm run test:rules`. */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    exclude: [
      "tests/e2e/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
});
