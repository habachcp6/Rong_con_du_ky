import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (...segments: string[]): string =>
  fs.readFileSync(path.resolve(process.cwd(), ...segments), "utf8");

const nativeRunner = projectFile("scripts", "run-native-docker-e2e.ps1");
const playwrightConfig = projectFile("playwright.config.ts");
const bridgeRunner = projectFile("scripts", "run-e2e-bridge.ts");

describe("native Docker E2E release contract", () => {
  it("requires native Windows, captures production evidence, and runs both target viewports", () => {
    expect(nativeRunner).toContain('$nodePlatform -ne "win32"');
    expect(nativeRunner).toContain('node -p "process.versions.node"');
    expect(nativeRunner).toContain('$nodeVersion -notmatch "^24\\."');
    expect(nativeRunner).toContain("requires Node.js 24.x from package.json");
    expect(nativeRunner).toContain("test-results\\native-docker-e2e");
    expect(nativeRunner).toContain("health.json");
    expect(nativeRunner).toContain("docker-compose-ps.txt");
    expect(nativeRunner).toContain("docker-compose-ps-failure.txt");
    expect(nativeRunner).toContain("docker-compose-app-failure.log");
    expect(nativeRunner).toContain("PLAYWRIGHT_HTML_OUTPUT_DIR");
    expect(nativeRunner).toContain('PLAYWRIGHT_CAPTURE_VIDEO = "true"');
    expect(nativeRunner).toContain("npx --no-install playwright test");
    expect(nativeRunner).toContain('"--project=chromium-desktop"');
    expect(nativeRunner).toContain('"--project=chromium-mobile"');
    expect(nativeRunner).toContain('"--workers=1"');
  });

  it("keeps production-container E2E black-box, deterministic, and excludes the development bridge suite", () => {
    expect(nativeRunner).toContain('VITE_ENABLE_E2E_BRIDGE = "false"');
    expect(nativeRunner).toContain('PLAYWRIGHT_PRODUCTION_E2E = "true"');
    expect(nativeRunner).toContain('VITE_API_BASE_URL = "/api"');
    expect(nativeRunner).toContain('VITE_USE_FIREBASE_EMULATORS = "false"');
    expect(nativeRunner).toContain('VITE_FIREBASE_API_KEY = ""');
    expect(nativeRunner).toContain('GEMINI_API_KEY = ""');
    expect(nativeRunner).toContain('GOOGLE_MAPS_API_KEY = ""');
    expect(nativeRunner).toContain(
      'Restore-ProcessEnvironmentVariable `\n        -Name "GEMINI_API_KEY"',
    );
    for (const variable of [
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_APP_ID",
      "VITE_FIREBASE_AUTH_EMULATOR_URL",
      "VITE_FIREBASE_FIRESTORE_EMULATOR_HOST",
      "VITE_FIREBASE_FIRESTORE_EMULATOR_PORT",
    ]) {
      expect(nativeRunner).toContain(`${variable} = ""`);
      expect(nativeRunner).toContain(
        `[Environment]::GetEnvironmentVariable(\n    "${variable}",`,
      );
      expect(nativeRunner).toContain(`-Name "${variable}"`);
    }
    for (const variable of [
      "VITE_API_BASE_URL",
      "VITE_USE_FIREBASE_EMULATORS",
      "VITE_FIREBASE_API_KEY",
      "GEMINI_API_KEY",
      "GOOGLE_MAPS_API_KEY",
    ]) {
      expect(nativeRunner).toContain(
        `[Environment]::GetEnvironmentVariable(\n    "${variable}",`,
      );
      expect(nativeRunner).toContain(`-Name "${variable}"`);
    }
    expect(playwrightConfig).toContain(
      'process.env.PLAYWRIGHT_PRODUCTION_E2E === "true"',
    );
    expect(playwrightConfig).toContain("testIgnore: productionContainerE2e");
    expect(playwrightConfig).toContain('"**/e2e-bridge-enabled.spec.ts"');
    expect(playwrightConfig).toContain("outputFolder: htmlReportOutputFolder");
  });

  it("prevents the development-only bridge command from inheriting a production URL or mode", () => {
    expect(bridgeRunner).toContain("delete environment.PLAYWRIGHT_BASE_URL");
    expect(bridgeRunner).toContain(
      "delete environment.PLAYWRIGHT_TEST_BASE_URL",
    );
    expect(bridgeRunner).toContain(
      "delete environment.PLAYWRIGHT_PRODUCTION_E2E",
    );
  });
});
