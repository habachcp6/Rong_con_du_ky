import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { Language } from "../../shared/types";
import { gameConfig } from "../game/config";
import { GameUiOverlay } from "./GameUiOverlay";

type GameContainerProps = {
  language: Language;
};

export const GameContainer: React.FC<GameContainerProps> = ({ language }) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(gameConfig);
      const canvas = containerRef.current?.querySelector("canvas");
      canvas?.setAttribute(
        "aria-label",
        "Rồng Con Du Ký: dùng WASD hoặc phím mũi tên để di chuyển",
      );
      canvas?.setAttribute("role", "application");
      canvas?.setAttribute("tabindex", "0");
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = containerRef.current?.querySelector("canvas");
    canvas?.setAttribute(
      "aria-label",
      language === "vi"
        ? "Rồng Con Du Ký: dùng WASD hoặc phím mũi tên để di chuyển"
        : "Little Dragon's Journey: use WASD or arrow keys to move",
    );
  }, [language]);

  return (
    <section
      className="game-shell"
      data-testid="game-shell"
      aria-label={
        language === "vi"
          ? "Khu vực trò chơi Rồng Con Du Ký"
          : "Little Dragon's Journey game area"
      }
    >
      <div
        id="game-container"
        ref={containerRef}
        className="game-canvas-container"
      />
      <GameUiOverlay language={language} />
    </section>
  );
};
