import { describe, it, expect } from "vitest";
import { QUESTS, canTransitionQuest } from "../../src/shared/quests.js";

describe("Baseline M0 Tests", () => {
  it("should have 4 defined quests", () => {
    expect(Object.keys(QUESTS)).toHaveLength(4);
  });

  it("should validate valid quest state transitions", () => {
    expect(canTransitionQuest("LOCKED", "AVAILABLE")).toBe(true);
    expect(canTransitionQuest("AVAILABLE", "ACTIVE")).toBe(true);
    expect(canTransitionQuest("ACTIVE", "COMPLETED")).toBe(true);
    expect(canTransitionQuest("COMPLETED", "REWARDED")).toBe(true);
  });

  it("should reject invalid quest state transitions", () => {
    expect(canTransitionQuest("LOCKED", "COMPLETED")).toBe(false);
    expect(canTransitionQuest("REWARDED", "ACTIVE")).toBe(false);
  });
});
