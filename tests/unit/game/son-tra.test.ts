import { describe, expect, it } from "vitest";
import {
  createSonTraObservationState,
  observeTrace,
  remainingTraces,
} from "../../../src/client/game/son-tra.js";

describe("Son Tra observation logic", () => {
  it("records each distinct trace and completes only after all three", () => {
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
});
