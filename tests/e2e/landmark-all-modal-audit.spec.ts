import { expect, test } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";

const LANDMARKS = [
  { placeKey: "dragon_bridge", nameVi: "Cầu Rồng" },
  { placeKey: "my_khe_beach", nameVi: "Biển Mỹ Khê" },
  { placeKey: "marble_mountains", nameVi: "Ngũ Hành Sơn" },
  { placeKey: "son_tra_peninsula", nameVi: "Bán Đảo Sơn Trà" },
  { placeKey: "han_river_bridge", nameVi: "Cầu Sông Hàn" },
  { placeKey: "linh_ung_son_tra", nameVi: "Chùa Linh Ứng Sơn Trà" },
  { placeKey: "cham_museum", nameVi: "Bảo tàng Điêu khắc Chăm" },
  {
    placeKey: "non_nuoc_stone_village",
    nameVi: "Làng nghề Đá mỹ nghệ Non Nước",
  },
  { placeKey: "han_market", nameVi: "Chợ Hàn" },
  { placeKey: "ba_na_hills", nameVi: "Bà Nà Hills" },
] as const;

test.describe("All 10 Landmarks Real User UI/UX Audit @all-landmarks-audit", () => {
  for (const landmark of LANDMARKS) {
    test(`opens gallery, detail, and challenge modal for ${landmark.nameVi} (${landmark.placeKey})`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60000);
      const browserErrors = collectSeriousBrowserErrors(page);

      await page.goto("/");
      await waitForGameCanvas(page);

      // Enter Overworld from Title Screen
      await page.keyboard.press("Enter");
      await page.waitForTimeout(600);

      // Open Landmark Gallery Panel
      const galleryButton = page.getByTestId("landmark-gallery-open");
      await expect(galleryButton).toBeVisible({ timeout: 5000 });
      await galleryButton.click();

      const galleryPanel = page.getByTestId("landmark-gallery-panel");
      await expect(galleryPanel).toBeVisible();

      // Click target Landmark Card in Gallery
      const card = page.getByTestId(`landmark-card-${landmark.placeKey}`);
      await expect(card).toBeVisible();
      await card.click();

      // Verify Landmark Detail Panel opens with correct content
      const detailPanel = page.getByTestId("landmark-detail-panel");
      await expect(detailPanel).toBeVisible();

      // Capture screenshot evidence of Detail UI
      await captureVisualEvidence(
        page,
        testInfo,
        `detail-ui-${landmark.placeKey}`,
      );

      // Click "Mở thử thách địa danh" / "Open landmark challenge" button
      const openChallengeBtn = page.getByTestId(
        "landmark-detail-open-challenge",
      );
      if (await openChallengeBtn.isVisible()) {
        await openChallengeBtn.click();

        const challengePanel = page.getByTestId("landmark-challenge-panel");
        await expect(challengePanel).toBeVisible();

        // Capture screenshot evidence of Challenge Modal UI
        await captureVisualEvidence(
          page,
          testInfo,
          `challenge-ui-${landmark.placeKey}`,
        );

        // Close Challenge Modal with Escape key
        await page.keyboard.press("Escape");
        await expect(challengePanel).toBeHidden();
      } else {
        // Close Detail Panel if challenge was not opened
        const detailClose = page.getByTestId("landmark-detail-close");
        await detailClose.click();
        await expect(detailPanel).toBeHidden();

        // Close Gallery Panel
        const galleryClose = page.getByTestId("landmark-gallery-close");
        await galleryClose.click();
        await expect(galleryPanel).toBeHidden();
      }

      await expectNoSeriousBrowserErrors(testInfo, browserErrors);
    });
  }
});
