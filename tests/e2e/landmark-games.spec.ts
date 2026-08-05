import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";
import { tapCanvasByTouch } from "./support/touch";

const GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v2";
const LEGACY_GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v1";
const SEED_MARKER_KEY = "landmark-games-e2e-seeded";

type QuestStatus = "LOCKED" | "AVAILABLE" | "ACTIVE" | "COMPLETED" | "REWARDED";

type CampaignEntry = {
  questId: string;
  placeKey: string;
  landmarkName: string;
  player: { x: number; y: number };
};

type ChallengeInput = {
  optionIndex: number;
  presses: number;
};

type LandmarkGame = CampaignEntry & {
  optionCount: number;
  solution: readonly ChallengeInput[];
};

type V2GameState = {
  version: 2;
  language: "vi";
  player: { scene: "OverworldScene"; x: number; y: number };
  quests: Record<string, QuestStatus>;
  unlockedPostcards: string[];
  memoryFragments: number;
  preferences: { interests: string[] };
  updatedAt: string;
};

type PersistedCampaignState = {
  memoryFragments?: unknown;
  quests?: Record<string, unknown>;
  unlockedPostcards?: unknown;
};

/** Campaign order is intentionally duplicated here so each seed is valid V2
 * persisted input without relying on a test-only application bridge. */
const CAMPAIGN: readonly CampaignEntry[] = [
  {
    questId: "dragon_bridge_lights",
    placeKey: "dragon_bridge",
    landmarkName: "Cầu Rồng",
    player: { x: 880, y: 630 },
  },
  {
    questId: "my_khe_clean_wave",
    placeKey: "my_khe_beach",
    landmarkName: "Biển Mỹ Khê",
    player: { x: 1200, y: 480 },
  },
  {
    questId: "marble_five_elements",
    placeKey: "marble_mountains",
    landmarkName: "Ngũ Hành Sơn",
    player: { x: 740, y: 850 },
  },
  {
    questId: "son_tra_traces",
    placeKey: "son_tra_peninsula",
    landmarkName: "Bán Đảo Sơn Trà",
    player: { x: 1250, y: 210 },
  },
  {
    questId: "han_river_bridge_turn",
    placeKey: "han_river_bridge",
    landmarkName: "Cầu Sông Hàn",
    player: { x: 830, y: 250 },
  },
  {
    questId: "linh_ung_quiet_path",
    placeKey: "linh_ung_son_tra",
    landmarkName: "Chùa Linh Ứng Sơn Trà",
    player: { x: 1420, y: 220 },
  },
  {
    questId: "cham_museum_relic_match",
    placeKey: "cham_museum",
    landmarkName: "Bảo tàng Điêu khắc Chăm",
    player: { x: 710, y: 470 },
  },
  {
    questId: "non_nuoc_carving_pattern",
    placeKey: "non_nuoc_stone_village",
    landmarkName: "Làng nghề Đá mỹ nghệ Non Nước",
    player: { x: 660, y: 880 },
  },
  {
    questId: "han_market_basket_sort",
    placeKey: "han_market",
    landmarkName: "Chợ Hàn",
    player: { x: 480, y: 490 },
  },
  {
    questId: "ba_na_golden_bridge",
    placeKey: "ba_na_hills",
    landmarkName: "Bà Nà Hills",
    player: { x: 260, y: 240 },
  },
];

