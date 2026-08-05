import type { Language } from "../../shared/types.js";

export type LandmarkChallengeMode = "rotate" | "sequence" | "cycle" | "toggle";

type LocalizedText = {
  vi: string;
  en: string;
};

export type LandmarkChallengeRule = {
  questId:
    | "han_river_bridge_turn"
    | "linh_ung_quiet_path"
    | "cham_museum_relic_match"
    | "non_nuoc_carving_pattern"
    | "han_market_basket_sort"
    | "ba_na_golden_bridge";
  mode: LandmarkChallengeMode;
  durationMs: number;
  title: LocalizedText;
  subtitle: LocalizedText;
  objective: LocalizedText;
  success: LocalizedText;
  failure: LocalizedText;
  options: LocalizedText[];
  expected: number[];
  cycleLabels?: LocalizedText[];
  accent: number;
  background: number;
};

export type LandmarkChallengeAttempt = {
  phase: "INTRO" | "PLAYING" | "FAILED" | "SUCCESS";
  values: number[];
  touched: boolean[];
  progress: number;
  feedback: LocalizedText | null;
};

const text = (vi: string, en: string): LocalizedText => ({ vi, en });

/**
 * These rules are deliberately data-only and fixed. Phaser renders them, but
 * no network/model response can change the solution, timer or reward path.
 */
export const LANDMARK_CHALLENGE_RULES: Readonly<
  Record<LandmarkChallengeRule["questId"], LandmarkChallengeRule>
