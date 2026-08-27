import Phaser from "phaser";
import { bridge } from "../../app/PhaserBridge";
import {
  SON_TRA_TRACE_IDS,
  ATTEMPT_DURATION_MS,
  createSonTraObservationState,
  observeTrace,
  remainingTraces,
  type SonTraTraceId,
} from "../son-tra";
import { gameSession } from "../state/GameStateStore";
import { gameText } from "../locale";

const QUEST_ID = "son_tra_traces";
const PLACE_KEY = "son_tra_peninsula";
export { ATTEMPT_DURATION_MS };

const GAME_FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif";

type TraceView = {
  id: SonTraTraceId;
  label: string;
  description: string;
  x: number;
  y: number;
  container: Phaser.GameObjects.Container;
  labelText: Phaser.GameObjects.Text;
};

/**
 * Observation mini-game: the player discovers signs, never an animal itself.
 * Quest transition/reward remains in the shared deterministic GameSession.
 */
export class SonTraWildlifeScene extends Phaser.Scene {
  private traceViews: TraceView[] = [];
  private selectedIndex = 0;
  private tutorialVisible = true;
  private attemptStarted = false;
  private attemptPaused = false;
  private pausedDeadlineRemainingMs = 0;
  private resolving = false;
  private failed = false;
  private deadline = 0;
  private state = createSonTraObservationState();
  private counterText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private notebookPanel!: Phaser.GameObjects.Container;
  private notebookText!: Phaser.GameObjects.Text;
  private tutorialOverlay?: Phaser.GameObjects.Container;
  private cameraReticle!: Phaser.GameObjects.Container;
  private shutterFlash!: Phaser.GameObjects.Rectangle;
  private resultPanel?: Phaser.GameObjects.Container;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;
  private restartKey?: Phaser.Input.Keyboard.Key;
  private sunbeamTween?: Phaser.Tweens.Tween;

  public constructor() {
    super({ key: "SonTraWildlifeScene" });
  }

