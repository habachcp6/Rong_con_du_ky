/**
 * Canonical binding between a Da Nang landmark, its deterministic challenge,
 * its Phaser scene, and the assets shown on the map and in the passport.
 *
 * Keep this array in campaign order. Consumers must look up a definition
 * rather than duplicating a landmark-to-scene or landmark-to-icon map.
 */
export type LandmarkGameDefinition = {
  locationKey: string;
  questId: string;
  sceneKey: string;
  mapIconAssetId: string;
  mapIconPath: string;
  postcardAssetId: string;
  mechanicId: string;
  mapPosition: { x: number; y: number };
};

export const LANDMARK_GAME_DEFINITION_COUNT = 10;

export type LandmarkGameDefinitionValidationResult = {
  valid: boolean;
  errors: string[];
};

type LandmarkGameDefinitionIdentityField =
  | "locationKey"
  | "questId"
  | "sceneKey"
  | "mapIconAssetId"
  | "postcardAssetId"
  | "mechanicId";

const IDENTITY_FIELDS: readonly LandmarkGameDefinitionIdentityField[] = [
  "locationKey",
  "questId",
  "sceneKey",
  "mapIconAssetId",
  "postcardAssetId",
  "mechanicId",
];

export const LANDMARK_GAME_DEFINITIONS = [
  {
    locationKey: "dragon_bridge",
    questId: "dragon_bridge_lights",
    sceneKey: "DragonBridgeQuestScene",
    mapIconAssetId: "landmark_icon_dragon_bridge",
    mapIconPath: "/assets/landmark-icons/dragon-bridge.png",
    postcardAssetId: "landmark_dragon_bridge",
    mechanicId: "rhythm_lights",
    mapPosition: { x: 880, y: 630 },
  },
  {
    locationKey: "my_khe_beach",
    questId: "my_khe_clean_wave",
    sceneKey: "MyKheCleanupScene",
    mapIconAssetId: "landmark_icon_my_khe_beach",
    mapIconPath: "/assets/landmark-icons/my-khe-beach.png",
    postcardAssetId: "landmark_my_khe_beach",
    mechanicId: "beach_cleanup",
    mapPosition: { x: 1200, y: 480 },
  },
  {
    locationKey: "marble_mountains",
    questId: "marble_five_elements",
    sceneKey: "MarbleMountainsPuzzleScene",
    mapIconAssetId: "landmark_icon_marble_mountains",
    mapIconPath: "/assets/landmark-icons/marble-mountains.png",
    postcardAssetId: "landmark_marble_mountains",
    mechanicId: "five_elements_match",
    mapPosition: { x: 740, y: 850 },
  },
  {
    locationKey: "son_tra_peninsula",
    questId: "son_tra_traces",
    sceneKey: "SonTraWildlifeScene",
    mapIconAssetId: "landmark_icon_son_tra_peninsula",
    mapIconPath: "/assets/landmark-icons/son-tra-peninsula.png",
    postcardAssetId: "landmark_son_tra_peninsula",
    mechanicId: "wildlife_trace_search",
    mapPosition: { x: 1250, y: 210 },
  },
  {
    locationKey: "han_river_bridge",
    questId: "han_river_bridge_turn",
    sceneKey: "HanRiverBridgeQuestScene",
    mapIconAssetId: "landmark_icon_han_river_bridge",
    mapIconPath: "/assets/landmark-icons/han-river-bridge.png",
    postcardAssetId: "landmark_han_river_bridge",
    mechanicId: "bridge_turn_rotation",
    mapPosition: { x: 830, y: 250 },
  },
  {
    locationKey: "linh_ung_son_tra",
    questId: "linh_ung_quiet_path",
    sceneKey: "LinhUngQuestScene",
    mapIconAssetId: "landmark_icon_linh_ung_son_tra",
    mapIconPath: "/assets/landmark-icons/linh-ung-son-tra.png",
    postcardAssetId: "landmark_linh_ung_son_tra",
    mechanicId: "quiet_path_sequence",
    mapPosition: { x: 1420, y: 220 },
  },
  {
    locationKey: "cham_museum",
    questId: "cham_museum_relic_match",
    sceneKey: "ChamMuseumQuestScene",
    mapIconAssetId: "landmark_icon_cham_museum",
    mapIconPath: "/assets/landmark-icons/cham-museum.png",
    postcardAssetId: "landmark_cham_museum",
    mechanicId: "relic_match_sequence",
    mapPosition: { x: 710, y: 470 },
  },
  {
    locationKey: "non_nuoc_stone_village",
    questId: "non_nuoc_carving_pattern",
    sceneKey: "NonNuocQuestScene",
    mapIconAssetId: "landmark_icon_non_nuoc_stone_village",
    mapIconPath: "/assets/landmark-icons/non-nuoc-stone-village.png",
    postcardAssetId: "landmark_non_nuoc_stone_village",
    mechanicId: "carving_pattern_sequence",
    mapPosition: { x: 660, y: 880 },
  },
  {
    locationKey: "han_market",
    questId: "han_market_basket_sort",
    sceneKey: "HanMarketQuestScene",
    mapIconAssetId: "landmark_icon_han_market",
    mapIconPath: "/assets/landmark-icons/han-market.png",
    postcardAssetId: "landmark_han_market",
    mechanicId: "basket_sort_cycle",
    mapPosition: { x: 480, y: 490 },
  },
  {
    locationKey: "ba_na_hills",
    questId: "ba_na_golden_bridge",
    sceneKey: "BaNaGoldenBridgeQuestScene",
    mapIconAssetId: "landmark_icon_ba_na_hills",
    mapIconPath: "/assets/landmark-icons/ba-na-hills.png",
    postcardAssetId: "landmark_ba_na_hills",
    mechanicId: "golden_bridge_toggle",
    mapPosition: { x: 260, y: 240 },
  },
] as const satisfies readonly LandmarkGameDefinition[];