const LANDMARK_GAMES: readonly LandmarkGame[] = [
  {
    questId: "han_river_bridge_turn",
    placeKey: "han_river_bridge",
    landmarkName: "Cầu Sông Hàn",
    player: { x: 830, y: 250 },
    optionCount: 4,
    solution: [
      { optionIndex: 0, presses: 1 },
      { optionIndex: 1, presses: 3 },
      { optionIndex: 2, presses: 2 },
      { optionIndex: 3, presses: 1 },
    ],
  },
  {
    questId: "linh_ung_quiet_path",
    placeKey: "linh_ung_son_tra",
    landmarkName: "Chùa Linh Ứng Sơn Trà",
    player: { x: 1420, y: 220 },
    optionCount: 7,
    solution: [
      { optionIndex: 0, presses: 1 },
      { optionIndex: 1, presses: 1 },
      { optionIndex: 2, presses: 1 },
      { optionIndex: 3, presses: 1 },
      { optionIndex: 4, presses: 1 },
    ],
  },
  {
    questId: "cham_museum_relic_match",
    placeKey: "cham_museum",
    landmarkName: "Bảo tàng Điêu khắc Chăm",
    player: { x: 710, y: 470 },
    optionCount: 6,
    solution: [
      { optionIndex: 0, presses: 1 },
      { optionIndex: 1, presses: 1 },
      { optionIndex: 2, presses: 1 },
      { optionIndex: 3, presses: 1 },
    ],
  },
  {
    questId: "non_nuoc_carving_pattern",
    placeKey: "non_nuoc_stone_village",
    landmarkName: "Làng nghề Đá mỹ nghệ Non Nước",
    player: { x: 660, y: 880 },
    optionCount: 7,
    solution: [
      { optionIndex: 0, presses: 1 },
      { optionIndex: 2, presses: 1 },
      { optionIndex: 1, presses: 1 },
      { optionIndex: 3, presses: 1 },
      { optionIndex: 4, presses: 1 },
      { optionIndex: 5, presses: 1 },
    ],
  },
  {
    questId: "han_market_basket_sort",
    placeKey: "han_market",
    landmarkName: "Chợ Hàn",
    player: { x: 480, y: 490 },
    optionCount: 8,
    solution: [
      { optionIndex: 0, presses: 2 },
      // Three presses deliberately cycle these two items back to their default
      // local-food basket instead of treating an untouched default as a win.
      { optionIndex: 1, presses: 3 },
      { optionIndex: 2, presses: 1 },
      { optionIndex: 3, presses: 1 },
      { optionIndex: 4, presses: 2 },
      { optionIndex: 5, presses: 2 },
      { optionIndex: 6, presses: 3 },
      { optionIndex: 7, presses: 1 },
    ],
  },
  {
    questId: "ba_na_golden_bridge",
    placeKey: "ba_na_hills",
    landmarkName: "Bà Nà Hills",
    player: { x: 260, y: 240 },
    optionCount: 6,
    solution: [
      { optionIndex: 0, presses: 1 },
      { optionIndex: 1, presses: 1 },
      { optionIndex: 2, presses: 1 },
      { optionIndex: 3, presses: 1 },
      { optionIndex: 4, presses: 1 },
      { optionIndex: 5, presses: 1 },
    ],
  },
];

function seedForCampaignEntry(game: CampaignEntry): V2GameState {
  const targetIndex = CAMPAIGN.findIndex(
    ({ questId }) => questId === game.questId,
  );
  if (targetIndex < 0) {
    throw new Error(`Missing campaign entry for ${game.questId}.`);
  }

  const quests: Record<string, QuestStatus> = {};
  CAMPAIGN.forEach(({ questId }, index) => {
    quests[questId] =
      index < targetIndex
        ? "REWARDED"
        : index === targetIndex
          ? "AVAILABLE"
          : "LOCKED";
  });

  return {
    version: 2,
    language: "vi",
    player: { scene: "OverworldScene", ...game.player },
    quests,
    unlockedPostcards: CAMPAIGN.slice(0, targetIndex).map(
      ({ placeKey }) => placeKey,
    ),
    memoryFragments: targetIndex,
    preferences: { interests: [] },
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

async function pressPhaserKey(page: Page, key: string): Promise<void> {
  // Phaser reads JustDown during its frame loop, so hold a real key long
  // enough that it cannot begin and end wholly between frames.
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
}

async function readPersistedState(
  page: Page,
): Promise<PersistedCampaignState | null> {
  return page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as PersistedCampaignState) : null;
  }, GAME_STATE_STORAGE_KEY);
}

async function readQuestStatus(page: Page, questId: string): Promise<unknown> {
  return (await readPersistedState(page))?.quests?.[questId];
}

