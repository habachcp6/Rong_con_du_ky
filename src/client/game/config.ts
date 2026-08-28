import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { TitleScene } from "./scenes/TitleScene";
import { OverworldScene } from "./scenes/OverworldScene";
import { DragonBridgeQuestScene } from "./scenes/DragonBridgeQuestScene";
import { MyKheCleanupScene } from "./scenes/MyKheCleanupScene";
import { MarbleMountainsPuzzleScene } from "./scenes/MarbleMountainsPuzzleScene";
import { SonTraWildlifeScene } from "./scenes/SonTraWildlifeScene";
import {
  BaNaGoldenBridgeQuestScene,
  ChamMuseumQuestScene,
  HanMarketQuestScene,
  HanRiverBridgeQuestScene,
  LinhUngQuestScene,
  NonNuocQuestScene,
} from "./scenes/LandmarkChallengeScenes";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 640,
  height: 360,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  audio: {
    noAudio: true,
  },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    OverworldScene,
    DragonBridgeQuestScene,
    MyKheCleanupScene,
    MarbleMountainsPuzzleScene,
    SonTraWildlifeScene,
    HanRiverBridgeQuestScene,
    LinhUngQuestScene,
    ChamMuseumQuestScene,
    NonNuocQuestScene,
    HanMarketQuestScene,
    BaNaGoldenBridgeQuestScene,
  ],
};
