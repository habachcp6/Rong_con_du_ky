import { createHash } from "node:crypto";
import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

/**
 * Visual evidence is intentionally emitted as an attached Playwright artifact,
 * rather than committed as a brittle snapshot. The path convention is:
 * test-results/playwright/<test>/screenshots/<checkpoint>-<project>.png.
 */
export async function captureVisualEvidence(
  page: Page,
  testInfo: TestInfo,
  checkpoint: string,
): Promise<string> {
  const filename = `${checkpoint}-${testInfo.project.name}.png`;
  const path = testInfo.outputPath("screenshots", filename);

  await page.screenshot({
    path,
    animations: "disabled",
  });
  await testInfo.attach(`visual:${checkpoint}`, {
    path,
    contentType: "image/png",
  });

  return path;
}

export async function waitForGameCanvas(page: Page): Promise<Locator> {
  const gameCanvas = page.locator("#game-container canvas").first();
  await expect(gameCanvas).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(
      async () =>
        gameCanvas.evaluate((canvas) => canvas.width > 0 && canvas.height > 0),
      { timeout: 20_000 },
    )
    .toBe(true);
  return gameCanvas;
}

/** Keeps layout checks semantic: the canvas must stay usable without relying on
 * a fragile pixel snapshot or a fixed browser chrome size. */
export async function expectCanvasWithinViewport(
  page: Page,
  canvas: Locator,
): Promise<void> {
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box, "Game canvas must have viewport layout bounds.").not.toBeNull();
  expect(viewport, "Playwright project must define a viewport.").not.toBeNull();
  if (!box || !viewport) return;

  expect(box.width, "Game canvas must have visible width.").toBeGreaterThan(0);
  expect(box.height, "Game canvas must have visible height.").toBeGreaterThan(
    0,
  );
  expect(
    box.x,
    "Game canvas must not clip on the left.",
  ).toBeGreaterThanOrEqual(-1);
  expect(
    box.y,
    "Game canvas must not clip above the viewport.",
  ).toBeGreaterThanOrEqual(-1);
  expect(
    box.x + box.width,
    "Game canvas must not clip on the right.",
  ).toBeLessThanOrEqual(viewport.width + 1);
  expect(
    box.y + box.height,
    "Game canvas must not clip below the viewport.",
  ).toBeLessThanOrEqual(viewport.height + 1);
  expect(
    box.width / box.height,
    "Phaser FIT canvas must preserve the 16:9 logical aspect ratio.",
  ).toBeCloseTo(16 / 9, 2);

  const documentMetrics = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(documentMetrics.scrollWidth).toBeLessThanOrEqual(
    documentMetrics.clientWidth + 1,
  );
  expect(documentMetrics.scrollHeight).toBeLessThanOrEqual(
    documentMetrics.clientHeight + 1,
  );
}

export async function screenshotHash(locator: Locator): Promise<string> {
  const image = await locator.screenshot({ animations: "disabled" });
  return createHash("sha256").update(image).digest("hex");
}

export async function expectCanvasToChange(
  canvas: Locator,
  previousHash: string,
  message: string,
): Promise<void> {
  await expect
    .poll(() => screenshotHash(canvas), { message, timeout: 6_000 })
    .not.toBe(previousHash);
}

export function collectSeriousBrowserErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on("pageerror", (error) => {
    errors.push(`[pageerror] ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`[console.error] ${message.text()}`);
    }
  });

  return errors;
}

export async function expectNoSeriousBrowserErrors(
  testInfo: TestInfo,
  errors: readonly string[],
): Promise<void> {
  if (errors.length > 0) {
    await testInfo.attach("browser-errors", {
      body: errors.join("\n"),
      contentType: "text/plain",
    });
  }

  expect(
    errors,
    "Unexpected browser errors were emitted during the journey.",
  ).toEqual([]);
}
