import { describe, expect, it } from "vitest";
import { LANDMARK_GAME_DEFINITIONS } from "../../../src/shared/landmark-game-definitions.js";
import { RIVER_BOUNDS, WORLD_BOUNDS } from "../../../src/client/game/world.js";

const getByKey = (key: string) => {
  const found = LANDMARK_GAME_DEFINITIONS.find((d) => d.locationKey === key);
  if (!found) throw new Error(`Missing landmark definition for key: ${key}`);
  return found;
};

describe("Landmark Geographic Position Constraints", () => {
  it("all 10 landmarks are within WORLD_BOUNDS", () => {
    for (const definition of LANDMARK_GAME_DEFINITIONS) {
      expect(definition.mapPosition.x).toBeGreaterThanOrEqual(30);
      expect(definition.mapPosition.x).toBeLessThanOrEqual(
        WORLD_BOUNDS.width - 30,
      );
      expect(definition.mapPosition.y).toBeGreaterThanOrEqual(30);
      expect(definition.mapPosition.y).toBeLessThanOrEqual(
        WORLD_BOUNDS.height - 30,
      );
    }
  });

  it("Dragon Bridge and Han River Bridge are positioned ON the Han River", () => {
    const dragonBridge = getByKey("dragon_bridge");
    const hanRiverBridge = getByKey("han_river_bridge");

    expect(dragonBridge.mapPosition.x).toBeGreaterThanOrEqual(
      RIVER_BOUNDS.left,
    );
    expect(dragonBridge.mapPosition.x).toBeLessThanOrEqual(RIVER_BOUNDS.right);

    expect(hanRiverBridge.mapPosition.x).toBeGreaterThanOrEqual(
      RIVER_BOUNDS.left,
    );
    expect(hanRiverBridge.mapPosition.x).toBeLessThanOrEqual(
      RIVER_BOUNDS.right,
    );
  });

  it("Han River Bridge is north of Dragon Bridge", () => {
    const dragonBridge = getByKey("dragon_bridge");
    const hanRiverBridge = getByKey("han_river_bridge");

    expect(hanRiverBridge.mapPosition.y).toBeLessThan(
      dragonBridge.mapPosition.y,
    );
  });

  it("Cham Museum and Han Market are on the west bank of the Han River", () => {
    const chamMuseum = getByKey("cham_museum");
    const hanMarket = getByKey("han_market");

    expect(chamMuseum.mapPosition.x).toBeLessThan(RIVER_BOUNDS.left);
    expect(hanMarket.mapPosition.x).toBeLessThan(RIVER_BOUNDS.left);
  });

  it("My Khe Beach is on the east coast", () => {
    const myKhe = getByKey("my_khe_beach");

    expect(myKhe.mapPosition.x).toBeGreaterThan(RIVER_BOUNDS.right);
    expect(myKhe.mapPosition.x).toBeGreaterThanOrEqual(1100);
  });

  it("Son Tra Peninsula and Linh Ung Pagoda are in the northeast", () => {
    const sonTra = getByKey("son_tra_peninsula");
    const linhUng = getByKey("linh_ung_son_tra");

    expect(sonTra.mapPosition.x).toBeGreaterThan(RIVER_BOUNDS.right);
    expect(sonTra.mapPosition.y).toBeLessThan(350);

    expect(linhUng.mapPosition.x).toBeGreaterThan(RIVER_BOUNDS.right);
    expect(linhUng.mapPosition.y).toBeLessThan(350);

    const dist = Math.hypot(
      linhUng.mapPosition.x - sonTra.mapPosition.x,
      linhUng.mapPosition.y - sonTra.mapPosition.y,
    );
    expect(dist).toBeLessThan(200);
  });

  it("Marble Mountains and Non Nuoc Stone Village are in the south", () => {
    const dragonBridge = getByKey("dragon_bridge");
    const marble = getByKey("marble_mountains");
    const nonNuoc = getByKey("non_nuoc_stone_village");

    expect(marble.mapPosition.y).toBeGreaterThan(dragonBridge.mapPosition.y);
    expect(nonNuoc.mapPosition.y).toBeGreaterThan(dragonBridge.mapPosition.y);

    const dist = Math.hypot(
      nonNuoc.mapPosition.x - marble.mapPosition.x,
      nonNuoc.mapPosition.y - marble.mapPosition.y,
    );
    expect(dist).toBeLessThan(150);
  });

  it("Ba Na Hills is in the northwest mountains", () => {
    const baNa = getByKey("ba_na_hills");

    expect(baNa.mapPosition.x).toBeLessThan(350);
    expect(baNa.mapPosition.y).toBeLessThan(350);
  });

  it("no two landmarks overlap (minimum distance > 60px)", () => {
    for (let i = 0; i < LANDMARK_GAME_DEFINITIONS.length; i++) {
      for (let j = i + 1; j < LANDMARK_GAME_DEFINITIONS.length; j++) {
        const a = LANDMARK_GAME_DEFINITIONS[i];
        const b = LANDMARK_GAME_DEFINITIONS[j];
        const dist = Math.hypot(
          a.mapPosition.x - b.mapPosition.x,
          a.mapPosition.y - b.mapPosition.y,
        );
        expect(
          dist,
          `Landmarks ${a.locationKey} and ${b.locationKey} are too close (${dist}px)`,
        ).toBeGreaterThan(60);
      }
    }
  });
});
