import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (...segments: string[]): string =>
  fs.readFileSync(path.resolve(process.cwd(), ...segments), "utf8");

const wslRunner = projectFile("scripts", "run-wsl-docker-e2e.sh");
const nativeRunner = projectFile("scripts", "run-native-docker-e2e.ps1");
const playwrightConfig = projectFile("playwright.config.ts");

describe("WSL/Linux Docker E2E release contract", () => {
  it("requires Linux Node 24 and fails before Compose when no daemon is reachable", () => {
    expect(wslRunner).toContain("#!/usr/bin/env bash");
    expect(wslRunner).toContain("set -euo pipefail");
    expect(wslRunner).toContain("node -p 'process.platform'");
    expect(wslRunner).toContain('"$node_platform" != "linux"');
    expect(wslRunner).toContain("node -p 'process.versions.node'");
    expect(wslRunner).toContain('[[ ! "$node_version" =~ ^24\\. ]]');
    expect(wslRunner).toContain("requires Node.js 24.x from package.json");
    expect(wslRunner).toContain("docker info");
    expect(wslRunner).toContain("docker-daemon-diagnostic.txt");
    expect(wslRunner).toContain(
      "did not start Compose, switch Docker contexts",
    );
    expect(wslRunner).toContain("Compose is intentionally left running");
  });

  it("captures separate production evidence and exercises both target viewports", () => {
    expect(wslRunner).toContain("test-results/wsl-docker-e2e");
    expect(wslRunner).toContain("health.json");
    expect(wslRunner).toContain("docker-compose-ps.txt");
    expect(wslRunner).toContain("docker-compose-ps-failure.txt");
    expect(wslRunner).toContain("docker-compose-app-failure.log");
    expect(wslRunner).toContain("PLAYWRIGHT_HTML_OUTPUT_DIR");
    expect(wslRunner).toContain('PLAYWRIGHT_CAPTURE_VIDEO="true"');
    expect(wslRunner).toContain("npx --no-install playwright test");
    expect(wslRunner).toContain('"--project=chromium-desktop"');
    expect(wslRunner).toContain('"--project=chromium-mobile"');
    expect(wslRunner).toContain('"--workers=1"');
  });

  it("keeps the WSL production run black-box and retains the native Windows gate", () => {
    expect(wslRunner).toContain('VITE_ENABLE_E2E_BRIDGE="false"');
    expect(wslRunner).toContain('PLAYWRIGHT_PRODUCTION_E2E="true"');
    expect(wslRunner).toContain('VITE_API_BASE_URL="/api"');
    expect(wslRunner).toContain('VITE_USE_FIREBASE_EMULATORS="false"');
    expect(wslRunner).toContain('VITE_FIREBASE_API_KEY=""');
    expect(wslRunner).toContain('GEMINI_API_KEY=""');
    expect(wslRunner).toContain('GOOGLE_MAPS_API_KEY=""');
    expect(playwrightConfig).toContain(
      'process.env.PLAYWRIGHT_PRODUCTION_E2E === "true"',
    );
    expect(playwrightConfig).toContain("testIgnore: productionContainerE2e");
    expect(nativeRunner).toContain('$nodePlatform -ne "win32"');
    expect(nativeRunner).toContain("test-results\\native-docker-e2e");
  });
});
