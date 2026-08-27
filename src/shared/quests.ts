import type { LandmarkQuestId } from "./landmark-game-definitions.js";
import type { QuestStatus } from "./types.js";

export type QuestDefinition = {
  id: LandmarkQuestId;
  landmarkKey: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
};

export const QUESTS: Record<LandmarkQuestId, QuestDefinition> = {
  dragon_bridge_lights: {
    id: "dragon_bridge_lights",
    landmarkKey: "dragon_bridge",
    nameVi: "Thắp Sáng Cầu Rồng",
    nameEn: "Light Up Dragon Bridge",
    descriptionVi: "Canh đúng ít nhất 7 trong 10 nhịp để thắp sáng Cầu Rồng!",
    descriptionEn: "Hit at least 7 of 10 beats to light up Dragon Bridge!",
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
    nameVi: "Dấu Vết Sơn Trà",
    nameEn: "Son Tra Traces",
    descriptionVi: "Quan sát và tìm 3 dấu vết của Voọc chà vá chân nâu!",
    descriptionEn: "Observe and find 3 traces of the Red-shanked douc langur!",
  },
  han_river_bridge_turn: {
    id: "han_river_bridge_turn",
    landmarkKey: "han_river_bridge",
    nameVi: "Nhịp Cầu Quay Sông Hàn",
    nameEn: "Han River Bridge Turn",
    descriptionVi: "Xoay đúng 4 nhịp cầu để nối hai bờ sông Hàn trong 60 giây!",
    descriptionEn:
      "Turn all 4 bridge spans to connect the Han River banks in 60 seconds!",
  },
  linh_ung_quiet_path: {
    id: "linh_ung_quiet_path",
    landmarkKey: "linh_ung_son_tra",
    nameVi: "Lối Đi Tĩnh Lặng Linh Ứng",
    nameEn: "Linh Ung Quiet Path",
    descriptionVi: "Chọn đúng 5 điểm quan sát yên tĩnh trong 60 giây!",
    descriptionEn: "Choose the 5 quiet observation stops in 60 seconds!",
  },
  cham_museum_relic_match: {
    id: "cham_museum_relic_match",
    landmarkKey: "cham_museum",
    nameVi: "Ghép Nhãn Hiện Vật Chăm",
    nameEn: "Cham Relic Match",
    descriptionVi: "Ghép 4 motif với nhãn trưng bày đúng thứ tự trong 75 giây!",
    descriptionEn:
      "Match 4 motifs to their exhibit labels in order in 75 seconds!",
  },
  non_nuoc_carving_pattern: {
    id: "non_nuoc_carving_pattern",
    landmarkKey: "non_nuoc_stone_village",
    nameVi: "Mẫu Chạm Non Nước",
    nameEn: "Non Nuoc Carving Pattern",
    descriptionVi: "Chọn đúng 6 nét đục theo mẫu chạm đá trong 60 giây!",
    descriptionEn:
      "Choose the 6 chisel strokes in the stone-carving pattern in 60 seconds!",
  },
  han_market_basket_sort: {
    id: "han_market_basket_sort",
    landmarkKey: "han_market",
    nameVi: "Sắp Giỏ Chợ Hàn",
    nameEn: "Han Market Basket Sort",
    descriptionVi: "Phân 8 vật phẩm vào đúng 3 giỏ ở Chợ Hàn trong 75 giây!",
    descriptionEn:
      "Sort 8 goods into the right 3 Han Market baskets in 75 seconds!",
  },
  ba_na_golden_bridge: {
    id: "ba_na_golden_bridge",
    landmarkKey: "ba_na_hills",
    nameVi: "Lối Qua Cầu Vàng",
    nameEn: "Ba Na Golden Bridge",
    descriptionVi: "Nối 6 ô lối đi qua Cầu Vàng trong 60 giây!",
    descriptionEn:
      "Connect 6 path tiles to cross the Golden Bridge in 60 seconds!",
  },
};

export const INITIAL_QUESTS_STATE: Record<LandmarkQuestId, QuestStatus> = {
  dragon_bridge_lights: "AVAILABLE",
  my_khe_clean_wave: "AVAILABLE",
  marble_five_elements: "AVAILABLE",
  son_tra_traces: "AVAILABLE",
  han_river_bridge_turn: "AVAILABLE",
  linh_ung_quiet_path: "AVAILABLE",
  cham_museum_relic_match: "AVAILABLE",
  non_nuoc_carving_pattern: "AVAILABLE",
  han_market_basket_sort: "AVAILABLE",
  ba_na_golden_bridge: "AVAILABLE",
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
