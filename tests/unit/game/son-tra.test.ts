import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ATTEMPT_DURATION_MS,
  createSonTraObservationState,
  observeTrace,
  remainingTraces,
} from "../../../src/client/game/son-tra.js";

const sonTraSceneSource = readFileSync(
  resolve(process.cwd(), "src/client/game/scenes/SonTraWildlifeScene.ts"),
  "utf8",
);

describe("Son Tra observation logic", () => {
  it("TC-4.1: Attempt duration increased to 90s (90_000ms)", () => {
    expect(ATTEMPT_DURATION_MS).toBe(90_000);
  });

  it("TC-4.2: Records each distinct trace and completes only after all three", () => {
    let state = createSonTraObservationState();
    const first = observeTrace(state, "canopy");
    expect(first.kind).toBe("FOUND");
    state = first.state;
    state = observeTrace(state, "footprint").state;
    const final = observeTrace(state, "fruit");

    expect(final.kind).toBe("COMPLETE");
    expect(final.state.found).toEqual(["canopy", "footprint", "fruit"]);
    expect(remainingTraces(final.state)).toBe(0);
  });

  it("does not count duplicate or invalid observations as new traces", () => {
    const initial = createSonTraObservationState();
    const found = observeTrace(initial, "canopy");
    const duplicate = observeTrace(found.state, "canopy");
    const invalid = observeTrace(duplicate.state, "animal");

    expect(duplicate.kind).toBe("DUPLICATE");
    expect(duplicate.state.duplicateAttempts).toBe(1);
    expect(invalid.kind).toBe("INVALID");
    expect(invalid.state.found).toEqual(["canopy"]);
  });

  it("keeps tutorial visibility and the observation deadline in one state flow", () => {
    expect(sonTraSceneSource).not.toContain("hideTutorialOverlay");
    expect(sonTraSceneSource).toContain("private closeTutorialOverlay");
    expect(sonTraSceneSource).toContain("private pauseAttemptForTutorial");
    expect(sonTraSceneSource).toContain("private resumeAttemptAfterTutorial");
    expect(sonTraSceneSource).toContain(
      "this.deadline = this.time.now + this.pausedDeadlineRemainingMs",
    );
    expect(sonTraSceneSource).toContain("private attemptStarted = false");
    expect(sonTraSceneSource).toContain("this.attemptStarted = true");
    expect(sonTraSceneSource).toMatch(
      /if \(this\.tutorialVisible\) \{\s*this\.closeTutorialOverlay\(\);\s*\} else \{/s,
    );
    expect(sonTraSceneSource).toMatch(
      /if \(!this\.attemptStarted\) \{\s*if \(this\.isInteractPressed\(\)\) this\.beginObservation\(\);\s*return;\s*\}/s,
    );
  });

  it("blocks canvas gameplay and pointer propagation while help is open", () => {
    expect(sonTraSceneSource).toContain(
      "if (this.tutorialVisible) {\n      return;\n    }",
    );
    expect(sonTraSceneSource).toContain("event: Phaser.Types.Input.EventData");
    expect(sonTraSceneSource).toContain("infoBg.on(");
    expect(sonTraSceneSource).toContain("backBg.on(");
    expect(sonTraSceneSource).toContain("btnBg.on(");
    expect(sonTraSceneSource.match(/event\.stopPropagation\(\)/g)).toHaveLength(
      3,
    );
  });
});
