import { test } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectCanvasToChange,
  expectNoSeriousBrowserErrors,
  screenshotHash,
  waitForGameCanvas,
} from "./support/evidence";

test.describe("keyboard happy path @keyboard", () => {
  test("starts from title and moves through the overworld with keyboard input", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "This is the desktop keyboard journey; mobile coverage uses touch-specific scenarios.",
    );

    const browserErrors = collectSeriousBrowserErrors(page);
    await page.goto("/");
    const gameCanvas = await waitForGameCanvas(page);

    await captureVisualEvidence(page, testInfo, "keyboard-title");
    const titleFrame = await screenshotHash(gameCanvas);

    // This must be a real key event. It guards against a pointer-only title UI.
    await page.keyboard.press("Enter");
    await expectCanvasToChange(
      gameCanvas,
      titleFrame,
      "Enter did not advance the title screen into the overworld.",
    );

    const overworldFrame = await screenshotHash(gameCanvas);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(450);
    await page.keyboard.up("ArrowRight");
    await expectCanvasToChange(
      gameCanvas,
      overworldFrame,
      "ArrowRight did not produce a visible overworld movement update.",
    );
    await captureVisualEvidence(page, testInfo, "keyboard-overworld");

    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
