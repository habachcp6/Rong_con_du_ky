import { describe, expect, it } from "vitest";
import { getPrerequisiteLandmarkName } from "../../../src/client/content.js";

describe("locked quest UX & prerequisite landmark name resolution", () => {
  it("returns correct localized prerequisite landmark name for each quest in VI and EN", () => {
    expect(
      getPrerequisiteLandmarkName("dragon_bridge_lights", "vi"),
    ).toBeUndefined();
    expect(
      getPrerequisiteLandmarkName("dragon_bridge_lights", "en"),
    ).toBeUndefined();

    // Quest 2 (My Khe Beach) requires Quest 1 (Dragon Bridge)
    expect(getPrerequisiteLandmarkName("my_khe_clean_wave", "vi")).toBe(
      "Cầu Rồng",
    );
    expect(getPrerequisiteLandmarkName("my_khe_clean_wave", "en")).toBe(
      "Dragon Bridge",
    );

    // Quest 3 (Marble Mountains) requires Quest 2 (My Khe Beach)
    expect(getPrerequisiteLandmarkName("marble_five_elements", "vi")).toBe(
      "Biển Mỹ Khê",
    );
    expect(getPrerequisiteLandmarkName("marble_five_elements", "en")).toBe(
      "My Khe Beach",
    );

    // Quest 4 (Son Tra Peninsula) requires Quest 3 (Marble Mountains)
    expect(getPrerequisiteLandmarkName("son_tra_traces", "vi")).toBe(
      "Ngũ Hành Sơn",
    );
    expect(getPrerequisiteLandmarkName("son_tra_traces", "en")).toBe(
      "Marble Mountains",
    );

    expect(getPrerequisiteLandmarkName("han_river_bridge_turn", "vi")).toBe(
      "Bán Đảo Sơn Trà",
    );
    expect(getPrerequisiteLandmarkName("han_river_bridge_turn", "en")).toBe(
      "Son Tra Peninsula",
    );
    expect(getPrerequisiteLandmarkName("linh_ung_quiet_path", "vi")).toBe(
      "Cầu Sông Hàn",
    );
    expect(getPrerequisiteLandmarkName("cham_museum_relic_match", "vi")).toBe(
      "Chùa Linh Ứng Sơn Trà",
    );
    expect(getPrerequisiteLandmarkName("non_nuoc_carving_pattern", "vi")).toBe(
      "Bảo tàng Điêu khắc Chăm",
    );
    expect(getPrerequisiteLandmarkName("han_market_basket_sort", "vi")).toBe(
      "Làng nghề Đá mỹ nghệ Non Nước",
    );
    expect(getPrerequisiteLandmarkName("ba_na_golden_bridge", "vi")).toBe(
      "Chợ Hàn",
    );
  });

  it("handles unknown or invalid quest IDs gracefully", () => {
    expect(
      getPrerequisiteLandmarkName("non_existent_quest", "vi"),
    ).toBeUndefined();
    expect(getPrerequisiteLandmarkName("", "en")).toBeUndefined();
  });
});
