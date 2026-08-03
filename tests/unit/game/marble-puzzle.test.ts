import { describe, expect, it } from "vitest";
import {
  MARBLE_ELEMENT_ORDER,
  MARBLE_POSTCARD_KEY,
  MARBLE_QUEST_ID,
  MAX_MARBLE_HINTS,
  createMarblePuzzleState,
  getExpectedMarbleElement,
  isMarblePuzzleComplete,
  reduceMarblePuzzle,
} from "../../../src/client/game/marble-puzzle.js";
import {
  GameSession,
  LocalGameStateStore,
  type StorageLike,
} from "../../../src/client/game/state/GameStateStore.js";

const startPuzzle = () =>
  reduceMarblePuzzle(createMarblePuzzleState(), { type: "START" });

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

const completeAndReward = (session: GameSession, questId: string): void => {
  expect(session.startQuest(questId)?.current).toBe("ACTIVE");
  expect(session.completeQuest(questId)?.current).toBe("COMPLETED");
  expect(session.rewardQuest(questId)?.current).toBe("REWARDED");
};

describe("Marble Mountains five-elements rules", () => {
  it("completes only after Kim, Mộc, Thủy, Hỏa, Thổ in that order", () => {
    const completed = MARBLE_ELEMENT_ORDER.reduce(
      (state, element) =>
        reduceMarblePuzzle(state, { type: "SELECT", element }),
      startPuzzle(),
    );

    expect(completed.selected).toEqual(MARBLE_ELEMENT_ORDER);
    expect(completed.phase).toBe("SUCCESS");
    expect(completed.feedback).toBe("COMPLETE");
    expect(isMarblePuzzleComplete(completed)).toBe(true);
    expect(getExpectedMarbleElement(completed)).toBeNull();
  });

  it("resets a wrong connection and lets the player retry without changing hint usage", () => {
    const afterKim = reduceMarblePuzzle(startPuzzle(), {
      type: "SELECT",
      element: "kim",
    });
    const wrong = reduceMarblePuzzle(afterKim, {
      type: "SELECT",
      element: "hoa",
    });
    const retried = reduceMarblePuzzle(wrong, { type: "RETRY" });

    expect(wrong).toMatchObject({
      selected: [],
      feedback: "WRONG",
      phase: "PLAYING",
    });
    expect(retried).toMatchObject({
      selected: [],
      feedback: "SELECT",
      phase: "PLAYING",
    });
    expect(getExpectedMarbleElement(retried)).toBe("kim");
  });

  it("caps hints at three and always points to the next required element", () => {
    const withThreeHints = Array.from({ length: MAX_MARBLE_HINTS }).reduce(
      (state) => reduceMarblePuzzle(state, { type: "REQUEST_HINT" }),
      startPuzzle(),
    );
    const exhausted = reduceMarblePuzzle(withThreeHints, {
      type: "REQUEST_HINT",
    });

    expect(withThreeHints.hintsUsed).toBe(MAX_MARBLE_HINTS);
    expect(exhausted).toMatchObject({
      hintsUsed: MAX_MARBLE_HINTS,
      feedback: "HINTS_EXHAUSTED",
    });
    expect(getExpectedMarbleElement(exhausted)).toBe("kim");
  });

  it("rewards Marble Mountains exactly once through the shared quest state machine", () => {
    const session = new GameSession(
      new LocalGameStateStore(new MemoryStorage(), 1),
    );

    completeAndReward(session, "dragon_bridge_lights");
    completeAndReward(session, "my_khe_clean_wave");
    expect(session.startQuest(MARBLE_QUEST_ID)?.current).toBe("ACTIVE");
    expect(session.completeQuest(MARBLE_QUEST_ID)?.current).toBe("COMPLETED");
    expect(session.rewardQuest(MARBLE_QUEST_ID)?.current).toBe("REWARDED");
    expect(session.rewardQuest(MARBLE_QUEST_ID)).toBeNull();

    const state = session.getState();
    expect(state.quests[MARBLE_QUEST_ID]).toBe("REWARDED");
    expect(state.unlockedPostcards).toContain(MARBLE_POSTCARD_KEY);
    expect(state.memoryFragments).toBe(3);
    expect(state.quests.son_tra_traces).toBe("AVAILABLE");
  });
});
