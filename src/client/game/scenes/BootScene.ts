import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // Load minimal loading graphics
  }

  create() {
    this.scene.start("PreloadScene");
  }
}
