import { describe, expect, it } from "vitest";
import { LANDMARK_GAME_DEFINITIONS } from "../../../src/shared/landmark-game-definitions.js";
import {
  DRAGON_BRIDGE_INTERACTABLE,
  QUEST_INTERACTABLES,
  QUEST_SCENE_BY_ID,
  WORLD_COLLIDERS,
  WORLD_LAYER_ORDER,
  getQuestInteractableCopy,
  isWithinInteractionRange,
  normalizeMovementVector,
} from "../../../src/client/game/world.js";

describe("overworld metadata", () => {
  it("keeps collision IDs unique for deterministic map construction", () => {
    expect(new Set(WORLD_COLLIDERS.map((collider) => collider.id)).size).toBe(
      WORLD_COLLIDERS.length,
    );
    expect(WORLD_COLLIDERS.every(({ layer }) => layer === "colliders")).toBe(
      true,
    );
    expect(WORLD_LAYER_ORDER).toEqual([
      "ground",
      "water",
      "roads",
      "landmarks",
      "colliders",
      "npcs",
    ]);
  });

  it("normalizes diagonal input without exceeding player speed", () => {
    const direction = normalizeMovementVector({ x: 1, y: 1 });
    expect(direction.x).toBeCloseTo(Math.SQRT1_2);
    expect(direction.y).toBeCloseTo(Math.SQRT1_2);
  });

  it("shows interaction only inside the authored landmark range", () => {
    expect(
      isWithinInteractionRange({
        x: DRAGON_BRIDGE_INTERACTABLE.x,
        y: DRAGON_BRIDGE_INTERACTABLE.y,
      }),
    ).toBe(true);
    expect(isWithinInteractionRange({ x: 0, y: 0 })).toBe(false);
  });

  it("makes all ten pixel icons primary interactables with canonical scene bindings", () => {
    expect(QUEST_INTERACTABLES).toHaveLength(10);
    expect(QUEST_INTERACTABLES.map((landmark) => landmark.questId)).toEqual(
      LANDMARK_GAME_DEFINITIONS.map((definition) => definition.questId),
    );
    expect(
      new Set(QUEST_INTERACTABLES.map((landmark) => landmark.placeKey)).size,
    ).toBe(10);
    expect(
      new Set(QUEST_INTERACTABLES.map((landmark) => landmark.mapIconAssetId))
        .size,
    ).toBe(10);
    expect(
      QUEST_INTERACTABLES.every(
        (landmark) =>
          landmark.type === "landmark" &&
          landmark.interactionRadius >= 48 &&
          landmark.mapIconAssetId.startsWith("landmark_icon_") &&
          landmark.mapIconPath.startsWith("/assets/landmark-icons/"),
      ),
    ).toBe(true);
    expect(
      QUEST_INTERACTABLES.map(
        (landmark) => QUEST_SCENE_BY_ID[landmark.questId],
      ),
    ).toEqual(
      LANDMARK_GAME_DEFINITIONS.map((definition) => definition.sceneKey),
    );
  });

  it("keeps four optional guides beside the first vertical slice and no detail-only POIs", () => {
    expect(
      QUEST_INTERACTABLES.filter((landmark) => landmark.guide).map(
        (landmark) => landmark.questId,
      ),
    ).toEqual([
      "dragon_bridge_lights",
      "my_khe_clean_wave",
      "marble_five_elements",
      "son_tra_traces",
    ]);
  });

  it("formats bilingual play copy for every landmark icon", () => {
    for (const landmark of QUEST_INTERACTABLES) {
      const copyVi = getQuestInteractableCopy(landmark, "vi");
      const copyEn = getQuestInteractableCopy(landmark, "en");
      expect(copyVi.name).toBe(landmark.nameVi);
      expect(copyVi.label).toContain("nhấn E / Space");
      expect(copyEn.name).toBe(landmark.nameEn);
      expect(copyEn.label).toContain("press E / Space");
    }
  });
});
