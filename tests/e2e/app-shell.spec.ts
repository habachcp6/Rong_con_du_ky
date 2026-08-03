import { expect, test } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectCanvasWithinViewport,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";

test.describe("application shell @visual", () => {
  test("loads the Vietnamese title screen and records a viewport artifact", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);

    await page.goto("/");
    await expect(page).toHaveTitle(/Rồng Con Du Ký/i);
    const canvas = await waitForGameCanvas(page);
    await expectCanvasWithinViewport(page, canvas);
    await captureVisualEvidence(page, testInfo, "title");

    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
