import Phaser from "phaser";
import { bridge } from "../../app/PhaserBridge";
import {
  DRAGON_BRIDGE_RHYTHM,
  remainingRhythmSeconds,
  requiredRhythmScore,
  rhythmWasSuccessful,
} from "../rhythm";
import { gameText } from "../locale";
import { DRAGON_BRIDGE_QUEST_ID, gameSession } from "../state/GameStateStore";

const GAME_FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif";

/**
 * The mini-game is intentionally deterministic. Gemini is never called here and
 * cannot influence beats, thresholds, quest transitions, or rewards.
 */
export class DragonBridgeQuestScene extends Phaser.Scene {
  private readonly beatMarkers: Phaser.GameObjects.Arc[] = [];
  private readonly bridgeSegments: Phaser.GameObjects.Rectangle[] = [];
  private readonly bridgeSegmentFrames: Phaser.GameObjects.Rectangle[] = [];
  private active = false;
  private currentBeat = 0;
  private correctBeats = 0;
  private incorrectBeats = 0;
  private deadline = 0;
  private beatWasHandled = false;
  private resultVisible = false;
  private resolvingSuccess = false;
  private resultReadyAt = 0;
  private tutorialVisible = false;
  private rhythmPaused = false;
  private pausedAt = 0;
  private beatTimer: Phaser.Time.TimerEvent | null = null;
  private travelingRingTween: Phaser.Tweens.Tween | null = null;
  private targetRingPulseTween: Phaser.Tweens.Tween | null = null;

  // Visual objects
  private sweetSpotRing!: Phaser.GameObjects.Arc;
  private travelingRing!: Phaser.GameObjects.Arc;
  private dragonEye!: Phaser.GameObjects.Arc;
  private tutorialContainer?: Phaser.GameObjects.Container;
  private waterWaves: Phaser.GameObjects.Graphics[] = [];

  // HUD
  private feedbackText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private tutorialText!: Phaser.GameObjects.Text;
  private infoBtn!: Phaser.GameObjects.Container;

  // Keyboard controls
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;

  public constructor() {
    super({ key: "DragonBridgeQuestScene" });
  }

