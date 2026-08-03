import { describe, expect, it } from "vitest";
import {
  DRAGON_BRIDGE_RHYTHM,
  remainingRhythmSeconds,
  requiredRhythmScore,
  rhythmWasSuccessful,
} from "../../../src/client/game/rhythm.js";

describe("Dragon Bridge rhythm rules", () => {
  it("requires the documented 70 percent threshold", () => {
    expect(requiredRhythmScore()).toBe(7);
    expect(rhythmWasSuccessful(6)).toBe(false);
    expect(rhythmWasSuccessful(7)).toBe(true);
  });

  it("never reports a negative countdown", () => {
    expect(remainingRhythmSeconds(10_000, 9_001)).toBe(1);
    expect(remainingRhythmSeconds(10_000, 12_000)).toBe(0);
    expect(DRAGON_BRIDGE_RHYTHM.maximumDurationMs).toBe(60_000);
  });
});
