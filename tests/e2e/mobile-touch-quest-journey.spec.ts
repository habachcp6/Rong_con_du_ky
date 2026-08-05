import { expect, test, type Page } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";
import { moveWithTouchJoystick, tapCanvasByTouch } from "./support/touch";

const GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v2";
const DRAGON_BRIDGE_QUEST_ID = "dragon_bridge_lights";

async function persistedQuestStatus(page: Page): Promise<unknown> {
  return page.evaluate(
    ({ storageKey, questId }) => {
      const raw = window.localStorage.getItem(storageKey);
      const state = raw
        ? (JSON.parse(raw) as { quests?: Record<string, unknown> })
        : undefined;
      return state?.quests?.[questId];
    },
    { storageKey: GAME_STATE_STORAGE_KEY, questId: DRAGON_BRIDGE_QUEST_ID },
  );
}

async function playDragonBridgeWithTouch(page: Page): Promise<void> {
  const canvas = await waitForGameCanvas(page);
  // The first tap starts the rhythm tutorial. A sequence of real taps then
  // catches enough deterministic windows without any test-only bridge.
  await tapCanvasByTouch(page, canvas, 320, 180);
  for (let index = 0; index < 30; index += 1) {
    await page.waitForTimeout(150);
    await tapCanvasByTouch(page, canvas, 320, 180, 45);
  }
}

test.describe("mobile touch quest journey @touch @m4", () => {
  test("reaches the initially available Dragon Bridge through touch controls and completes it", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile",
      "This journey is intentionally proven in the mobile touch project only.",
    );
    test.setTimeout(50_000);

    const browserErrors = collectSeriousBrowserErrors(page);
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto("/");
    const canvas = await waitForGameCanvas(page);

    // No localStorage precondition is installed: Dragon Bridge is the real
    // first AVAILABLE quest in a fresh game. Start and travel using only touch.
    await tapCanvasByTouch(page, canvas, 320, 180);
    await moveWithTouchJoystick(page, canvas, { x: 1, y: 0 }, 200);

    await expect(page.getByTestId("interaction-hint")).toBeVisible();
    await captureVisualEvidence(page, testInfo, "mobile-near-dragon-bridge");

    // This is the Overworld's visible mobile interaction control at logical
    // x=556/y=298, not an E/Space shortcut.
    await expect
      .poll(
        async () => {
          await tapCanvasByTouch(page, canvas, 556, 298);
          return page.getByTestId("landmark-challenge-panel").isVisible();
        },
        { timeout: 8_000 },
      )
      .toBe(true);
    await page.getByTestId("landmark-challenge-start").tap();
    await expect(page.getByTestId("landmark-challenge-panel")).toBeHidden();

    await playDragonBridgeWithTouch(page);
    await expect
      .poll(() => persistedQuestStatus(page), { timeout: 10_000 })
      .toBe("REWARDED");
    await expect(page.getByTestId("dragon-postcard")).toBeVisible();
    await captureVisualEvidence(page, testInfo, "mobile-dragon-bridge-reward");

    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
