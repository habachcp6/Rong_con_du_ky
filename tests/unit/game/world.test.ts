import { describe, expect, it } from "vitest";
import {
  DRAGON_BRIDGE_INTERACTABLE,
  QUEST_INTERACTABLES,
  QUEST_SCENE_BY_ID,
  WORLD_COLLIDERS,
  WORLD_LAYER_ORDER,
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

  it("shows interaction only inside the authored NPC range", () => {
    expect(
      isWithinInteractionRange({
        x: DRAGON_BRIDGE_INTERACTABLE.x,
        y: DRAGON_BRIDGE_INTERACTABLE.y,
      }),
    ).toBe(true);
    expect(isWithinInteractionRange({ x: 0, y: 0 })).toBe(false);
  });

  it("routes each authored landmark to exactly one registered quest scene", () => {
    expect(QUEST_INTERACTABLES).toHaveLength(4);
    expect(
      new Set(QUEST_INTERACTABLES.map((interactable) => interactable.questId))
        .size,
    ).toBe(4);
    expect(
      new Set(
        QUEST_INTERACTABLES.map((interactable) => interactable.npcTexture),
      ).size,
    ).toBe(4);
    expect(
      QUEST_INTERACTABLES.every(
        (interactable) =>
          interactable.type === "npc" && interactable.interactionRadius > 0,
      ),
    ).toBe(true);
    expect(
      QUEST_INTERACTABLES.map(
        (interactable) => QUEST_SCENE_BY_ID[interactable.questId],
      ),
    ).toEqual([
      "DragonBridgeQuestScene",
      "MyKheCleanupScene",
      "MarbleMountainsPuzzleScene",
      "SonTraWildlifeScene",
    ]);
  });
});