  public create(): void {
    this.resetAttemptState();
    this.ensureQuestActive();
    this.drawForest();
    this.createTraces();
    this.createCameraViewfinder();
    this.createHud();
    this.createInput();
    this.input.on("pointerdown", this.handleCanvasPointer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.refreshHud();
    this.showTutorialOverlay();
  }

  public update(): void {
    if (this.resolving) return;
    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      if (this.tutorialVisible) {
        this.closeTutorialOverlay();
      } else {
        this.leaveQuest();
      }
      return;
    }
    if (this.tutorialVisible) {
      if (this.isInteractPressed()) this.beginObservation();
      return;
    }
    if (!this.attemptStarted) {
      if (this.isInteractPressed()) this.beginObservation();
      return;
    }
    if (this.failed) {
      if (
        this.isInteractPressed() ||
        (this.restartKey && Phaser.Input.Keyboard.JustDown(this.restartKey))
      )
        this.restartAttempt();
      return;
    }

    if (
      this.cursors &&
      (Phaser.Input.Keyboard.JustDown(this.cursors.left) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.up))
    ) {
      this.moveSelection(-1);
    }
    if (
      this.cursors &&
      (Phaser.Input.Keyboard.JustDown(this.cursors.right) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.down))
    ) {
      this.moveSelection(1);
    }
    if (this.isInteractPressed())
      this.inspect(this.traceViews[this.selectedIndex]?.id ?? "");

    if (this.time.now >= this.deadline) {
      this.failAttempt();
      return;
    }
    const remainingSec = Math.max(
      0,
      Math.ceil((this.deadline - this.time.now) / 1000),
    );
    this.timerText.setText(
      gameText(`⏱️ Còn ${remainingSec}s`, `⏱️ ${remainingSec}s left`),
    );
    if (remainingSec <= 15) {
      this.timerText.setColor("#ffeb3b");
    } else {
      this.timerText.setColor("#d9f8ff");
    }
  }

  private resetAttemptState(): void {
    this.sunbeamTween?.stop();
    this.traceViews = [];
    this.selectedIndex = 0;
    this.tutorialVisible = true;
    this.attemptStarted = false;
    this.attemptPaused = false;
    this.pausedDeadlineRemainingMs = 0;
    this.resolving = false;
    this.failed = false;
    this.deadline = 0;
    this.state = createSonTraObservationState();
    this.resultPanel = undefined;
    this.tutorialOverlay = undefined;
  }

  private ensureQuestActive(): void {
    const status = gameSession.getState().quests[QUEST_ID];
    if (status === "AVAILABLE") {
      const started = gameSession.startQuest(QUEST_ID);
      if (started)
        bridge.emitGameToUi({
          type: "QUEST_UPDATED",
          questId: QUEST_ID,
          state: started.current,
        });
    }
  }

  private drawForest(): void {
    const { width, height } = this.scale;

    // Deep Jungle Emerald Backdrop
    this.cameras.main.setBackgroundColor("#08221b");
    const bgG = this.add.graphics();
    bgG.fillStyle(0x0f3b30, 1);
    bgG.fillRect(0, 0, width, height);

    // Rainforest dirt ground trail at bottom
    const groundG = this.add.graphics();
    groundG.fillStyle(0x4a3d24, 0.95);
    groundG.fillRect(0, height - 60, width, 60);

    // Fallen leaves and moss texture on trail
    groundG.fillStyle(0x355a30, 0.7);
    for (let x = 20; x < width; x += 40) {
      groundG.fillCircle(x, height - 30 + ((x * 3) % 20), 8);
    }

    // Rainforest Canopy Layers
    for (let x = 20; x < width + 60; x += 65) {
      const canopyY = 50 + ((x * 11) % 40);
      const canopyG = this.add.graphics();

      // Outer dark foliage
      canopyG.fillStyle(0x0a2820, 1);
      canopyG.fillCircle(x, canopyY, 48);

      // Inner vibrant green leaves
      canopyG.fillStyle(0x19523e, 0.9);
      canopyG.fillCircle(x + 12, canopyY + 12, 34);

      // Bright leaf highlights
      canopyG.fillStyle(0x317c5d, 0.7);
      canopyG.fillCircle(x - 10, canopyY - 10, 18);
    }

    // Ambient Sunbeams radiating through canopy
    const sunbeamG = this.add.graphics().setDepth(2);
    sunbeamG.fillStyle(0xffea79, 0.12);

    const beamCoords = [
      { x1: 60, y1: 0, x2: 120, y2: height },
      { x1: 220, y1: 0, x2: 300, y2: height },
      { x1: 420, y1: 0, x2: 500, y2: height },
      { x1: 580, y1: 0, x2: 640, y2: height },
    ];

    beamCoords.forEach((b) => {
      sunbeamG.beginPath();
      sunbeamG.moveTo(b.x1 - 20, b.y1);
      sunbeamG.lineTo(b.x1 + 40, b.y1);
      sunbeamG.lineTo(b.x2 + 50, b.y2);
      sunbeamG.lineTo(b.x2 - 30, b.y2);
      sunbeamG.closePath();
      sunbeamG.fillPath();
    });

    this.sunbeamTween = this.tweens.add({
      targets: sunbeamG,
      alpha: { from: 0.12, to: 0.22 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Side Tree Trunks & Framing Vines
    const frameG = this.add.graphics().setDepth(3);
    frameG.fillStyle(0x2d1f14, 0.95);
    frameG.fillRect(0, 0, 24, height);
    frameG.fillRect(width - 24, 0, 24, height);

    // Title banner
    this.add
      .text(
        width / 2,
        22,
        gameText("DẤU VẾT SƠN TRÀ", "SON TRA WILDLIFE TRACES"),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "20px",
          fontStyle: "bold",
          color: "#fff1b0",
          shadow: {
            offsetX: 1,
            offsetY: 2,
            color: "#061814",
            blur: 3,
            fill: true,
          },
        },
      )
      .setOrigin(0.5)
      .setDepth(20);

    this.add
      .text(
        width / 2,
        48,
        gameText(
          "Quan sát dấu vết từ xa · Tôn trọng & bảo vệ động vật hoang dã",
          "Observe wildlife traces from afar · Respect & protect nature",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "11px",
          color: "#c2f0d9",
        },
      )
      .setOrigin(0.5)
      .setDepth(20);
  }

  private createTraces(): void {
    const definitions: Array<{
      id: SonTraTraceId;
      label: string;
      description: string;
      x: number;
      y: number;
    }> = [
      {
        id: "canopy",
        label: gameText("Tán cây rung", "Moving canopy"),
        description: gameText(
          "Tán cây rung nhẹ: Chà vá chân nâu đang chuyền cành",
          "Canopy rustle: Red-shanked Douc langurs leaping between branches",
        ),
        x: 148,
        y: 134,
      },
      {
        id: "footprint",
        label: gameText("Dấu chân", "Footprint"),
        description: gameText(
          "Dấu chân linh trưởng trên lối mòn gần suối",
          "Primate footprint on wet trail near water stream",
        ),
        x: 334,
        y: 244,
      },
      {
        id: "fruit",
        label: gameText("Quả rơi", "Fallen fruit"),
        description: gameText(
          "Quả sung rừng tươi mới rụng dưới gốc cây",
          "Fresh forest figs and fruit fallen under wild fig tree",
        ),
        x: 518,
        y: 162,
      },
    ];

    this.traceViews = definitions.map((definition) => {
      const container = this.add
        .container(definition.x, definition.y)
        .setDepth(10);

      // Outer glowing target aura
      const aura = this.add.circle(0, 0, 26, 0x9ed86b, 0.35);
      aura.setStrokeStyle(2, 0xf4ffbd, 0.85);

      // Custom Vector Icon Graphics
      const g = this.add.graphics();
      this.drawVectorTraceIcon(g, definition.id);

      // Interactive hit area
      const hitArea = this.add
        .circle(0, 0, 28, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => this.inspect(definition.id));

      container.add([aura, g, hitArea]);

      // Label badge below
      const labelText = this.add
        .text(definition.x, definition.y + 36, definition.label, {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "12px",
          fontStyle: "bold",
          color: "#f6ffe6",
          backgroundColor: "#0a221cb8",
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(11);

      // Subtle breathing tween
      this.tweens.add({
        targets: aura,
        scale: 1.15,
        alpha: 0.55,
        duration: 1100 + Math.random() * 300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      return {
        ...definition,
        container,
        labelText,
      };
    });

    this.renderSelection();
  }

  private drawVectorTraceIcon(
    g: Phaser.GameObjects.Graphics,
    traceId: SonTraTraceId,
  ): void {
    g.clear();
    switch (traceId) {
      case "canopy": {
        // Canopy Foliage Rustle Icon (Shaking Leaves + Wind Swirl)
        g.fillStyle(0x2e7d32, 1);
        g.fillCircle(-4, -2, 10);
        g.fillCircle(6, 2, 8);
        g.fillCircle(2, -8, 9);

        // Bright green leaf highlights
        g.fillStyle(0x66bb6a, 1);
        g.fillCircle(-2, -4, 5);
        g.fillCircle(4, 0, 4);

        // Wind swirl arcs
        g.lineStyle(1.5, 0xffeb3b, 0.9);
        g.beginPath();
        g.arc(0, 0, 16, Phaser.Math.DegToRad(45), Phaser.Math.DegToRad(180));
        g.strokePath();
        g.beginPath();
        g.arc(-2, -2, 20, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(320));
        g.strokePath();
        break;
      }
      case "footprint": {
        // Primate Animal Footprint Icon on Dirt Mound
        g.fillStyle(0x5d4037, 0.9);
        g.fillEllipse(0, 0, 24, 16);

        // Main palm pad
        g.fillStyle(0x3e2723, 1);
        g.fillEllipse(0, 3, 10, 7);

        // 4 Toe pads
        g.fillCircle(-8, -4, 3);
        g.fillCircle(-3, -7, 3);
        g.fillCircle(3, -7, 3);
        g.fillCircle(8, -4, 3);
        break;
      }
      case "fruit": {
        // Wild Forest Fruit Cluster Icon
        g.fillStyle(0xd81b60, 1);
        g.fillCircle(-5, 2, 7);
        g.fillCircle(5, 2, 7);
        g.fillCircle(0, -5, 7);

        // Fruit highlights
        g.fillStyle(0xff4081, 1);
        g.fillCircle(-6, 0, 3);
        g.fillCircle(4, 0, 3);
        g.fillCircle(-1, -7, 3);

        // Green Stem & Leaf
        g.lineStyle(2, 0x4caf50, 1);
        g.lineBetween(0, -8, 0, -14);
        g.fillStyle(0x81c784, 1);
        g.fillEllipse(4, -13, 8, 4);
        break;
      }
    }
  }

  private createCameraViewfinder(): void {
    const { width, height } = this.scale;

    // Darkened Vignette Overlay Frame
    const vignette = this.add.graphics().setDepth(20);
    vignette.fillStyle(0x000000, 0.35);
    vignette.fillRect(0, 0, width, 24);
    vignette.fillRect(0, height - 30, width, 30);

    // Camera Reticle Container
    this.cameraReticle = this.add.container(0, 0).setDepth(22);
    const reticleG = this.add.graphics();
    reticleG.lineStyle(2, 0xffea79, 0.9);

    // Reticle Corner Brackets
    const size = 26;
    // Top-Left
    reticleG.lineBetween(-size, -size, -size + 10, -size);
    reticleG.lineBetween(-size, -size, -size, -size + 10);
    // Top-Right
    reticleG.lineBetween(size, -size, size - 10, -size);
    reticleG.lineBetween(size, -size, size, -size + 10);
    // Bottom-Left
    reticleG.lineBetween(-size, size, -size + 10, size);
    reticleG.lineBetween(-size, size, -size, size - 10);
    // Bottom-Right
    reticleG.lineBetween(size, size, size - 10, size);
    reticleG.lineBetween(size, size, size, size - 10);

    // Central crosshair dot
    reticleG.strokeCircle(0, 0, 4);

    // Camera viewfinder text indicator
    const camText = this.add
      .text(0, size + 10, gameText("📷 ỐNG KÍNH CAM", "📷 VIEW FINDER"), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffea79",
        backgroundColor: "#000000b3",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);

    this.cameraReticle.add([reticleG, camText]);

    // Full screen shutter flash white rect
    this.shutterFlash = this.add
      .rectangle(width / 2, height / 2, width, height, 0xffffff, 0)
      .setDepth(45);

    // Camera HUD info at top right (REC indicator)
    const recText = this.add
      .text(width - 120, 22, "● REC  ISO 400", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ff5252",
      })
      .setDepth(21);

    this.tweens.add({
      targets: recText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  private createHud(): void {
    const { width, height } = this.scale;

    // Ranger Field Notebook Header Card
    this.add
      .rectangle(16, 78, 140, 30, 0x0a221c, 0.9)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1.5, 0x4caf50, 1)
      .setDepth(30);

    this.counterText = this.add
      .text(26, 78, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5)
      .setDepth(31);

    this.add
      .rectangle(width - 16, 78, 130, 30, 0x0a221c, 0.9)
      .setOrigin(1, 0.5)
      .setStrokeStyle(1.5, 0x4caf50, 1)
      .setDepth(30);

    this.timerText = this.add
      .text(width - 26, 78, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#d9f8ff",
      })
      .setOrigin(1, 0.5)
      .setDepth(31);

    // Action buttons top header
    this.createHeaderButtons(width);

    // Ranger Field Notebook Journal Panel at bottom
    this.notebookPanel = this.add
      .container(width / 2, height - 26)
      .setDepth(30);
    const nbBg = this.add
      .rectangle(0, 0, width - 40, 34, 0x0a221c, 0.94)
      .setStrokeStyle(1.5, 0xffea79, 0.9);

    this.notebookText = this.add
      .text(0, 0, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "12px",
        fontStyle: "bold",
        color: "#e8f7d5",
        align: "center",
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5);

    this.notebookPanel.add([nbBg, this.notebookText]);
  }

  private createHeaderButtons(width: number): void {
    // "How to Play" button top left
    const infoBtn = this.add.container(60, 22).setDepth(35);
    const infoBg = this.add
      .rectangle(0, 0, 84, 26, 0x0a2a22, 0.9)
      .setStrokeStyle(1, 0x4caf50, 1)
      .setInteractive({ useHandCursor: true });
    const infoLabel = this.add
      .text(0, 0, gameText("ℹ️ Hướng Dẫn", "ℹ️ Tutorial"), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "11px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    infoBtn.add([infoBg, infoLabel]);
    infoBg.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.toggleTutorialOverlay();
      },
    );
    infoBg.on("pointerover", () => infoBg.setStrokeStyle(1.5, 0xffffff, 1));
    infoBg.on("pointerout", () => infoBg.setStrokeStyle(1, 0x4caf50, 1));

    // "Back to Map" button top right
    const backBtn = this.add.container(width - 60, 22).setDepth(35);
    const backBg = this.add
      .rectangle(0, 0, 88, 26, 0x0a2a22, 0.9)
      .setStrokeStyle(1, 0x4caf50, 1)
      .setInteractive({ useHandCursor: true });
    const backLabel = this.add
      .text(0, 0, gameText("🚪 Bản Đồ", "🚪 Map"), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "11px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    backBtn.add([backBg, backLabel]);
    backBg.on(
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
    backBg.on("pointerover", () => backBg.setStrokeStyle(1.5, 0xffffff, 1));
    backBg.on("pointerout", () => backBg.setStrokeStyle(1, 0x4caf50, 1));
  }

  private showTutorialOverlay(): void {
    if (this.resolving || this.failed) {
      return;
    }

    this.tutorialVisible = true;
    this.pauseAttemptForTutorial();
    const { width, height } = this.scale;
    this.tutorialOverlay?.destroy();

    const container = this.add.container(0, 0).setDepth(50);
    const backdrop = this.add
      .rectangle(width / 2, height / 2, width, height, 0x051612, 0.84)
      .setInteractive();

    const card = this.add
      .rectangle(width / 2, height / 2, width - 80, 240, 0x0a2820, 0.96)
      .setStrokeStyle(2, 0xffea79, 1);

    const title = this.add
      .text(
        width / 2,
        height / 2 - 90,
        gameText(
          "📷 SỔ TAY RANGER: DẤU VẾT SƠN TRÀ",
          "📷 RANGER FIELD GUIDE: SON TRA TRACES",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
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
          "1. Di chuyển ống kính camera bằng phím mũi tên ← → hoặc chạm trực tiếp vào dấu vết.\n2. Nhấn E / Space để chụp ảnh ghi nhận 3 dấu vết thiên nhiên (Tán cây rung, Dấu chân, Quả rơi).\n3. Tôn trọng thiên nhiên: Quan sát từ xa, không gây tiếng ồn, không đuổi theo động vật!\n\nNhấn E / Space hoặc nút bên dưới để bắt đầu.",
          "1. Aim camera view reticle with Arrow keys ← → or Tap directly on a trace.\n2. Press E / Space to photograph 3 nature traces (Canopy rustle, Footprint, Fallen fruit).\n3. Respect wildlife: Observe from afar, keep quiet, do not chase or feed animals!\n\nPress E / Space or button below to begin.",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "13px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: width - 120 },
        },
      )
      .setOrigin(0.5);

    const startBtn = this.add.container(width / 2, height / 2 + 80);
    const btnBg = this.add
      .rectangle(0, 0, 170, 34, 0x2e7d32, 1)
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add
      .text(0, 0, gameText("BẮT ĐẦU TUẦN TRA", "START RANGER PATROL"), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    startBtn.add([btnBg, btnText]);

    btnBg.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.beginObservation();
      },
    );

    container.add([backdrop, card, title, body, startBtn]);
    this.tutorialOverlay = container;
  }

  private toggleTutorialOverlay(): void {
    if (this.tutorialVisible) {
      this.closeTutorialOverlay();
    } else {
      this.showTutorialOverlay();
    }
  }

  private closeTutorialOverlay(): void {
    this.tutorialOverlay?.destroy();
    this.tutorialOverlay = undefined;
    this.tutorialVisible = false;
    this.resumeAttemptAfterTutorial();
  }

  private pauseAttemptForTutorial(): void {
    if (
      !this.attemptStarted ||
      this.attemptPaused ||
      this.deadline <= 0 ||
      this.failed ||
      this.resolving
    ) {
      return;
    }

    this.attemptPaused = true;
    this.pausedDeadlineRemainingMs = Math.max(0, this.deadline - this.time.now);
  }

  private resumeAttemptAfterTutorial(): void {
    if (!this.attemptPaused) {
      return;
    }

    this.deadline = this.time.now + this.pausedDeadlineRemainingMs;
    this.attemptPaused = false;
    this.pausedDeadlineRemainingMs = 0;
  }

  private createInput(): void {
    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.interactKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.E,
    );
    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    this.escapeKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
    this.restartKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.R,
    );
  }

  private handleCanvasPointer(): void {
    if (this.tutorialVisible) {
      return;
    }
    if (this.failed) this.restartAttempt();
  }

  private isInteractPressed(): boolean {
    return Boolean(
      (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) ||
      (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)),
    );
  }

  private beginObservation(): void {
    if (this.failed || this.resolving) return;
    if (this.attemptStarted) {
      if (this.tutorialVisible) this.closeTutorialOverlay();
      return;
    }

    this.closeTutorialOverlay();
    this.attemptStarted = true;
    this.deadline = this.time.now + ATTEMPT_DURATION_MS;
    this.notebookText
      .setText(
        gameText(
          "Quan sát kỹ từng dấu vết. Đừng làm phiền động vật hoang dã.",
          "Observe each trace carefully. Do not disturb wildlife.",
        ),
      )
      .setColor("#e8f7d5");
    this.refreshHud();
  }

  private moveSelection(offset: number): void {
    this.selectedIndex =
      (this.selectedIndex + offset + this.traceViews.length) %
      this.traceViews.length;
    this.renderSelection();
  }

  private renderSelection(): void {
    this.traceViews.forEach((trace, index) => {
      const found = this.state.found.includes(trace.id);
      const isSelected = index === this.selectedIndex;

      trace.container.setScale(isSelected ? 1.2 : 1);
      trace.labelText.setAlpha(found ? 0.6 : 1);

      if (isSelected) {
        // Move camera reticle to target trace position smoothly
        this.tweens.add({
          targets: this.cameraReticle,
          x: trace.x,
          y: trace.y,
          duration: 180,
          ease: "Quad.easeOut",
        });
      }
    });
  }

  private inspect(traceId: string): void {
    if (
      !this.attemptStarted ||
      this.tutorialVisible ||
      this.failed ||
      this.resolving
    )
      return;

    // Trigger Screen Shutter Flash Effect
    this.triggerShutterFlash();

    const result = observeTrace(this.state, traceId);
    this.state = result.state;
    if (result.kind === "INVALID") {
      this.notebookText
        .setText(
          gameText(
            "Dấu hiệu này không thuộc thử thách. Hãy quan sát lại.",
            "This sign is not part of the challenge. Observe again.",
          ),
        )
        .setColor("#ffdb9b");
      return;
    }
    if (result.kind === "DUPLICATE") {
      this.notebookText
        .setText(
          gameText(
            "Dấu vết này đã được ghi nhận vào Sổ tay. Hãy tìm dấu hiệu khác.",
            "This trace is already recorded in your notebook. Find another sign.",
          ),
        )
        .setColor("#ffdb9b");
      return;
    }

    const trace = this.traceViews.find((entry) => entry.id === traceId);
    this.notebookText
      .setText(
        gameText(
          `📷 ${trace?.description ?? "Đã ghi nhận dấu vết"}! Còn ${remainingTraces(this.state)} dấu vết.`,
          `📷 ${trace?.description ?? "Trace recorded"}! ${remainingTraces(this.state)} traces left.`,
        ),
      )
      .setColor("#b9f5b3");

    this.renderSelection();
    this.refreshHud();
    if (result.kind === "COMPLETE") this.completeObservation();
  }

  private triggerShutterFlash(): void {
    // Camera Shutter Flash Effect
    this.shutterFlash.setAlpha(0.9);
    this.tweens.add({
      targets: this.shutterFlash,
      alpha: { from: 0.9, to: 0 },
      duration: 220,
      ease: "Cubic.easeOut",
    });

    // Camera Photo Captured Floating Badge
    const snapBadge = this.add
      .text(
        this.cameraReticle.x,
        this.cameraReticle.y - 45,
        "📸 PHOTO CAPTURED!",
        {
          fontFamily: "monospace",
          fontSize: "13px",
          fontStyle: "bold",
          color: "#76ff03",
          backgroundColor: "#000000d9",
          padding: { x: 6, y: 3 },
        },
      )
      .setOrigin(0.5)
      .setDepth(40);

    this.tweens.add({
      targets: snapBadge,
      y: snapBadge.y - 25,
      alpha: { from: 1, to: 0 },
      duration: 700,
      onComplete: () => snapBadge.destroy(),
    });
  }

  private completeObservation(): void {
    this.resolving = true;
    this.notebookText
      .setText(
        gameText(
          "Ghi nhận hoàn tất! Sơn Trà và Chà vá chân nâu cần sự tôn trọng và bảo vệ.",
          "Observation complete! Son Tra & Douc langurs deserve respect and protection.",
        ),
      )
      .setColor("#fff1a8");

    this.time.delayedCall(650, () => {
      const completed = gameSession.completeQuest(QUEST_ID);
      if (completed)
        bridge.emitGameToUi({
          type: "QUEST_UPDATED",
          questId: QUEST_ID,
          state: completed.current,
        });
      const rewarded = gameSession.rewardQuest(QUEST_ID);
      if (rewarded) {
        bridge.emitGameToUi({
          type: "QUEST_UPDATED",
          questId: QUEST_ID,
          state: rewarded.current,
        });
        bridge.emitGameToUi({ type: "POSTCARD_UNLOCKED", placeKey: PLACE_KEY });
      }
      this.scene.start("OverworldScene");
    });
  }

  private failAttempt(): void {
    if (this.failed || this.resolving) return;
    this.failed = true;
    const retried = gameSession.retryQuest(QUEST_ID);
    if (retried)
      bridge.emitGameToUi({
        type: "QUEST_UPDATED",
        questId: QUEST_ID,
        state: retried.current,
      });
    const panel = this.add
      .container(this.scale.width / 2, this.scale.height / 2)
      .setDepth(32);
    const box = this.add
      .rectangle(0, 0, this.scale.width - 70, 138, 0x0a2820, 0.98)
      .setStrokeStyle(2, 0xffd166, 1);
    const text = this.add
      .text(
        0,
        0,
        gameText(
          "Thời gian quan sát đã hết.\nHãy thử lại, chậm rãi và tôn trọng không gian sống của động vật.\n\nNhấn E / Space / R hoặc chạm để thử lại.",
          "Observation time is up.\nTry again slowly and respect the animals' habitat.\n\nPress E / Space / R or tap to retry.",
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "15px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: this.scale.width - 110 },
        },
      )
      .setOrigin(0.5);
    panel.add([box, text]);
    this.resultPanel = panel;
  }

  private restartAttempt(): void {
    if (!this.failed) return;
    const started = gameSession.startQuest(QUEST_ID);
    if (started)
      bridge.emitGameToUi({
        type: "QUEST_UPDATED",
        questId: QUEST_ID,
        state: started.current,
      });
    this.scene.restart();
  }

  private leaveQuest(): void {
    if (this.resolving) return;
    if (gameSession.getState().quests[QUEST_ID] === "ACTIVE") {
      const retried = gameSession.retryQuest(QUEST_ID);
      if (retried)
        bridge.emitGameToUi({
          type: "QUEST_UPDATED",
          questId: QUEST_ID,
          state: retried.current,
        });
    }
    this.scene.start("OverworldScene");
  }

  private refreshHud(): void {
    this.counterText.setText(
      gameText(
        `📷 Dấu vết: ${this.state.found.length} / ${SON_TRA_TRACE_IDS.length}`,
        `📷 Traces: ${this.state.found.length} / ${SON_TRA_TRACE_IDS.length}`,
      ),
    );
    if (this.tutorialVisible)
      this.timerText.setText(
        gameText("⏱️ Quan sát an toàn", "⏱️ Safe observation"),
      );
  }

  private cleanUp(): void {
    this.sunbeamTween?.stop();
    this.input.off("pointerdown", this.handleCanvasPointer, this);
    this.tutorialOverlay?.destroy();
    this.tutorialOverlay = undefined;
    this.resultPanel?.destroy();
  }
}
