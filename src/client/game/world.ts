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
  type: "npc";
  label: string;
  x: number;
  y: number;
  interactionRadius: number;
};

export type QuestInteractable = WorldInteractable & {
  questId: string;
  placeKey: string;
  npcId: string;
  npcTexture: string;
  npcLabel: string;
  color: number;
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
  playerStart: { x: 248, y: 772 },
} as const;

/** Metadata first, so later tiled assets can replace the procedural map without
 * changing movement, collision, or interaction rules. */
export const WORLD_COLLIDERS: readonly WorldRectangle[] = [
  {
    id: "market-hall",
    layer: "colliders",
    x: 310,
    y: 190,
    width: 210,
    height: 120,
    color: 0x7a5134,
  },
  {
    id: "lantern-garden",
    layer: "colliders",
    x: 516,
    y: 700,
    width: 184,
    height: 96,
    color: 0x35654d,
  },
  {
    id: "river-pier",
    layer: "colliders",
    x: 742,
    y: 644,
    width: 134,
    height: 74,
    color: 0x5a4638,
  },
  {
    id: "east-pavilion",
    layer: "colliders",
    x: 1335,
    y: 180,
    width: 166,
    height: 112,
    color: 0x6c4b72,
  },
  {
    id: "east-garden",
    layer: "colliders",
    x: 1415,
    y: 762,
    width: 158,
    height: 128,
    color: 0x35654d,
  },
];

export const QUEST_INTERACTABLES: readonly QuestInteractable[] = [
  {
    id: "dragon_bridge_npc",
    type: "npc",
    npcId: "dragon_bridge_npc",
    questId: "dragon_bridge_lights",
    placeKey: "dragon_bridge",
    npcTexture: "npc_dragon_bridge",
    npcLabel: "Người gác Cầu Rồng",
    label: "Cầu Rồng — nhấn E / Space để trò chuyện",
    x: 1160,
    y: 474,
    interactionRadius: 68,
    color: 0x6ce5ff,
  },
  {
    id: "my_khe_npc",
    type: "npc",
    npcId: "my_khe_npc",
    questId: "my_khe_clean_wave",
    placeKey: "my_khe_beach",
    npcTexture: "npc_my_khe",
    npcLabel: "Người giữ biển Mỹ Khê",
    label: "Biển Mỹ Khê — nhấn E / Space để giúp dọn sạch bờ biển",
    x: 1382,
    y: 688,
    interactionRadius: 72,
    color: 0x8ee5ff,
  },
  {
    id: "marble_npc",
    type: "npc",
    npcId: "marble_npc",
    questId: "marble_five_elements",
    placeKey: "marble_mountains",
    npcTexture: "npc_marble_mountains",
    npcLabel: "Người dẫn đường Ngũ Hành Sơn",
    label: "Ngũ Hành Sơn — nhấn E / Space để giải câu đố",
    x: 394,
    y: 370,
    interactionRadius: 70,
    color: 0xc8b6ff,
  },
  {
    id: "son_tra_npc",
    type: "npc",
    npcId: "son_tra_npc",
    questId: "son_tra_traces",
    placeKey: "son_tra_peninsula",
    npcTexture: "npc_son_tra",
    npcLabel: "Kiểm lâm Sơn Trà",
    label: "Sơn Trà — nhấn E / Space để quan sát dấu vết",
    x: 1362,
    y: 354,
    interactionRadius: 72,
    color: 0xb9ed8a,
  },
];

export const DRAGON_BRIDGE_INTERACTABLE = QUEST_INTERACTABLES[0];

const QUEST_INTERACTABLE_COPY: Record<
  string,
  Record<Language, Pick<QuestInteractable, "npcLabel" | "label">>
> = {
  dragon_bridge_npc: {
    vi: {
      npcLabel: "Người gác Cầu Rồng",
      label: "Cầu Rồng — nhấn E / Space để trò chuyện",
    },
    en: {
      npcLabel: "Dragon Bridge guide",
      label: "Dragon Bridge — press E / Space to talk",
    },
  },
  my_khe_npc: {
    vi: {
      npcLabel: "Người giữ biển Mỹ Khê",
      label: "Biển Mỹ Khê — nhấn E / Space để giúp dọn sạch bờ biển",
    },
    en: {
      npcLabel: "My Khe beach keeper",
      label: "My Khe Beach — press E / Space to clean the shore",
    },
  },
  marble_npc: {
    vi: {
      npcLabel: "Người dẫn đường Ngũ Hành Sơn",
      label: "Ngũ Hành Sơn — nhấn E / Space để giải câu đố",
    },
    en: {
      npcLabel: "Marble Mountains guide",
      label: "Marble Mountains — press E / Space to solve the puzzle",
    },
  },
  son_tra_npc: {
    vi: {
      npcLabel: "Kiểm lâm Sơn Trà",
      label: "Sơn Trà — nhấn E / Space để quan sát dấu vết",
    },
    en: {
      npcLabel: "Son Tra ranger",
      label: "Son Tra — press E / Space to observe traces",
    },
  },
};

export const getQuestInteractableCopy = (
  interactable: QuestInteractable,
  language: Language,
): QuestInteractable => ({
  ...interactable,
  ...(QUEST_INTERACTABLE_COPY[interactable.id]?.[language] ?? interactable),
});

export const QUEST_SCENE_BY_ID: Record<string, string> = {
  dragon_bridge_lights: "DragonBridgeQuestScene",
  my_khe_clean_wave: "MyKheCleanupScene",
  marble_five_elements: "MarbleMountainsPuzzleScene",
  son_tra_traces: "SonTraWildlifeScene",
};

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
import type { Language } from "../../shared/types";