function optionPoint(
  optionCount: number,
  optionIndex: number,
): {
  x: number;
  y: number;
} {
  const columns = optionCount > 6 ? 2 : 3;
  const rows = Math.ceil(optionCount / columns);
  const denseGrid = rows > 2;
  const buttonWidth = Math.min(180, (640 - 56 - (columns - 1) * 12) / columns);
  const buttonHeight = denseGrid ? 38 : 52;
  const rowGap = denseGrid ? 8 : 11;
  const startY = denseGrid ? 153 : 166;
  const column = optionIndex % columns;
  const row = Math.floor(optionIndex / columns);

  return {
    x:
      320 -
      ((columns - 1) * (buttonWidth + 12)) / 2 +
      column * (buttonWidth + 12),
    y: startY + row * (buttonHeight + rowGap),
  };
}

function landmarkPoint(player: LandmarkGame["player"]): {
  x: number;
  y: number;
} {
  const cameraX = Math.max(0, Math.min(player.x - 320, 1600 - 640));
  const cameraY = Math.max(0, Math.min(player.y - 180, 960 - 360));
  return { x: player.x - cameraX, y: player.y - cameraY };
}

async function clickCanvasPoint(
  page: Page,
  canvas: Locator,
  x: number,
  y: number,
): Promise<void> {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box.");
  await page.mouse.click(
    box.x + (x / 640) * box.width,
    box.y + (y / 360) * box.height,
  );
}

async function startSeededOverworld(
  page: Page,
  state: V2GameState,
  useTouch: boolean,
) {
  // The init script also runs on reload. A session marker preserves the
  // earned reward so the reload assertion exercises real local persistence.
  await page.addInitScript(
    ({ storageKey, legacyStorageKey, markerKey, persistedState }) => {
      if (window.sessionStorage.getItem(markerKey) !== "true") {
        window.localStorage.removeItem(legacyStorageKey);
        window.localStorage.setItem(storageKey, JSON.stringify(persistedState));
        window.sessionStorage.setItem(markerKey, "true");
      }
    },
    {
      storageKey: GAME_STATE_STORAGE_KEY,
      legacyStorageKey: LEGACY_GAME_STATE_STORAGE_KEY,
      markerKey: SEED_MARKER_KEY,
      persistedState: state,
    },
  );

  await page.goto("/");
  const canvas = await waitForGameCanvas(page);
  await expect(page.getByTestId("language-toggle")).toBeVisible();

  // A valid frontier seed restores the previous postcard. Close it as a user
  // would before starting from the title screen, especially for touch input.
  const restoredPostcard = page.getByTestId("dragon-postcard");
  if (await restoredPostcard.isVisible()) {
    await page.getByTestId("dragon-postcard-close").click();
    await expect(restoredPostcard).toBeHidden();
  }

  if (useTouch) {
    await tapCanvasByTouch(page, canvas, 320, 180);
  } else {
    await canvas.focus();
    await pressPhaserKey(page, "Enter");
  }

  return canvas;
}

async function openSeededChallenge(
  page: Page,
  useTouch: boolean,
  game: CampaignEntry,
) {
  const hint = page.getByTestId("interaction-hint");
  await expect(hint).toBeVisible();
  await expect(hint).toContainText(game.landmarkName);
  // The follow camera needs a few frames to settle after a seeded title
  // transition. Then this is a real click/tap on the actual map icon.
  await page.waitForTimeout(600);

  const canvas = page.locator("#game-container canvas").first();
  const mapPoint = landmarkPoint(game.player);
  if (useTouch) {
    await tapCanvasByTouch(page, canvas, mapPoint.x, mapPoint.y);
  } else {
    await clickCanvasPoint(page, canvas, mapPoint.x, mapPoint.y);
  }

  const challengePanel = page.getByTestId("landmark-challenge-panel");
  await expect(challengePanel).toBeVisible();
  await expect(challengePanel).toContainText(game.landmarkName);
  const startButton = page.getByTestId("landmark-challenge-start");
  if (useTouch) await startButton.tap();
  else await startButton.click();
  await expect(challengePanel).toBeHidden();
  await expect.poll(() => readQuestStatus(page, game.questId)).toBe("ACTIVE");
  await page.waitForTimeout(100);
}

