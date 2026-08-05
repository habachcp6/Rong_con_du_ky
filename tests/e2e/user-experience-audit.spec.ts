import { expect, test } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectCanvasWithinViewport,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";

async function pressPhaserKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
}

test.describe("Real User UI/UX Audit & Interactive Journey @ux-audit", () => {
  test("end-to-end user journey: title screen, overworld, landmark challenge modal, gallery, companion, and language toggle", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60000);
    const browserErrors = collectSeriousBrowserErrors(page);

    // 1. Visit main page and wait for Phaser Canvas
    await page.goto("/");
    const gameCanvas = await waitForGameCanvas(page);
    await expectCanvasWithinViewport(page, gameCanvas);
    await captureVisualEvidence(page, testInfo, "01-title-screen");

    // 2. Test Language Toggle UI/UX on Title Screen
    const languageToggle = page.getByTestId("language-toggle");
    await expect(languageToggle).toBeVisible();
    await languageToggle.click();
    await page.waitForTimeout(200);
    await captureVisualEvidence(page, testInfo, "02-title-screen-english");

    // 3. Enter Overworld via Enter key
    await pressPhaserKey(page, "Enter");
    await page.waitForTimeout(600);
    await captureVisualEvidence(page, testInfo, "03-overworld-entered");

    // 4. Verify Interaction Hint for Dragon Bridge near spawn
    const interactionHint = page.getByTestId("interaction-hint");
    await expect(interactionHint).toBeVisible({ timeout: 5000 });
    await expect(interactionHint).toHaveText(/Cầu Rồng|Dragon Bridge/);

    // 5. Open Landmark Challenge Modal for Dragon Bridge via Space key
    await pressPhaserKey(page, "Space");
    await page.waitForTimeout(500);

    const challengePanel = page.getByTestId("landmark-challenge-panel");
    await expect(challengePanel).toBeVisible();
    await expect(challengePanel).toHaveText(
      /Thắp Sáng Cầu Rồng|Light Up Dragon Bridge/,
    );
    await captureVisualEvidence(page, testInfo, "04-dragon-bridge-modal");

    // Close challenge modal with Escape key
    await page.keyboard.press("Escape");
    await expect(challengePanel).toBeHidden();

    // 6. Test Landmark Gallery Panel UI/UX
    const galleryButton = page.getByTestId("landmark-gallery-open");
    await expect(galleryButton).toBeVisible();
    await galleryButton.click();

    const galleryPanel = page.getByTestId("landmark-gallery-panel");
    await expect(galleryPanel).toBeVisible();
    await expect(page.getByTestId("landmark-gallery-grid")).toBeVisible();
    await captureVisualEvidence(page, testInfo, "05-landmark-gallery");

    // Verify all 10 landmark cards exist in the gallery
    const landmarkKeys = [
      "dragon_bridge",
      "my_khe_beach",
      "marble_mountains",
      "son_tra_peninsula",
      "han_river_bridge",
      "linh_ung_son_tra",
      "cham_museum",
      "non_nuoc_stone_village",
      "han_market",
      "ba_na_hills",
    ];

    for (const key of landmarkKeys) {
      const card = page.getByTestId(`landmark-card-${key}`);
      await expect(card).toBeVisible();
    }

    // Click Landmark Card to inspect LandmarkDetailPanel
    const dragonCard = page.getByTestId("landmark-card-dragon_bridge");
    await dragonCard.click();

    const detailPanel = page.getByTestId("landmark-detail-panel");
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel).toHaveText(/Cầu Rồng|Dragon Bridge/);
    await captureVisualEvidence(page, testInfo, "06-landmark-detail-panel");

    // Close detail panel via Escape key
    await page.keyboard.press("Escape");
    await expect(detailPanel).toBeHidden();

    // Close gallery panel via Escape key
    await page.keyboard.press("Escape");
    await expect(galleryPanel).toBeHidden();

    // 7. Test Travel Tools / AI Companion Panel UI/UX
    const travelToolsButton = page.getByTestId("travel-tools-open");
    if (await travelToolsButton.isVisible()) {
      await travelToolsButton.click();

      const travelToolsPanel = page.getByTestId("travel-tools-panel");
      await expect(travelToolsPanel).toBeVisible();
      await captureVisualEvidence(page, testInfo, "07-travel-tools-panel");

      await page.keyboard.press("Escape");
      await expect(travelToolsPanel).toBeHidden();
    }

    // 8. Verify Zero Uncaught Page or Console Errors
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
