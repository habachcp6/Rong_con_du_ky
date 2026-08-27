import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MARBLE_ELEMENT_ORDER,
  MAX_MARBLE_HINTS,
  createMarblePuzzleState,
  getExpectedMarbleElement,
  isMarblePuzzleComplete,
  reduceMarblePuzzle,
} from "../../../src/client/game/marble-puzzle.js";

describe("Adversarial Verification of Marble Mountains Five Elements Puzzle", () => {
  it("verifies exact element order requirement (Kim -> Mộc -> Thủy -> Hỏa -> Thổ)", () => {
    expect(MARBLE_ELEMENT_ORDER).toEqual(["kim", "moc", "thuy", "hoa", "tho"]);

    let state = reduceMarblePuzzle(createMarblePuzzleState(), {
      type: "START",
    });

    // Step 1: Must be kim
    expect(getExpectedMarbleElement(state)).toBe("kim");
    state = reduceMarblePuzzle(state, { type: "SELECT", element: "kim" });
    expect(state.selected).toEqual(["kim"]);

    // Step 2: Must be moc
    expect(getExpectedMarbleElement(state)).toBe("moc");
    state = reduceMarblePuzzle(state, { type: "SELECT", element: "moc" });
    expect(state.selected).toEqual(["kim", "moc"]);

    // Step 3: Must be thuy
    expect(getExpectedMarbleElement(state)).toBe("thuy");
    state = reduceMarblePuzzle(state, { type: "SELECT", element: "thuy" });
    expect(state.selected).toEqual(["kim", "moc", "thuy"]);

    // Step 4: Must be hoa
    expect(getExpectedMarbleElement(state)).toBe("hoa");
    state = reduceMarblePuzzle(state, { type: "SELECT", element: "hoa" });
    expect(state.selected).toEqual(["kim", "moc", "thuy", "hoa"]);

    // Step 5: Must be tho
    expect(getExpectedMarbleElement(state)).toBe("tho");
    state = reduceMarblePuzzle(state, { type: "SELECT", element: "tho" });
    expect(state.selected).toEqual(["kim", "moc", "thuy", "hoa", "tho"]);

    expect(isMarblePuzzleComplete(state)).toBe(true);
    expect(state.phase).toBe("SUCCESS");
  });

  it("verifies wrong connection immediately resets sequence and feedback", () => {
    let state = reduceMarblePuzzle(createMarblePuzzleState(), {
      type: "START",
    });

    // Select kim correctly
    state = reduceMarblePuzzle(state, { type: "SELECT", element: "kim" });
    expect(state.selected).toEqual(["kim"]);

    // Select wrong element (hoa instead of moc)
    state = reduceMarblePuzzle(state, { type: "SELECT", element: "hoa" });
    expect(state.selected).toEqual([]);
    expect(state.feedback).toBe("WRONG");
    expect(state.phase).toBe("PLAYING");

    // Next expected element is kim again
    expect(getExpectedMarbleElement(state)).toBe("kim");
  });

  it("verifies 3-hint cap and hint tracking across retries", () => {
    let state = reduceMarblePuzzle(createMarblePuzzleState(), {
      type: "START",
    });

    // Hint 1
    state = reduceMarblePuzzle(state, { type: "REQUEST_HINT" });
    expect(state.hintsUsed).toBe(1);
    expect(state.feedback).toBe("HINT");

    // Hint 2
    state = reduceMarblePuzzle(state, { type: "REQUEST_HINT" });
    expect(state.hintsUsed).toBe(2);

    // Hint 3
    state = reduceMarblePuzzle(state, { type: "REQUEST_HINT" });
    expect(state.hintsUsed).toBe(3);

    // Hint 4 (Exhausted)
    state = reduceMarblePuzzle(state, { type: "REQUEST_HINT" });
    expect(state.hintsUsed).toBe(MAX_MARBLE_HINTS);
    expect(state.feedback).toBe("HINTS_EXHAUSTED");

    // Retry does NOT reset hintsUsed
    state = reduceMarblePuzzle(state, { type: "RETRY" });
    expect(state.hintsUsed).toBe(MAX_MARBLE_HINTS);
    expect(state.selected).toEqual([]);

    // Further hint requests remain exhausted
    state = reduceMarblePuzzle(state, { type: "REQUEST_HINT" });
    expect(state.hintsUsed).toBe(MAX_MARBLE_HINTS);
    expect(state.feedback).toBe("HINTS_EXHAUSTED");
  });

  it("verifies scene code static structure for 1..5 hotkeys and touch support", () => {
    const scenePath = path.resolve(
      process.cwd(),
      "src/client/game/scenes/MarbleMountainsPuzzleScene.ts",
    );
    const sceneCode = fs.readFileSync(scenePath, "utf-8");

    // Check digit keys 1..5 in input handling
    expect(sceneCode).toContain("Phaser.Input.Keyboard.KeyCodes.ONE");
    expect(sceneCode).toContain("Phaser.Input.Keyboard.KeyCodes.TWO");
    expect(sceneCode).toContain("Phaser.Input.Keyboard.KeyCodes.THREE");
    expect(sceneCode).toContain("Phaser.Input.Keyboard.KeyCodes.FOUR");
    expect(sceneCode).toContain("Phaser.Input.Keyboard.KeyCodes.FIVE");
    expect(sceneCode).toContain("Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE");
    expect(sceneCode).toContain("Phaser.Input.Keyboard.KeyCodes.NUMPAD_FIVE");

    // Check hotkey digit loop
    expect(sceneCode).toMatch(
      /for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*5;\s*i\s*\+=\s*1\s*\)/,
    );
    expect(sceneCode).toContain("selectElement(MARBLE_ELEMENT_ORDER[i])");

    // Check touch / pointer interactions on element nodes
    expect(sceneCode).toContain(".setInteractive({ useHandCursor: true })");
    expect(sceneCode).toContain('node.on("pointerdown"');

    // Check tutorial overlay and buttons
    expect(sceneCode).toContain("createTutorialOverlay");
    expect(sceneCode).toContain("NGŨ HÀNH KỲ BÍ — HƯỚNG DẪN CHƠI");
  });
});
