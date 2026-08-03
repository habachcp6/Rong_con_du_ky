/**
 * Deterministic rules for the Marble Mountains mini-game.  This module has no
 * Phaser, persistence, or AI dependency so the sequence remains testable and
 * cannot be influenced by a model response.
 */
export const MARBLE_QUEST_ID = "marble_five_elements";
export const MARBLE_POSTCARD_KEY = "marble_mountains";
export const MAX_MARBLE_HINTS = 3;

export const MARBLE_ELEMENT_ORDER = [
  "kim",
  "moc",
  "thuy",
  "hoa",
  "tho",
] as const;

export type MarbleElementId = (typeof MARBLE_ELEMENT_ORDER)[number];

export const MARBLE_ELEMENT_LABELS: Record<MarbleElementId, string> = {
  kim: "Kim",
  moc: "Mộc",
  thuy: "Thủy",
  hoa: "Hỏa",
  tho: "Thổ",
};

export type MarblePuzzlePhase = "INTRO" | "PLAYING" | "SUCCESS";

export type MarblePuzzleFeedback =
  | "INTRO"
  | "SELECT"
  | "CORRECT"
  | "WRONG"
  | "HINT"
  | "HINTS_EXHAUSTED"
  | "COMPLETE";

export type MarblePuzzleState = {
  phase: MarblePuzzlePhase;
  selected: MarbleElementId[];
  hintsUsed: number;
  feedback: MarblePuzzleFeedback;
};

export type MarblePuzzleAction =
  | { type: "START" }
  | { type: "SELECT"; element: MarbleElementId }
  | { type: "REQUEST_HINT" }
  | { type: "RETRY" };

export const createMarblePuzzleState = (): MarblePuzzleState => ({
  phase: "INTRO",
  selected: [],
  hintsUsed: 0,
  feedback: "INTRO",
});

/** Returns the next deterministic element, or null once the puzzle is solved. */
export const getExpectedMarbleElement = (
  state: MarblePuzzleState,
): MarbleElementId | null =>
  state.phase === "PLAYING"
    ? (MARBLE_ELEMENT_ORDER[state.selected.length] ?? null)
    : null;

export const isMarblePuzzleComplete = (state: MarblePuzzleState): boolean =>
  state.phase === "SUCCESS" &&
  state.selected.length === MARBLE_ELEMENT_ORDER.length;

/**
 * A wrong element resets only the visual attempt; the quest stays ACTIVE until
 * the scene explicitly abandons or completes it.  Hints are retained on a
 * retry so an open scene can never grant more than three hints.
 */
export const reduceMarblePuzzle = (
  state: MarblePuzzleState,
  action: MarblePuzzleAction,
): MarblePuzzleState => {
  if (action.type === "START") {
    return state.phase === "INTRO"
      ? { ...state, phase: "PLAYING", feedback: "SELECT" }
      : state;
  }

  if (action.type === "RETRY") {
    return state.phase === "SUCCESS"
      ? state
      : { ...state, phase: "PLAYING", selected: [], feedback: "SELECT" };
  }

  if (state.phase !== "PLAYING") {
    return state;
  }

  if (action.type === "REQUEST_HINT") {
    return state.hintsUsed >= MAX_MARBLE_HINTS
      ? { ...state, feedback: "HINTS_EXHAUSTED" }
      : {
          ...state,
          hintsUsed: state.hintsUsed + 1,
          feedback: "HINT",
        };
  }

  const expected = getExpectedMarbleElement(state);
  if (action.element !== expected) {
    return { ...state, selected: [], feedback: "WRONG" };
  }

  const selected = [...state.selected, action.element];
  return selected.length === MARBLE_ELEMENT_ORDER.length
    ? { ...state, selected, phase: "SUCCESS", feedback: "COMPLETE" }
    : { ...state, selected, feedback: "CORRECT" };
};
