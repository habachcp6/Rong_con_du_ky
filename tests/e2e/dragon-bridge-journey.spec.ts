import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectCanvasToChange,
  expectNoSeriousBrowserErrors,
  screenshotHash,
  waitForGameCanvas,
} from "./support/evidence";
import { tapCanvasByTouch } from "./support/touch";

const GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v2";
const LEGACY_GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v1";
const DRAGON_BRIDGE_QUEST_ID = "dragon_bridge_lights";
const SEED_MARKER_KEY = "dragon-bridge-journey-e2e-seeded";

type PersistedGameState = {
  memoryFragments?: unknown;
  quests?: Record<string, unknown>;
  unlockedPostcards?: unknown;
};

/**
 * V2 seed: Dragon Bridge AVAILABLE, player spawned at world (880, 630).
 * Camera settles at (560, 450), placing the Dragon Bridge map icon at
 * canvas logical coords (320, 180) — the dead centre of the viewport.
 */
const DRAGON_BRIDGE_SEED = {
  version: 2,
  language: "vi",
  player: { scene: "OverworldScene", x: 880, y: 630 },
  quests: {
    dragon_bridge_lights: "AVAILABLE",
    my_khe_clean_wave: "LOCKED",
    marble_five_elements: "LOCKED",
    son_tra_traces: "LOCKED",
    han_river_bridge_turn: "LOCKED",
    linh_ung_quiet_path: "LOCKED",
    cham_museum_relic_match: "LOCKED",
    non_nuoc_carving_pattern: "LOCKED",
    han_market_basket_sort: "LOCKED",
    ba_na_golden_bridge: "LOCKED",
  },
  unlockedPostcards: [] as string[],
  memoryFragments: 0,
  preferences: { interests: [] as string[] },
  updatedAt: "2026-08-04T00:00:00.000Z",
};

async function readPersistedGameState(
  page: Page,
): Promise<PersistedGameState | null> {
  return page.evaluate((storageKey) => {
    const rawState = window.localStorage.getItem(storageKey);
    return rawState ? (JSON.parse(rawState) as PersistedGameState) : null;
  }, GAME_STATE_STORAGE_KEY);
}

async function pressPhaserKey(page: Page, key: string): Promise<void> {
  // Phaser's JustDown polling occurs on a game frame. Holding an actual key for
  // a short frame window prevents a synthetic press/release from landing wholly
  // between two Phaser updates.
  await page.keyboard.down(key);
  await page.waitForTimeout(60);
  await page.keyboard.up(key);
}

async function clickLogicalCanvasPoint(
  page: Page,
  canvas: Locator,
  x: number,
  y: number,
): Promise<void> {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Game canvas has no screen bounding box.");
  await page.mouse.click(
    box.x + (x / 640) * box.width,
    box.y + (y / 360) * box.height,
  );
  await page.waitForTimeout(60);
}

async function playWinningRhythm(page: Page): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  await canvas.focus();
  await page.waitForTimeout(100);
  for (let beat = 0; beat < 16; beat += 1) {
    await pressPhaserKey(page, "Space");
    await page.waitForTimeout(480);
  }
}

async function playWinningRhythmTouch(
  page: Page,
  canvas: Locator,
): Promise<void> {
  await canvas.focus();
  await page.waitForTimeout(100);
  for (let beat = 0; beat < 16; beat += 1) {
    await tapCanvasByTouch(page, canvas, 480, 270, 60);
    await page.waitForTimeout(480);
  }
}

/**
 * Seeds game state with Dragon Bridge AVAILABLE at world (880, 630),
 * navigates to "/" and transitions past the title screen via touch or keyboard.
 */
