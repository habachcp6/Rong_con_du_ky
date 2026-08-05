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
    await page.addInitScript(() => window.localStorage.clear());
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
        ["han_river_bridge", "han_river_bridge_turn"],
        ["linh_ung_son_tra", "linh_ung_quiet_path"],
        ["cham_museum", "cham_museum_relic_match"],
        ["non_nuoc_stone_village", "non_nuoc_carving_pattern"],
        ["han_market", "han_market_basket_sort"],
        ["ba_na_hills", "ba_na_golden_bridge"],
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
      version: "2",
      blockedBeforeUnlock: false,
      dragonTeleported: true,
      dragonStarted: true,
      dragonRewarded: true,
      progression: [
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
        { teleported: true, rewarded: true },
      ],
      state: {
        player: { scene: "OverworldScene", x: 260, y: 240 },
        quests: {
          dragon_bridge_lights: "REWARDED",
          my_khe_clean_wave: "REWARDED",
          marble_five_elements: "REWARDED",
          son_tra_traces: "REWARDED",
          han_river_bridge_turn: "REWARDED",
          linh_ung_quiet_path: "REWARDED",
          cham_museum_relic_match: "REWARDED",
          non_nuoc_carving_pattern: "REWARDED",
          han_market_basket_sort: "REWARDED",
          ba_na_golden_bridge: "REWARDED",
        },
        unlockedPostcards: [
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
        ],
        memoryFragments: 10,
      },
    });
  });
});
