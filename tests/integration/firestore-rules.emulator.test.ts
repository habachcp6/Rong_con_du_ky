import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const PROJECT_ID = "demo-rong-con-du-ky";
const RULES = fs.readFileSync(
  path.resolve(process.cwd(), "firestore.rules"),
  "utf8",
);

let environment: RulesTestEnvironment;

const initialState = (updatedAt = "2026-08-03T00:00:00.000Z") => ({
  version: 2,
  language: "vi",
  player: { scene: "OverworldScene", x: 248, y: 772 },
  quests: {
    dragon_bridge_lights: "AVAILABLE",
    my_khe_clean_wave: "LOCKED",
    marble_five_elements: "LOCKED",
    son_tra_traces: "LOCKED",
    han_river_bridge_turn: "LOCKED",
    linh_ung_quiet_path: "LOCKED",
    cham_museum_relic_match: "LOCKED",
    non_nuoc_carving_pattern: "LOCKED",
    han_market_basket_sort: "LOCKED",
    ba_na_golden_bridge: "LOCKED",
  },
  unlockedPostcards: [],
  memoryFragments: 0,
  preferences: { interests: [] },
  updatedAt,
});

const legacyState = (updatedAt = "2026-08-03T00:00:00.000Z") => ({
  version: 1,
  language: "vi",
  player: { scene: "OverworldScene", x: 248, y: 772 },
  quests: {
    dragon_bridge_lights: "REWARDED",
    my_khe_clean_wave: "AVAILABLE",
    marble_five_elements: "LOCKED",
    son_tra_traces: "LOCKED",
  },
  unlockedPostcards: ["dragon_bridge"],
  memoryFragments: 1,
  preferences: { interests: [] },
  updatedAt,
});

const gameStateReference = (uid: string) =>
  doc(
    environment.authenticatedContext(uid).firestore(),
    "users",
    uid,
    "game",
    "state",
  );

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: RULES,
    },
  });
});

afterEach(async () => {
  await environment.clearFirestore();
});

afterAll(async () => {
  await environment.cleanup();
});