async function solveWithKeyboard(
  page: Page,
  game: LandmarkGame,
): Promise<void> {
  await pressPhaserKey(page, "Space");
  let focusedOption = 0;

  for (const { optionIndex, presses } of game.solution) {
    const forwardSteps =
      (optionIndex - focusedOption + game.optionCount) % game.optionCount;
    const backwardSteps =
      (focusedOption - optionIndex + game.optionCount) % game.optionCount;
    const key = forwardSteps <= backwardSteps ? "ArrowRight" : "ArrowLeft";
    const steps = Math.min(forwardSteps, backwardSteps);

    for (let index = 0; index < steps; index += 1) {
      await pressPhaserKey(page, key);
    }
    for (let index = 0; index < presses; index += 1) {
      await pressPhaserKey(page, "Space");
    }
    focusedOption = optionIndex;
  }
}

async function solveWithTouch(page: Page, game: LandmarkGame): Promise<void> {
  const canvas = page.locator("#game-container canvas").first();
  // The shared scene's intro button is centered at logical 320/180.
  await tapCanvasByTouch(page, canvas, 320, 180);

  for (const { optionIndex, presses } of game.solution) {
    const point = optionPoint(game.optionCount, optionIndex);
    for (let index = 0; index < presses; index += 1) {
      await tapCanvasByTouch(page, canvas, point.x, point.y);
    }
  }
}

function assertSingleReward(
  state: PersistedCampaignState | null,
  game: LandmarkGame,
  expectedPostcards: readonly string[],
  nextQuestId: string | undefined,
): void {
  expect(state?.quests?.[game.questId]).toBe("REWARDED");
  expect(state?.memoryFragments).toBe(expectedPostcards.length);
  expect(state?.unlockedPostcards).toEqual(expectedPostcards);
  const unlockedPostcards = state?.unlockedPostcards;
  expect(
    Array.isArray(unlockedPostcards)
      ? unlockedPostcards.filter((placeKey) => placeKey === game.placeKey)
      : [],
  ).toHaveLength(1);
  if (nextQuestId) {
    expect(state?.quests?.[nextQuestId]).toBe("AVAILABLE");
  }
}

test.describe("all landmark map-icon entry @landmark-icons", () => {
  for (const landmark of CAMPAIGN) {
    test(`opens ${landmark.landmarkName} from its actual map icon`, async ({
      page,
    }, testInfo) => {
      const browserErrors = collectSeriousBrowserErrors(page);
      const useTouch = testInfo.project.name === "chromium-mobile";

      await startSeededOverworld(
        page,
        seedForCampaignEntry(landmark),
        useTouch,
      );
      const hint = page.getByTestId("interaction-hint");
      await expect(hint).toBeVisible();
      await expect(hint).toContainText(landmark.landmarkName);
      await page.waitForTimeout(600);
      await captureVisualEvidence(
        page,
        testInfo,
        `map-icon-${landmark.placeKey}`,
      );

      const canvas = page.locator("#game-container canvas").first();
      const point = landmarkPoint(landmark.player);
      if (useTouch) {
        await tapCanvasByTouch(page, canvas, point.x, point.y);
      } else {
        await clickCanvasPoint(page, canvas, point.x, point.y);
      }

      const challengePanel = page.getByTestId("landmark-challenge-panel");
      await expect(challengePanel).toBeVisible();
      await expect(challengePanel).toContainText(landmark.landmarkName);
      const closeButton = page.getByTestId("landmark-challenge-close");
      if (useTouch) await closeButton.tap();
      else await closeButton.click();
      await expect(challengePanel).toBeHidden();
      if (useTouch) {
        // Closing a DOM challenge panel must hand control back to Phaser;
        // prove it with a second real map-icon touch, not a test bridge.
        await tapCanvasByTouch(page, canvas, point.x, point.y);
        await expect(challengePanel).toBeVisible();
        await closeButton.tap();
        await expect(challengePanel).toBeHidden();
      }
      await expectNoSeriousBrowserErrors(testInfo, browserErrors);
    });
  }
});

