export const SON_TRA_TRACE_IDS = ["canopy", "footprint", "fruit"] as const;

export type SonTraTraceId = (typeof SON_TRA_TRACE_IDS)[number];

export type SonTraObservationState = {
  found: SonTraTraceId[];
  duplicateAttempts: number;
};

export type ObserveTraceResult =
  | { kind: "FOUND"; state: SonTraObservationState }
  | { kind: "DUPLICATE"; state: SonTraObservationState }
  | { kind: "INVALID"; state: SonTraObservationState }
  | { kind: "COMPLETE"; state: SonTraObservationState };

const isTraceId = (value: string): value is SonTraTraceId =>
  SON_TRA_TRACE_IDS.includes(value as SonTraTraceId);

export const createSonTraObservationState = (): SonTraObservationState => ({
  found: [],
  duplicateAttempts: 0,
});

export const observeTrace = (
  state: SonTraObservationState,
  traceId: string,
): ObserveTraceResult => {
  if (!isTraceId(traceId)) return { kind: "INVALID", state };
  if (state.found.includes(traceId)) {
    return {
      kind: "DUPLICATE",
      state: { ...state, duplicateAttempts: state.duplicateAttempts + 1 },
    };
  }

  const next: SonTraObservationState = {
    ...state,
    found: [...state.found, traceId],
  };
  return next.found.length === SON_TRA_TRACE_IDS.length
    ? { kind: "COMPLETE", state: next }
    : { kind: "FOUND", state: next };
};

export const remainingTraces = (state: SonTraObservationState): number =>
  SON_TRA_TRACE_IDS.length - state.found.length;
