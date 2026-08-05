import { expect, test, type Page } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";
import { QUEST_ORDER } from "../../src/shared/game-state";

const GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v2";

const CAMPAIGN = [
  ["dragon_bridge_lights", "dragon_bridge"],
  ["my_khe_clean_wave", "my_khe_beach"],
  ["marble_five_elements", "marble_mountains"],
  ["son_tra_traces", "son_tra_peninsula"],
  ["han_river_bridge_turn", "han_river_bridge"],
  ["linh_ung_quiet_path", "linh_ung_son_tra"],
  ["cham_museum_relic_match", "cham_museum"],
  ["non_nuoc_carving_pattern", "non_nuoc_stone_village"],
  ["han_market_basket_sort", "han_market"],
  ["ba_na_golden_bridge", "ba_na_hills"],
] as const;

const coordinates = {
  han_river_bridge: { x: 830, y: 250 },
  linh_ung_son_tra: { x: 1420, y: 220 },
} as const;

function seedCampaign(
  frontierIndex: number,
  player: { x: number; y: number },
  language: "vi" | "en" = "vi",
) {
  const quests: Record<string, string> = {};
  QUEST_ORDER.forEach((questId, index) => {
    quests[questId] =
      index < frontierIndex
        ? "REWARDED"
        : index === frontierIndex
          ? "AVAILABLE"
          : "LOCKED";
  });
  return {
    version: 2,
    language,
    player: { scene: "OverworldScene", ...player },
    quests,
    unlockedPostcards: CAMPAIGN.slice(0, frontierIndex).map(
      ([, placeKey]) => placeKey,
    ),
    memoryFragments: frontierIndex,
    preferences: { interests: [] },
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

async function pressPhaserKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
}

async function startSeededOverworld(page: Page, state: unknown) {
  await page.addInitScript(
    ({ storageKey, persistedState }) =>
      window.localStorage.setItem(storageKey, JSON.stringify(persistedState)),
    { storageKey: GAME_STATE_STORAGE_KEY, persistedState: state },
  );

  await page.goto("/");
  const canvas = await waitForGameCanvas(page);
  await canvas.focus();
  await pressPhaserKey(page, "Enter");
  const restoredPostcard = page.getByTestId("dragon-postcard");
  try {
    await restoredPostcard.waitFor({ state: "visible", timeout: 2500 });
    await page.getByTestId("dragon-postcard-close").click();
    await restoredPostcard.waitFor({ state: "hidden", timeout: 2500 });
  } catch {
    // Postcard not shown
  }
  return canvas;
}

test.describe("landmark icon challenge entry @landmark-icons", () => {
  test("opens the Han River Bridge challenge panel from its map icon hint and keeps bilingual copy", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);
    const canvas = await startSeededOverworld(
      page,
      seedCampaign(4, coordinates.han_river_bridge),
    );

    const hint = page.getByTestId("interaction-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("Cầu Sông Hàn — nhấn E / Space");

    await page.getByTestId("language-toggle").click();
    await expect(hint).toContainText("Han River Bridge — press E / Space");

    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    const challenge = page.getByTestId("landmark-challenge-panel");
    await expect(challenge).toBeVisible();
    await expect(challenge).toContainText("Han River Bridge");
    await expect(challenge.locator("img")).toHaveAttribute(
      "src",
      "/assets/landmark-icons/han-river-bridge.png",
    );
    await expect(page.getByTestId("landmark-challenge-start")).toBeVisible();
    await captureVisualEvidence(page, testInfo, "han-river-challenge-panel");
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("uses the common panel to explain a locked next landmark", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);
    const canvas = await startSeededOverworld(
      page,
      seedCampaign(4, coordinates.linh_ung_son_tra),
    );

    await expect(page.getByTestId("interaction-hint")).toHaveText(
      /Chùa Linh Ứng Sơn Trà — (Hoàn thành Cầu Sông Hàn để mở khóa|nhấn E \/ Space)/,
    );
    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    const challenge = page.getByTestId("landmark-challenge-panel");
    await expect(challenge).toHaveText(/Chưa mở khóa|Chùa Linh Ứng/);
    await expect(page.getByTestId("landmark-challenge-close")).toBeVisible();
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("keeps landmark content available from the challenge panel without replacing the game", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The keyboard modal hand-off is exercised once on desktop.",
    );
    const browserErrors = collectSeriousBrowserErrors(page);
    const canvas = await startSeededOverworld(
      page,
      seedCampaign(4, coordinates.han_river_bridge),
    );
    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    await page.getByRole("button", { name: "Xem nội dung địa danh" }).click();

    const detailPanel = page.getByTestId("landmark-detail-panel");
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.locator("#landmark-detail-title")).toHaveText(
      "Cầu Sông Hàn",
    );
    await expect(
      detailPanel.locator(".landmark-detail-panel__food-section"),
    ).toBeVisible();
    await expect(
      detailPanel.getByTestId("landmark-detail-open-challenge"),
    ).toBeVisible();
    await captureVisualEvidence(
      page,
      testInfo,
      "han-river-detail-from-challenge",
    );
    await page.getByTestId("landmark-detail-close").click();
    await expect(detailPanel).toBeHidden();
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("returns Phaser control after closing the common challenge panel by button, backdrop, or Escape", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Keyboard focus/escape behavior is exercised once on desktop.",
    );
    const browserErrors = collectSeriousBrowserErrors(page);
    const canvas = await startSeededOverworld(
      page,
      seedCampaign(4, coordinates.han_river_bridge),
    );
    const challenge = page.getByTestId("landmark-challenge-panel");

    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    await page.getByTestId("landmark-challenge-close").click();
    await expect(challenge).toBeHidden();

    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    await page
      .getByTestId("landmark-challenge-backdrop")
      .click({ position: { x: 4, y: 4 } });
    await expect(challenge).toBeHidden();

    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    await page.keyboard.press("Escape");
    await expect(challenge).toBeHidden();
    await expect(page.getByTestId("interaction-hint")).toBeVisible();
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
