import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DRAGON_BRIDGE_RHYTHM,
  remainingRhythmSeconds,
  requiredRhythmScore,
  rhythmWasSuccessful,
} from "../../../src/client/game/rhythm.js";

const dragonBridgeSceneSource = readFileSync(
  resolve(process.cwd(), "src/client/game/scenes/DragonBridgeQuestScene.ts"),
  "utf8",
);

describe("Dragon Bridge rhythm rules", () => {
  it("requires the documented 70 percent threshold", () => {
    expect(requiredRhythmScore()).toBe(7);
    expect(rhythmWasSuccessful(6)).toBe(false);
    expect(rhythmWasSuccessful(7)).toBe(true);
  });

  it("never reports a negative countdown", () => {
    expect(remainingRhythmSeconds(10_000, 9_001)).toBe(1);
    expect(remainingRhythmSeconds(10_000, 12_000)).toBe(0);
    expect(DRAGON_BRIDGE_RHYTHM.maximumDurationMs).toBe(90_000);
  });

  it("TC-2.1: Hit window widened to >= 1500ms", () => {
    expect(DRAGON_BRIDGE_RHYTHM.hitWindowMs).toBeGreaterThanOrEqual(1500);
  });

  it("TC-2.2: Max duration increased to 90s", () => {
    expect(DRAGON_BRIDGE_RHYTHM.maximumDurationMs).toBe(90_000);
  });

  it("TC-2.3: Beat interval is playable (>= 750ms)", () => {
    expect(DRAGON_BRIDGE_RHYTHM.beatIntervalMs).toBeGreaterThanOrEqual(750);
  });

  it("TC-2.4: Score threshold evaluation (7 is success, 6 is failure)", () => {
    expect(rhythmWasSuccessful(7)).toBe(true);
    expect(rhythmWasSuccessful(6)).toBe(false);
  });

  it("pauses tutorial input without advancing the active beat timer", () => {
    expect(dragonBridgeSceneSource).toContain("private pauseRhythmForTutorial");
    expect(dragonBridgeSceneSource).toContain("this.beatTimer.paused = true");
    expect(dragonBridgeSceneSource).toContain(
      "private resumeRhythmAfterTutorial",
    );
    expect(dragonBridgeSceneSource).toContain(
      "this.deadline += pausedDurationMs",
    );
    expect(dragonBridgeSceneSource).toContain("this.beatTimer.paused = false");
    expect(dragonBridgeSceneSource).toContain(
      "this.tutorialVisible || this.rhythmPaused",
    );
  });

  it("stops Phaser pointer propagation for Dragon Bridge controls", () => {
    expect(dragonBridgeSceneSource).toContain("this.infoBtn.on(");
    expect(dragonBridgeSceneSource).toContain("exitBtn.on(");
    expect(dragonBridgeSceneSource).toContain("backdrop.on(");
    expect(dragonBridgeSceneSource).toContain("startBtnZone.on(");
    expect(dragonBridgeSceneSource).toContain(
      "event: Phaser.Types.Input.EventData",
    );
    expect(
      dragonBridgeSceneSource.match(/event\.stopPropagation\(\)/g),
    ).toHaveLength(4);
  });
});
