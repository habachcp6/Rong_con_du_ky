import { expect, test, type Page } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";

const GAME_STATE_STORAGE_KEY = "rong-con-du-ky.game-state.v1";

type QuestId = "my_khe_clean_wave" | "marble_five_elements" | "son_tra_traces";

const seedForQuest = (questId: QuestId) => {
  const state = {
    version: 1,
    language: "vi",
    player: { scene: "OverworldScene", x: 0, y: 0 },
    quests: {
      dragon_bridge_lights: "REWARDED",
      my_khe_clean_wave: "LOCKED",
      marble_five_elements: "LOCKED",
      son_tra_traces: "LOCKED",
    },
    unlockedPostcards: ["dragon_bridge"],
    memoryFragments: 1,
    preferences: { interests: [] },
    updatedAt: "2026-08-03T00:00:00.000Z",
  };

  const coordinates: Record<QuestId, { x: number; y: number }> = {
    my_khe_clean_wave: { x: 1382, y: 688 },
    marble_five_elements: { x: 394, y: 370 },
    son_tra_traces: { x: 1362, y: 354 },
  };
  const rewardsByQuest: Record<QuestId, string[]> = {
    my_khe_clean_wave: ["dragon_bridge"],
    marble_five_elements: ["dragon_bridge", "my_khe_beach"],
    son_tra_traces: ["dragon_bridge", "my_khe_beach", "marble_mountains"],
  };
  const previousQuestStates: Record<
    QuestId,
    Array<[keyof typeof state.quests, string]>
  > = {
    my_khe_clean_wave: [],
    marble_five_elements: [["my_khe_clean_wave", "REWARDED"]],
    son_tra_traces: [
      ["my_khe_clean_wave", "REWARDED"],
      ["marble_five_elements", "REWARDED"],
    ],
  };

  previousQuestStates[questId].forEach(([id, status]) => {
    state.quests[id] = status;
  });
  state.quests[questId] = "AVAILABLE";
  state.player = { scene: "OverworldScene", ...coordinates[questId] };
  state.unlockedPostcards = rewardsByQuest[questId];
  state.memoryFragments = state.unlockedPostcards.length;
  return state;
};

async function pressPhaserKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
}

async function persistedQuestStatus(
  page: Page,
  questId: QuestId,
): Promise<unknown> {
  return page.evaluate(
    ({ storageKey, id }) => {
      const raw = window.localStorage.getItem(storageKey);
      const state = raw
        ? (JSON.parse(raw) as { quests?: Record<string, unknown> })
        : undefined;
      return state?.quests?.[id];
    },
    { storageKey: GAME_STATE_STORAGE_KEY, id: questId },
  );
}

async function clickGamePoint(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Game canvas has no bounding box");
  await page.mouse.click(
    box.x + (x / 640) * box.width,
    box.y + (y / 360) * box.height,
  );
  await page.waitForTimeout(80);
}

async function completeSeededQuest(
  page: Page,
  questId: QuestId,
): Promise<void> {
  if (questId === "my_khe_clean_wave") {
    await pressPhaserKey(page, "Space");
    for (const [x, y] of [
      [100, 120],
      [169, 246],
      [261, 106],
      [368, 165],
      [523, 112],
      [538, 279],
      [410, 300],
      [95, 302],
    ]) {
      await clickGamePoint(page, x, y);
    }
    return;
  }

  if (questId === "marble_five_elements") {
    for (const [x, y] of [
      [320, 90],
      [399, 147],
      [369, 240],
      [271, 240],
      [241, 147],
    ]) {
      await clickGamePoint(page, x, y);
    }
    return;
  }

  await pressPhaserKey(page, "Space");
  for (const [x, y] of [
    [148, 134],
    [334, 244],
    [518, 162],
  ]) {
    await clickGamePoint(page, x, y);
  }
}