  public create(): void {
    this.resetAttemptState();
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#07152b");

    // 1. Draw Environment (Night sky, city lights, Han river)
    this.drawSkyAndCity(width, height);

    // 2. Draw Dragon Bridge artwork (golden arches, piers, dragon head, lanterns)
    this.drawDragonBridgeArtwork(width, height);

    // 3. Draw Beat conductor track & target sweet spot
    this.drawBeatTrack(width, height);

    // 4. Header HUD
    this.createHud(width, height);

    // 5. Tutorial Overlay ("How to Play")
    this.createTutorialOverlay(width, height);

    // Input handlers
    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE,
      );
      this.enterKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ENTER,
      );
      this.interactKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.E,
      );
      this.escapeKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC,
      );
    }

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);

    this.refreshHud();
  }

  /** Phaser restarts a Scene instance in place, so every attempt-specific flag
   * must be reset before rebuilding its visual objects and input handlers. */
  private resetAttemptState(): void {
    this.beatTimer?.remove(false);
    this.beatTimer = null;
    this.travelingRingTween?.stop();
    this.travelingRingTween = null;
    this.targetRingPulseTween?.stop();
    this.targetRingPulseTween = null;

    this.beatMarkers.length = 0;
    this.bridgeSegments.length = 0;
    this.bridgeSegmentFrames.length = 0;
    this.waterWaves.length = 0;

    this.active = false;
    this.currentBeat = 0;
    this.correctBeats = 0;
    this.incorrectBeats = 0;
    this.deadline = 0;
    this.beatWasHandled = false;
    this.resultVisible = false;
    this.resolvingSuccess = false;
    this.resultReadyAt = 0;
    this.tutorialVisible = false;
    this.rhythmPaused = false;
    this.pausedAt = 0;
  }

  public update(): void {
    if (this.resolvingSuccess) {
      return;
    }

    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      if (this.tutorialVisible) {
        this.closeTutorial();
      } else {
        this.leaveQuest();
      }
      return;
    }

    if (this.tutorialVisible || this.rhythmPaused) {
      return;
    }

    if (this.resultVisible) {
      if (
        (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) ||
        (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) ||
        (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
      ) {
        this.retryFromResult();
      }
      return;
    }

    if (!this.active) {
      if (
        (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) ||
        (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) ||
        (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
      ) {
        this.beginRhythm();
      }
      return;
    }

    if (
      (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) ||
      (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) ||
      (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
    ) {
      this.handleBeatInput();
    }

    if (this.time.now >= this.deadline) {
      this.finishRhythm();
      return;
    }

    this.timerText.setText(
      gameText(
        `Tối đa: ${remainingRhythmSeconds(this.deadline, this.time.now)} giây`,
        `Time: ${remainingRhythmSeconds(this.deadline, this.time.now)}s`,
      ),
    );
  }

  private drawSkyAndCity(width: number, height: number): void {
    const skyGraphics = this.add.graphics();
    skyGraphics.fillGradientStyle(0x050d1a, 0x07152b, 0x0c213d, 0x0a1c36, 1);
    skyGraphics.fillRect(0, 0, width, height / 2 - 20);

    // Stars in night sky
    const starColors = [0xffffff, 0xffe082, 0xcae9ff];
    for (let i = 0; i < 35; i += 1) {
      const starX = (i * 37 + 13) % width;
      const starY = (i * 19 + 7) % (height / 2 - 40);
      const starAlpha = 0.3 + ((i * 11) % 70) / 100;
      const color = starColors[i % starColors.length];
      const star = this.add.circle(
        starX,
        starY,
        i % 3 === 0 ? 1.5 : 1,
        color,
        starAlpha,
      );
      if (i % 4 === 0) {
        this.tweens.add({
          targets: star,
          alpha: { from: starAlpha, to: 0.1 },
          duration: 800 + (i % 5) * 200,
          yoyo: true,
          repeat: -1,
        });
      }
    }

    // City lights along horizon
    const horizonY = height / 2 - 25;
    const skylineGraphics = this.add.graphics();
    skylineGraphics.fillStyle(0x0a1628, 0.9);
    skylineGraphics.fillRect(20, horizonY - 20, 45, 20);
    skylineGraphics.fillRect(75, horizonY - 35, 30, 35);
    skylineGraphics.fillRect(115, horizonY - 15, 50, 15);
    skylineGraphics.fillRect(width - 160, horizonY - 28, 40, 28);
    skylineGraphics.fillRect(width - 110, horizonY - 18, 55, 18);
    skylineGraphics.fillRect(width - 48, horizonY - 32, 35, 32);

    const cityLightColors = [
      0xffd166, 0xff6b6b, 0x4ecdc4, 0xa8ffbd, 0xffb703, 0xffffff,
    ];
    for (let i = 0; i < 20; i += 1) {
      const lightX = 15 + i * (width / 20);
      const lightY = horizonY - 4 - ((i * 7) % 18);
      const lightColor = cityLightColors[i % cityLightColors.length];
      this.add.circle(lightX, lightY, 2, lightColor, 0.85);
    }

    // Han River Water
    const riverY = height / 2 - 25;
    const riverHeight = 125;
    const river = this.add.graphics();
    river.fillGradientStyle(0x091c36, 0x091c36, 0x061124, 0x061124, 0.95);
    river.fillRect(0, riverY, width, riverHeight);

    // River wave shimmer lines
    for (let i = 0; i < 5; i += 1) {
      const waveG = this.add.graphics();
      const lineY = riverY + 18 + i * 22;
      waveG.lineStyle(2, 0x1e5288, 0.45);
      waveG.beginPath();
      waveG.moveTo(0, lineY);
      for (let x = 0; x <= width; x += 40) {
        const offset = Math.sin((x + i * 30) * 0.05) * 3;
        waveG.lineTo(x, lineY + offset);
      }
      waveG.strokePath();
      this.waterWaves.push(waveG);

      this.tweens.add({
        targets: waveG,
        alpha: { from: 0.3, to: 0.75 },
        duration: 1200 + i * 300,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private drawDragonBridgeArtwork(width: number, height: number): void {
    const bridgeY = height / 2 + 10;
    const bridgeWidth = width - 120;
    const startX = 60;
    const endX = startX + bridgeWidth;

    // 1. Concrete Piers in River Water
    const pierCount = 5;
    const pierSpacing = bridgeWidth / (pierCount - 1);
    for (let i = 0; i < pierCount; i += 1) {
      const pierX = startX + i * pierSpacing;
      const pier = this.add.graphics();
      pier.fillStyle(0x1e293b, 1);
      pier.fillRect(pierX - 12, bridgeY + 8, 24, 38);
      pier.lineStyle(2, 0x334155, 1);
      pier.strokeRect(pierX - 12, bridgeY + 8, 24, 38);
      this.add.rectangle(pierX, bridgeY + 48, 20, 6, 0x0f233f, 0.6);
    }

    // 2. Roadway Deck Bar
    const deck = this.add.graphics();
    deck.fillStyle(0x27354a, 1);
    deck.fillRect(startX - 10, bridgeY, bridgeWidth + 20, 12);
    deck.lineStyle(2, 0xffb703, 0.9);
    deck.strokeLineShape(
      new Phaser.Geom.Line(
        startX - 10,
        bridgeY,
        startX + bridgeWidth + 10,
        bridgeY,
      ),
    );

    // 3. Golden Steel Dragon Arches (5 sweeping parabolic arches)
    const archGraphics = this.add.graphics();
    archGraphics.lineStyle(6, 0xd97706, 0.9);
    this.drawParabolicArches(
      archGraphics,
      startX,
      bridgeY,
      pierSpacing,
      pierCount,
      40,
    );

    archGraphics.lineStyle(3, 0xffb703, 1);
    this.drawParabolicArches(
      archGraphics,
      startX,
      bridgeY,
      pierSpacing,
      pierCount,
      40,
    );

    archGraphics.lineStyle(1.5, 0xffe082, 0.95);
    this.drawParabolicArches(
      archGraphics,
      startX,
      bridgeY,
      pierSpacing,
      pierCount,
      40,
    );

    // 4. Stylized Dragon Head (Eastern Pier, right side)
    const headX = endX + 8;
    const headY = bridgeY - 22;
    const dragonHeadG = this.add.graphics();

    dragonHeadG.fillStyle(0xfb8500, 1);
    dragonHeadG.fillTriangle(
      headX - 10,
      headY + 12,
      headX + 24,
      headY - 4,
      headX + 18,
      headY + 16,
    );
    dragonHeadG.fillStyle(0xffb703, 1);
    dragonHeadG.fillCircle(headX, headY, 14);
    dragonHeadG.lineStyle(3, 0xffd166, 1);
    dragonHeadG.strokeLineShape(
      new Phaser.Geom.Line(headX - 4, headY - 10, headX - 12, headY - 24),
    );
    dragonHeadG.strokeLineShape(
      new Phaser.Geom.Line(headX + 4, headY - 10, headX + 2, headY - 26),
    );

    this.dragonEye = this.add.circle(headX + 4, headY - 2, 4, 0xff3d00, 1);
    this.dragonEye.setStrokeStyle(1.5, 0xffd166, 1);

    // Dragon Tail (Western Pier, left side)
    const tailX = startX - 12;
    const tailY = bridgeY - 6;
    const tailG = this.add.graphics();
    tailG.lineStyle(4, 0xffb703, 1);
    tailG.beginPath();
    tailG.moveTo(tailX + 10, tailY);
    tailG.lineTo(tailX - 8, tailY - 15);
    tailG.lineTo(tailX - 18, tailY + 5);
    tailG.lineTo(tailX - 26, tailY - 8);
    tailG.strokePath();

    // 5. 5 Lantern Spans on the Bridge Deck
    const segmentWidth = (bridgeWidth - 40) / 5;
    const segStartX = startX + 20;
    for (let index = 0; index < 5; index += 1) {
      const segX = segStartX + index * segmentWidth + segmentWidth / 2;

      const frame = this.add.rectangle(
        segX,
        bridgeY - 14,
        segmentWidth - 8,
        16,
        0x1a263b,
      );
      frame.setStrokeStyle(1.5, 0x334155, 0.9);
      this.bridgeSegmentFrames.push(frame);

      const orb = this.add.circle(segX, bridgeY - 14, 6, 0x243956, 1);
      orb.setStrokeStyle(1.5, 0x475569, 0.9);
      this.bridgeSegments.push(orb as unknown as Phaser.GameObjects.Rectangle);
    }
  }

  private drawParabolicArches(
    g: Phaser.GameObjects.Graphics,
    startX: number,
    bridgeY: number,
    pierSpacing: number,
    pierCount: number,
    archHeight: number,
  ): void {
    const steps = 20;
    for (let i = 0; i < pierCount - 1; i += 1) {
      const x1 = startX + i * pierSpacing;
      const x2 = startX + (i + 1) * pierSpacing;
      const controlX = (x1 + x2) / 2;
      const controlY = bridgeY - archHeight;
      g.beginPath();
      g.moveTo(x1, bridgeY);
      for (let s = 1; s <= steps; s += 1) {
        const t = s / steps;
        const u = 1 - t;
        const x = u * u * x1 + 2 * u * t * controlX + t * t * x2;
        const y = u * u * bridgeY + 2 * u * t * controlY + t * t * bridgeY;
        g.lineTo(x, y);
      }
      g.strokePath();
    }
  }

  private drawBeatTrack(width: number, height: number): void {
    const trackY = height / 2 + 105;
    const trackWidth = width - 140;
    const trackStartX = 70;

    const rail = this.add.graphics();
    rail.fillStyle(0x0f172a, 0.95);
    rail.fillRoundedRect(trackStartX, trackY - 20, trackWidth, 40, 20);
    rail.lineStyle(2, 0x334155, 1);
    rail.strokeRoundedRect(trackStartX, trackY - 20, trackWidth, 40, 20);

    const centerLine = this.add.graphics();
    centerLine.lineStyle(1.5, 0x1e293b, 0.8);
    centerLine.strokeLineShape(
      new Phaser.Geom.Line(
        trackStartX + 20,
        trackY,
        trackStartX + trackWidth - 20,
        trackY,
      ),
    );

    const markerStart = trackStartX + 35;
    const markerStep =
      (trackWidth - 70) / (DRAGON_BRIDGE_RHYTHM.totalBeats - 1);

    for (let index = 0; index < DRAGON_BRIDGE_RHYTHM.totalBeats; index += 1) {
      const x = markerStart + index * markerStep;
      const marker = this.add
        .circle(x, trackY, 14, 0x243956, 1)
        .setStrokeStyle(2, 0x6c8fb0, 0.95);

      this.add
        .text(x, trackY + 24, `${index + 1}`, {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "11px",
          color: "#6c8fb0",
        })
        .setOrigin(0.5);

      this.beatMarkers.push(marker);
    }

    this.sweetSpotRing = this.add
      .circle(markerStart, trackY, 22, 0x000000, 0)
      .setStrokeStyle(3, 0xffd166, 1)
      .setVisible(false);

    this.travelingRing = this.add
      .circle(markerStart, trackY, 36, 0x000000, 0)
      .setStrokeStyle(2.5, 0x7ef29a, 0.9)
      .setVisible(false);
  }

  private createHud(width: number, height: number): void {
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x06101e, 0.75);
    hudBg.fillRect(0, 0, width, 52);

    this.add
      .text(
        width / 2,
        26,
        gameText("THẮP SÁNG CẦU RỒNG", "LIGHT UP DRAGON BRIDGE"),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "20px",
          fontStyle: "bold",
          color: "#ffe082",
        },
      )
      .setOrigin(0.5);

    this.scoreText = this.add
      .text(110, 26, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);

    this.timerText = this.add
      .text(width - 24, 26, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "14px",
        fontStyle: "bold",
        color: "#b9ecff",
      })
      .setOrigin(1, 0.5);

    this.feedbackText = this.add
      .text(width / 2, height - 54, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5);

    this.tutorialText = this.add
      .text(
        width / 2,
        height - 24,
        gameText(
          "Nhấn Space / E hoặc Chạm màn hình để bắt đầu thử thách (Cần 7/10 nhịp đúng).",
          "Press Space / E or Tap to start challenge (7/10 correct beats needed).",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "13px",
          color: "#e8f7ff",
          align: "center",
        },
      )
      .setOrigin(0.5);

    this.infoBtn = this.add.container(28, 26);
    const infoBg = this.add
      .circle(0, 0, 16, 0x1e293b, 0.9)
      .setStrokeStyle(1.5, 0xffd166, 1);
    const infoText = this.add
      .text(0, 0, "ℹ️", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "15px",
      })
      .setOrigin(0.5);
    this.infoBtn.add([infoBg, infoText]);
    this.infoBtn.setSize(32, 32);
    this.infoBtn.setInteractive({ useHandCursor: true });
    this.infoBtn.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.toggleTutorial();
      },
    );
    infoBg.on("pointerover", () => infoBg.setStrokeStyle(2, 0xffffff, 1));
    infoBg.on("pointerout", () => infoBg.setStrokeStyle(1.5, 0xffd166, 1));

    const exitBtn = this.add.container(66, 26);
    const exitBg = this.add
      .circle(0, 0, 16, 0x3d2222, 0.9)
      .setStrokeStyle(1.5, 0xe06c75, 1);
    const exitText = this.add
      .text(0, 0, "🚪", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "15px",
      })
      .setOrigin(0.5);
    exitBtn.add([exitBg, exitText]);
    exitBtn.setSize(32, 32);
    exitBtn.setInteractive({ useHandCursor: true });
    exitBtn.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.leaveQuest();
      },
    );
    exitBg.on("pointerover", () => exitBg.setStrokeStyle(2, 0xffffff, 1));
    exitBg.on("pointerout", () => exitBg.setStrokeStyle(1.5, 0xe06c75, 1));
  }

  private createTutorialOverlay(width: number, height: number): void {
    this.tutorialContainer = this.add.container(0, 0).setDepth(100);

    const backdrop = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive();

    backdrop.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (this.active) {
          this.closeTutorial();
        } else if (!this.resultVisible) {
          this.beginRhythm();
        }
      },
    );

    const cardWidth = 560;
    const cardHeight = 330;
    const cardX = width / 2;
    const cardY = height / 2;

    const cardG = this.add.graphics();
    cardG.fillStyle(0x0b1b33, 0.96);
    cardG.fillRoundedRect(
      cardX - cardWidth / 2,
      cardY - cardHeight / 2,
      cardWidth,
      cardHeight,
      16,
    );
    cardG.lineStyle(3, 0xffd166, 1);
    cardG.strokeRoundedRect(
      cardX - cardWidth / 2,
      cardY - cardHeight / 2,
      cardWidth,
      cardHeight,
      16,
    );

    const title = this.add
      .text(
        cardX,
        cardY - cardHeight / 2 + 32,
        gameText(
          "🐉 HƯỚNG DẪN CHƠI CẦU RỒNG 🐉",
          "🐉 DRAGON BRIDGE TUTORIAL 🐉",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "20px",
          fontStyle: "bold",
          color: "#ffe082",
        },
      )
      .setOrigin(0.5);

    const diagY = cardY - 45;
    const diagG = this.add.graphics();
    diagG.fillStyle(0x0f2744, 1);
    diagG.fillRoundedRect(cardX - 180, diagY - 25, 360, 60, 10);
    diagG.lineStyle(1.5, 0x334155, 1);
    diagG.strokeRoundedRect(cardX - 180, diagY - 25, 360, 60, 10);

    const leftNode = this.add.circle(cardX - 100, diagY, 12, 0x243956, 1);
    leftNode.setStrokeStyle(2, 0x6c8fb0, 1);

    const targetNode = this.add.circle(cardX, diagY, 14, 0xffd166, 1);
    const targetHalo = this.add.circle(cardX, diagY, 22, 0x000000, 0);
    targetHalo.setStrokeStyle(2.5, 0xffd166, 1);

    const rightNode = this.add.circle(cardX + 100, diagY, 12, 0x243956, 1);
    rightNode.setStrokeStyle(2, 0x6c8fb0, 1);

    const diagLabel = this.add
      .text(
        cardX,
        diagY + 44,
        gameText(
          "Vòng thu nhỏ 🎯 ➔ ĐÚNG TÂM VÀNG ➔ Bấm Space / E / Chạm",
          "Shrinking ring 🎯 ➔ INSIDE SWEET SPOT ➔ Press Space / E / Tap",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "13px",
          fontStyle: "bold",
          color: "#7ef29a",
        },
      )
      .setOrigin(0.5);

    const rulesText = this.add
      .text(
        cardX,
        cardY + 38,
        gameText(
          "• Quan sát vòng năng lượng di chuyển vào tâm nhịp phát sáng.\n• Bấm Space / E hoặc Chạm màn hình đúng thời điểm.\n• Đạt 7 / 10 nhịp đúng để thắp sáng toàn bộ Cầu Rồng!",
          "• Watch energy rings shrink into glowing target sweet spot.\n• Press Space / E or Tap precisely on time.\n• Get 7 / 10 correct beats to light up Dragon Bridge!",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "14px",
          color: "#e8f7ff",
          align: "center",
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);

    const btnWidth = 260;
    const btnHeight = 42;
    const btnY = cardY + cardHeight / 2 - 38;

    const btnG = this.add.graphics();
    btnG.fillStyle(0xf59e0b, 1);
    btnG.fillRoundedRect(
      cardX - btnWidth / 2,
      btnY - btnHeight / 2,
      btnWidth,
      btnHeight,
      10,
    );
    btnG.lineStyle(2, 0xfef08a, 1);
    btnG.strokeRoundedRect(
      cardX - btnWidth / 2,
      btnY - btnHeight / 2,
      btnWidth,
      btnHeight,
      10,
    );

    const btnLabel = this.add
      .text(
        cardX,
        btnY,
        gameText("⚡ BẮT ĐẦU CHƠI (Space / E)", "⚡ START PLAYING (Space / E)"),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "15px",
          fontStyle: "bold",
          color: "#0f172a",
        },
      )
      .setOrigin(0.5);

    const startBtnZone = this.add
      .zone(cardX, btnY, btnWidth, btnHeight)
      .setInteractive({ useHandCursor: true });

    startBtnZone.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (this.active) {
          this.closeTutorial();
        } else {
          this.beginRhythm();
        }
      },
    );

    this.tutorialContainer.add([
      backdrop,
      cardG,
      title,
      diagG,
      leftNode,
      targetNode,
      targetHalo,
      rightNode,
      diagLabel,
      rulesText,
      btnG,
      btnLabel,
      startBtnZone,
    ]);

    this.tutorialContainer.setVisible(this.tutorialVisible);
  }

  private toggleTutorial(): void {
    if (this.tutorialVisible) {
      this.closeTutorial();
    } else {
      this.openTutorial();
    }
  }

  private openTutorial(): void {
    if (this.tutorialVisible || this.resolvingSuccess || this.resultVisible) {
      return;
    }

    this.tutorialVisible = true;
    this.pauseRhythmForTutorial();
    this.tutorialContainer?.setVisible(true);
  }

  private closeTutorial(): void {
    if (!this.tutorialVisible) {
      return;
    }

    this.tutorialVisible = false;
    this.tutorialContainer?.setVisible(false);
    this.resumeRhythmAfterTutorial();
  }

  private pauseRhythmForTutorial(): void {
    if (!this.active || this.rhythmPaused) {
      return;
    }

    this.rhythmPaused = true;
    this.pausedAt = this.time.now;
    if (this.beatTimer) {
      this.beatTimer.paused = true;
    }
    this.travelingRingTween?.pause();
    this.targetRingPulseTween?.pause();
  }

  private resumeRhythmAfterTutorial(): void {
    if (!this.rhythmPaused) {
      return;
    }

    const pausedDurationMs = Math.max(0, this.time.now - this.pausedAt);
    this.deadline += pausedDurationMs;
    this.rhythmPaused = false;
    if (this.beatTimer) {
      this.beatTimer.paused = false;
    }
    this.travelingRingTween?.resume();
    this.targetRingPulseTween?.resume();
    this.pausedAt = 0;
  }

  private beginRhythm(): void {
    if (this.active || this.resultVisible) {
      return;
    }

    this.active = true;
    this.closeTutorial();
    this.rhythmPaused = false;
    this.pausedAt = 0;

    this.currentBeat = 0;
    this.correctBeats = 0;
    this.incorrectBeats = 0;
    this.deadline = this.time.now + DRAGON_BRIDGE_RHYTHM.maximumDurationMs;
    this.tutorialText.setVisible(false);
    this.feedbackText
      .setText(
        gameText(
          "Bắt đầu! Chạm hoặc nhấn Space/E đúng nhịp.",
          "Start! Tap or press Space/E on the beat.",
        ),
      )
      .setColor("#ffe082");
    this.refreshHud();
    this.activateBeat();
  }

  private activateBeat(): void {
    if (!this.active || this.currentBeat >= DRAGON_BRIDGE_RHYTHM.totalBeats) {
      this.finishRhythm();
      return;
    }

    this.beatWasHandled = false;
    const currentMarker = this.beatMarkers[this.currentBeat];

    if (currentMarker) {
      this.sweetSpotRing
        .setPosition(currentMarker.x, currentMarker.y)
        .setVisible(true);

      this.targetRingPulseTween?.stop();
      this.sweetSpotRing.setScale(1);
      this.targetRingPulseTween = this.tweens.add({
        targets: this.sweetSpotRing,
        scale: { from: 1, to: 1.25 },
        duration: 350,
        yoyo: true,
        repeat: -1,
      });

      this.travelingRing
        .setPosition(currentMarker.x, currentMarker.y)
        .setScale(1)
        .setAlpha(0.95)
        .setVisible(true);

      this.travelingRingTween?.stop();
      this.travelingRingTween = this.tweens.add({
        targets: this.travelingRing,
        scale: { from: 2.2, to: 0.8 },
        duration: DRAGON_BRIDGE_RHYTHM.beatIntervalMs,
        ease: "Linear",
      });
    }

    this.beatMarkers.forEach((marker, index) => {
      if (index === this.currentBeat) {
        marker.setFillStyle(0xffd166, 1).setScale(1.28);
      } else if (index > this.currentBeat) {
        marker.setFillStyle(0x243956, 1).setScale(1);
      }
    });

    this.beatTimer?.remove(false);
    this.beatTimer = this.time.delayedCall(
      DRAGON_BRIDGE_RHYTHM.beatIntervalMs,
      () => {
        if (!this.active) {
          return;
        }

        if (!this.beatWasHandled) {
          this.incorrectBeats += 1;
          this.beatMarkers[this.currentBeat]
            ?.setFillStyle(0xad3d54, 1)
            .setScale(1);

          this.spawnFloatingText(
            currentMarker ? currentMarker.x : this.scale.width / 2,
            currentMarker ? currentMarker.y - 20 : this.scale.height / 2,
            gameText("LỠ NHỊP!", "MISSED!"),
            "#ffb3c1",
          );

          this.cameras.main.shake(120, 0.005);

          this.feedbackText
            .setText(
              gameText("Lỡ nhịp — tiếp tục nào!", "Missed it — keep going!"),
            )
            .setColor("#ffb3c1");
        }

        this.currentBeat += 1;
        this.refreshHud();
        this.activateBeat();
      },
    );
  }

  private handlePointerDown(_pointer?: Phaser.Input.Pointer): void {
    if (this.resolvingSuccess || this.tutorialVisible || this.rhythmPaused) {
      return;
    }

    if (this.resultVisible) {
      this.retryFromResult();
      return;
    }

    if (!this.active) {
      this.beginRhythm();
      return;
    }

    this.handleBeatInput();
  }

  private handleBeatInput(): void {
    if (!this.active || this.rhythmPaused || this.beatWasHandled) {
      return;
    }

    this.beatWasHandled = true;
    const marker = this.beatMarkers[this.currentBeat];
    const expectedHitEndsAt = this.beatTimer
      ? this.deadline -
        DRAGON_BRIDGE_RHYTHM.maximumDurationMs +
        this.currentBeat * DRAGON_BRIDGE_RHYTHM.beatIntervalMs +
        DRAGON_BRIDGE_RHYTHM.hitWindowMs
      : 0;

    if (this.time.now <= expectedHitEndsAt) {
      this.correctBeats += 1;
      marker?.setFillStyle(0x7ef29a, 1).setScale(1.35);

      this.lightProgressSegment();

      if (marker) {
        this.spawnHitParticles(marker.x, marker.y);
        this.spawnFloatingText(
          marker.x,
          marker.y - 22,
          gameText("✨ PERFECT!", "✨ PERFECT!"),
          "#ffe082",
        );
      }

      if (this.dragonEye) {
        this.dragonEye.setFillStyle(0xffd166, 1);
        this.time.delayedCall(300, () =>
          this.dragonEye.setFillStyle(0xff3d00, 1),
        );
      }

      this.feedbackText
        .setText(
          gameText(
            "Đúng nhịp! Đèn năng lượng Cầu Rồng bừng sáng.",
            "On beat! A Dragon Bridge light shines.",
          ),
        )
        .setColor("#a8ffbd");
    } else {
      this.incorrectBeats += 1;
      marker?.setFillStyle(0xad3d54, 1).setScale(1);
      if (marker) {
        this.spawnFloatingText(
          marker.x,
          marker.y - 22,
          gameText("CHƯA ĐÚNG!", "MISSED!"),
          "#ffb3c1",
        );
        this.tweens.add({
          targets: marker,
          x: "+=5",
          duration: 40,
          yoyo: true,
          repeat: 2,
        });
      }
      this.feedbackText
        .setText(
          gameText(
            "Chưa đúng nhịp — chờ vòng tròn tiếp theo.",
            "Not on beat — wait for the next circle.",
          ),
        )
        .setColor("#ffb3c1");
    }

    this.refreshHud();
  }

  private spawnHitParticles(x: number, y: number): void {
    const colors = [0xffe082, 0x7ef29a, 0xffb703, 0xffffff];
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2;
      const speed = 35 + Math.random() * 45;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const particle = this.add.circle(
        x,
        y,
        3 + Math.random() * 2,
        colors[i % colors.length],
        1,
      );

      this.tweens.add({
        targets: particle,
        x: x + vx,
        y: y + vy,
        alpha: 0,
        scale: 0.2,
        duration: 400,
        ease: "Cubic.out",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private spawnFloatingText(
    x: number,
    y: number,
    content: string,
    color: string,
  ): void {
    const txt = this.add
      .text(x, y, content, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "16px",
        fontStyle: "bold",
        color: color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: txt,
      y: y - 32,
      alpha: 0,
      duration: 650,
      ease: "Power1",
      onComplete: () => txt.destroy(),
    });
  }

  private lightProgressSegment(): void {
    const index = Math.min(
      this.correctBeats - 1,
      this.bridgeSegments.length - 1,
    );
    const orb = this.bridgeSegments[index];
    const frame = this.bridgeSegmentFrames[index];

    if (orb) {
      orb.setFillStyle(0xffc857, 1).setStrokeStyle(2, 0xfff0a8, 1);
      this.tweens.add({
        targets: orb,
        scale: { from: 1.6, to: 1 },
        duration: 250,
      });
    }

    if (frame) {
      frame.setStrokeStyle(2, 0xffd166, 1);
    }
  }

  private finishRhythm(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.beatTimer?.remove(false);
    this.beatTimer = null;
    this.travelingRingTween?.stop();
    this.sweetSpotRing.setVisible(false);
    this.travelingRing.setVisible(false);

    if (rhythmWasSuccessful(this.correctBeats)) {
      this.resolvingSuccess = true;
      const completed = gameSession.completeQuest(DRAGON_BRIDGE_QUEST_ID);
      if (completed) {
        bridge.emitGameToUi({
          type: "QUEST_UPDATED",
          questId: DRAGON_BRIDGE_QUEST_ID,
          state: completed.current,
        });
      }

      this.playBridgeCelebration();
      this.feedbackText
        .setText(
          gameText(
            "Cầu Rồng bừng sáng! Đang nhận Mảnh Ký Ức...",
            "Dragon Bridge shines! Receiving a Memory Fragment...",
          ),
        )
        .setColor("#ffe082");
      this.time.delayedCall(850, () => {
        const rewarded = gameSession.rewardDragonBridge();
        if (rewarded) {
          bridge.emitGameToUi({
            type: "QUEST_UPDATED",
            questId: DRAGON_BRIDGE_QUEST_ID,
            state: rewarded.current,
          });
          bridge.emitGameToUi({
            type: "POSTCARD_UNLOCKED",
            placeKey: "dragon_bridge",
          });
        }
        this.scene.start("OverworldScene");
      });
      return;
    }

    const retried = gameSession.retryQuest(DRAGON_BRIDGE_QUEST_ID);
    if (retried) {
      bridge.emitGameToUi({
        type: "QUEST_UPDATED",
        questId: DRAGON_BRIDGE_QUEST_ID,
        state: retried.current,
      });
    }
    this.showFailureResult();
  }

  private showFailureResult(): void {
    const { width, height } = this.scale;
    this.resultVisible = true;
    this.resultReadyAt = this.time.now + 250;

    this.add
      .rectangle(width / 2, height / 2, width - 48, 140, 0x101b2e, 0.96)
      .setStrokeStyle(2, 0xffa3b5, 1);

    this.add
      .text(
        width / 2,
        height / 2,
        gameText(
          `Chưa đủ nhịp (${this.correctBeats} / ${DRAGON_BRIDGE_RHYTHM.totalBeats}).\nHãy thử lại — cần ${requiredRhythmScore()} nhịp đúng.\n\nNhấn E / Space / Enter hoặc chạm để thử lại.`,
          `Not enough beats (${this.correctBeats} / ${DRAGON_BRIDGE_RHYTHM.totalBeats}).\nTry again — you need ${requiredRhythmScore()} correct beats.\n\nPress E / Space / Enter or tap to retry.`,
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "16px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: width - 80 },
        },
      )
      .setOrigin(0.5);
  }

  private playBridgeCelebration(): void {
    this.bridgeSegments.forEach((orb) => {
      orb.setFillStyle(0xffc857, 1).setStrokeStyle(2, 0xfff0a8, 1);
    });

    const headX = this.scale.width - 60;
    const headY = this.scale.height / 2 - 12;

    const flameColors = [0xff4500, 0xfb8500, 0xffb703, 0xffd166, 0xffffff];
    for (let i = 0; i < 24; i += 1) {
      const angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.8;
      const speed = 60 + Math.random() * 80;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const p = this.add.circle(
        headX,
        headY,
        4 + Math.random() * 4,
        flameColors[i % flameColors.length],
        1,
      );

      this.tweens.add({
        targets: p,
        x: headX + vx,
        y: headY + vy,
        alpha: 0,
        scale: 0.1,
        duration: 600 + Math.random() * 300,
        ease: "Quad.out",
        onComplete: () => p.destroy(),
      });
    }

    this.waterWaves.forEach((waveG) => {
      this.tweens.add({
        targets: waveG,
        alpha: 1,
        y: "+=4",
        duration: 300,
        yoyo: true,
        repeat: 2,
      });
    });

    const bannerText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2 - 45,
        "🔥 ✨ CẦU RỒNG ĐÃ BỪNG SÁNG! ✨ 🔥",
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "24px",
          fontStyle: "bold",
          color: "#ffe082",
          stroke: "#000000",
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5)
      .setScale(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: bannerText,
      scale: 1.1,
      alpha: 1,
      duration: 400,
      ease: "Back.out",
      onComplete: () => {
        this.tweens.add({
          targets: bannerText,
          alpha: 0,
          y: bannerText.y - 20,
          duration: 400,
          delay: 400,
          onComplete: () => bannerText.destroy(),
        });
      },
    });
  }

  private retryFromResult(): void {
    if (!this.resultVisible || this.time.now < this.resultReadyAt) {
      return;
    }

    const started = gameSession.startQuest(DRAGON_BRIDGE_QUEST_ID);
    if (started) {
      bridge.emitGameToUi({
        type: "QUEST_UPDATED",
        questId: DRAGON_BRIDGE_QUEST_ID,
        state: started.current,
      });
      this.scene.restart();
      return;
    }

    this.scene.start("OverworldScene");
  }

  private leaveQuest(): void {
    if (this.resolvingSuccess) {
      return;
    }

    const currentStatus = gameSession.getState().quests[DRAGON_BRIDGE_QUEST_ID];
    if (this.active || currentStatus === "ACTIVE") {
      const retried = gameSession.retryQuest(DRAGON_BRIDGE_QUEST_ID);
      if (retried) {
        bridge.emitGameToUi({
          type: "QUEST_UPDATED",
          questId: DRAGON_BRIDGE_QUEST_ID,
          state: retried.current,
        });
      }
    }
    this.scene.start("OverworldScene");
  }

  private refreshHud(): void {
    this.scoreText.setText(
      gameText(
        `Nhịp đúng: ${this.correctBeats} / ${DRAGON_BRIDGE_RHYTHM.totalBeats}`,
        `Correct beats: ${this.correctBeats} / ${DRAGON_BRIDGE_RHYTHM.totalBeats}`,
      ),
    );
    this.timerText.setText(
      this.active
        ? gameText(
            `Tối đa: ${remainingRhythmSeconds(this.deadline, this.time.now)} giây`,
            `Time: ${remainingRhythmSeconds(this.deadline, this.time.now)}s`,
          )
        : gameText("Tối đa: 90 giây", "Time: 90s"),
    );
  }

  private cleanUp(): void {
    this.beatTimer?.remove(false);
    this.travelingRingTween?.stop();
    this.targetRingPulseTween?.stop();
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.input.keyboard?.removeAllKeys();
  }
}
