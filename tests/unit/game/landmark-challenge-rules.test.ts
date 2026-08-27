import { describe, expect, it } from "vitest";
import {
  LANDMARK_CHALLENGE_RULES,
  applyLandmarkChallengeInput,
  createLandmarkChallengeAttempt,
  failLandmarkChallenge,
  startLandmarkChallenge,
} from "../../../src/client/game/landmark-challenge-rules.js";

const solveByCycling = (questId: keyof typeof LANDMARK_CHALLENGE_RULES) => {
  const rule = LANDMARK_CHALLENGE_RULES[questId];
  let attempt = startLandmarkChallenge(createLandmarkChallengeAttempt(rule));
  if (rule.mode === "sequence") {
    for (const optionIndex of rule.expected) {
      attempt = applyLandmarkChallengeInput(rule, attempt, optionIndex);
    }
    return attempt;
  }
  rule.expected.forEach((target, index) => {
    const steps =
      rule.mode === "cycle" && target === 0
        ? (rule.cycleLabels?.length ?? 3)
        : target;
    for (let step = 0; step < steps; step += 1) {
      attempt = applyLandmarkChallengeInput(rule, attempt, index);
    }
  });
  return attempt;
};

describe("landmark challenge rules", () => {
  it("defines six deterministic non-network challenges", () => {
    expect(Object.keys(LANDMARK_CHALLENGE_RULES)).toEqual([
      "han_river_bridge_turn",
      "linh_ung_quiet_path",
      "cham_museum_relic_match",
      "non_nuoc_carving_pattern",
      "han_market_basket_sort",
      "ba_na_golden_bridge",
    ]);
    expect(
      Object.values(LANDMARK_CHALLENGE_RULES).every(
        (rule) => rule.durationMs >= 90_000 && rule.durationMs <= 115_000,
      ),
    ).toBe(true);
  });

  it("TC-1.2: Han River Bridge turn duration is 90s", () => {
    expect(LANDMARK_CHALLENGE_RULES.han_river_bridge_turn.durationMs).toBe(
      90_000,
    );
  });

  it("TC-1.3: Han Market basket sort duration is >= 110s", () => {
    expect(
      LANDMARK_CHALLENGE_RULES.han_market_basket_sort.durationMs,
    ).toBeGreaterThanOrEqual(110_000);
  });

  it("does not advance a sequence when its next selected option is wrong", () => {
    const rule = LANDMARK_CHALLENGE_RULES.linh_ung_quiet_path;
    const initial = startLandmarkChallenge(
      createLandmarkChallengeAttempt(rule),
    );
    const wrong = applyLandmarkChallengeInput(rule, initial, 6);
    expect(wrong.phase).toBe("PLAYING");
    expect(wrong.progress).toBe(0);
    expect(wrong.feedback?.vi).toContain("Chưa đúng");
  });

  it.each(
    Object.keys(LANDMARK_CHALLENGE_RULES) as Array<
      keyof typeof LANDMARK_CHALLENGE_RULES
    >,
  )("reaches success with the authored solution: %s", (questId) => {
    expect(solveByCycling(questId).phase).toBe("SUCCESS");
  });

  it("turns an active attempt into a retryable failure", () => {
    const rule = LANDMARK_CHALLENGE_RULES.han_market_basket_sort;
    const active = startLandmarkChallenge(createLandmarkChallengeAttempt(rule));
    const failed = failLandmarkChallenge(active);
    expect(failed.phase).toBe("FAILED");
    expect(startLandmarkChallenge(failed).phase).toBe("PLAYING");
  });

  it("requires every Han Market item to be deliberately assigned", () => {
    const rule = LANDMARK_CHALLENGE_RULES.han_market_basket_sort;
    let attempt = startLandmarkChallenge(createLandmarkChallengeAttempt(rule));

    rule.expected.forEach((target, index) => {
      for (let step = 0; step < target; step += 1) {
        attempt = applyLandmarkChallengeInput(rule, attempt, index);
      }
    });

    expect(attempt.phase).toBe("PLAYING");
    expect(attempt.touched.every(Boolean)).toBe(false);

    for (const index of [1, 6]) {
      for (let step = 0; step < (rule.cycleLabels?.length ?? 3); step += 1) {
        attempt = applyLandmarkChallengeInput(rule, attempt, index);
      }
    }

    expect(attempt.phase).toBe("SUCCESS");
    expect(attempt.touched.every(Boolean)).toBe(true);
  });
});