/**
 * Pure structural guard for the canonical campaign registry. It deliberately
 * does not inspect the filesystem; content/asset validators can compose this
 * result with their own manifest and source checks.
 */
export function validateLandmarkGameDefinitions(
  definitions: readonly LandmarkGameDefinition[] = LANDMARK_GAME_DEFINITIONS,
): LandmarkGameDefinitionValidationResult {
  const errors: string[] = [];

  if (definitions.length !== LANDMARK_GAME_DEFINITION_COUNT) {
    errors.push(
      `Expected ${LANDMARK_GAME_DEFINITION_COUNT} landmark game definitions, received ${definitions.length}.`,
    );
  }

  for (const field of IDENTITY_FIELDS) {
    const seen = new Set<string>();
    definitions.forEach((definition, index) => {
      const value = definition[field];
      if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`Definition ${index} is missing ${field}.`);
        return;
      }
      if (seen.has(value)) {
        errors.push(`Definition ${index} duplicates ${field}: ${value}.`);
        return;
      }
      seen.add(value);
    });
  }

  definitions.forEach((definition, index) => {
    const expectedMapIconAssetId = `landmark_icon_${definition.locationKey}`;
    const expectedPostcardAssetId = `landmark_${definition.locationKey}`;
    if (definition.mapIconAssetId !== expectedMapIconAssetId) {
      errors.push(
        `Definition ${index} mapIconAssetId must be ${expectedMapIconAssetId}.`,
      );
    }
    if (definition.postcardAssetId !== expectedPostcardAssetId) {
      errors.push(
        `Definition ${index} postcardAssetId must be ${expectedPostcardAssetId}.`,
      );
    }
    if (
      typeof definition.mapIconPath !== "string" ||
      !definition.mapIconPath.startsWith("/assets/landmark-icons/") ||
      !/\.(png|svg)$/.test(definition.mapIconPath)
    ) {
      errors.push(`Definition ${index} has an invalid mapIconPath.`);
    }
    const position = definition.mapPosition;
    if (
      !position ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      errors.push(`Definition ${index} has an invalid mapPosition.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export type LandmarkLocationKey =
  (typeof LANDMARK_GAME_DEFINITIONS)[number]["locationKey"];
export type LandmarkQuestId =
  (typeof LANDMARK_GAME_DEFINITIONS)[number]["questId"];

export function getLandmarkGameDefinitionByQuestId(
  questId: string,
): (typeof LANDMARK_GAME_DEFINITIONS)[number] | undefined {
  return LANDMARK_GAME_DEFINITIONS.find(
    (definition) => definition.questId === questId,
  );
}

export function getLandmarkGameDefinitionByLocationKey(
  locationKey: string,
): (typeof LANDMARK_GAME_DEFINITIONS)[number] | undefined {
  return LANDMARK_GAME_DEFINITIONS.find(
    (definition) => definition.locationKey === locationKey,
  );
}
