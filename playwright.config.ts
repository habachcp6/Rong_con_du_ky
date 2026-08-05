import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? "4173");
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.PLAYWRIGHT_TEST_BASE_URL ??
  `http://127.0.0.1:${port}`;
const isCI = Boolean(process.env.CI);
const usesExternalServer = Boolean(
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.PLAYWRIGHT_TEST_BASE_URL,
);
const productionContainerE2e = process.env.PLAYWRIGHT_PRODUCTION_E2E === "true";
const htmlReportOutputFolder =
  process.env.PLAYWRIGHT_HTML_OUTPUT_DIR ?? "playwright-report";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    `PLAYWRIGHT_PORT must be a valid TCP port; received ${port}.`,
  );
}

/**
 * The browser test suite is deliberately black-box by default. An application
 * may add a narrowly scoped test bridge only when this explicit dev flag is
 * true; the flag is never enabled by this config implicitly.
 */
const e2eBridgeEnabled = process.env.VITE_ENABLE_E2E_BRIDGE === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: productionContainerE2e ? ["**/e2e-bridge-enabled.spec.ts"] : [],
  outputDir: "test-results/playwright",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: htmlReportOutputFolder }],
  ],
  use: {
    baseURL,
    locale: "vi-VN",
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video:
      process.env.PLAYWRIGHT_CAPTURE_VIDEO === "true"
        ? "on"
        : "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1366, height: 768 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
      },
    },
    {
      name: "chromium-mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        command: `npm run dev:web -- --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !isCI,
        env: {
          VITE_ENABLE_E2E_BRIDGE: e2eBridgeEnabled ? "true" : "false",
        },
      },
});
