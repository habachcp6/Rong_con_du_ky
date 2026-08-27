import Phaser from "phaser";
import { bridge } from "../../app/PhaserBridge.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import {
  MY_KHE_CLEANUP_RULES,
  MY_KHE_OBSTACLES,
  MY_KHE_POSTCARD_KEY,
  MY_KHE_QUEST_ID,
  MY_KHE_TRASH,
  collectTrash,
  createCleanupAttempt,
  getMyKheObstacleCollider,
  getCleanupOutcome,
  pauseCleanupAttempt,
  remainingCleanupAttemptSeconds,
  resumeCleanupAttempt,
  type CleanupAttempt,
} from "../my-khe.js";
import { gameSession } from "../state/GameStateStore.js";
import { gameText } from "../locale.js";
import { normalizeMovementVector, type MovementVector } from "../world.js";

const GAME_FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif";

type MovementKeys = {
  up: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

type Facing = "south" | "north" | "west" | "east";

/**
 * A self-contained cleanup challenge. Its score, deadline, item locations,
 * and completion state are deterministic and never call Gemini.
 */
export class MyKheCleanupScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private movementKeys?: MovementKeys;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;
  private joystick!: TouchJoystick;
  private readonly trashObjects = new Map<
    string,
    Phaser.GameObjects.Container
  >();
  private readonly trashVisuals = new Map<
    string,
    Phaser.GameObjects.GameObject
  >();
  private attempt: CleanupAttempt | null = null;
  private active = false;
  private resultVisible = false;
  private resolvingSuccess = false;
  private resultReadyAt = 0;
  private facing: Facing = "south";
  private countText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private tutorialOverlay?: Phaser.GameObjects.Container;
  private proximityRing!: Phaser.GameObjects.Graphics;
  private promptBadge!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private rewardTimer: Phaser.Time.TimerEvent | null = null;
  private waveGraphics!: Phaser.GameObjects.Graphics;
  private waveOffset = 0;
  private waveTween?: Phaser.Tweens.Tween;

  public constructor() {
    super({ key: "MyKheCleanupScene" });
  }

  public create(): void {
    this.resetAttemptState();
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#1a6b85");
    this.drawBeach(width, height);
    this.createPlayer();
    this.createObstacles();
    this.createTrash();
    this.createProximityRing();
    this.createHud(width, height);
    this.createInput();

    this.joystick = new TouchJoystick(this);
    this.joystick.layout(width, height);
    this.scale.on("resize", this.handleResize, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.refreshHud();
    this.showTutorialOverlay();
  }

  public update(): void {
    this.updateWaves();

    if (this.resolvingSuccess) {
      return;
    }

    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      if (this.hasTutorialOverlay()) {
        this.closeTutorialOverlay();
      } else {
        this.leaveQuest();
      }
      return;
    }

    if (this.hasTutorialOverlay()) {
      if (this.wasInteractPressed()) {
        this.startOrResumeCleanup();
      }
      return;
    }

    if (this.resultVisible) {
      if (this.wasInteractPressed()) {
        this.retryFromResult();
      }
      return;
    }

    if (!this.active) {
      if (this.wasInteractPressed()) {
        this.beginCleanup();
      }
      return;
    }

    if (!this.attempt) {
      return;
    }

    if (getCleanupOutcome(this.attempt, this.time.now) === "FAILED") {
      this.finishFailure();
      return;
    }

    const keyboardDirection = this.getKeyboardDirection();
    const direction =
      keyboardDirection.x !== 0 || keyboardDirection.y !== 0
        ? keyboardDirection
        : this.joystick.getDirection();
    this.movePlayer(direction);

    this.updateProximityRing();

    if (this.wasInteractPressed()) {
      this.collectNearestTrash();
    }

    this.refreshHud();
  }

  private resetAttemptState(): void {
    this.rewardTimer?.remove(false);
    this.rewardTimer = null;
    this.waveTween?.stop();
    this.trashObjects.clear();
    this.trashVisuals.clear();
    this.attempt = null;
    this.active = false;
    this.resultVisible = false;
    this.resolvingSuccess = false;
    this.resultReadyAt = 0;
    this.facing = "south";
    this.tutorialOverlay = undefined;
  }

  private drawBeach(width: number, height: number): void {
    // 1. Deep Ocean & Waves Gradient Header
    const oceanBg = this.add.graphics();
    oceanBg.fillStyle(0x135368, 1);
    oceanBg.fillRect(0, 0, width, 72);

    for (let y = 0; y < 70; y += 6) {
      const alpha = 0.3 + (y / 70) * 0.7;
      oceanBg.fillStyle(0x35abd0, alpha);
      oceanBg.fillRect(0, y, width, 6);
    }

    // Dynamic wave layer graphics
    this.waveGraphics = this.add.graphics().setDepth(2);

    // 2. Golden Sand Shoreline
    const sandG = this.add.graphics();
    // Sand background fill
    sandG.fillStyle(0xf3d697, 1);
    sandG.fillRect(0, 70, width, height - 70);

    // Wet sand shoreline band right below water
    sandG.fillStyle(0xdfb772, 0.85);
    sandG.fillRect(0, 70, width, 22);

    // Sand dune ripples & decorative details
    sandG.fillStyle(0xe4be73, 0.4);
    for (let y = 100; y < height; y += 45) {
      sandG.fillRoundedRect(12, y, width - 24, 18, 9);
    }

    // Seashells & starfish vector accents on sand
    const decorativeG = this.add.graphics().setDepth(3);
    const accents = [
      { x: 80, y: 100, color: 0xf5eedc },
      { x: 380, y: 92, color: 0xffa07a },
      { x: 590, y: 150, color: 0xf5eedc },
      { x: 140, y: 330, color: 0xffa07a },
      { x: 500, y: 320, color: 0xf5eedc },
    ];
    accents.forEach((acc) => {
      decorativeG.fillStyle(acc.color, 0.75);
      decorativeG.fillCircle(acc.x, acc.y, 4);
      decorativeG.lineStyle(1, 0xbf9652, 0.5);
      decorativeG.strokeCircle(acc.x, acc.y, 4);
    });

    // Playfield boundary border highlight
    const boundsG = this.add.graphics().setDepth(4);
    boundsG.lineStyle(2, 0xdcb271, 0.6);
    boundsG.strokeRect(
      MY_KHE_CLEANUP_RULES.playfield.minX - 4,
      MY_KHE_CLEANUP_RULES.playfield.minY - 4,
      MY_KHE_CLEANUP_RULES.playfield.maxX -
        MY_KHE_CLEANUP_RULES.playfield.minX +
        8,
      MY_KHE_CLEANUP_RULES.playfield.maxY -
        MY_KHE_CLEANUP_RULES.playfield.minY +
        8,
    );

    // Title banner text
    this.add
      .text(width / 2, 22, gameText("SÓNG XANH MỸ KHÊ", "MY KHE BLUE WAVE"), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "20px",
        fontStyle: "bold",
        color: "#ffffff",
        shadow: {
          offsetX: 1,
          offsetY: 2,
          color: "#0d3644",
          blur: 3,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.add
      .text(
        width / 2,
        48,
        gameText(
          "Dọn sạch bãi biển Mỹ Khê cùng Rồng Con",
          "Clean My Khe shoreline with Little Dragon",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "12px",
          color: "#d7f9ff",
        },
      )
      .setOrigin(0.5)
      .setDepth(20);
  }

  private updateWaves(): void {
    if (!this.waveGraphics) return;
    this.waveOffset += 0.04;
    const width = this.scale.width;
    this.waveGraphics.clear();

    // Wave crest 1
    this.waveGraphics.fillStyle(0x75d5ec, 0.6);
    this.waveGraphics.beginPath();
    this.waveGraphics.moveTo(0, 62);
    for (let x = 0; x <= width; x += 20) {
      const y = 62 + Math.sin(x * 0.03 + this.waveOffset) * 4;
      this.waveGraphics.lineTo(x, y);
    }
    this.waveGraphics.lineTo(width, 70);
    this.waveGraphics.lineTo(0, 70);
    this.waveGraphics.closePath();
    this.waveGraphics.fillPath();

    // Wave foam line 2
    this.waveGraphics.lineStyle(2.5, 0xffffff, 0.8);
    this.waveGraphics.beginPath();
    this.waveGraphics.moveTo(0, 68);
    for (let x = 0; x <= width; x += 15) {
      const y = 68 + Math.cos(x * 0.04 + this.waveOffset * 1.2) * 3;
      this.waveGraphics.lineTo(x, y);
    }
    this.waveGraphics.strokePath();
  }

  private createPlayer(): void {
    this.physics.world.setBounds(
      MY_KHE_CLEANUP_RULES.playfield.minX,
      MY_KHE_CLEANUP_RULES.playfield.minY,
      MY_KHE_CLEANUP_RULES.playfield.maxX - MY_KHE_CLEANUP_RULES.playfield.minX,
      MY_KHE_CLEANUP_RULES.playfield.maxY - MY_KHE_CLEANUP_RULES.playfield.minY,
    );
    this.player = this.physics.add.sprite(
      55,
      210,
      "dragon_player",
      "south-idle",
    );
    this.player.setDepth(15).setCollideWorldBounds(true);

    // Player soft drop shadow
    const shadow = this.add.ellipse(0, 14, 28, 12, 0x000000, 0.25).setDepth(14);
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      if (this.player && shadow) {
        shadow.setPosition(this.player.x, this.player.y + 14);
      }
    });
  }

  private createObstacles(): void {
    MY_KHE_OBSTACLES.forEach((definition) => {
      const container = this.add
        .container(definition.x, definition.y)
        .setDepth(8);

      // Static physics remains in world coordinates; only the visual uses a Container.
      const collider = getMyKheObstacleCollider(definition);
      const colliderBody = this.add
        .rectangle(
          collider.x,
          collider.y,
          collider.width,
          collider.height,
          0x000000,
          0,
        )
        .setOrigin(0.5)
        .setVisible(false);
      this.physics.add.existing(colliderBody, true);
      this.physics.add.collider(this.player, colliderBody);

      // Render custom detailed scenery graphics
      const g = this.add.graphics();
      g.setPosition(-definition.width / 2, -definition.height / 2);

      if (definition.id === "sandcastle") {
        // Detailed Sandcastle
        // Drop shadow on sand
        g.fillStyle(0xc49f5a, 0.5);
        g.fillEllipse(
          definition.width / 2,
          definition.height - 4,
          definition.width + 10,
          14,
        );

        // Castle Base
        g.fillStyle(0xdcb271, 1);
        g.fillRect(8, 14, definition.width - 16, definition.height - 16);
        g.lineStyle(1.5, 0x9b763b, 0.8);
        g.strokeRect(8, 14, definition.width - 16, definition.height - 16);

        // 3 Towers
        const towers = [
          { x: 10, w: 14, h: 26 },
          { x: definition.width / 2 - 9, w: 18, h: 34 },
          { x: definition.width - 24, w: 14, h: 26 },
        ];
        towers.forEach((t) => {
          g.fillStyle(0xe5c284, 1);
          g.fillRect(t.x, definition.height - t.h - 4, t.w, t.h);
          g.lineStyle(1, 0x9b763b, 0.8);
          g.strokeRect(t.x, definition.height - t.h - 4, t.w, t.h);
          // Crenellations
          g.fillStyle(0xbf9958, 1);
          g.fillRect(t.x, definition.height - t.h - 8, 4, 4);
          g.fillRect(t.x + t.w - 4, definition.height - t.h - 8, 4, 4);
        });

        // Arched entrance door
        g.fillStyle(0x6e4e24, 1);
        g.fillRoundedRect(
          definition.width / 2 - 5,
          definition.height - 16,
          10,
          12,
          { tl: 5, tr: 5, bl: 0, br: 0 },
        );

        // Flag on center spire
        g.fillStyle(0xeb4d4b, 1);
        g.fillTriangle(
          definition.width / 2,
          0,
          definition.width / 2 + 10,
          4,
          definition.width / 2,
          8,
        );
        g.lineStyle(1.5, 0x4a3b22, 1);
        g.lineBetween(definition.width / 2, 0, definition.width / 2, 14);
      } else if (definition.id === "beach-umbrella") {
        // Detailed Beach Umbrella & Chair
        // Shadow on sand
        g.fillStyle(0xc49f5a, 0.5);
        g.fillEllipse(
          definition.width / 2,
          definition.height - 4,
          definition.width + 12,
          18,
        );

        // Wooden Lounger Chair
        g.fillStyle(0xa87442, 1);
        g.fillRoundedRect(10, definition.height - 18, 38, 12, 3);
        g.fillStyle(0x8a5b29, 1);
        g.fillRect(14, definition.height - 24, 10, 14);

        // Umbrella Pole
        g.lineStyle(3, 0xdedede, 1);
        g.lineBetween(
          definition.width - 24,
          4,
          definition.width - 24,
          definition.height - 6,
        );

        // Umbrella Canopy Dome
        const canopyX = definition.width - 24;
        const canopyY = 12;
        g.fillStyle(0xeb4d4b, 1);
        g.beginPath();
        g.arc(
          canopyX,
          canopyY,
          34,
          Phaser.Math.DegToRad(180),
          Phaser.Math.DegToRad(360),
        );
        g.fillPath();
        // White stripes
        g.fillStyle(0xffffff, 0.9);
        g.fillTriangle(
          canopyX - 22,
          canopyY,
          canopyX - 10,
          canopyY - 30,
          canopyX,
          canopyY,
        );
        g.fillTriangle(
          canopyX + 10,
          canopyY - 30,
          canopyX + 22,
          canopyY,
          canopyX,
          canopyY,
        );
      } else {
        // Detailed Coastal Rock Cluster
        // Shadow
        g.fillStyle(0xc49f5a, 0.5);
        g.fillEllipse(
          definition.width / 2,
          definition.height - 4,
          definition.width + 8,
          16,
        );

        // Rocks
        const rocks = [
          { x: 18, y: 18, r: 16, c: 0x606e75 },
          { x: 44, y: 14, r: 20, c: 0x76858c },
          { x: 66, y: 20, r: 14, c: 0x505b61 },
        ];
        rocks.forEach((rk) => {
          g.fillStyle(rk.c, 1);
          g.fillCircle(rk.x, rk.y, rk.r);
          g.lineStyle(1.5, 0x364045, 0.8);
          g.strokeCircle(rk.x, rk.y, rk.r);

          // Rock highlights
          g.fillStyle(0x9eb1bb, 0.6);
          g.fillCircle(rk.x - rk.r * 0.3, rk.y - rk.r * 0.3, rk.r * 0.4);

          // Moss patches
          g.fillStyle(0x4e7c4f, 0.8);
          g.fillCircle(rk.x + rk.r * 0.2, rk.y + rk.r * 0.2, rk.r * 0.35);
        });
      }

      container.add([g]);

      // Label text pill below obstacle
      this.add
        .text(
          definition.x,
          definition.y + definition.height / 2 + 10,
          definition.label,
          {
            fontFamily: GAME_FONT_FAMILY,
            fontSize: "10px",
            color: "#4f3c1b",
            backgroundColor: "#fbeed3cc",
            padding: { x: 4, y: 2 },
          },
        )
        .setOrigin(0.5)
        .setDepth(9);
    });
  }

  private createTrash(): void {
    MY_KHE_TRASH.forEach((trash) => {
      const container = this.add.container(trash.x, trash.y).setDepth(10);

      // Sand shadow behind trash item
      const shadow = this.add.ellipse(0, 10, 24, 10, 0x000000, 0.22);

      // Vector Graphics object for custom trash icon
      const g = this.add.graphics();
      this.drawVectorTrashIcon(g, trash.id);

      // Interactive hit area circle around trash vector graphic
      const hitArea = this.add
        .circle(0, 0, 22, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => this.tryCollectTrash(trash.id));

      // Label tag above trash item
      const tag = this.add
        .text(0, -18, trash.label, {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "10px",
          color: "#183e4d",
          backgroundColor: "#ffffffd9",
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5);

      container.add([shadow, g, hitArea, tag]);
      this.trashObjects.set(trash.id, container);
      this.trashVisuals.set(trash.id, container);

      // Gentle floating animation
      this.tweens.add({
        targets: container,
        y: trash.y - 3,
        duration: 1200 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }

  private drawVectorTrashIcon(
    g: Phaser.GameObjects.Graphics,
    trashId: string,
  ): void {
    g.clear();
    switch (trashId) {
      case "plastic-bottle": {
        // Blue Plastic Bottle with Cap & Label
        g.fillStyle(0x83d5ec, 0.85);
        g.fillRoundedRect(-6, -10, 12, 20, 4);
        g.lineStyle(1.5, 0x2e86a1, 1);
        g.strokeRoundedRect(-6, -10, 12, 20, 4);
        // Bottle neck & cap
        g.fillStyle(0x1976d2, 1);
        g.fillRect(-3, -14, 6, 4);
        // White label
        g.fillStyle(0xffffff, 0.9);
        g.fillRect(-6, -2, 12, 6);
        // Highlight stripe
        g.fillStyle(0xffffff, 0.7);
        g.fillRect(-4, -8, 3, 14);
        break;
      }
      case "snack-wrapper": {
        // Crinkled Snack Foil Wrapper
        g.fillStyle(0xf3bf67, 1);
        g.beginPath();
        g.moveTo(-12, -8);
        g.lineTo(12, -6);
        g.lineTo(14, 0);
        g.lineTo(11, 8);
        g.lineTo(-11, 7);
        g.lineTo(-14, 0);
        g.closePath();
        g.fillPath();
        g.lineStyle(1.5, 0xb87d19, 1);
        g.strokePath();
        // Red diagonal stripe
        g.fillStyle(0xeb4d4b, 0.9);
        g.fillRect(-4, -7, 6, 14);
        break;
      }
      case "paper-cup": {
        // Disposable Paper Coffee Cup
        g.fillStyle(0xf2eee2, 1);
        g.beginPath();
        g.moveTo(-8, -8);
        g.lineTo(8, -8);
        g.lineTo(6, 10);
        g.lineTo(-6, 10);
        g.closePath();
        g.fillPath();
        g.lineStyle(1.5, 0x8a7b68, 1);
        g.strokePath();
        // Dark coffee sleeve band
        g.fillStyle(0x795548, 1);
        g.fillRect(-7, -2, 14, 6);
        // Lid rim
        g.fillStyle(0xffffff, 1);
        g.fillRect(-9, -10, 18, 3);
        break;
      }
      case "fishing-line": {
        // Spool of Tangled Nylon Fishing Line
        g.fillStyle(0x73cfb7, 0.9);
        g.fillCircle(0, 0, 9);
        g.lineStyle(2, 0x228b70, 1);
        g.strokeCircle(0, 0, 9);
        // Tangled loops
        g.lineStyle(1.5, 0xe0ffeb, 1);
        g.strokeCircle(-2, -2, 5);
        g.strokeCircle(3, 2, 4);
        // Hook accent
        g.lineStyle(1.5, 0xcccccc, 1);
        g.lineBetween(6, -6, 10, -2);
        break;
      }
      case "tin-can": {
        // Aluminum Soda Can
        g.fillStyle(0xcbd4dc, 1);
        g.fillRoundedRect(-6, -10, 12, 20, 3);
        g.lineStyle(1.5, 0x607d8b, 1);
        g.strokeRoundedRect(-6, -10, 12, 20, 3);
        // Red brand stripe
        g.fillStyle(0xe53935, 1);
        g.fillRect(-6, -4, 12, 8);
        // Can top pull-tab
        g.fillStyle(0xb0bec5, 1);
        g.fillEllipse(0, -10, 8, 3);
        break;
      }
      case "plastic-bag": {
        // Translucent Plastic Grocery Bag
        g.fillStyle(0xe8a8d7, 0.85);
        g.fillCircle(0, 2, 9);
        // Handle loops
        g.lineStyle(2, 0xab47bc, 1);
        g.beginPath();
        g.arc(-4, -6, 6, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360));
        g.strokePath();
        g.beginPath();
        g.arc(4, -6, 6, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360));
        g.strokePath();
        // Fold lines
        g.lineStyle(1, 0xffffff, 0.7);
        g.lineBetween(-4, 0, 2, 6);
        break;
      }
      case "bottle-cap": {
        // Fluted Crown Bottle Cap
        g.fillStyle(0xf67f6c, 1);
        g.fillCircle(0, 0, 8);
        g.lineStyle(2, 0xc62828, 1);
        // Fluted edges
        for (let a = 0; a < 360; a += 45) {
          const rad = Phaser.Math.DegToRad(a);
          g.lineBetween(
            Math.cos(rad) * 6,
            Math.sin(rad) * 6,
            Math.cos(rad) * 10,
            Math.sin(rad) * 10,
          );
        }
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(-2, -2, 3);
        break;
      }
      case "drinking-straw": {
        // Bendy Drinking Straw
        g.lineStyle(4, 0xb79bf7, 1);
        g.beginPath();
        g.moveTo(-10, 10);
        g.lineTo(4, -4);
        g.lineTo(10, -8);
        g.strokePath();
        // Stripe detail
        g.lineStyle(1.5, 0xffffff, 0.9);
        g.lineBetween(-8, 8, -6, 6);
        g.lineBetween(0, 0, 2, -2);
        break;
      }
    }
  }

  private createProximityRing(): void {
    this.proximityRing = this.add.graphics().setDepth(14);

    this.promptBadge = this.add.container(0, 0).setDepth(25).setVisible(false);
    const bg = this.add
      .rectangle(0, 0, 110, 24, 0x133e4f, 0.92)
      .setStrokeStyle(1.5, 0xffea79, 1);
    this.promptText = this.add
      .text(0, 0, gameText("[E] NHẶT RÁC", "[E] PICK UP"), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "11px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.promptBadge.add([bg, this.promptText]);
  }

  private updateProximityRing(): void {
    if (
      !this.active ||
      !this.player ||
      this.resultVisible ||
      this.resolvingSuccess
    ) {
      this.proximityRing.clear();
      this.promptBadge.setVisible(false);
      return;
    }

    // Find nearest uncollected trash item
    const uncollected = MY_KHE_TRASH.filter((trash) =>
      this.trashObjects.has(trash.id),
    );
    let nearestTrash: (typeof MY_KHE_TRASH)[number] | null = null;
    let minDist = Infinity;

    uncollected.forEach((trash) => {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        trash.x,
        trash.y,
      );
      if (dist < minDist) {
        minDist = dist;
        nearestTrash = trash;
      }
    });

    this.proximityRing.clear();

    if (nearestTrash && minDist <= MY_KHE_CLEANUP_RULES.pickupRadius) {
      const targetX = (nearestTrash as (typeof MY_KHE_TRASH)[number]).x;
      const targetY = (nearestTrash as (typeof MY_KHE_TRASH)[number]).y;

      // Pulsing aura ring around near trash item
      const pulse = 1 + Math.sin(this.time.now * 0.008) * 0.12;
      this.proximityRing.lineStyle(3, 0xffeb3b, 0.85);
      this.proximityRing.strokeCircle(targetX, targetY, 26 * pulse);
      this.proximityRing.lineStyle(1.5, 0xffffff, 0.6);
      this.proximityRing.strokeCircle(targetX, targetY, 32 * pulse);

      // Show prompt badge above player
      this.promptBadge.setPosition(this.player.x, this.player.y - 36);
      this.promptBadge.setVisible(true);
    } else {
      this.promptBadge.setVisible(false);
    }
  }

  private createHud(width: number, height: number): void {
    // Left pill HUD: Trash Bag counter
    this.add
      .rectangle(16, 80, 140, 32, 0x133e4f, 0.88)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1.5, 0x47a3bf, 1)
      .setDepth(30);

    this.countText = this.add
      .text(26, 80, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5)
      .setDepth(31);

    // Right pill HUD: Timer badge
    this.add
      .rectangle(width - 16, 80, 130, 32, 0x133e4f, 0.88)
      .setOrigin(1, 0.5)
      .setStrokeStyle(1.5, 0x47a3bf, 1)
      .setDepth(30);

    this.timerText = this.add
      .text(width - 26, 80, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(1, 0.5)
      .setDepth(31);

    // Top action buttons: How to Play and Back to Map
    this.createHeaderButtons(width);

    // Feedback banner text at bottom
    this.feedbackText = this.add
      .text(width / 2, height - 24, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#133e4f",
        align: "center",
        backgroundColor: "#ffffffeb",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(30);
  }

  private createHeaderButtons(width: number): void {
    // "How to Play" button top left
    const infoBtn = this.add.container(60, 22).setDepth(35);
    const infoBg = this.add
      .rectangle(0, 0, 84, 26, 0x103a49, 0.9)
      .setStrokeStyle(1, 0x59c3e2, 1)
      .setInteractive({ useHandCursor: true });
    const infoLabel = this.add
      .text(0, 0, gameText("ℹ️ Hướng Dẫn", "ℹ️ Tutorial"), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "11px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    infoBtn.add([infoBg, infoLabel]);
    infoBg.on("pointerdown", () => this.toggleTutorialOverlay());
    infoBg.on("pointerover", () => infoBg.setStrokeStyle(1.5, 0xffffff, 1));
    infoBg.on("pointerout", () => infoBg.setStrokeStyle(1, 0x59c3e2, 1));

    // "Back to Map" button top right
    const backBtn = this.add.container(width - 60, 22).setDepth(35);
    const backBg = this.add
      .rectangle(0, 0, 88, 26, 0x103a49, 0.9)
      .setStrokeStyle(1, 0x59c3e2, 1)
      .setInteractive({ useHandCursor: true });
    const backLabel = this.add
      .text(0, 0, gameText("🚪 Bản Đồ", "🚪 Map"), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "11px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    backBtn.add([backBg, backLabel]);
    backBg.on("pointerdown", () => this.leaveQuest());
    backBg.on("pointerover", () => backBg.setStrokeStyle(1.5, 0xffffff, 1));
    backBg.on("pointerout", () => backBg.setStrokeStyle(1, 0x59c3e2, 1));
  }

  private showTutorialOverlay(): void {
    const { width, height } = this.scale;
    this.tutorialOverlay?.destroy();

    const container = this.add.container(0, 0).setDepth(50);
    const backdrop = this.add
      .rectangle(width / 2, height / 2, width, height, 0x0a212c, 0.82)
      .setInteractive();

    const card = this.add
      .rectangle(width / 2, height / 2, width - 80, 240, 0x133e4f, 0.96)
      .setStrokeStyle(2, 0xffea79, 1);

    const title = this.add
      .text(
        width / 2,
        height / 2 - 90,
        gameText(
          "🏖️ HƯỚNG DẪN: SÓNG XANH MỸ KHÊ",
          "🏖️ TUTORIAL: MY KHE BLUE WAVE",
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "16px",
          fontStyle: "bold",
          color: "#ffea79",
        },
      )
      .setOrigin(0.5);

    const body = this.add
      .text(
        width / 2,
        height / 2 - 15,
        gameText(
          "1. Di chuyển bằng phím WASD / Mũi tên hoặc Cần gạt joystick.\n2. Tiến lại gần món rác (vòng hào quang phát sáng) và nhấn E / Space hoặc Chạm trực tiếp.\n3. Thu gom đủ 8 món rác rải rác trên bãi biển trước khi hết 90 giây!\n\nNhấn E / Space hoặc nút bên dưới để bắt đầu.",
          "1. Move dragon with WASD / Arrow keys or Touch Joystick.\n2. Stand near litter (glowing target aura) and press E / Space or Tap it directly.\n3. Collect all 8 pieces of litter on the beach within 90 seconds!\n\nPress E / Space or the button below to start.",
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: width - 120 },
        },
      )
      .setOrigin(0.5);

    const startBtn = this.add.container(width / 2, height / 2 + 80);
    const btnBg = this.add
      .rectangle(0, 0, 160, 34, 0x228b6d, 1)
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add
      .text(0, 0, gameText("BẮT ĐẦU / START", "START CLEANUP"), {
        fontFamily: "sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    startBtn.add([btnBg, btnText]);

    btnBg.on("pointerdown", () => this.startOrResumeCleanup());

    container.add([backdrop, card, title, body, startBtn]);
    this.tutorialOverlay = container;
  }

  private toggleTutorialOverlay(): void {
    if (this.hasTutorialOverlay()) {
      this.closeTutorialOverlay();
    } else {
      this.openTutorialOverlay();
    }
  }

  private hasTutorialOverlay(): boolean {
    return Boolean(
      this.tutorialOverlay?.active && this.tutorialOverlay.visible,
    );
  }

  private openTutorialOverlay(): void {
    if (
      this.resolvingSuccess ||
      this.resultVisible ||
      this.hasTutorialOverlay()
    ) {
      return;
    }
    if (this.active && this.attempt) {
      if (getCleanupOutcome(this.attempt, this.time.now) === "FAILED") {
        this.finishFailure();
        return;
      }
      this.attempt = pauseCleanupAttempt(this.attempt, this.time.now);
    }
    this.showTutorialOverlay();
  }

  private closeTutorialOverlay(): void {
    this.tutorialOverlay?.destroy();
    this.tutorialOverlay = undefined;
    if (this.active && this.attempt) {
      this.attempt = resumeCleanupAttempt(this.attempt, this.time.now);
      this.refreshHud();
    }
  }

  private startOrResumeCleanup(): void {
    const wasActive = this.active;
    this.closeTutorialOverlay();
    if (!wasActive) {
      this.beginCleanup();
    }
  }

  private createInput(): void {
    if (!this.input.keyboard) {
      return;
    }
    this.cursors = this.input.keyboard.createCursorKeys();
    this.movementKeys = {
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.E,
    );
    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    this.escapeKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
  }

  private beginCleanup(): void {
    if (this.active || this.resultVisible || this.resolvingSuccess) {
      return;
    }

    const questStatus = gameSession.getState().quests[MY_KHE_QUEST_ID];
    if (questStatus === "AVAILABLE") {
      const started = gameSession.startQuest(MY_KHE_QUEST_ID);
      if (!started) {
        this.leaveQuest();
        return;
      }
      bridge.emitGameToUi({
        type: "QUEST_UPDATED",
        questId: MY_KHE_QUEST_ID,
        state: started.current,
      });
    } else if (questStatus !== "ACTIVE") {
      this.leaveQuest();
      return;
    }

    this.attempt = createCleanupAttempt(this.time.now);
    this.active = true;
    if (this.tutorialOverlay) {
      this.tutorialOverlay.destroy();
      this.tutorialOverlay = undefined;
    }
    this.feedbackText
      .setText(
        gameText(
          "Bắt đầu! Hãy nhặt sạch 8 món rác trên bờ biển.",
          "Start! Collect all 8 pieces of litter on the shore.",
        ),
      )
      .setColor("#133e4f");
    this.refreshHud();
  }

  private collectNearestTrash(): void {
    const nearest = MY_KHE_TRASH.filter((trash) =>
      this.trashObjects.has(trash.id),
    )
      .map((trash) => ({
        trash,
        distance: Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          trash.x,
          trash.y,
        ),
      }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (!nearest || nearest.distance > MY_KHE_CLEANUP_RULES.pickupRadius) {
      this.feedbackText
        .setText(
          gameText(
            "Hãy đứng gần món rác (vòng sáng) rồi nhấn E / Space.",
            "Stand close to the litter (glowing aura), then press E / Space.",
          ),
        )
        .setColor("#a83244");
      return;
    }
    this.tryCollectTrash(nearest.trash.id);
  }

  private tryCollectTrash(trashId: string): void {
    if (
      !this.active ||
      !this.attempt ||
      this.hasTutorialOverlay() ||
      this.resolvingSuccess ||
      this.resultVisible
    ) {
      return;
    }
    if (getCleanupOutcome(this.attempt, this.time.now) === "FAILED") {
      this.finishFailure();
      return;
    }

    const collection = collectTrash(this.attempt, trashId);
    if (!collection.accepted) {
      return;
    }
    this.attempt = collection.attempt;

    const item = this.trashObjects.get(trashId);
    if (item) {
      // Trigger Clean Sparkle Burst Effect before destruction
      this.triggerSparkleBurst(item.x, item.y);
      item.destroy();
    }

    this.trashObjects.delete(trashId);
    this.trashVisuals.delete(trashId);

    this.feedbackText
      .setText(
        gameText(
          `Đã dọn ${this.attempt.collectedIds.length} / ${MY_KHE_CLEANUP_RULES.requiredTrash} món rác!`,
          `Collected ${this.attempt.collectedIds.length} / ${MY_KHE_CLEANUP_RULES.requiredTrash} pieces!`,
        ),
      )
      .setColor("#1b785a");
    this.refreshHud();

    if (getCleanupOutcome(this.attempt, this.time.now) === "SUCCESS") {
      this.finishSuccess();
    }
  }

  private triggerSparkleBurst(x: number, y: number): void {
    // 1. Floating "+1" score text
    const scoreFloat = this.add
      .text(x, y - 10, "+1 ♻", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#76ff03",
        shadow: {
          offsetX: 1,
          offsetY: 1,
          color: "#000000",
          blur: 2,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(28);

    this.tweens.add({
      targets: scoreFloat,
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 750,
      ease: "Cubic.easeOut",
      onComplete: () => scoreFloat.destroy(),
    });

    // 2. Animated expanding sparkle stars
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const speed = 24 + Math.random() * 20;
      const starG = this.add.graphics().setPosition(x, y).setDepth(27);

      starG.fillStyle(i % 2 === 0 ? 0xffea79 : 0x80d8ff, 1);
      starG.fillTriangle(0, -6, 2, 0, -2, 0);
      starG.fillTriangle(0, 6, 2, 0, -2, 0);
      starG.fillTriangle(-6, 0, 0, 2, 0, -2);
      starG.fillTriangle(6, 0, 0, 2, 0, -2);

      this.tweens.add({
        targets: starG,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        scale: { from: 1, to: 0.2 },
        alpha: { from: 1, to: 0 },
        duration: 500 + Math.random() * 150,
        ease: "Quad.easeOut",
        onComplete: () => starG.destroy(),
      });
    }
  }

  private finishSuccess(): void {
    if (this.resolvingSuccess || !this.active) {
      return;
    }
    this.active = false;
    this.resolvingSuccess = true;
    this.player.setVelocity(0, 0);
    this.promptBadge.setVisible(false);
    this.proximityRing.clear();

    const completed = gameSession.completeQuest(MY_KHE_QUEST_ID);
    if (!completed) {
      this.resolvingSuccess = false;
      this.scene.start("OverworldScene");
      return;
    }
    bridge.emitGameToUi({
      type: "QUEST_UPDATED",
      questId: MY_KHE_QUEST_ID,
      state: completed.current,
    });
    this.feedbackText
      .setText(
        gameText(
          "Bãi biển Mỹ Khê đã hoàn toàn sạch đẹp! Đang nhận Mảnh Ký Ức...",
          "My Khe beach is pristine! Receiving Memory Fragment...",
        ),
      )
      .setColor("#1b785a");
    this.showCelebration();

    this.rewardTimer = this.time.delayedCall(900, () => {
      const rewarded = gameSession.rewardQuest(MY_KHE_QUEST_ID);
      if (rewarded) {
        bridge.emitGameToUi({
          type: "QUEST_UPDATED",
          questId: MY_KHE_QUEST_ID,
          state: rewarded.current,
        });
        bridge.emitGameToUi({
          type: "POSTCARD_UNLOCKED",
          placeKey: MY_KHE_POSTCARD_KEY,
        });
      }
      this.scene.start("OverworldScene");
    });
  }

  private finishFailure(): void {
    if (!this.active || this.resultVisible) {
      return;
    }
    this.active = false;
    this.player.setVelocity(0, 0);
    this.promptBadge.setVisible(false);
    this.proximityRing.clear();

    const retried = gameSession.retryQuest(MY_KHE_QUEST_ID);
    if (retried) {
      bridge.emitGameToUi({
        type: "QUEST_UPDATED",
        questId: MY_KHE_QUEST_ID,
        state: retried.current,
      });
    }
    this.showFailureResult();
  }

  private showFailureResult(): void {
    const { width, height } = this.scale;
    const collected = this.attempt?.collectedIds.length ?? 0;
    this.resultVisible = true;
    this.resultReadyAt = this.time.now + 250;
    this.add
      .rectangle(width / 2, height / 2, width - 54, 150, 0x103a49, 0.96)
      .setStrokeStyle(2, 0xffd58a, 1)
      .setDepth(50);
    this.add
      .text(
        width / 2,
        height / 2,
        gameText(
          `Hết giờ! Đã dọn (${collected} / ${MY_KHE_CLEANUP_RULES.requiredTrash} món rác).\nMỗi lần thử lại sẽ bắt đầu từ đầu.\n\nNhấn E / Space hoặc chạm để thử lại · Esc để quay lại.`,
          `Time is up! Collected (${collected} / ${MY_KHE_CLEANUP_RULES.requiredTrash} items).\nEach retry starts fresh.\n\nPress E / Space or tap to retry · Esc returns to map.`,
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "15px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: width - 88 },
        },
      )
      .setOrigin(0.5)
      .setDepth(51);
  }

  private retryFromResult(): void {
    if (!this.resultVisible || this.time.now < this.resultReadyAt) {
      return;
    }
    const started = gameSession.startQuest(MY_KHE_QUEST_ID);
    if (!started) {
      this.scene.start("OverworldScene");
      return;
    }
    bridge.emitGameToUi({
      type: "QUEST_UPDATED",
      questId: MY_KHE_QUEST_ID,
      state: started.current,
    });
    this.scene.restart();
  }

  private leaveQuest(): void {
    if (this.resolvingSuccess) {
      return;
    }
    this.active = false;
    this.player?.setVelocity(0, 0);
    if (gameSession.getState().quests[MY_KHE_QUEST_ID] === "ACTIVE") {
      const retried = gameSession.retryQuest(MY_KHE_QUEST_ID);
      if (retried) {
        bridge.emitGameToUi({
          type: "QUEST_UPDATED",
          questId: MY_KHE_QUEST_ID,
          state: retried.current,
        });
      }
    }
    this.scene.start("OverworldScene");
  }

  private showCelebration(): void {
    const celebration = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 32, "🌊  ✨  ♻", {
        fontFamily: "sans-serif",
        fontSize: "34px",
      })
      .setOrigin(0.5)
      .setDepth(45)
      .setAlpha(0);
    this.tweens.add({
      targets: celebration,
      alpha: { from: 0, to: 1 },
      y: celebration.y - 28,
      duration: 420,
      yoyo: true,
      repeat: 1,
      onComplete: () => celebration.destroy(),
    });
  }

  private getKeyboardDirection(): MovementVector {
    const x =
      (this.cursors?.right.isDown || this.movementKeys?.right.isDown ? 1 : 0) -
      (this.cursors?.left.isDown || this.movementKeys?.left.isDown ? 1 : 0);
    const y =
      (this.cursors?.down.isDown || this.movementKeys?.down.isDown ? 1 : 0) -
      (this.cursors?.up.isDown || this.movementKeys?.up.isDown ? 1 : 0);
    return normalizeMovementVector({ x, y });
  }

  private movePlayer(direction: MovementVector): void {
    if (direction.x === 0 && direction.y === 0) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setFrame(`${this.facing}-idle`);
      return;
    }
    this.player.setVelocity(
      direction.x * MY_KHE_CLEANUP_RULES.playerSpeed,
      direction.y * MY_KHE_CLEANUP_RULES.playerSpeed,
    );
    if (Math.abs(direction.x) > Math.abs(direction.y)) {
      this.facing = direction.x > 0 ? "east" : "west";
    } else {
      this.facing = direction.y > 0 ? "south" : "north";
    }
    this.player.anims.play(`dragon-${this.facing}`, true);
  }

  private wasInteractPressed(): boolean {
    return Boolean(
      (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) ||
      (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)),
    );
  }

  private refreshHud(): void {
    const collected = this.attempt?.collectedIds.length ?? 0;
    this.countText.setText(
      gameText(
        `🗑️ Rác: ${collected} / ${MY_KHE_CLEANUP_RULES.requiredTrash}`,
        `🗑️ Litter: ${collected} / ${MY_KHE_CLEANUP_RULES.requiredTrash}`,
      ),
    );
    const seconds = this.attempt
      ? remainingCleanupAttemptSeconds(this.attempt, this.time.now)
      : 90;
    this.timerText.setText(
      gameText(`⏱️ Thời gian: ${seconds}s`, `⏱️ Time: ${seconds}s`),
    );
    if (seconds <= 15) {
      this.timerText.setColor("#ffeb3b");
    } else {
      this.timerText.setColor("#ffffff");
    }
  }

  private handlePointerDown(): void {
    if (this.resolvingSuccess || this.hasTutorialOverlay()) {
      return;
    }
    if (this.resultVisible) {
      this.retryFromResult();
      return;
    }
    if (!this.active && !this.tutorialOverlay) {
      this.beginCleanup();
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.joystick.layout(gameSize.width, gameSize.height);
  }

  private cleanUp(): void {
    this.rewardTimer?.remove(false);
    this.rewardTimer = null;
    this.waveTween?.stop();
    this.tutorialOverlay?.destroy();
    this.tutorialOverlay = undefined;
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.scale.off("resize", this.handleResize, this);
    this.joystick?.destroy();
  }
}