async function startSeededDragonBridgeOverworld(
  page: Page,
  useTouch: boolean,
): Promise<Locator> {
  await page.addInitScript(
    ({ storageKey, legacyKey, markerKey, seed }) => {
      if (window.sessionStorage.getItem(markerKey) !== "true") {
        window.localStorage.removeItem(legacyKey);
        window.localStorage.setItem(storageKey, JSON.stringify(seed));
        window.sessionStorage.setItem(markerKey, "true");
      }
    },
    {
      storageKey: GAME_STATE_STORAGE_KEY,
      legacyKey: LEGACY_GAME_STATE_STORAGE_KEY,
      markerKey: SEED_MARKER_KEY,
      seed: DRAGON_BRIDGE_SEED,
    },
  );
  await page.goto("/");
  const canvas = await waitForGameCanvas(page);
  // Dismiss any restored postcard before interacting (fresh seed has none, but
  // the guard is consistent with the landmark-games pattern).
  const restoredPostcard = page.getByTestId("dragon-postcard");
  if (await restoredPostcard.isVisible()) {
    await page.getByTestId("dragon-postcard-close").click();
    await expect(restoredPostcard).toBeHidden();
  }
  const hint = page.getByTestId("interaction-hint");
  if (useTouch) {
    await tapCanvasByTouch(page, canvas, 320, 180);
    if (!(await hint.isVisible())) {
      await expect
        .poll(
          async () => {
            if (!(await hint.isVisible())) {
              await tapCanvasByTouch(page, canvas, 320, 180);
            }
            return hint.isVisible();
          },
          { timeout: 10_000, intervals: [500, 800, 1200] },
        )
        .toBe(true);
    }
  } else {
    await canvas.focus();
    await pressPhaserKey(page, "Enter");
    if (!(await hint.isVisible())) {
      await expect
        .poll(
          async () => {
            if (!(await hint.isVisible())) {
              await pressPhaserKey(page, "Enter");
            }
            return hint.isVisible();
          },
          { timeout: 10_000, intervals: [500, 800, 1200] },
        )
        .toBe(true);
    }
  }
  await expect(hint).toBeVisible({ timeout: 6_000 });
  return canvas;
}

/**
 * Opens the Dragon Bridge challenge panel from a seeded overworld and clicks Start.
 * With camera settled on (880, 630) → camera (560, 450), the map icon sits at
 * canvas logical (320, 180).
 */
async function openSeededDragonBridgeChallenge(
  page: Page,
  canvas: Locator,
  useTouch: boolean,
): Promise<void> {
  const hint = page.getByTestId("interaction-hint");
  await expect(hint).toBeVisible({ timeout: 8_000 });
  const challengePanel = page.getByTestId("landmark-challenge-panel");
  if (useTouch) {
    await tapCanvasByTouch(page, canvas, 320, 180);
  } else {
    await clickLogicalCanvasPoint(page, canvas, 320, 180);
  }
  if (!(await challengePanel.isVisible())) {
    await expect
      .poll(
        async () => {
          if (!(await challengePanel.isVisible())) {
            if (useTouch) {
              await tapCanvasByTouch(page, canvas, 320, 180);
            } else {
              await clickLogicalCanvasPoint(page, canvas, 320, 180);
            }
          }
          return challengePanel.isVisible();
        },
        { timeout: 8_000, intervals: [400, 600, 800] },
      )
      .toBe(true);
  }
  await expect(challengePanel).toBeVisible({ timeout: 6_000 });

  const startBtn = page.getByTestId("landmark-challenge-start");
  if (useTouch) await startBtn.tap();
  else await startBtn.click();
  await expect(challengePanel).toBeHidden({ timeout: 6_000 });
  await canvas.focus();
  await page.waitForTimeout(200);
}

