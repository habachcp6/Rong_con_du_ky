import { expect, test } from "@playwright/test";
import { waitForGameCanvas } from "./support/evidence";

const e2eBridgeEnabled = process.env.VITE_ENABLE_E2E_BRIDGE === "true";

declare global {
  interface Window {
    __GAME_TEST__?: {
      version: string;
      getState(): {
        player: { scene: string; x: number; y: number };
        quests: Record<string, string>;
        unlockedPostcards: string[];
        memoryFragments: number;
      };
      teleportTo(placeKey: string): boolean;
      startQuest(questId: string): boolean;
      completeQuest(questId: string): boolean;
    };
  }
}

test.describe("development-only E2E bridge", () => {
  test.skip(!e2eBridgeEnabled, "Only enabled by npm run test:e2e:bridge.");

  test("advances the full quest graph only through deterministic transitions", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForGameCanvas(page);

    const result = await page.evaluate(() => {
      const bridge = window.__GAME_TEST__;
      if (!bridge) return null;

      const blockedBeforeUnlock = bridge.completeQuest("marble_five_elements");
      const dragonTeleported = bridge.teleportTo("dragon_bridge");
      const dragonStarted = bridge.startQuest("dragon_bridge_lights");
      const dragonRewarded = bridge.completeQuest("dragon_bridge_lights");
      const progression = [
        ["my_khe_beach", "my_khe_clean_wave"],
        ["marble_mountains", "marble_five_elements"],
        ["son_tra_peninsula", "son_tra_traces"],
      ].map(([placeKey, questId]) => ({
        teleported: bridge.teleportTo(placeKey),
        rewarded: bridge.completeQuest(questId),
      }));
      return {
        version: bridge.version,
        blockedBeforeUnlock,
        dragonTeleported,
        dragonStarted,
        dragonRewarded,
        progression,
        state: bridge.getState(),
      };
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      version: "1",
      blockedBeforeUnlock: false,
      dragonTeleported: true,
      dragonStarted: true,
      dragonRewarded: true,
      progression: [
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
      ],
      state: {
        player: { scene: "OverworldScene", x: 1362, y: 354 },
        quests: {
          dragon_bridge_lights: "REWARDED",
          my_khe_clean_wave: "REWARDED",
          marble_five_elements: "REWARDED",
          son_tra_traces: "REWARDED",
        },
        unlockedPostcards: [
          "dragon_bridge",
          "my_khe_beach",
          "marble_mountains",
          "son_tra_peninsula",
        ],
        memoryFragments: 4,
      },
    });
  });
});
