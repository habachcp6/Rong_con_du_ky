import { gameSession } from "./state/GameStateStore";

/** Small scene-level translation seam. Gameplay keeps IDs and rules language
 * neutral; only authored presentation strings read the current saved choice. */
export const gameText = (vi: string, en: string): string =>
  gameSession.getState().language === "vi" ? vi : en;
