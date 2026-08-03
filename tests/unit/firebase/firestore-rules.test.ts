import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rules = fs.readFileSync(
  path.resolve(process.cwd(), "firestore.rules"),
  "utf8",
);

describe("Firestore game-state rule contract", () => {
  it("allows exactly the canonical postcard keys and keeps user state owner-scoped", () => {
    for (const placeKey of [
      "dragon_bridge",
      "my_khe_beach",
      "marble_mountains",
      "son_tra_peninsula",
    ]) {
      expect(rules).toContain(`'${placeKey}'`);
    }
    expect(rules).toContain("match /users/{userId}/game/state");
    expect(rules).toContain("request.auth.uid == userId");
    expect(rules).toContain("allow list: if false");
  });

  it("binds postcards and write transitions to the deterministic quest graph", () => {
    expect(rules).toContain("function postcardsMatchRewards(state)");
    expect(rules).toContain("function validQuestTransition(current, next)");
    expect(rules).toContain(
      "validQuestUpdate(resource.data.quests, request.resource.data.quests)",
    );
    expect(rules).toContain(
      "state.memoryFragments == rewardedCount(state.quests)",
    );
  });
});