test.describe("Dragon Bridge vertical slice @dragon-bridge", () => {
  test("retries, completes, and restores the postcard after refresh", async ({
    page,
  }, testInfo) => {
    test.setTimeout(30_000);
    const useTouch = testInfo.project.name === "chromium-mobile";
    const browserErrors = collectSeriousBrowserErrors(page);
    let gameCanvas: Locator;

    if (useTouch) {
      // MOBILE PATH: seed player at Dragon Bridge, use touch input throughout.
      gameCanvas = await startSeededDragonBridgeOverworld(page, true);
      await openSeededDragonBridgeChallenge(page, gameCanvas, true);
      await captureVisualEvidence(page, testInfo, "dragon-bridge-tutorial");

      // Attempt 1: Cancel/exit attempt to verify ACTIVE reverts to AVAILABLE for retry.
      await tapCanvasByTouch(page, gameCanvas, 66, 26);
      await expect
        .poll(
          async () =>
            (await readPersistedGameState(page))?.quests?.[
              DRAGON_BRIDGE_QUEST_ID
            ],
          { timeout: 10_000 },
        )
        .toBe("AVAILABLE");
      await captureVisualEvidence(page, testInfo, "dragon-bridge-retry");

      // Attempt 2 (Retry): Re-open challenge and play winning rhythm.
      await openSeededDragonBridgeChallenge(page, gameCanvas, true);
      await playWinningRhythmTouch(page, gameCanvas);
    } else {
      // DESKTOP PATH: seed player at Dragon Bridge, keyboard input throughout.
      gameCanvas = await startSeededDragonBridgeOverworld(page, false);
      await openSeededDragonBridgeChallenge(page, gameCanvas, false);
      await captureVisualEvidence(page, testInfo, "dragon-bridge-tutorial");

      // Attempt 1: Cancel/exit attempt to verify ACTIVE reverts to AVAILABLE for retry.
      await pressPhaserKey(page, "Escape");
      await expect
        .poll(
          async () =>
            (await readPersistedGameState(page))?.quests?.[
              DRAGON_BRIDGE_QUEST_ID
            ],
          { timeout: 10_000 },
        )
        .toBe("AVAILABLE");
      await captureVisualEvidence(page, testInfo, "dragon-bridge-retry");

      // Attempt 2 (Retry): Re-open challenge and play winning rhythm.
      await openSeededDragonBridgeChallenge(page, gameCanvas, false);
      await playWinningRhythm(page);
    }

    await captureVisualEvidence(
      page,
      testInfo,
      "dragon-bridge-after-winning-rhythm",
    );
    await expect
      .poll(
        async () =>
          (await readPersistedGameState(page))?.quests?.[
            DRAGON_BRIDGE_QUEST_ID
          ],
        { timeout: 15_000 },
      )
      .toBe("REWARDED");
    const completedState = await readPersistedGameState(page);
    expect(completedState?.quests?.[DRAGON_BRIDGE_QUEST_ID]).toBe("REWARDED");
    expect(completedState?.memoryFragments).toBe(1);
    expect(completedState?.unlockedPostcards).toEqual(["dragon_bridge"]);
    const postcard = page.getByTestId("dragon-postcard");
    await expect(postcard).toBeVisible();
    await captureVisualEvidence(page, testInfo, "dragon-bridge-postcard");

    await page.getByTestId("dragon-postcard-close").click();
    await expect(postcard).toBeHidden();
    await page.reload();
    await waitForGameCanvas(page);
    await expect(page.getByTestId("dragon-postcard")).toBeVisible();
    await captureVisualEvidence(
      page,
      testInfo,
      "dragon-bridge-postcard-after-refresh",
    );

    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("keeps Info, Start, and Exit pointer controls isolated", async ({
    page,
  }, testInfo) => {
    test.setTimeout(30_000);
    const useTouch = testInfo.project.name === "chromium-mobile";
    const browserErrors = collectSeriousBrowserErrors(page);
    let canvas: Locator;

    if (useTouch) {
      // MOBILE PATH: seed at Dragon Bridge, open challenge via touch, then
      // exit via the Exit button at its known logical position (66, 26).
      // On mobile, pointer-isolation is proven by the quest returning to
      // AVAILABLE without any fragment — if Exit were leaking to the beat
      // handler, memoryFragments would be 1.
      canvas = await startSeededDragonBridgeOverworld(page, true);
      await openSeededDragonBridgeChallenge(page, canvas, true);
      // Exit from tutorial state — must cancel attempt and return to overworld.
      await tapCanvasByTouch(page, canvas, 66, 26);
      await expect
        .poll(
          async () =>
            (await readPersistedGameState(page))?.quests?.[
              DRAGON_BRIDGE_QUEST_ID
            ],
          { timeout: 8_000 },
        )
        .toBe("AVAILABLE");
      await expect(page.getByTestId("interaction-hint")).toBeVisible();
    } else {
      // DESKTOP PATH: seeded navigation + mouse pointer isolation.
      canvas = await startSeededDragonBridgeOverworld(page, false);
      await openSeededDragonBridgeChallenge(page, canvas, false);
      // Close the initial guide, then reopen it through the actual Info hit area.
      await pressPhaserKey(page, "Escape");
      const idleFrame = await screenshotHash(canvas);
      await clickLogicalCanvasPoint(page, canvas, 28, 26);
      await expectCanvasToChange(
        canvas,
        idleFrame,
        "Info did not open the guide.",
      );
      // The Start zone must consume only its own pointer event; the scene-wide
      // handler must not score beat zero on that same tap.
      await clickLogicalCanvasPoint(page, canvas, 320, 307);
      await page.waitForTimeout(200);
      // Exit must win over the scene-wide pointer handler and return to the map.
      await clickLogicalCanvasPoint(page, canvas, 66, 26);
      await expect(page.getByTestId("interaction-hint")).toBeVisible();
    }

    const state = await readPersistedGameState(page);
    expect(state?.quests?.[DRAGON_BRIDGE_QUEST_ID]).toBe("AVAILABLE");
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("first-attempt failure does not award a memory fragment (edge case @dragon-bridge)", async ({
    page,
  }, testInfo) => {
    test.setTimeout(30_000);
    const useTouch = testInfo.project.name === "chromium-mobile";
    const browserErrors = collectSeriousBrowserErrors(page);
    const canvas = await startSeededDragonBridgeOverworld(page, useTouch);
    await openSeededDragonBridgeChallenge(page, canvas, useTouch);

    // Dismiss tutorial without scoring any beats, then let the full beat
    // sequence expire so the game transitions back to AVAILABLE on its own.
    if (useTouch) {
      await tapCanvasByTouch(page, canvas, 320, 180);
    } else {
      await pressPhaserKey(page, "Space");
    }
    await expect
      .poll(
        async () =>
          (await readPersistedGameState(page))?.quests?.[
            DRAGON_BRIDGE_QUEST_ID
          ],
        { timeout: 20_000 },
      )
      .toBe("AVAILABLE");

    const state = await readPersistedGameState(page);
    expect(state?.quests?.[DRAGON_BRIDGE_QUEST_ID]).toBe("AVAILABLE");
    expect(state?.memoryFragments).toBe(0);
    expect(state?.unlockedPostcards).toEqual([]);
    await captureVisualEvidence(
      page,
      testInfo,
      "dragon-bridge-failure-no-fragment",
    );
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("exiting before the first beat does not award a fragment (edge case @dragon-bridge)", async ({
    page,
  }, testInfo) => {
    test.setTimeout(30_000);
    const useTouch = testInfo.project.name === "chromium-mobile";
    const browserErrors = collectSeriousBrowserErrors(page);
    const canvas = await startSeededDragonBridgeOverworld(page, useTouch);
    await openSeededDragonBridgeChallenge(page, canvas, useTouch);

    // Exit immediately from the tutorial overlay before any beat interaction.
    if (useTouch) {
      await tapCanvasByTouch(page, canvas, 66, 26); // Exit/Back button
    } else {
      await pressPhaserKey(page, "Escape");
    }

    await expect
      .poll(
        async () =>
          (await readPersistedGameState(page))?.quests?.[
            DRAGON_BRIDGE_QUEST_ID
          ],
        { timeout: 10_000 },
      )
      .toBe("AVAILABLE");
    const state = await readPersistedGameState(page);
    expect(state?.memoryFragments).toBe(0);
    expect(state?.unlockedPostcards).toEqual([]);
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