> = {
  han_river_bridge_turn: {
    questId: "han_river_bridge_turn",
    mode: "rotate",
    durationMs: 60_000,
    title: text("NHỊP CẦU XOAY", "TURN THE BRIDGE"),
    subtitle: text("Cầu Sông Hàn", "Han River Bridge"),
    objective: text(
      "Chạm từng nhịp để xoay về hướng sáng và nối hai bờ.",
      "Tap each span until its lighted direction connects both riverbanks.",
    ),
    success: text("Dòng sông đã thông!", "The river route is open!"),
    failure: text(
      "Nhịp cầu chưa khớp. Thử lại từ đầu.",
      "The spans do not align. Try again.",
    ),
    options: [
      text("Nhịp Tây", "West span"),
      text("Trụ giữa", "Centre pivot"),
      text("Nhịp Đông", "East span"),
      text("Đèn dẫn lối", "Guide light"),
    ],
    expected: [1, 3, 2, 1],
    accent: 0xffd166,
    background: 0x152238,
  },
  linh_ung_quiet_path: {
    questId: "linh_ung_quiet_path",
    mode: "sequence",
    durationMs: 60_000,
    title: text("LỐI ĐI TĨNH LẶNG", "QUIET PATH"),
    subtitle: text("Chùa Linh Ứng Sơn Trà", "Linh Ung Pagoda Son Tra"),
    objective: text(
      "Chọn lần lượt năm điểm quan sát tôn trọng không gian chung.",
      "Choose the five respectful observation stops in order.",
    ),
    success: text(
      "Bạn đã đi đúng lối quan sát.",
      "You followed a respectful path.",
    ),
    failure: text(
      "Hết giờ trước khi hoàn thành lộ trình.",
      "Time ran out before the route was complete.",
    ),
    options: [
      text("Biển chỉ dẫn", "Trail sign"),
      text("Lối đi yên tĩnh", "Quiet walkway"),
      text("Điểm ngắm cảnh", "Viewpoint"),
      text("Thùng rác", "Waste station"),
      text("Lối ra", "Exit path"),
      text("Khu vực không vào", "Restricted area"),
      text("Âm thanh lớn", "Loud speaker"),
    ],
    expected: [0, 1, 2, 3, 4],
    accent: 0x9fe3c0,
    background: 0x183c38,
  },
  cham_museum_relic_match: {
    questId: "cham_museum_relic_match",
    mode: "sequence",
    durationMs: 75_000,
    title: text("GHÉP NHÃN TRƯNG BÀY", "RELIC LABEL MATCH"),
    subtitle: text("Bảo tàng Điêu khắc Chăm", "Museum of Cham Sculpture"),
    objective: text(
      "Ghép bốn motif theo thứ tự của nhãn trưng bày.",
      "Match four motifs in the order shown by the exhibit labels.",
    ),
    success: text(
      "Bộ nhãn đã được ghép đúng.",
      "The exhibit labels now match.",
    ),
    failure: text(
      "Triển lãm cần được ghép lại. Thử lại nhé.",
      "The exhibit needs another match. Try again.",
    ),
    options: [
      text("Mặt trời · nhãn ánh sáng", "Sun · light label"),
      text("Vũ nữ · nhãn chuyển động", "Dancer · movement label"),
      text("Tháp · nhãn kiến trúc", "Tower · architecture label"),
      text("Hoa văn lá · nhãn trang trí", "Leaf motif · decoration label"),
      text("Sóng · nhãn nước", "Wave · water label"),
      text("Mây · nhãn bầu trời", "Cloud · sky label"),
    ],
    expected: [0, 1, 2, 3],
    accent: 0xe9a96b,
    background: 0x412820,
  },
  non_nuoc_carving_pattern: {
    questId: "non_nuoc_carving_pattern",
    mode: "sequence",
    durationMs: 60_000,
    title: text("MẪU CHẠM KHẮC", "CARVING PATTERN"),
    subtitle: text(
      "Làng đá mỹ nghệ Non Nước",
      "Non Nuoc Stone Carving Village",
    ),
    objective: text(
      "Chọn sáu nét đục theo mẫu silhouette từ ngoài vào trong.",
      "Choose six chisel strokes from the silhouette edge toward its centre.",
    ),
    success: text("Mẫu đá đã hoàn chỉnh.", "The stone pattern is complete."),
    failure: text(
      "Mẫu chạm chưa xong. Hãy thử lại.",
      "The carving is unfinished. Try again.",
    ),
    options: [
      text("Viền trái", "Left outline"),
      text("Viền phải", "Right outline"),
      text("Đỉnh", "Top edge"),
      text("Chân đế", "Base edge"),
      text("Nét giữa", "Centre line"),
      text("Chi tiết sáng", "Highlight detail"),
      text("Vết thử", "Test mark"),
    ],
    expected: [0, 2, 1, 3, 4, 5],
    accent: 0xbfc5bf,
    background: 0x30363b,
  },
  han_market_basket_sort: {
    questId: "han_market_basket_sort",
    mode: "cycle",
    durationMs: 75_000,
    title: text("SẮP GIỎ HÀNG", "MARKET BASKET SORT"),
    subtitle: text("Chợ Hàn", "Han Market"),
    objective: text(
      "Chạm từng món để chuyển qua đúng giỏ: đặc sản, quà tặng hoặc dùng ngay.",
      "Tap each item to cycle it into the right basket: local food, gift, or ready now.",
    ),
    success: text(
      "Các giỏ hàng đã được sắp xếp.",
      "Every market basket is sorted.",
    ),
    failure: text(
      "Chợ sắp đóng rồi. Hãy thử lại.",
      "The market is closing. Try again.",
    ),
    options: [
      text("Mì Quảng", "Mi Quang"),
      text("Cá khô", "Dried fish"),
      text("Khăn vải", "Cloth scarf"),
      text("Móc khóa", "Keyring"),
      text("Trái cây", "Fresh fruit"),
      text("Nước ép", "Juice"),
      text("Bánh khô", "Dry cake"),
      text("Túi quà", "Gift bag"),
    ],
    expected: [2, 0, 1, 1, 2, 2, 0, 1],
    cycleLabels: [
      text("Đặc sản", "Local food"),
      text("Quà tặng", "Gift"),
      text("Dùng ngay", "Ready now"),
    ],
    accent: 0xffc857,
    background: 0x4a3020,
  },
  ba_na_golden_bridge: {
    questId: "ba_na_golden_bridge",
    mode: "toggle",
    durationMs: 60_000,
    title: text("LỐI QUA CẦU VÀNG", "GOLDEN BRIDGE PATH"),
    subtitle: text("Bà Nà Hills", "Ba Na Hills"),
    objective: text(
      "Bật đúng sáu tile để nối lối đi trên Cầu Vàng.",
      "Toggle the six tiles that connect the Golden Bridge path.",
    ),
    success: text(
      "Con đường trên mây đã sáng.",
      "The path above the clouds is lit.",
    ),
    failure: text(
      "Lối đi chưa được nối. Hãy thử lại.",
      "The path is not connected yet. Try again.",
    ),
    options: [
      text("Cột mốc 1", "Path tile 1"),
      text("Cột mốc 2", "Path tile 2"),
      text("Cột mốc 3", "Path tile 3"),
      text("Cột mốc 4", "Path tile 4"),
      text("Cột mốc 5", "Path tile 5"),
      text("Cột mốc 6", "Path tile 6"),
    ],
    // Every tile belongs to the one continuous Golden Bridge path, so a win
    // requires deliberately lighting all six rather than discovering a short
    // subset that happens to satisfy the state comparison.
    expected: [1, 1, 1, 1, 1, 1],
    accent: 0xf6cf63,
    background: 0x304d62,
  },
};

