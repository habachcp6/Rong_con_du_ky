import { expect, test } from "@playwright/test";
import { waitForGameCanvas } from "./support/evidence";

const e2eBridgeEnabled = process.env.VITE_ENABLE_E2E_BRIDGE === "true";

declare global {
  interface Window {
    __GAME_TEST__?: {
      readonly version: string;
      readonly getState: () => unknown;
      readonly teleportTo: (placeKey: string) => boolean;
      readonly startQuest: (questId: string) => boolean;
      readonly completeQuest: (questId: string) => boolean;
    };
  }
}

test.describe("E2E bridge guard @security", () => {
  test("does not expose an automation bridge unless local development opted in", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForGameCanvas(page);

    const bridge = await page.evaluate(() => {
      const candidate = window.__GAME_TEST__;
      if (!candidate) {
        return undefined;
      }

      return {
        keys: Object.keys(candidate).sort(),
        version: candidate.version,
        getStateType: typeof candidate.getState,
        teleportToType: typeof candidate.teleportTo,
        startQuestType: typeof candidate.startQuest,
        completeQuestType: typeof candidate.completeQuest,
      };
    });

    if (!e2eBridgeEnabled) {
      expect(bridge).toBeUndefined();
      return;
    }

    expect(bridge).toBeDefined();
    expect(bridge).toMatchObject({
      version: expect.any(String),
      getStateType: "function",
      teleportToType: "function",
      startQuestType: "function",
      completeQuestType: "function",
    });
    expect(bridge?.keys).toEqual([
      "completeQuest",
      "getState",
      "startQuest",
      "teleportTo",
      "version",
    ]);
  });
});
