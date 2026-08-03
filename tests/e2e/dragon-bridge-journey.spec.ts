import { expect, test, type Page } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectCanvasToChange,
  expectNoSeriousBrowserErrors,
  screenshotHash,
  waitForGameCanvas,
} from "./support/evidence";

const GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v1";
const DRAGON_BRIDGE_QUEST_ID = "dragon_bridge_lights";

type PersistedGameState = {
  memoryFragments?: unknown;
  quests?: Record<string, unknown>;
  unlockedPostcards?: unknown;
};

async function readPersistedGameState(
  page: Page,
): Promise<PersistedGameState | null> {
  return page.evaluate((storageKey) => {
    const rawState = window.localStorage.getItem(storageKey);
    return rawState ? (JSON.parse(rawState) as PersistedGameState) : null;
  }, GAME_STATE_STORAGE_KEY);
}

async function moveKeyboardPlayerToDragonBridge(page: Page): Promise<void> {
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(1_800);
  await page.keyboard.up("ArrowUp");

  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(5_400);
  await page.keyboard.up("ArrowRight");
}

async function pressPhaserKey(page: Page, key: string): Promise<void> {
  // Phaser's JustDown polling occurs on a game frame. Holding an actual key for
  // a short frame window prevents a synthetic press/release from landing wholly
  // between two Phaser updates.
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
}

async function beginDragonBridgeQuest(page: Page): Promise<void> {
  await expect(page.getByTestId("interaction-hint")).toBeVisible();
  await pressPhaserKey(page, "KeyE");
  await expect(page.getByTestId("dragon-dialogue")).toBeVisible();
  await page.getByTestId("dragon-quest-start").click();
  await expect(page.getByTestId("dragon-dialogue")).toBeHidden();
}

async function playWinningRhythm(page: Page): Promise<void> {
  // The first Space starts the tutorial. Subsequent real key presses are spaced
  // inside each 500 ms hit window of the 750 ms deterministic beat interval.
  await pressPhaserKey(page, "Space");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.waitForTimeout(150);
    await pressPhaserKey(page, "Space");
  }
  // Wait for the final beat, deterministic reward transition, and scene return.
  await page.waitForTimeout(2_000);
}

test.describe("Dragon Bridge vertical slice @dragon-bridge", () => {
  test("retries, completes through keyboard input, and restores the postcard after refresh", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The Dragon Bridge keyboard journey is exercised once on the desktop project.",
    );
    test.setTimeout(60_000);

    const browserErrors = collectSeriousBrowserErrors(page);
    await page.goto("/");
    const gameCanvas = await waitForGameCanvas(page);
    await gameCanvas.focus();
    const titleFrame = await screenshotHash(gameCanvas);

    await page.keyboard.press("Enter");
    await expectCanvasToChange(
      gameCanvas,
      titleFrame,
      "Enter did not start the game before the Dragon Bridge journey.",
    );
    await moveKeyboardPlayerToDragonBridge(page);
    await beginDragonBridgeQuest(page);
    await captureVisualEvidence(page, testInfo, "dragon-bridge-tutorial");

    // First attempt deliberately misses every beat and must return ACTIVE to
    // AVAILABLE so a user can retry without corrupting deterministic state.
    await pressPhaserKey(page, "Space");
    await page.waitForTimeout(8_200);
    await captureVisualEvidence(page, testInfo, "dragon-bridge-retry");
    const retryState = await readPersistedGameState(page);
    expect(retryState?.quests?.[DRAGON_BRIDGE_QUEST_ID]).toBe("AVAILABLE");

    // Space restarts the result screen; the next Space starts the new attempt.
    await pressPhaserKey(page, "Space");
    await page.waitForTimeout(300);
    await playWinningRhythm(page);

    await captureVisualEvidence(
      page,
      testInfo,
      "dragon-bridge-after-winning-rhythm",
    );
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
});
