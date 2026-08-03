import type { GameToUiEvent, UiToGameEvent } from "../../shared/types.js";

type EventCallback<T> = (data: T) => void;

class PhaserBridge {
  private gameToUiListeners: Set<EventCallback<GameToUiEvent>> = new Set();
  private uiToGameListeners: Set<EventCallback<UiToGameEvent>> = new Set();

  public emitGameToUi(event: GameToUiEvent): void {
    this.gameToUiListeners.forEach((listener) => listener(event));
  }

  public emitUiToGame(event: UiToGameEvent): void {
    this.uiToGameListeners.forEach((listener) => listener(event));
  }

  public onGameToUi(callback: EventCallback<GameToUiEvent>): () => void {
    this.gameToUiListeners.add(callback);
    return () => this.gameToUiListeners.delete(callback);
  }

  public onUiToGame(callback: EventCallback<UiToGameEvent>): () => void {
    this.uiToGameListeners.add(callback);
    return () => this.uiToGameListeners.delete(callback);
  }
}

export const bridge = new PhaserBridge();
