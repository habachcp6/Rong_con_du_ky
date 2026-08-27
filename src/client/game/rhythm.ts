export const DRAGON_BRIDGE_RHYTHM = {
  totalBeats: 10,
  minimumScorePercent: 70,
  beatIntervalMs: 750,
  hitWindowMs: 1500,
  maximumDurationMs: 90_000,
} as const;

export const requiredRhythmScore = (): number =>
  Math.ceil(
    (DRAGON_BRIDGE_RHYTHM.totalBeats *
      DRAGON_BRIDGE_RHYTHM.minimumScorePercent) /
      100,
  );

export const rhythmWasSuccessful = (correctBeats: number): boolean =>
  correctBeats >= requiredRhythmScore();

export const remainingRhythmSeconds = (deadline: number, now: number): number =>
  Math.max(0, Math.ceil((deadline - now) / 1000));
