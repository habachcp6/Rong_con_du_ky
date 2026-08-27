import { expect, test } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";

const ALL_LANDMARK_KEYS = [
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
] as const;

test.describe("Landmark Gallery UI @gallery", () => {
  test("opens LandmarkGalleryPanel from header button and displays 10 landmark cards", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);

    await page.goto("/");
    await waitForGameCanvas(page);

    const galleryButton = page.getByTestId("landmark-gallery-open");
    await expect(galleryButton).toBeVisible();
    await galleryButton.click();

    const galleryPanel = page.getByTestId("landmark-gallery-panel");
    await expect(galleryPanel).toBeVisible();

    const heading = galleryPanel.locator("#landmark-gallery-title");
    await expect(heading).toHaveText("Khám phá 10 Địa danh");

    const grid = page.getByTestId("landmark-gallery-grid");
    await expect(grid).toBeVisible();

    for (const key of ALL_LANDMARK_KEYS) {
      const card = page.getByTestId(`landmark-card-${key}`);
      await expect(card).toBeVisible();
    }

    const cardsCount = await grid
      .locator('[data-testid^="landmark-card-"]')
      .count();
    expect(cardsCount).toBe(10);

    await captureVisualEvidence(page, testInfo, "landmark-gallery-10-cards");
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("renders 2 columns layout on desktop vs 1 column layout on mobile", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);

    await page.goto("/");
    await waitForGameCanvas(page);

    await page.getByTestId("landmark-gallery-open").click();
    await expect(page.getByTestId("landmark-gallery-panel")).toBeVisible();

    const card0 = page.getByTestId(`landmark-card-${ALL_LANDMARK_KEYS[0]}`);
    const card1 = page.getByTestId(`landmark-card-${ALL_LANDMARK_KEYS[1]}`);

    const box0 = await card0.boundingBox();
    const box1 = await card1.boundingBox();
    expect(box0).not.toBeNull();
    expect(box1).not.toBeNull();

    if (testInfo.project.name === "chromium-desktop") {
      // Desktop: 2 columns side-by-side
      expect(box1!.x).toBeGreaterThan(box0!.x + box0!.width / 2);
    } else if (testInfo.project.name === "chromium-mobile") {
      // Mobile: 1 column stacked vertically
      expect(Math.abs(box1!.x - box0!.x)).toBeLessThan(30);
      expect(box1!.y).toBeGreaterThan(box0!.y);
    }

    await captureVisualEvidence(
      page,
      testInfo,
      `gallery-layout-${testInfo.project.name}`,
    );
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("clicking landmark card opens LandmarkDetailPanel with food cards, sources, and Maps link", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);

    await page.goto("/");
    await waitForGameCanvas(page);

    await page.getByTestId("landmark-gallery-open").click();
    await expect(page.getByTestId("landmark-gallery-panel")).toBeVisible();

    const baNaCard = page.getByTestId("landmark-card-ba_na_hills");
    await baNaCard.click();

    const detailPanel = page.getByTestId("landmark-detail-panel");
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.locator("#landmark-detail-title")).toHaveText(
      "Bà Nà Hills",
    );

    const detailImg = detailPanel.locator("img.landmark-detail-panel__image");
    await expect(detailImg).toBeVisible();
    await expect(detailImg).toHaveAttribute(
      "src",
      "/assets/landmarks/ba-na-hills.png",
    );

    const foodSection = detailPanel.locator(
      ".landmark-detail-panel__food-section",
    );
    await expect(foodSection).toBeVisible();
    await expect(foodSection.locator(".place-card").first()).toBeVisible();

    const sources = detailPanel.locator(".landmark-detail-panel__sources");
    await expect(sources).toBeVisible();
    await expect(sources).toContainText("Nguồn dữ liệu & Trích dẫn");

    const mapsLink = detailPanel.locator("a.landmark-detail-panel__maps-link");
    await expect(mapsLink).toBeVisible();
    await expect(mapsLink).toHaveAttribute("target", "_blank");
    await expect(mapsLink).toHaveAttribute("href", /google\.com\/maps\/search/);

    await captureVisualEvidence(page, testInfo, "landmark-detail-ba-na-hills");
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("opens the common Dragon Bridge challenge from gallery detail before title play begins", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);

    await page.goto("/");
    await waitForGameCanvas(page);
    await page.getByTestId("landmark-gallery-open").click();
    await page.getByTestId("landmark-card-dragon_bridge").click();
    const detailPanel = page.getByTestId("landmark-detail-panel");
    await expect(detailPanel).toBeVisible();

    await page.getByTestId("landmark-detail-open-challenge").click();
    const challengePanel = page.getByTestId("landmark-challenge-panel");
    await expect(challengePanel).toBeVisible();
    await expect(challengePanel).toContainText("Cầu Rồng");
    await expect(page.getByTestId("landmark-challenge-start")).toBeVisible();

    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("supports modal accessibility for gallery and detail (X button, backdrop click, Escape key)", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);

    await page.goto("/");
    await waitForGameCanvas(page);

    const galleryButton = page.getByTestId("landmark-gallery-open");
    const galleryPanel = page.getByTestId("landmark-gallery-panel");
    const detailPanel = page.getByTestId("landmark-detail-panel");

    // 1. Close gallery via X button
    await galleryButton.click();
    await expect(galleryPanel).toBeVisible();
    await page.getByTestId("landmark-gallery-close").click();
    await expect(galleryPanel).toBeHidden();

    // 2. Header coordinates are covered by the modal. The existing gallery
    // backdrop-dismiss behavior closes the gallery, but must not reopen it
    // through the covered header button.
    await galleryButton.click();
    await expect(galleryPanel).toBeVisible();
    const galleryHeaderBox = await galleryButton.boundingBox();
    expect(galleryHeaderBox).not.toBeNull();
    await page.mouse.click(
      galleryHeaderBox!.x + galleryHeaderBox!.width / 2,
      galleryHeaderBox!.y + galleryHeaderBox!.height / 2,
    );
    await expect(galleryPanel).toBeHidden();
    await expect(page.getByTestId("landmark-gallery-panel")).toBeHidden();

    // 3. Close gallery via backdrop click
    await galleryButton.click();
    await expect(galleryPanel).toBeVisible();
    await page
      .getByTestId("landmark-gallery-backdrop")
      .click({ position: { x: 5, y: 5 } });
    await expect(galleryPanel).toBeHidden();

    // 4. Close gallery via Escape key
    await galleryButton.click();
    await expect(galleryPanel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(galleryPanel).toBeHidden();

    // 5. Open card detail -> close detail via X button
    await galleryButton.click();
    await expect(galleryPanel).toBeVisible();
    await page.getByTestId("landmark-card-han_market").click();
    await expect(detailPanel).toBeVisible();
    await page.getByTestId("landmark-detail-close").click();
    await expect(detailPanel).toBeHidden();

    // 6. A header click dismisses the detail backdrop but does not open the
    // covered gallery button through it.
    await galleryButton.click();
    await expect(galleryPanel).toBeVisible();
    await page.getByTestId("landmark-card-han_market").click();
    await expect(detailPanel).toBeVisible();
    const detailHeaderBox = await galleryButton.boundingBox();
    expect(detailHeaderBox).not.toBeNull();
    await page.mouse.click(
      detailHeaderBox!.x + detailHeaderBox!.width / 2,
      detailHeaderBox!.y + detailHeaderBox!.height / 2,
    );
    await expect(detailPanel).toBeHidden();
    await expect(page.getByTestId("landmark-gallery-panel")).toBeHidden();

    // 7. Open card detail -> close detail via Escape key
    await galleryButton.click();
    await expect(galleryPanel).toBeVisible();
    await page.getByTestId("landmark-card-cham_museum").click();
    await expect(detailPanel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detailPanel).toBeHidden();

    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("updates gallery and detail panel text when language is toggled", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);

    await page.goto("/");
    await waitForGameCanvas(page);

    await page.getByTestId("language-toggle").click();
    await expect(page.getByTestId("language-toggle")).toHaveText("Tiếng Việt");

    await page.getByTestId("landmark-gallery-open").click();
    const galleryPanel = page.getByTestId("landmark-gallery-panel");
    await expect(galleryPanel).toBeVisible();
    await expect(galleryPanel.locator("#landmark-gallery-title")).toHaveText(
      "Explore 10 Landmarks",
    );

    const baNaCard = page.getByTestId("landmark-card-ba_na_hills");
    await baNaCard.scrollIntoViewIfNeeded();
    await baNaCard.locator(".landmark-gallery-card__button").click();
    const detailPanel = page.getByTestId("landmark-detail-panel");
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.locator("#landmark-detail-title")).toHaveText(
      "Ba Na Hills",
    );

    const mapsLink = detailPanel.locator("a.landmark-detail-panel__maps-link");
    await expect(mapsLink).toContainText("View location on Google Maps");

    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
