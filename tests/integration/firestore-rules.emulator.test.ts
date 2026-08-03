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
  version: 1,
  language: "vi",
  player: { scene: "OverworldScene", x: 248, y: 772 },
  quests: {
    dragon_bridge_lights: "AVAILABLE",
    my_khe_clean_wave: "LOCKED",
    marble_five_elements: "LOCKED",
    son_tra_traces: "LOCKED",
  },
  unlockedPostcards: [],
  memoryFragments: 0,
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
});
