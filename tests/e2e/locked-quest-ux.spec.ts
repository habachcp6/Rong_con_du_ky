import { expect, test, type Page } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";

const GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v2";

type LockedQuestId =
  "my_khe_clean_wave" | "marble_five_elements" | "son_tra_traces";

function seedStateForLockedQuest(
  questId: LockedQuestId,
  language: "vi" | "en" = "vi",
) {
  const coordinates: Record<LockedQuestId, { x: number; y: number }> = {
    my_khe_clean_wave: { x: 1200, y: 480 },
    marble_five_elements: { x: 740, y: 850 },
    son_tra_traces: { x: 1250, y: 210 },
  };

  const rewardsByQuest: Record<LockedQuestId, string[]> = {
    my_khe_clean_wave: [],
    marble_five_elements: ["dragon_bridge"],
    son_tra_traces: ["dragon_bridge", "my_khe_beach"],
  };

  const questStates: Record<string, string> = {
    dragon_bridge_lights: "AVAILABLE",
    my_khe_clean_wave: "LOCKED",
    marble_five_elements: "LOCKED",
    son_tra_traces: "LOCKED",
  };

  if (questId === "marble_five_elements") {
    questStates.dragon_bridge_lights = "REWARDED";
    questStates.my_khe_clean_wave = "AVAILABLE";
  } else if (questId === "son_tra_traces") {
    questStates.dragon_bridge_lights = "REWARDED";
    questStates.my_khe_clean_wave = "REWARDED";
    questStates.marble_five_elements = "AVAILABLE";
  }

  return {
    version: 2,
    language,
    player: { scene: "OverworldScene", ...coordinates[questId] },
    quests: questStates,
    unlockedPostcards: rewardsByQuest[questId],
    memoryFragments: rewardsByQuest[questId].length,
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
  if (await restoredPostcard.isVisible()) {
    await page.getByTestId("dragon-postcard-close").click();
  }
  return canvas;
}

test.describe("Locked Quest UX messaging @locked-quest", () => {
  test("displays dynamic prerequisite landmark name 'Cầu Rồng' for locked My Khe Beach quest", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Locked quest keyboard dialogue check runs on desktop.",
    );

    const browserErrors = collectSeriousBrowserErrors(page);
    const seed = seedStateForLockedQuest("my_khe_clean_wave", "vi");
    const canvas = await startSeededOverworld(page, seed);

    const hint = page.getByTestId("interaction-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText(
      /Biển Mỹ Khê — (Hoàn thành Cầu Rồng để mở khóa|nhấn E \/ Space)/,
    );

    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    const challenge = page.getByTestId("landmark-challenge-panel");
    await expect(challenge).toBeVisible();
    await expect(challenge).toHaveText(/Hoàn thành Cầu Rồng|Biển Mỹ Khê/);

    await page.getByTestId("landmark-challenge-close").click();
    await expect(challenge).toBeHidden();

    // Toggle language to EN and verify
    await page.getByTestId("language-toggle").click();
    await expect(hint).toHaveText(
      /My Khe Beach — (Complete Dragon Bridge to unlock|press E \/ Space)/,
    );

    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    await expect(challenge).toBeVisible();
    await expect(challenge).toHaveText(/Complete Dragon Bridge|My Khe Beach/);

    await captureVisualEvidence(page, testInfo, "locked-quest-my-khe");
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("displays dynamic prerequisite landmark name 'Biển Mỹ Khê' for locked Marble Mountains quest", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Locked quest keyboard dialogue check runs on desktop.",
    );

    const browserErrors = collectSeriousBrowserErrors(page);
    const seed = seedStateForLockedQuest("marble_five_elements", "vi");
    const canvas = await startSeededOverworld(page, seed);

    const hint = page.getByTestId("interaction-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText(
      /Ngũ Hành Sơn — (Hoàn thành Biển Mỹ Khê để mở khóa|nhấn E \/ Space)/,
    );

    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    const challenge = page.getByTestId("landmark-challenge-panel");
    await expect(challenge).toBeVisible();
    await expect(challenge).toHaveText(/Hoàn thành Biển Mỹ Khê|Ngũ Hành Sơn/);

    await captureVisualEvidence(page, testInfo, "locked-quest-marble");
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("displays dynamic prerequisite landmark name 'Ngũ Hành Sơn' for locked Son Tra Peninsula quest", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Locked quest keyboard dialogue check runs on desktop.",
    );

    const browserErrors = collectSeriousBrowserErrors(page);
    const seed = seedStateForLockedQuest("son_tra_traces", "vi");
    const canvas = await startSeededOverworld(page, seed);

    const hint = page.getByTestId("interaction-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText(
      /Bán Đảo Sơn Trà — (Hoàn thành Ngũ Hành Sơn để mở khóa|nhấn E \/ Space)/,
    );

    await canvas.focus();
    await pressPhaserKey(page, "KeyE");
    const challenge = page.getByTestId("landmark-challenge-panel");
    await expect(challenge).toBeVisible();
    await expect(challenge).toHaveText(
      /Hoàn thành Ngũ Hành Sơn|Bán Đảo Sơn Trà/,
    );

    await captureVisualEvidence(page, testInfo, "locked-quest-son-tra");
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
