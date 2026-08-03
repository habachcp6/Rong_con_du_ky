/**
 * Deterministic rules and authored layout for the My Khe cleanup mini-game.
 * These values deliberately live outside Phaser so gameplay outcomes can be
 * tested without a canvas, clock, or network service.
 */
export const MY_KHE_QUEST_ID = "my_khe_clean_wave";
export const MY_KHE_POSTCARD_KEY = "my_khe_beach";

export const MY_KHE_CLEANUP_RULES = {
  requiredTrash: 8,
  maximumDurationMs: 60_000,
  pickupRadius: 38,
  playerSpeed: 175,
  playfield: { minX: 20, maxX: 620, minY: 70, maxY: 338 },
} as const;

export type MyKheTrash = {
  id: string;
  x: number;
  y: number;
  label: string;
  color: number;
};

export type MyKheObstacle = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  label: string;
};

/** Fixed item positions make every retry fair and reproducible. */
export const MY_KHE_TRASH: readonly MyKheTrash[] = [
  { id: "plastic-bottle", x: 100, y: 120, label: "Chai nhựa", color: 0x83d5ec },
  { id: "snack-wrapper", x: 169, y: 246, label: "Vỏ bánh", color: 0xf3bf67 },
  { id: "paper-cup", x: 261, y: 106, label: "Cốc giấy", color: 0xf2eee2 },
  { id: "fishing-line", x: 368, y: 165, label: "Dây cước", color: 0x73cfb7 },
  { id: "tin-can", x: 523, y: 112, label: "Lon rỗng", color: 0xcbd4dc },
  { id: "plastic-bag", x: 538, y: 279, label: "Túi nhựa", color: 0xe8a8d7 },
  { id: "bottle-cap", x: 410, y: 300, label: "Nắp chai", color: 0xf67f6c },
  { id: "drinking-straw", x: 95, y: 302, label: "Ống hút", color: 0xb79bf7 },
];

/** Obstacles are navigable physical scenery, not random penalty zones. */
export const MY_KHE_OBSTACLES: readonly MyKheObstacle[] = [
  {
    id: "sandcastle",
    x: 245,
    y: 170,
    width: 72,
    height: 44,
    color: 0xc99a5c,
    label: "Lâu đài cát",
  },
  {
    id: "beach-umbrella",
    x: 458,
    y: 225,
    width: 82,
    height: 46,
    color: 0xe96e65,
    label: "Ô che nắng",
  },
  {
    id: "rock-cluster",
    x: 302,
    y: 286,
    width: 84,
    height: 34,
    color: 0x6e7e85,
    label: "Cụm đá",
  },
];

export type CleanupAttempt = {
  startedAtMs: number;
  collectedIds: readonly string[];
};

export type CollectTrashResult = {
  accepted: boolean;
  reason:
    "COLLECTED" | "UNKNOWN_TRASH" | "ALREADY_COLLECTED" | "ATTEMPT_COMPLETE";
  attempt: CleanupAttempt;
};

export type CleanupOutcome = "IN_PROGRESS" | "SUCCESS" | "FAILED";

const knownTrashIds = new Set(MY_KHE_TRASH.map((trash) => trash.id));

export const createCleanupAttempt = (startedAtMs: number): CleanupAttempt => ({
  startedAtMs,
  collectedIds: [],
});

/** A retry must discard all progress; quest state is reset separately by GameSession. */
export const retryCleanupAttempt = (startedAtMs: number): CleanupAttempt =>
  createCleanupAttempt(startedAtMs);

export const collectedTrashCount = (attempt: CleanupAttempt): number =>
  attempt.collectedIds.length;

export const cleanupIsComplete = (attempt: CleanupAttempt): boolean =>
  collectedTrashCount(attempt) >= MY_KHE_CLEANUP_RULES.requiredTrash;

export function collectTrash(
  attempt: CleanupAttempt,
  trashId: string,
): CollectTrashResult {
  if (!knownTrashIds.has(trashId)) {
    return { accepted: false, reason: "UNKNOWN_TRASH", attempt };
  }
  if (attempt.collectedIds.includes(trashId)) {
    return { accepted: false, reason: "ALREADY_COLLECTED", attempt };
  }
  if (cleanupIsComplete(attempt)) {
    return { accepted: false, reason: "ATTEMPT_COMPLETE", attempt };
  }

  return {
    accepted: true,
    reason: "COLLECTED",
    attempt: {
      ...attempt,
      collectedIds: [...attempt.collectedIds, trashId],
    },
  };
}

export const cleanupDeadline = (attempt: CleanupAttempt): number =>
  attempt.startedAtMs + MY_KHE_CLEANUP_RULES.maximumDurationMs;

export const remainingCleanupSeconds = (
  deadlineMs: number,
  nowMs: number,
): number => Math.max(0, Math.ceil((deadlineMs - nowMs) / 1_000));

/** Time expiry wins ties so a collection at exactly 60.000 seconds cannot pass. */
export function getCleanupOutcome(
  attempt: CleanupAttempt,
  nowMs: number,
): CleanupOutcome {
  if (nowMs >= cleanupDeadline(attempt)) {
    return "FAILED";
  }
  return cleanupIsComplete(attempt) ? "SUCCESS" : "IN_PROGRESS";
}

const pointOverlapsObstacle = (
  point: Pick<MyKheTrash, "x" | "y">,
  obstacle: MyKheObstacle,
): boolean =>
  Math.abs(point.x - obstacle.x) <= obstacle.width / 2 + 12 &&
  Math.abs(point.y - obstacle.y) <= obstacle.height / 2 + 12;

/**
 * Guards authored layout changes from accidentally placing an unreachable item
 * outside the beach or inside scenery. The validator is also used in tests.
 */
export function validateMyKheLayout(
  trash: readonly MyKheTrash[] = MY_KHE_TRASH,
  obstacles: readonly MyKheObstacle[] = MY_KHE_OBSTACLES,
): { valid: true } | { valid: false; reason: string } {
  if (trash.length !== MY_KHE_CLEANUP_RULES.requiredTrash) {
    return { valid: false, reason: "TRASH_COUNT" };
  }

  const seenIds = new Set<string>();
  for (const item of trash) {
    if (seenIds.has(item.id)) {
      return { valid: false, reason: "DUPLICATE_TRASH_ID" };
    }
    seenIds.add(item.id);
    if (
      item.x < MY_KHE_CLEANUP_RULES.playfield.minX ||
      item.x > MY_KHE_CLEANUP_RULES.playfield.maxX ||
      item.y < MY_KHE_CLEANUP_RULES.playfield.minY ||
      item.y > MY_KHE_CLEANUP_RULES.playfield.maxY
    ) {
      return { valid: false, reason: "TRASH_OUT_OF_BOUNDS" };
    }
    if (obstacles.some((obstacle) => pointOverlapsObstacle(item, obstacle))) {
      return { valid: false, reason: "TRASH_OVERLAPS_OBSTACLE" };
    }
  }

  return { valid: true };
}