async function startSeededQuest(page: Page): Promise<void> {
  const canvas = await waitForGameCanvas(page);
  await canvas.focus();
  await page.keyboard.press("Enter");
  const restoredPostcard = page.getByTestId("dragon-postcard");
  if (await restoredPostcard.isVisible()) {
    await page.getByTestId("dragon-postcard-close").click();
  }
  await expect(page.getByTestId("interaction-hint")).toBeVisible();
  await pressPhaserKey(page, "KeyE");
  await expect(page.getByTestId("dragon-dialogue")).toBeVisible();
  await page.getByTestId("dragon-quest-start").click();
  await expect(page.getByTestId("dragon-dialogue")).toBeHidden();
}

test.describe("remaining quest integration @m4", () => {
  for (const questId of [
    "my_khe_clean_wave",
    "marble_five_elements",
    "son_tra_traces",
  ] as const) {
    test(`opens ${questId} from its persisted deterministic unlock and returns with Esc`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium-desktop",
        "Quest routing is exercised once with real desktop keyboard input.",
      );
      const browserErrors = collectSeriousBrowserErrors(page);
      const seed = seedForQuest(questId);
      await page.addInitScript(
        ({ storageKey, persistedState }) =>
          window.localStorage.setItem(
            storageKey,
            JSON.stringify(persistedState),
          ),
        { storageKey: GAME_STATE_STORAGE_KEY, persistedState: seed },
      );

      await page.goto("/");
      await startSeededQuest(page);
      await page.waitForTimeout(250);
      await captureVisualEvidence(page, testInfo, `${questId}-tutorial`);
      await pressPhaserKey(page, "Escape");
      await expect
        .poll(() => persistedQuestStatus(page, questId))
        .toBe("AVAILABLE");
      await expect(page.locator("#game-container canvas")).toBeVisible();
      await expectNoSeriousBrowserErrors(testInfo, browserErrors);
    });
  }

  for (const questId of [
    "my_khe_clean_wave",
    "marble_five_elements",
    "son_tra_traces",
  ] as const) {
    test(`wins ${questId} with real deterministic input and earns its postcard`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium-desktop",
        "Each deterministic win is exercised once with real desktop input.",
      );
      test.setTimeout(30_000);
      const browserErrors = collectSeriousBrowserErrors(page);
      const seed = seedForQuest(questId);
      await page.addInitScript(
        ({ storageKey, persistedState }) =>
          window.localStorage.setItem(
            storageKey,
            JSON.stringify(persistedState),
          ),
        { storageKey: GAME_STATE_STORAGE_KEY, persistedState: seed },
      );

      await page.goto("/");
      await startSeededQuest(page);
      await completeSeededQuest(page, questId);
      await expect
        .poll(() => persistedQuestStatus(page, questId), { timeout: 8_000 })
        .toBe("REWARDED");
      await expect(page.getByTestId("dragon-postcard")).toBeVisible();
      await captureVisualEvidence(page, testInfo, `${questId}-reward`);
      await expectNoSeriousBrowserErrors(testInfo, browserErrors);
    });
  }

  test("shows all earned fragments and the ending only after the four-reward save", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Passport UI is exercised once on desktop.",
    );
    const browserErrors = collectSeriousBrowserErrors(page);
    const state = seedForQuest("son_tra_traces");
    state.quests.son_tra_traces = "REWARDED";
    state.unlockedPostcards = [
      "dragon_bridge",
      "my_khe_beach",
      "marble_mountains",
      "son_tra_peninsula",
    ];
    state.memoryFragments = 4;
    await page.addInitScript(
      ({ storageKey, persistedState }) =>
        window.localStorage.setItem(storageKey, JSON.stringify(persistedState)),
      { storageKey: GAME_STATE_STORAGE_KEY, persistedState: state },
    );

    await page.goto("/");
    await waitForGameCanvas(page);
    await page.getByTestId("passport-open").click();
    await expect(page.getByTestId("passport-panel")).toContainText("4 / 4");
    await page.getByTestId("passport-ending-open").click();
    await expect(page.getByTestId("journey-ending")).toBeVisible();
    await captureVisualEvidence(page, testInfo, "journey-ending");
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
