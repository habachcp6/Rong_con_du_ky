import { spawn } from "node:child_process";

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(
  executable,
  [
    "playwright",
    "test",
    "tests/e2e/dragon-bridge-journey.spec.ts",
    "--project=chromium-desktop",
    "--workers=1",
  ],
  {
    env: {
      ...process.env,
      PLAYWRIGHT_CAPTURE_VIDEO: "true",
      VITE_ENABLE_E2E_BRIDGE: "false",
    },
    stdio: "inherit",
  },
);

child.once("error", (error) => {
  console.error("Unable to start Playwright recording:", error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