describe("Firestore Security Rules emulator", () => {
  it("denies an unauthenticated game-state read", async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, "users", "owner", "game", "state")));
  });

  it("allows an owner to create the canonical initial state", async () => {
    await assertSucceeds(setDoc(gameStateReference("owner"), initialState()));
    const snapshot = await getDoc(gameStateReference("owner"));
    expect(snapshot.exists()).toBe(true);
  });

  it("allows an owner to complete the deterministic quest lifecycle", async () => {
    const reference = gameStateReference("owner");
    await assertSucceeds(setDoc(reference, initialState()));
    const active = initialState("2026-08-03T00:01:00.000Z");
    active.quests.dragon_bridge_lights = "ACTIVE";
    await assertSucceeds(setDoc(reference, active));

    const retry = initialState("2026-08-03T00:02:00.000Z");
    await assertSucceeds(setDoc(reference, retry));

    const activeAgain = initialState("2026-08-03T00:03:00.000Z");
    activeAgain.quests.dragon_bridge_lights = "ACTIVE";
    await assertSucceeds(setDoc(reference, activeAgain));

    const completed = initialState("2026-08-03T00:04:00.000Z");
    completed.quests.dragon_bridge_lights = "COMPLETED";
    await assertSucceeds(setDoc(reference, completed));

    const rewarded = initialState("2026-08-03T00:05:00.000Z");
    rewarded.quests.dragon_bridge_lights = "REWARDED";
    rewarded.quests.my_khe_clean_wave = "AVAILABLE";
    rewarded.unlockedPostcards = ["dragon_bridge"];
    rewarded.memoryFragments = 1;

    await assertSucceeds(setDoc(reference, rewarded));
  });

  it("denies a collection listing even to the owner", async () => {
    const database = environment.authenticatedContext("owner").firestore();

    await assertFails(getDocs(collection(database, "users", "owner", "game")));
  });

  it("denies a cross-UID read and write", async () => {
    await assertSucceeds(setDoc(gameStateReference("owner"), initialState()));
    const intruder = environment.authenticatedContext("intruder").firestore();
    const ownerState = doc(intruder, "users", "owner", "game", "state");

    await assertFails(getDoc(ownerState));
    await assertFails(setDoc(ownerState, initialState()));
  });

  it("denies malformed state fields", async () => {
    const malformed = { ...initialState(), untrustedScore: 9999 };
    await assertFails(setDoc(gameStateReference("owner"), malformed));
  });

  it("denies a skipped reward transition even when postcard fields look valid", async () => {
    const reference = gameStateReference("owner");
    await assertSucceeds(setDoc(reference, initialState()));
    const skipped = initialState("2026-08-03T00:01:00.000Z");
    skipped.quests.dragon_bridge_lights = "REWARDED";
    skipped.quests.my_khe_clean_wave = "AVAILABLE";
    skipped.unlockedPostcards = ["dragon_bridge"];
    skipped.memoryFragments = 1;

    await assertFails(setDoc(reference, skipped));
  });

  it("denies a forged terminal campaign on the first write", async () => {
    const forged = initialState("2026-08-03T00:01:00.000Z");
    forged.quests = {
      dragon_bridge_lights: "REWARDED",
      my_khe_clean_wave: "REWARDED",
      marble_five_elements: "REWARDED",
      son_tra_traces: "REWARDED",
      han_river_bridge_turn: "REWARDED",
      linh_ung_quiet_path: "REWARDED",
      cham_museum_relic_match: "REWARDED",
      non_nuoc_carving_pattern: "REWARDED",
      han_market_basket_sort: "REWARDED",
      ba_na_golden_bridge: "REWARDED",
    };
    forged.unlockedPostcards = [
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
    ];
    forged.memoryFragments = 10;

    await assertFails(setDoc(gameStateReference("owner"), forged));
  });

  it("allows a valid V1 document to migrate to V2 without losing its reward", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "owner", "game", "state"),
        legacyState(),
      );
    });
    const migrated = initialState("2026-08-03T00:01:00.000Z");
    migrated.quests.dragon_bridge_lights = "REWARDED";
    migrated.quests.my_khe_clean_wave = "AVAILABLE";
    migrated.unlockedPostcards = ["dragon_bridge"];
    migrated.memoryFragments = 1;

    await assertSucceeds(setDoc(gameStateReference("owner"), migrated));
  });

  it("normalizes a locked V1 frontier to the available V2 frontier", async () => {
    const legacy = legacyState();
    legacy.quests.my_khe_clean_wave = "LOCKED";
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "owner", "game", "state"),
        legacy,
      );
    });

    const migrated = initialState("2026-08-03T00:01:00.000Z");
    migrated.quests.dragon_bridge_lights = "REWARDED";
    migrated.quests.my_khe_clean_wave = "AVAILABLE";
    migrated.unlockedPostcards = ["dragon_bridge"];
    migrated.memoryFragments = 1;

    await assertSucceeds(setDoc(gameStateReference("owner"), migrated));
  });

  it("preserves the exact active V1 frontier instead of accepting another valid V2 status", async () => {
    const legacy = legacyState();
    legacy.quests.my_khe_clean_wave = "ACTIVE";
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "owner-active", "game", "state"),
        legacy,
      );
      await setDoc(
        doc(context.firestore(), "users", "owner-available", "game", "state"),
        legacy,
      );
    });

    const exact = initialState("2026-08-03T00:01:00.000Z");
    exact.quests.dragon_bridge_lights = "REWARDED";
    exact.quests.my_khe_clean_wave = "ACTIVE";
    exact.unlockedPostcards = ["dragon_bridge"];
    exact.memoryFragments = 1;

    const alteredFrontier = {
      ...exact,
      quests: { ...exact.quests, my_khe_clean_wave: "AVAILABLE" },
    };

    await assertSucceeds(setDoc(gameStateReference("owner-active"), exact));
    await assertFails(
      setDoc(gameStateReference("owner-available"), alteredFrontier),
    );
  });

  it("does not migrate rewards that appear after an unfinished V1 frontier", async () => {
    const legacy = legacyState();
    legacy.quests.my_khe_clean_wave = "LOCKED";
    legacy.quests.marble_five_elements = "REWARDED";
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "owner", "game", "state"),
        legacy,
      );
    });

    const normalized = initialState("2026-08-03T00:01:00.000Z");
    normalized.quests.dragon_bridge_lights = "REWARDED";
    normalized.quests.my_khe_clean_wave = "AVAILABLE";
    normalized.unlockedPostcards = ["dragon_bridge"];
    normalized.memoryFragments = 1;

    const forged = {
      ...normalized,
      quests: {
        ...normalized.quests,
        marble_five_elements: "REWARDED",
      },
      unlockedPostcards: ["dragon_bridge", "marble_mountains"],
      memoryFragments: 2,
    };

    await assertSucceeds(setDoc(gameStateReference("owner"), normalized));

    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "owner-forged", "game", "state"),
        legacy,
      );
    });
    await assertFails(setDoc(gameStateReference("owner-forged"), forged));
  });

  it("migrates four rewarded V1 quests to only the fifth V2 frontier", async () => {
    const legacy = legacyState();
    legacy.quests = {
      dragon_bridge_lights: "REWARDED",
      my_khe_clean_wave: "REWARDED",
      marble_five_elements: "REWARDED",
      son_tra_traces: "REWARDED",
    };
    legacy.unlockedPostcards = [
      "dragon_bridge",
      "my_khe_beach",
      "marble_mountains",
      "son_tra_peninsula",
    ];
    legacy.memoryFragments = 4;
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "owner", "game", "state"),
        legacy,
      );
    });

    const migrated = initialState("2026-08-03T00:01:00.000Z");
    migrated.quests.dragon_bridge_lights = "REWARDED";
    migrated.quests.my_khe_clean_wave = "REWARDED";
    migrated.quests.marble_five_elements = "REWARDED";
    migrated.quests.son_tra_traces = "REWARDED";
    migrated.quests.han_river_bridge_turn = "AVAILABLE";
    migrated.unlockedPostcards = [
      "dragon_bridge",
      "my_khe_beach",
      "marble_mountains",
      "son_tra_peninsula",
    ];
    migrated.memoryFragments = 4;

    await assertSucceeds(setDoc(gameStateReference("owner"), migrated));
  });

  it("denies a V1 migration that skips a legacy quest lifecycle", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "owner", "game", "state"),
        legacyState(),
      );
    });

    const skipped = initialState("2026-08-03T00:01:00.000Z");
    skipped.quests.dragon_bridge_lights = "REWARDED";
    skipped.quests.my_khe_clean_wave = "REWARDED";
    skipped.quests.marble_five_elements = "AVAILABLE";
    skipped.unlockedPostcards = ["dragon_bridge", "my_khe_beach"];
    skipped.memoryFragments = 2;

    await assertFails(setDoc(gameStateReference("owner"), skipped));
  });

  it("denies a V1-to-V2 migration that drops an earned legacy reward", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "owner", "game", "state"),
        legacyState(),
      );
    });

    await assertFails(setDoc(gameStateReference("owner"), initialState()));
  });
});