test.describe("six landmark game Escape lifecycle @landmark-games", () => {
  for (const game of LANDMARK_GAMES) {
    test(`returns ${game.landmarkName} to its available frontier after Escape`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium-desktop",
        "Escape is a desktop keyboard control; touch completion is covered separately.",
      );
      const browserErrors = collectSeriousBrowserErrors(page);

      await startSeededOverworld(page, seedForCampaignEntry(game), false);
      await openSeededChallenge(page, false, game);
      await pressPhaserKey(page, "Escape");
      await expect
        .poll(() => readQuestStatus(page, game.questId), { timeout: 8_000 })
        .toBe("AVAILABLE");
      await expect(page.getByTestId("interaction-hint")).toBeVisible();
      await expectNoSeriousBrowserErrors(testInfo, browserErrors);
    });
  }
});

test.describe("six landmark game journeys @landmark-games", () => {
  for (const game of LANDMARK_GAMES) {
    test(`completes ${game.landmarkName}, persists one fragment, and unlocks the campaign frontier`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(45_000);
      const browserErrors = collectSeriousBrowserErrors(page);
      const useTouch = testInfo.project.name === "chromium-mobile";
      const seed = seedForCampaignEntry(game);
      const targetIndex = CAMPAIGN.findIndex(
        ({ questId }) => questId === game.questId,
      );
      const expectedPostcards = CAMPAIGN.slice(0, targetIndex + 1).map(
        ({ placeKey }) => placeKey,
      );
      const nextQuestId = CAMPAIGN[targetIndex + 1]?.questId;

      await startSeededOverworld(page, seed, useTouch);
      await openSeededChallenge(page, useTouch, game);
      await captureVisualEvidence(
        page,
        testInfo,
        `landmark-game-intro-${game.placeKey}`,
      );
      if (useTouch) {
        await solveWithTouch(page, game);
      } else {
        await solveWithKeyboard(page, game);
      }

      await expect
        .poll(() => readQuestStatus(page, game.questId), { timeout: 8_000 })
        .toBe("REWARDED");
      const postcard = page.getByTestId("dragon-postcard");
      await expect(postcard).toBeVisible();
      await expect(postcard).toContainText(game.landmarkName);
      await captureVisualEvidence(
        page,
        testInfo,
        `landmark-game-reward-${game.placeKey}`,
      );
      assertSingleReward(
        await readPersistedState(page),
        game,
        expectedPostcards,
        nextQuestId,
      );

      await page.reload();
      await waitForGameCanvas(page);
      await expect(page.getByTestId("language-toggle")).toBeVisible();
      await expect(postcard).toBeVisible();
      assertSingleReward(
        await readPersistedState(page),
        game,
        expectedPostcards,
        nextQuestId,
      );

      // The postcard holds Phaser input while open. Closing it must return
      // real map interaction after a scene return/reload, not only hide DOM.
      await page.getByTestId("dragon-postcard-close").click();
      await expect(postcard).toBeHidden();
      const resumedCanvas = page.locator("#game-container canvas").first();
      if (useTouch) {
        await tapCanvasByTouch(page, resumedCanvas, 320, 180);
      } else {
        await resumedCanvas.focus();
        await pressPhaserKey(page, "Enter");
      }
      await expect(page.getByTestId("interaction-hint")).toBeVisible();
      await page.waitForTimeout(600);
      const resumedMapPoint = landmarkPoint(game.player);
      if (useTouch) {
        await tapCanvasByTouch(
          page,
          resumedCanvas,
          resumedMapPoint.x,
          resumedMapPoint.y,
        );
      } else {
        await clickCanvasPoint(
          page,
          resumedCanvas,
          resumedMapPoint.x,
          resumedMapPoint.y,
        );
      }
      await expect(page.getByTestId("landmark-detail-panel")).toBeVisible();
      await expectNoSeriousBrowserErrors(testInfo, browserErrors);
    });
  }
});
