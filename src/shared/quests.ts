import type { QuestStatus } from "./types.js";

export type QuestDefinition = {
  id: string;
  landmarkKey: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
};

export const QUESTS: Record<string, QuestDefinition> = {
  dragon_bridge_lights: {
    id: "dragon_bridge_lights",
    landmarkKey: "dragon_bridge",
    nameVi: "Thắp Sáng Cầu Rồng",
    nameEn: "Light Up Dragon Bridge",
    descriptionVi: "Nhấn theo nhịp để thắp sáng 5 đoạn Cầu Rồng!",
    descriptionEn:
      "Tap to the rhythm to light up the 5 sections of Dragon Bridge!",
  },
  my_khe_clean_wave: {
    id: "my_khe_clean_wave",
    landmarkKey: "my_khe_beach",
    nameVi: "Sóng Xanh Mỹ Khê",
    nameEn: "My Khe Clean Wave",
    descriptionVi: "Thu gom 8 vật thể rác trên bãi biển Mỹ Khê!",
    descriptionEn: "Collect 8 trash items on My Khe beach!",
  },
  marble_five_elements: {
    id: "marble_five_elements",
    landmarkKey: "marble_mountains",
    nameVi: "Ngũ Hành Kỳ Bí",
    nameEn: "Marble Five Elements",
    descriptionVi: "Ghép 5 biểu tượng Kim-Mộc-Thủy-Hỏa-Thổ!",
    descriptionEn: "Match the 5 elements: Metal, Wood, Water, Fire, Earth!",
  },
  son_tra_traces: {
    id: "son_tra_traces",
    landmarkKey: "son_tra_peninsula",
    nameVi: "Dấu Dân Sơn Trà",
    nameEn: "Son Tra Traces",
    descriptionVi: "Quan sát và tìm 3 dấu vết của Voọc chà vá chân nâu!",
    descriptionEn: "Observe and find 3 traces of the Red-shanked douc langur!",
  },
};

export const INITIAL_QUESTS_STATE: Record<string, QuestStatus> = {
  dragon_bridge_lights: "AVAILABLE",
  my_khe_clean_wave: "LOCKED",
  marble_five_elements: "LOCKED",
  son_tra_traces: "LOCKED",
};

export function canTransitionQuest(
  current: QuestStatus,
  next: QuestStatus,
): boolean {
  const validTransitions: Record<QuestStatus, QuestStatus[]> = {
    LOCKED: ["AVAILABLE"],
    AVAILABLE: ["ACTIVE"],
    ACTIVE: ["COMPLETED", "AVAILABLE"],
    COMPLETED: ["REWARDED"],
    REWARDED: [],
  };
  return validTransitions[current]?.includes(next) ?? false;
}
