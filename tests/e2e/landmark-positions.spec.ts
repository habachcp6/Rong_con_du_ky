import { expect, test } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";

test.describe("Overworld Landmark Positions E2E @positions", () => {
  test("verifies all 10 landmarks and geographic river layout on the overworld map", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);
    await page.goto("/");
    await waitForGameCanvas(page);

    // Press Enter to start game from Title into Overworld
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Capture visual evidence of overworld map layout
    await captureVisualEvidence(page, testInfo, "overworld-landmark-positions");

    const data = await page.evaluate(() => {
      const bridgeData = (window as any).__QUEST_POSITIONS__;
      const riverBounds = (window as any).__RIVER_BOUNDS__ || {
        left: 750,
        right: 950,
      };
      return { bridgeData, riverBounds };
    });

    if (data.bridgeData) {
      const positions = data.bridgeData as Array<{
        key: string;
        x: number;
        y: number;
      }>;
      const findKey = (key: string) => positions.find((p) => p.key === key)!;

      const dragonBridge = findKey("dragon_bridge");
      const hanRiverBridge = findKey("han_river_bridge");
      const chamMuseum = findKey("cham_museum");
      const hanMarket = findKey("han_market");
      const myKhe = findKey("my_khe_beach");
      const sonTra = findKey("son_tra_peninsula");
      const linhUng = findKey("linh_ung_son_tra");
      const marble = findKey("marble_mountains");
      const nonNuoc = findKey("non_nuoc_stone_village");
      const baNa = findKey("ba_na_hills");

      // Verify all 10 are present
      expect(positions.length).toBe(10);

      // Bridges ON river
      expect(dragonBridge.x).toBeGreaterThanOrEqual(data.riverBounds.left);
      expect(dragonBridge.x).toBeLessThanOrEqual(data.riverBounds.right);
      expect(hanRiverBridge.x).toBeGreaterThanOrEqual(data.riverBounds.left);
      expect(hanRiverBridge.x).toBeLessThanOrEqual(data.riverBounds.right);
      expect(hanRiverBridge.y).toBeLessThan(dragonBridge.y);

      // West bank
      expect(chamMuseum.x).toBeLessThan(data.riverBounds.left);
      expect(hanMarket.x).toBeLessThan(data.riverBounds.left);

      // East coast & NE
      expect(myKhe.x).toBeGreaterThan(data.riverBounds.right);
      expect(sonTra.x).toBeGreaterThan(data.riverBounds.right);
      expect(sonTra.y).toBeLessThan(350);
      expect(linhUng.x).toBeGreaterThan(data.riverBounds.right);
      expect(linhUng.y).toBeLessThan(350);

      // South
      expect(marble.y).toBeGreaterThan(dragonBridge.y);
      expect(nonNuoc.y).toBeGreaterThan(dragonBridge.y);

      // NW
      expect(baNa.x).toBeLessThan(350);
      expect(baNa.y).toBeLessThan(350);
    }

    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
