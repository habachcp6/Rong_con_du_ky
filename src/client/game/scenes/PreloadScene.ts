import Phaser from "phaser";
import { LANDMARK_GAME_DEFINITIONS } from "../../../shared/landmark-game-definitions.js";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: "Loading Rồng Con Du Ký...",
      style: { font: "18px monospace", color: "#ffffff" },
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xffa500, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    this.queueManifestGameplayAssets();
  }

  create() {
    // Checked-in SVG assets are preferred. Procedural textures remain a safe
    // fallback when an asset cannot be fetched in an offline/local session.
    this.createPlaceholderTextures();
    this.createPlayerAnimations();
    this.scene.start("TitleScene");
  }

  private queueManifestGameplayAssets(): void {
    this.load.svg("dragon_player", "/assets/characters/dragon-boy.svg", {
      width: 128,
      height: 128,
    });
    this.load.svg(
      "npc_dragon_bridge",
      "/assets/characters/dragon-bridge-guide-npc.svg",
      { width: 32, height: 32 },
    );
    this.load.svg("npc_my_khe", "/assets/characters/my-khe-lifeguard-npc.svg", {
      width: 32,
      height: 32,
    });
    this.load.svg(
      "npc_marble_mountains",
      "/assets/characters/marble-monk-npc.svg",
      { width: 32, height: 32 },
    );
    this.load.svg("npc_son_tra", "/assets/characters/son-tra-ranger-npc.svg", {
      width: 32,
      height: 32,
    });
    // Load baked 1600x960 pixel-art night map background
    this.load.image(
      "map_background_overworld_night",
      "/assets/map/overworld-night.png",
    );

    // Load 10 PNG map icons and 10 PNG landmark postcards
    LANDMARK_GAME_DEFINITIONS.forEach((definition) => {
      this.load.image(definition.mapIconAssetId, definition.mapIconPath);
      const postcardFilename =
        definition.locationKey === "my_khe_beach"
          ? "my-khe"
          : definition.locationKey === "son_tra_peninsula"
            ? "son-tra"
            : definition.locationKey === "linh_ung_son_tra"
              ? "linh-ung"
              : definition.locationKey === "non_nuoc_stone_village"
                ? "non-nuoc"
                : definition.locationKey.replace(/_/g, "-");
      this.load.image(
        definition.postcardAssetId,
        `/assets/landmarks/${postcardFilename}.png`,
      );
    });
  }

  private createPlaceholderTextures() {
    this.createDragonTexture();

    const fallbackNpcs = [
      ["npc_dragon_bridge", "#6ce5ff"],
      ["npc_my_khe", "#8ee5ff"],
      ["npc_marble_mountains", "#c8b6ff"],
      ["npc_son_tra", "#b9ed8a"],
    ] as const;
    fallbackNpcs.forEach(([key, accent]) => {
      if (this.textures.exists(key)) return;
      const npcCanvas = this.textures.createCanvas(key, 32, 32);
      if (!npcCanvas) return;
      const ctx = npcCanvas.getContext();
      ctx.fillStyle = "#202b52";
      ctx.fillRect(6, 4, 20, 24);
      ctx.fillStyle = accent;
      ctx.fillRect(9, 7, 14, 10);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(12, 20, 8, 6);
      npcCanvas.refresh();
    });
  }

  private createDragonTexture(): void {
    if (this.textures.exists("dragon_player")) {
      return;
    }

    const frameSize = 32;
    const canvas = this.textures.createCanvas(
      "dragon_player",
      frameSize * 8,
      frameSize,
    );
    if (!canvas) {
      return;
    }

    const directions = ["south", "north", "west", "east"] as const;
    const context = canvas.getContext();
    directions.forEach((direction, directionIndex) => {
      [false, true].forEach((walking, walkingIndex) => {
        const frameIndex = directionIndex * 2 + walkingIndex;
        const x = frameIndex * frameSize;
        this.drawDragonFrame(context, x, direction, walking);
        canvas.add(
          `${direction}-${walking ? "walk" : "idle"}`,
          0,
          x,
          0,
          frameSize,
          frameSize,
        );
      });
    });
    canvas.refresh();
  }

  private drawDragonFrame(
    context: CanvasRenderingContext2D,
    x: number,
    direction: "south" | "north" | "west" | "east",
    walking: boolean,
  ): void {
    context.fillStyle = "#351d48";
    context.fillRect(x + 7, 5, 18, 22);
    context.fillStyle = "#e85d3f";
    context.fillRect(x + 8, 6, 16, 17);
    context.fillStyle = "#ffd166";
    context.fillRect(x + 13, 10, 6, 8);
    context.fillStyle = "#fff3bf";
    context.fillRect(x + 10, 4, 4, 4);
    context.fillRect(x + 18, 4, 4, 4);
    context.fillStyle = "#19223c";
    context.fillRect(x + 10, 20, 5, 5);
    context.fillRect(x + 18, 20, 5, 5);

    if (direction === "north") {
      context.fillStyle = "#a53645";
      context.fillRect(x + 10, 9, 12, 8);
    }
    if (direction === "west") {
      context.fillStyle = "#ffd166";
      context.fillRect(x + 8, 12, 7, 5);
    }
    if (direction === "east") {
      context.fillStyle = "#ffd166";
      context.fillRect(x + 17, 12, 7, 5);
    }
    if (walking) {
      context.fillStyle = "#351d48";
      context.fillRect(x + 7, 25, 7, 3);
      context.fillRect(x + 19, 23, 7, 3);
    }
  }

  private createPlayerAnimations(): void {
    this.addManifestDragonFrames();
    const directions = ["south", "north", "west", "east"] as const;
    directions.forEach((direction) => {
      const key = `dragon-${direction}`;
      if (this.anims.exists(key)) {
        return;
      }
      this.anims.create({
        key,
        frames: [
          { key: "dragon_player", frame: `${direction}-idle` },
          { key: "dragon_player", frame: `${direction}-walk` },
        ],
        frameRate: 7,
        repeat: -1,
      });
    });
  }

  /** Maps the checked-in 4 × 4 sprite sheet to deterministic movement frames.
   * The procedural fallback already creates these named frames itself. */
  private addManifestDragonFrames(): void {
    const texture = this.textures.get("dragon_player");
    if (texture.has("south-idle")) return;

    const rows = {
      south: 0,
      west: 32,
      east: 64,
      north: 96,
    } as const;
    (
      Object.entries(rows) as Array<
        ["south" | "north" | "west" | "east", number]
      >
    ).forEach(([direction, y]) => {
      texture.add(`${direction}-idle`, 0, 0, y, 32, 32);
      texture.add(`${direction}-walk`, 0, 32, y, 32, 32);
    });
  }
}
