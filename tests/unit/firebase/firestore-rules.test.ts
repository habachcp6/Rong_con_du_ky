import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rules = fs.readFileSync(
  path.resolve(process.cwd(), "firestore.rules"),
  "utf8",
);

describe("Firestore game-state rule contract", () => {
  it("allows exactly the ten canonical postcard keys and keeps user state owner-scoped", () => {
    for (const placeKey of [
      "dragon_bridge",
      "my_khe_beach",
      "marble_mountains",
      "son_tra_peninsula",
      "han_river_bridge",
      "linh_ung_son_tra",
      "cham_museum",
      "non_nuoc_stone_village",
      "han_market",
      "ba_na_hills",
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
    expect(rules).toContain("function validV1ToV2Migration(current, next)");
    expect(rules).toContain("function validInitialGameState(state)");
    expect(rules).toContain(
      "allow create: if isOwner(userId) && validInitialGameState(request.resource.data)",
    );
    expect(rules).toContain("state.version == 2");
  });
});