export const getLocalizedChallengeText = (
  value: LocalizedText,
  language: Language,
): string => value[language];

export const createLandmarkChallengeAttempt = (
  rule: LandmarkChallengeRule,
): LandmarkChallengeAttempt => ({
  phase: "INTRO",
  values: rule.options.map(() => 0),
  touched: rule.options.map(() => false),
  progress: 0,
  feedback: null,
});

export const startLandmarkChallenge = (
  attempt: LandmarkChallengeAttempt,
): LandmarkChallengeAttempt =>
  attempt.phase === "INTRO" || attempt.phase === "FAILED"
    ? {
        ...attempt,
        phase: "PLAYING",
        values: attempt.values.map(() => 0),
        touched: attempt.touched.map(() => false),
        progress: 0,
        feedback: null,
      }
    : attempt;

export const failLandmarkChallenge = (
  attempt: LandmarkChallengeAttempt,
): LandmarkChallengeAttempt =>
  attempt.phase === "PLAYING" ? { ...attempt, phase: "FAILED" } : attempt;

const successIfComplete = (
  rule: LandmarkChallengeRule,
  attempt: LandmarkChallengeAttempt,
): LandmarkChallengeAttempt => {
  const complete =
    rule.mode === "sequence"
      ? attempt.progress === rule.expected.length
      : rule.expected.every(
          (expected, index) => attempt.values[index] === expected,
        ) &&
        (rule.mode !== "cycle" || attempt.touched.every(Boolean));
  return complete ? { ...attempt, phase: "SUCCESS" } : attempt;
};

export const applyLandmarkChallengeInput = (
  rule: LandmarkChallengeRule,
  attempt: LandmarkChallengeAttempt,
  optionIndex: number,
): LandmarkChallengeAttempt => {
  if (
    attempt.phase !== "PLAYING" ||
    optionIndex < 0 ||
    optionIndex >= rule.options.length
  ) {
    return attempt;
  }

  if (rule.mode === "sequence") {
    const expectedIndex = rule.expected[attempt.progress];
    if (optionIndex !== expectedIndex) {
      return {
        ...attempt,
        feedback: text(
          "Chưa đúng thứ tự — thử lại điểm đang chọn.",
          "Not that order — try the current step again.",
        ),
      };
    }
    return successIfComplete(rule, {
      ...attempt,
      progress: attempt.progress + 1,
      feedback: text("Đúng rồi!", "Correct!"),
    });
  }

  const modulo =
    rule.mode === "rotate"
      ? 4
      : rule.mode === "cycle"
        ? (rule.cycleLabels?.length ?? 3)
        : 2;
  const values = [...attempt.values];
  const touched = [...attempt.touched];
  values[optionIndex] = (values[optionIndex] + 1) % modulo;
  touched[optionIndex] = true;
  return successIfComplete(rule, {
    ...attempt,
    values,
    touched,
    feedback: null,
  });
};

export const remainingLandmarkChallengeSeconds = (
  deadline: number,
  now: number,
): number => Math.max(0, Math.ceil((deadline - now) / 1_000));
