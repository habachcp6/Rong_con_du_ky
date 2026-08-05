import {
  LANDMARK_GAME_DEFINITIONS,
  type LandmarkQuestId,
} from "../../shared/landmark-game-definitions.js";
import { QUESTS } from "../../shared/quests.js";
import type { Language } from "../../shared/types.js";
import { getLocationContent } from "../content.js";

export type WorldRectangle = {
  id: string;
  layer: "colliders";
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
};

export type WorldInteractable = {
  id: string;
  type: "landmark";
  label: string;
  x: number;
  y: number;
  interactionRadius: number;
};

type QuestGuide = {
  npcId: string;
  npcTexture: string;
  nameVi: string;
  nameEn: string;
};

export type QuestInteractable = WorldInteractable & {
  questId: LandmarkQuestId;
  placeKey: string;
  sceneKey: string;
  mapIconAssetId: string;
  mapIconPath: string;
  nameVi: string;
  nameEn: string;
  color: number;
  guide?: QuestGuide;
};

export type MovementVector = { x: number; y: number };

/** Named map-layer contract retained even while the MVP draws its compact map
 * procedurally. A future tiled map can preserve these semantic boundaries. */
export const WORLD_LAYER_ORDER = [
  "ground",
  "water",
  "roads",
  "landmarks",
  "colliders",
  "npcs",
] as const;

export const WORLD_BOUNDS = {
  width: 1600,
  height: 960,
  playerStart: { x: 830, y: 630 },
} as const;

export const RIVER_BOUNDS = {
  left: 750,
  right: 950,
} as const;

export const WORLD_COLLIDERS: readonly WorldRectangle[] = [
  {
    id: "ba-na-mountains",
    layer: "colliders",
    x: 80,
    y: 150,
    width: 120,
    height: 140,
    color: 0x35654d,
  },
  {
    id: "son-tra-forest",
    layer: "colliders",
    x: 1300,
    y: 100,
    width: 160,
    height: 90,
    color: 0x35654d,
  },
  {
    id: "marble-rocks",
    layer: "colliders",
    x: 740,
    y: 910,
    width: 120,
    height: 40,
    color: 0x5a4638,
  },
];

const QUEST_GUIDES: Partial<Record<LandmarkQuestId, QuestGuide>> = {
  dragon_bridge_lights: {
    npcId: "dragon_bridge_npc",
    npcTexture: "npc_dragon_bridge",
    nameVi: "Người gác Cầu Rồng",
    nameEn: "Dragon Bridge guide",
  },
  my_khe_clean_wave: {
    npcId: "my_khe_npc",
    npcTexture: "npc_my_khe",
    nameVi: "Người giữ biển Mỹ Khê",
    nameEn: "My Khe beach keeper",
  },
  marble_five_elements: {
    npcId: "marble_npc",
    npcTexture: "npc_marble_mountains",
    nameVi: "Người dẫn đường Ngũ Hành Sơn",
    nameEn: "Marble Mountains guide",
  },
  son_tra_traces: {
    npcId: "son_tra_npc",
    npcTexture: "npc_son_tra",
    nameVi: "Kiểm lâm Sơn Trà",
    nameEn: "Son Tra ranger",
  },
};

const QUEST_COLORS: Record<LandmarkQuestId, number> = {
  dragon_bridge_lights: 0x6ce5ff,
  my_khe_clean_wave: 0x8ee5ff,
  marble_five_elements: 0xc8b6ff,
  son_tra_traces: 0xb9ed8a,
  han_river_bridge_turn: 0xffd166,
  linh_ung_quiet_path: 0x9fe3c0,
  cham_museum_relic_match: 0xe9a96b,
  non_nuoc_carving_pattern: 0xbfc5bf,
  han_market_basket_sort: 0xffc857,
  ba_na_golden_bridge: 0xf6cf63,
};

/** Every destination is now a quest location. The canonical definition owns
 * the one-to-one game/icon/scene binding; this map layer only adds labels and
 * optional guide NPC presentation. */
export const QUEST_INTERACTABLES: readonly QuestInteractable[] =
  LANDMARK_GAME_DEFINITIONS.map((definition) => {
    const quest = QUESTS[definition.questId];
    const locationVi = getLocationContent("vi", definition.locationKey);
    const locationEn = getLocationContent("en", definition.locationKey);
    return {
      id: `landmark_${definition.locationKey}`,
      type: "landmark",
      questId: definition.questId,
      placeKey: definition.locationKey,
      sceneKey: definition.sceneKey,
      mapIconAssetId: definition.mapIconAssetId,
      mapIconPath: definition.mapIconPath,
      nameVi: locationVi?.name ?? quest.nameVi,
      nameEn: locationEn?.name ?? quest.nameEn,
      label: `${locationVi?.name ?? quest.nameVi} — nhấn E / Space để chơi`,
      x: definition.mapPosition.x,
      y: definition.mapPosition.y,
      interactionRadius: 52,
      color: QUEST_COLORS[definition.questId],
      guide: QUEST_GUIDES[definition.questId],
    };
  });

export const DRAGON_BRIDGE_INTERACTABLE = QUEST_INTERACTABLES[0];

export const getQuestInteractableCopy = (
  interactable: QuestInteractable,
  language: Language,
): { name: string; label: string; guideName?: string } => {
  const name = language === "vi" ? interactable.nameVi : interactable.nameEn;
  return {
    name,
    label:
      language === "vi"
        ? `${name} — nhấn E / Space hoặc chạm để chơi`
        : `${name} — press E / Space or tap to play`,
    guideName: interactable.guide
      ? language === "vi"
        ? interactable.guide.nameVi
        : interactable.guide.nameEn
      : undefined,
  };
};

export const QUEST_SCENE_BY_ID: Record<string, string> = Object.fromEntries(
  LANDMARK_GAME_DEFINITIONS.map((definition) => [
    definition.questId,
    definition.sceneKey,
  ]),
);

export const normalizeMovementVector = ({
  x,
  y,
}: MovementVector): MovementVector => {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
};

export const isWithinInteractionRange = (
  player: Pick<MovementVector, "x" | "y">,
  interactable: WorldInteractable = DRAGON_BRIDGE_INTERACTABLE,
): boolean =>
  Math.hypot(player.x - interactable.x, player.y - interactable.y) <=
  interactable.interactionRadius;
