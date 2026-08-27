import Phaser from "phaser";
import { bridge } from "../../app/PhaserBridge";
import {
  MARBLE_ELEMENT_LABELS,
  MARBLE_ELEMENT_ORDER,
  MARBLE_POSTCARD_KEY,
  MARBLE_QUEST_ID,
  MAX_MARBLE_HINTS,
  createMarblePuzzleState,
  getExpectedMarbleElement,
  reduceMarblePuzzle,
  type MarbleElementId,
  type MarblePuzzleState,
} from "../marble-puzzle";
import { gameSession } from "../state/GameStateStore";
import { gameText } from "../locale";
import type { QuestStatus } from "../../../shared/types";

const GAME_FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif";

type MovementKeys = {
  up: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

type SceneButton = {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

type TutorialKind = "entry" | "help";

type ElementVisualData = {
  id: MarbleElementId;
  labelVi: string;
  labelEn: string;
  mountainVi: string;
  mountainEn: string;
  symbol: string;
  color: number;
  glowColor: number;
};

const ELEMENT_VISUALS: Record<MarbleElementId, ElementVisualData> = {
  kim: {
    id: "kim",
    labelVi: "Kim",
    labelEn: "Metal",
    mountainVi: "Kim Sơn",
    mountainEn: "Metal Peak",
    symbol: "⚔️",
    color: 0xf4c430,
    glowColor: 0xffea79,
  },
  moc: {
    id: "moc",
    labelVi: "Mộc",
    labelEn: "Wood",
    mountainVi: "Mộc Sơn",
    mountainEn: "Wood Peak",
    symbol: "🍃",
    color: 0x2ecc71,
    glowColor: 0x76ec9b,
  },
  thuy: {
    id: "thuy",
    labelVi: "Thủy",
    labelEn: "Water",
    mountainVi: "Thủy Sơn",
    mountainEn: "Water Peak",
    symbol: "💧",
    color: 0x3498db,
    glowColor: 0x7eccff,
  },
  hoa: {
    id: "hoa",
    labelVi: "Hỏa",
    labelEn: "Fire",
    mountainVi: "Hỏa Sơn",
    mountainEn: "Fire Peak",
    symbol: "🔥",
    color: 0xe74c3c,
    glowColor: 0xff7b6e,
  },
  tho: {
    id: "tho",
    labelVi: "Thổ",
    labelEn: "Earth",
    mountainVi: "Thổ Sơn",
    mountainEn: "Earth Peak",
    symbol: "⛰️",
    color: 0xb8860b,
    glowColor: 0xe8bd52,
  },
};

/**
 * A self-contained, deterministic Five Elements puzzle. Its only stateful
 * side effects are the generic quest transitions in GameSession; no model or
 * generated response can alter the expected order or its reward.
 */
export class MarbleMountainsPuzzleScene extends Phaser.Scene {
  private readonly elementNodes = new Map<
    MarbleElementId,
    Phaser.GameObjects.Arc
  >();
  private readonly elementPositions = new Map<
    MarbleElementId,
    Phaser.Math.Vector2
  >();
  private puzzle: MarblePuzzleState = createMarblePuzzleState();
  private connectionGraphics!: Phaser.GameObjects.Graphics;
  private feedbackText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private startButton!: SceneButton;
  private hintButton!: SceneButton;
  private retryButton!: SceneButton;
  private backButton!: SceneButton;
  private infoButton!: SceneButton;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private movementKeys?: MovementKeys;
  private digitKeys: Phaser.Input.Keyboard.Key[] = [];
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private hintKey?: Phaser.Input.Keyboard.Key;
  private retryKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;
  private focusedElementIndex = 0;
  private resolvingSuccess = false;
  private feedbackOverride: string | null = null;
  private returnTimer: Phaser.Time.TimerEvent | null = null;
  private tutorialVisible = true;
  private tutorialKind: TutorialKind = "entry";
  private tutorialContainer?: Phaser.GameObjects.Container;

  public constructor() {
    super({ key: "MarbleMountainsPuzzleScene" });
  }

  public create(): void {
    this.resetSceneState();
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#0a1820");
    this.drawBackdrop(width, height);
    this.connectionGraphics = this.add.graphics().setDepth(3);
    this.createElementNodes(width, height);
    this.createHud(width, height);
    this.createTutorialOverlay(width, height);
    this.createInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);

    if (this.questStatus() === "REWARDED") {
      this.feedbackOverride = gameText(
        "Mảnh Ký Ức Ngũ Hành đã được mở khóa.",
        "The Five Elements Memory Fragment is unlocked.",
      );
      this.tutorialVisible = false;
      this.tutorialContainer?.setVisible(false);
    }
    this.refreshView();
  }

  public update(): void {
    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      if (this.tutorialVisible) {
        if (this.tutorialKind === "entry") {
          this.leaveQuest();
        } else {
          this.closeTutorial();
        }
      } else {
        this.leaveQuest();
      }
      return;
    }

    if (this.tutorialVisible) {
      if (this.tutorialKind === "entry") {
        if (this.wasPressed(this.spaceKey, this.enterKey, this.interactKey)) {
          this.startFromTutorial();
          return;
        }
        for (let i = 0; i < 5; i += 1) {
          if (this.wasPressed(this.digitKeys[i], this.digitKeys[i + 5])) {
            this.startFromTutorial();
            this.selectElement(MARBLE_ELEMENT_ORDER[i]);
            return;
          }
        }
      }
      return;
    }

    if (this.resolvingSuccess) {
      if (this.wasInteractPressed()) {
        this.returnToOverworld();
      }
      return;
    }

    if (this.wasPressed(this.retryKey)) {
      this.retryPuzzle();
      return;
    }

    if (this.wasPressed(this.hintKey)) {
      this.requestHint();
      return;
    }

    // Number keys 1..5 for direct element selection
    for (let i = 0; i < 5; i += 1) {
      if (this.wasPressed(this.digitKeys[i], this.digitKeys[i + 5])) {
        this.selectElement(MARBLE_ELEMENT_ORDER[i]);
        return;
      }
    }

    if (this.puzzle.phase === "PLAYING") {
      if (
        this.wasPressed(this.cursors?.left, this.movementKeys?.left) ||
        this.wasPressed(this.cursors?.up, this.movementKeys?.up)
      ) {
        this.moveFocus(-1);
        return;
      }
      if (
        this.wasPressed(this.cursors?.right, this.movementKeys?.right) ||
        this.wasPressed(this.cursors?.down, this.movementKeys?.down)
      ) {
        this.moveFocus(1);
        return;
      }
    }

    if (this.wasInteractPressed()) {
      if (this.puzzle.phase === "INTRO") {
        this.startPuzzle();
      } else if (this.puzzle.phase === "PLAYING") {
        this.selectElement(MARBLE_ELEMENT_ORDER[this.focusedElementIndex]);
      }
    }
  }

  private resetSceneState(): void {
    this.returnTimer?.remove(false);
    this.returnTimer = null;
    this.elementNodes.clear();
    this.elementPositions.clear();
    this.puzzle = createMarblePuzzleState();
    this.focusedElementIndex = 0;
    this.resolvingSuccess = false;
    this.feedbackOverride = null;
    this.tutorialVisible = true;
    this.tutorialKind = "entry";
  }

  private drawBackdrop(width: number, height: number): void {
    const sky = this.add.graphics();
    sky.fillStyle(0x0a1820, 1);
    sky.fillRect(0, 0, width, height);

    for (let i = 0; i < height * 0.7; i += 10) {
      const alpha = (1 - i / (height * 0.7)) * 0.5;
      sky.fillStyle(0x19454f, alpha);
      sky.fillRect(0, i, width, 10);
    }

    // Distant Karst Mountains (Layer 1)
    const distantPeaks = this.add.graphics();
    distantPeaks.fillStyle(0x0e2a32, 0.75);
    distantPeaks.beginPath();
    distantPeaks.moveTo(0, height);
    distantPeaks.lineTo(width * 0.05, height * 0.45);
    distantPeaks.lineTo(width * 0.12, height * 0.28);
    distantPeaks.lineTo(width * 0.22, height * 0.52);
    distantPeaks.lineTo(width * 0.32, height * 0.32);
    distantPeaks.lineTo(width * 0.42, height * 0.55);
    distantPeaks.lineTo(width * 0.5, height * 0.2);
    distantPeaks.lineTo(width * 0.6, height * 0.52);
    distantPeaks.lineTo(width * 0.7, height * 0.3);
    distantPeaks.lineTo(width * 0.8, height * 0.5);
    distantPeaks.lineTo(width * 0.88, height * 0.35);
    distantPeaks.lineTo(width, height * 0.48);
    distantPeaks.lineTo(width, height);
    distantPeaks.closePath();
    distantPeaks.fillPath();

    // Foreground 5 Karst Peaks representing the Five Elements (Layer 2)
    const peaks = this.add.graphics();

    // 1. Kim Sơn (Sharp metallic silver-gold stone peak)
    peaks.fillStyle(0x1c373a, 0.95);
    peaks.beginPath();
    peaks.moveTo(0, height);
    peaks.lineTo(width * 0.02, height * 0.48);
    peaks.lineTo(width * 0.1, height * 0.28);
    peaks.lineTo(width * 0.2, height);
    peaks.closePath();
    peaks.fillPath();
    peaks.lineStyle(2, 0xf4c430, 0.45);
    peaks.lineBetween(width * 0.1, height * 0.28, width * 0.06, height * 0.6);

    // 2. Mộc Sơn (Lush green-tinted karst peak)
    peaks.fillStyle(0x184039, 0.95);
    peaks.beginPath();
    peaks.moveTo(width * 0.15, height);
    peaks.lineTo(width * 0.25, height * 0.33);
    peaks.lineTo(width * 0.35, height);
    peaks.closePath();
    peaks.fillPath();
    peaks.lineStyle(2, 0x2ecc71, 0.45);
    peaks.lineBetween(width * 0.25, height * 0.33, width * 0.28, height * 0.58);

    // 3. Thủy Sơn (Tallest central majestic peak - sapphire blue cave glow)
    peaks.fillStyle(0x143542, 0.95);
    peaks.beginPath();
    peaks.moveTo(width * 0.32, height);
    peaks.lineTo(width * 0.48, height * 0.21);
    peaks.lineTo(width * 0.52, height * 0.23);
    peaks.lineTo(width * 0.65, height);
    peaks.closePath();
    peaks.fillPath();
    peaks.lineStyle(2, 0x3498db, 0.55);
    peaks.lineBetween(width * 0.48, height * 0.21, width * 0.5, height * 0.65);
    peaks.fillStyle(0x3498db, 0.35);
    peaks.fillCircle(width * 0.49, height * 0.54, 14);

    // 4. Hỏa Sơn (Fiery ruby/amber double peak)
    peaks.fillStyle(0x392224, 0.95);
    peaks.beginPath();
    peaks.moveTo(width * 0.6, height);
    peaks.lineTo(width * 0.72, height * 0.31);
    peaks.lineTo(width * 0.82, height);
    peaks.closePath();
    peaks.fillPath();
    peaks.lineStyle(2, 0xe74c3c, 0.45);
    peaks.lineBetween(width * 0.72, height * 0.31, width * 0.75, height * 0.6);

    // 5. Thổ Sơn (Broad earth marble cliff peak)
    peaks.fillStyle(0x2d2c20, 0.95);
    peaks.beginPath();
    peaks.moveTo(width * 0.78, height);
    peaks.lineTo(width * 0.88, height * 0.35);
    peaks.lineTo(width, height * 0.44);
    peaks.lineTo(width, height);
    peaks.closePath();
    peaks.fillPath();
    peaks.lineStyle(2, 0xb8860b, 0.45);
    peaks.lineBetween(width * 0.88, height * 0.35, width * 0.92, height * 0.65);

    // Mist gradients across valley floor
    const mist = this.add.graphics();
    for (let i = 0; i < 4; i += 1) {
      const yPos = height * 0.65 + i * 35;
      const alpha = 0.22 - i * 0.04;
      mist.fillStyle(0xc8f0e6, alpha);
      mist.fillRect(0, yPos, width, 40);
    }

    // Ancient stone altar foundation line
    const stoneBase = this.add.graphics();
    stoneBase.fillStyle(0x0c1e24, 0.92);
    stoneBase.fillRect(0, height - 120, width, 120);
    stoneBase.lineStyle(3, 0x4a7c85, 0.6);
    stoneBase.lineBetween(0, height - 120, width, height - 120);

    // Title banner
    this.add
      .text(
        width / 2,
        22,
        gameText("NGŨ HÀNH KỲ BÍ", "FIVE ELEMENTS MYSTERY"),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "24px",
          fontStyle: "bold",
          color: "#fff3cf",
          stroke: "#0a191f",
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5)
      .setDepth(5);

    this.add
      .text(
        width / 2,
        48,
        gameText(
          "Danh thắng Ngũ Hành Sơn · Nối đúng dòng chảy 5 nguyên tố",
          "Marble Mountains · Connect the five elemental peaks in order",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "12px",
          color: "#c2ede2",
        },
      )
      .setOrigin(0.5)
      .setDepth(5);
  }

  private createElementNodes(width: number, height: number): void {
    const centerX = width / 2;
    const centerY = height / 2 - 12;
    const radius = Math.min(130, width * 0.22);

    MARBLE_ELEMENT_ORDER.forEach((element, index) => {
      const angle = Phaser.Math.DegToRad(-90 + index * 72);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const visual = ELEMENT_VISUALS[element];

      // Node Outer Glow Ring
      this.add.circle(x, y, 38, visual.glowColor, 0.22).setDepth(4);

      // Stone Runic Disc
      const node = this.add
        .circle(x, y, 32, visual.color, 0.92)
        .setStrokeStyle(4, 0xfff9e6, 0.85)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });

      // Inner Symbol (Emoji)
      this.add
        .text(x, y - 2, visual.symbol, {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "20px",
        })
        .setOrigin(0.5)
        .setDepth(6);

      // Mountain label text below disc
      this.add
        .text(x, y + 44, gameText(visual.mountainVi, visual.mountainEn), {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "12px",
          fontStyle: "bold",
          color: "#ffffff",
          stroke: "#0a191f",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(6);

      // Hotkey indicator badge [1..5]
      this.add
        .text(x, y - 44, `[ ${index + 1} ]`, {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "11px",
          fontStyle: "bold",
          color: "#ffe082",
          stroke: "#0a191f",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(6);

      node.on("pointerdown", () => {
        if (this.tutorialVisible) {
          if (this.tutorialKind === "help") {
            return;
          }
          this.startFromTutorial();
        }
        this.selectElement(element);
      });

      this.elementNodes.set(element, node);
      this.elementPositions.set(element, new Phaser.Math.Vector2(x, y));
    });
  }

  private createHud(width: number, height: number): void {
    this.progressText = this.add
      .text(width / 2, height - 110, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.instructionText = this.add
      .text(width / 2, height - 87, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "12px",
        color: "#d2f5e9",
        align: "center",
        wordWrap: { width: width - 38 },
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.feedbackText = this.add
      .text(width / 2, height - 20, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: width - 30 },
      })
      .setOrigin(0.5)
      .setDepth(7);

    this.startButton = this.createButton(
      width / 2,
      height - 56,
      154,
      gameText("Bắt đầu  (E / Space)", "Start  (E / Space)"),
      () => this.startFromTutorial(),
    );
    this.hintButton = this.createButton(
      width / 2 - 113,
      height - 56,
      106,
      gameText("Gợi ý  (H)", "Hint  (H)"),
      () => this.requestHint(),
    );
    this.retryButton = this.createButton(
      width / 2,
      height - 56,
      108,
      gameText("Thử lại  (R)", "Retry  (R)"),
      () => this.retryPuzzle(),
    );
    this.backButton = this.createButton(
      width / 2 + 116,
      height - 56,
      102,
      gameText("🚪 Bản đồ", "🚪 Map"),
      () => this.leaveQuest(),
    );
    this.infoButton = this.createButton(width - 40, 24, 44, "ℹ️", () => {
      if (this.tutorialVisible) {
        this.closeTutorial();
      } else {
        this.openTutorial();
      }
    });
    this.createButton(width - 92, 24, 44, "🚪", () => this.leaveQuest());
  }

  private createTutorialOverlay(width: number, height: number): void {
    const backdrop = this.add
      .rectangle(width / 2, height / 2, width, height, 0x05131a, 0.85)
      .setInteractive();

    const cardWidth = Math.min(500, width - 40);
    const cardHeight = Math.min(350, height - 60);

    const cardBg = this.add
      .rectangle(width / 2, height / 2, cardWidth, cardHeight, 0x0e2830, 0.98)
      .setStrokeStyle(3, 0xf4c430, 0.9);

    const title = this.add
      .text(
        width / 2,
        height / 2 - cardHeight / 2 + 28,
        gameText(
          "NGŨ HÀNH KỲ BÍ — HƯỚNG DẪN CHƠI",
          "FIVE ELEMENTS MYSTERY — HOW TO PLAY",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "18px",
          fontStyle: "bold",
          color: "#fff3cf",
        },
      )
      .setOrigin(0.5);

    const sub = this.add
      .text(
        width / 2,
        height / 2 - cardHeight / 2 + 54,
        gameText(
          "Nối 5 tháp đá Ngũ Hành theo đúng thứ tự tương sinh:",
          "Connect the 5 elemental peaks in correct generating order:",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "12px",
          color: "#d0f2e8",
        },
      )
      .setOrigin(0.5);

    const orderDiagram = this.add
      .text(
        width / 2,
        height / 2 - cardHeight / 2 + 90,
        "⚔️ Kim  ➔  🍃 Mộc  ➔  💧 Thủy  ➔  🔥 Hỏa  ➔  ⛰️ Thổ",
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "15px",
          fontStyle: "bold",
          color: "#ffe082",
          backgroundColor: "#07171e",
          padding: { x: 12, y: 8 },
        },
      )
      .setOrigin(0.5);

    const guideText = this.add
      .text(
        width / 2,
        height / 2 + 10,
        gameText(
          "• Chọn lần lượt các nguyên tố Kim → Mộc → Thủy → Hỏa → Thổ.\n" +
            "• Nếu chọn sai, chuỗi năng lượng sẽ reset để bạn thử lại.\n" +
            "• Sử dụng Gợi ý (tối đa 3 lần) nếu cần trợ giúp tìm đỉnh tiếp theo.\n\n" +
            "🎮 Điều khiển:\n" +
            "  • Bàn phím: Phím 1..5 chọn nhanh · Mũi tên/WASD chọn · Space/E nối · H gợi ý · R thử lại\n" +
            "  • Cảm ứng / Chuột: Chạm trực tiếp vào các đỉnh tháp đá",
          "• Select elements in order: Kim → Mộc → Thủy → Hỏa → Thổ.\n" +
            "• If wrong, the energy path resets for you to retry.\n" +
            "• Use Hint (up to 3 times) to highlight the next element.\n\n" +
            "🎮 Controls:\n" +
            "  • Keyboard: Keys 1..5 quick-select · Arrows/WASD focus · Space/E connect · H hint · R retry\n" +
            "  • Touch / Mouse: Tap directly on elemental peaks",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "11px",
          color: "#effff8",
          align: "left",
          wordWrap: { width: cardWidth - 40 },
        },
      )
      .setOrigin(0.5);

    const startBtnBg = this.add
      .rectangle(
        width / 2,
        height / 2 + cardHeight / 2 - 32,
        170,
        34,
        0xf4c430,
        1,
      )
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });

    const startBtnTxt = this.add
      .text(
        width / 2,
        height / 2 + cardHeight / 2 - 32,
        gameText("Bắt đầu ngay  (Space)", "Start now  (Space)"),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "13px",
          fontStyle: "bold",
          color: "#0a191f",
        },
      )
      .setOrigin(0.5);

    startBtnBg.on("pointerdown", () => this.startFromTutorial());

    this.tutorialContainer = this.add
      .container(0, 0, [
        backdrop,
        cardBg,
        title,
        sub,
        orderDiagram,
        guideText,
        startBtnBg,
        startBtnTxt,
      ])
      .setDepth(100);

    this.tutorialContainer.setVisible(this.tutorialVisible);
  }

  private openTutorial(): void {
    this.tutorialKind = "help";
    this.tutorialVisible = true;
    this.tutorialContainer?.setVisible(true);
  }

  private closeTutorial(): void {
    this.tutorialVisible = false;
    this.tutorialContainer?.setVisible(false);
  }

  private startFromTutorial(): void {
    this.closeTutorial();
    this.startPuzzle();
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    label: string,
    onPress: () => void,
  ): SceneButton {
    const background = this.add
      .rectangle(x, y, width, 30, 0x173841, 0.96)
      .setStrokeStyle(2, 0xb8e7d8, 0.85)
      .setDepth(8)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "11px",
        fontStyle: "bold",
        color: "#effff8",
      })
      .setOrigin(0.5)
      .setDepth(9);
    background.on("pointerdown", onPress);
    return { background, label: text };
  }

  private createInput(): void {
    if (!this.input.keyboard) {
      return;
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.movementKeys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as MovementKeys;

    this.digitKeys = [
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_THREE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_FIVE),
    ];

    this.interactKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.E,
    );
    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    this.enterKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER,
    );
    this.hintKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.retryKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.R,
    );
    this.escapeKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
  }

  private startPuzzle(): void {
    if (this.resolvingSuccess || this.puzzle.phase !== "INTRO") {
      return;
    }

    const status = this.questStatus();
    if (status === "REWARDED") {
      this.returnToOverworld();
      return;
    }
    if (status === "COMPLETED") {
      this.puzzle = { ...this.puzzle, phase: "SUCCESS", feedback: "COMPLETE" };
      this.resolveSuccess();
      return;
    }
    if (status !== "ACTIVE") {
      const started = gameSession.startQuest(MARBLE_QUEST_ID);
      if (!started) {
        this.feedbackOverride = gameText(
          "Thử thách chưa mở. Hãy hoàn thành hành trình trước đó.",
          "This challenge is locked. Complete the previous journey first.",
        );
        this.refreshView();
        return;
      }
      this.emitQuestUpdate(started.current);
    }

    this.feedbackOverride = null;
    this.puzzle = reduceMarblePuzzle(this.puzzle, { type: "START" });
    this.refreshView();
  }

  private selectElement(element: MarbleElementId): void {
    if (this.resolvingSuccess) {
      return;
    }
    if (this.puzzle.phase === "INTRO") {
      this.startPuzzle();
    }
    if (this.puzzle.phase !== "PLAYING") {
      return;
    }

    const prevLength = this.puzzle.selected.length;
    this.feedbackOverride = null;
    this.focusedElementIndex = MARBLE_ELEMENT_ORDER.indexOf(element);
    this.puzzle = reduceMarblePuzzle(this.puzzle, { type: "SELECT", element });

    if (this.puzzle.selected.length > prevLength) {
      this.triggerNodeHitFx(element);
    } else if (this.puzzle.feedback === "WRONG") {
      this.triggerWrongFx();
    }

    this.refreshView();
    if (this.puzzle.phase === "SUCCESS") {
      this.resolveSuccess();
    }
  }

  private triggerNodeHitFx(element: MarbleElementId): void {
    const pos = this.elementPositions.get(element);
    if (!pos) return;

    const visual = ELEMENT_VISUALS[element];

    // 1. Floating text popup
    const floatText = this.add
      .text(
        pos.x,
        pos.y - 30,
        `${visual.symbol} ${MARBLE_ELEMENT_LABELS[element]}`,
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "18px",
          fontStyle: "bold",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: floatText,
      y: pos.y - 75,
      alpha: 0,
      duration: 900,
      ease: "Cubic.out",
      onComplete: () => floatText.destroy(),
    });

    // 2. Particle sparkle burst
    const numParticles = 14;
    for (let i = 0; i < numParticles; i += 1) {
      const angle = (i / numParticles) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 25 + Math.random() * 45;
      const px = pos.x + Math.cos(angle) * 10;
      const py = pos.y + Math.sin(angle) * 10;

      const sparkle = this.add
        .circle(px, py, Math.random() * 3 + 2, visual.glowColor, 0.9)
        .setDepth(15);

      this.tweens.add({
        targets: sparkle,
        x: pos.x + Math.cos(angle) * distance,
        y: pos.y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.1,
        duration: 600 + Math.random() * 300,
        ease: "Quad.out",
        onComplete: () => sparkle.destroy(),
      });
    }

    // 3. Node scale pulse
    const nodeObj = this.elementNodes.get(element);
    if (nodeObj) {
      this.tweens.add({
        targets: nodeObj,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 150,
        yoyo: true,
        ease: "Quad.out",
      });
    }
  }

  private triggerWrongFx(): void {
    this.cameras.main.shake(250, 0.012);

    const flash = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xff2222, 0.25)
      .setOrigin(0, 0)
      .setDepth(50);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 350,
      onComplete: () => flash.destroy(),
    });

    this.elementNodes.forEach((node) => {
      this.tweens.add({
        targets: node,
        x: node.x + (Math.random() > 0.5 ? 6 : -6),
        duration: 50,
        yoyo: true,
        repeat: 3,
      });
    });
  }

  private requestHint(): void {
    if (this.resolvingSuccess || this.puzzle.phase !== "PLAYING") {
      return;
    }

    this.feedbackOverride = null;
    const expected = getExpectedMarbleElement(this.puzzle);
    this.puzzle = reduceMarblePuzzle(this.puzzle, { type: "REQUEST_HINT" });

    if (expected) {
      this.triggerHintPulse(expected);
    }

    this.refreshView();
  }

  private triggerHintPulse(targetElement: MarbleElementId): void {
    const pos = this.elementPositions.get(targetElement);
    if (!pos) return;

    const visual = ELEMENT_VISUALS[targetElement];

    const pulseRing = this.add
      .circle(pos.x, pos.y, 35)
      .setStrokeStyle(4, visual.glowColor, 1)
      .setDepth(12);

    this.tweens.add({
      targets: pulseRing,
      scaleX: 1.7,
      scaleY: 1.7,
      alpha: 0,
      duration: 750,
      repeat: 2,
      ease: "Quad.out",
      onComplete: () => pulseRing.destroy(),
    });

    const nodeObj = this.elementNodes.get(targetElement);
    if (nodeObj) {
      this.tweens.add({
        targets: nodeObj,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 200,
        yoyo: true,
        repeat: 2,
      });
    }
  }

  private retryPuzzle(): void {
    if (this.resolvingSuccess) {
      return;
    }
    if (this.puzzle.phase === "INTRO") {
      this.startPuzzle();
      return;
    }
    if (this.puzzle.phase === "SUCCESS") {
      this.returnToOverworld();
      return;
    }

    const retried = gameSession.retryQuest(MARBLE_QUEST_ID);
    if (retried) {
      this.emitQuestUpdate(retried.current);
    }
    const started = gameSession.startQuest(MARBLE_QUEST_ID);
    if (started) {
      this.emitQuestUpdate(started.current);
    }

    this.feedbackOverride = null;
    this.puzzle = reduceMarblePuzzle(this.puzzle, { type: "RETRY" });
    this.focusedElementIndex = 0;
    this.refreshView();
  }

  private resolveSuccess(): void {
    if (this.resolvingSuccess) {
      return;
    }
    this.resolvingSuccess = true;

    const completed = gameSession.completeQuest(MARBLE_QUEST_ID);
    if (completed) {
      this.emitQuestUpdate(completed.current);
    }
    const rewarded = gameSession.rewardQuest(MARBLE_QUEST_ID);
    if (rewarded) {
      this.emitQuestUpdate(rewarded.current);
      bridge.emitGameToUi({
        type: "POSTCARD_UNLOCKED",
        placeKey: MARBLE_POSTCARD_KEY,
      });
    }

    this.feedbackOverride = gameText(
      "Chính xác! Nhận Mảnh Ký Ức Ngũ Hành...",
      "Correct! Receiving the Five Elements Memory Fragment...",
    );
    this.refreshView();
    this.returnTimer = this.time.delayedCall(1_250, () =>
      this.returnToOverworld(),
    );
  }

  private leaveQuest(): void {
    if (this.resolvingSuccess) {
      this.returnToOverworld();
      return;
    }

    if (this.questStatus() === "ACTIVE") {
      const retried = gameSession.retryQuest(MARBLE_QUEST_ID);
      if (retried) {
        this.emitQuestUpdate(retried.current);
      }
    }
    this.returnToOverworld();
  }

  private returnToOverworld(): void {
    this.returnTimer?.remove(false);
    this.returnTimer = null;
    gameSession.flush();
    this.scene.start("OverworldScene");
  }

  private moveFocus(delta: number): void {
    this.focusedElementIndex =
      (this.focusedElementIndex + delta + MARBLE_ELEMENT_ORDER.length) %
      MARBLE_ELEMENT_ORDER.length;
    this.refreshView();
  }

  private refreshView(): void {
    const selected = new Set(this.puzzle.selected);
    const focused = MARBLE_ELEMENT_ORDER[this.focusedElementIndex];
    MARBLE_ELEMENT_ORDER.forEach((element) => {
      const node = this.elementNodes.get(element);
      if (!node) {
        return;
      }
      const visual = ELEMENT_VISUALS[element];
      const isSelected = selected.has(element);
      const isFocused = this.puzzle.phase === "PLAYING" && element === focused;

      if (isSelected) {
        node.setFillStyle(visual.color, 1);
        node.setScale(1.18);
        node.setStrokeStyle(5, 0xfffae6, 1);
      } else if (isFocused) {
        node.setFillStyle(visual.color, 0.95);
        node.setScale(1.12);
        node.setStrokeStyle(4, 0xffffff, 1);
      } else {
        node.setFillStyle(visual.color, 0.75);
        node.setScale(1.0);
        node.setStrokeStyle(3, 0xe7f9f2, 0.82);
      }
    });
    this.drawConnections();

    const sequence = this.puzzle.selected
      .map((element) => MARBLE_ELEMENT_LABELS[element])
      .join(" → ");
    this.progressText.setText(
      sequence.length > 0
        ? gameText(`Đường đã nối: ${sequence}`, `Connected path: ${sequence}`)
        : gameText(
            "Đường đã nối: chưa có nguyên tố nào",
            "Connected path: no element selected",
          ),
    );
    this.instructionText.setText(
      this.puzzle.phase === "INTRO"
        ? gameText(
            "Nhấn E / Space hoặc phím 1..5 hoặc chạm nguyên tố để bắt đầu.",
            "Press E / Space or keys 1..5 or tap an element to start.",
          )
        : gameText(
            "1..5 / ← → / W A S D chọn · E / Space nối · H gợi ý · R thử lại · Esc về bản đồ",
            "1..5 / ← → / W A S D select · E / Space connect · H hint · R retry · Esc map",
          ),
    );
    this.feedbackText.setText(this.feedbackOverride ?? this.feedbackCopy());

    const isIntro =
      this.puzzle.phase === "INTRO" && this.questStatus() !== "REWARDED";
    const isPlaying = this.puzzle.phase === "PLAYING";
    this.setButtonVisible(this.startButton, isIntro);
    this.setButtonVisible(this.hintButton, isPlaying);
    this.setButtonVisible(this.retryButton, isPlaying);
    this.setButtonVisible(this.backButton, true);
    this.setButtonVisible(this.infoButton, true);
    this.hintButton.label.setText(
      gameText(
        `Gợi ý ${this.puzzle.hintsUsed}/${MAX_MARBLE_HINTS}  (H)`,
        `Hint ${this.puzzle.hintsUsed}/${MAX_MARBLE_HINTS}  (H)`,
      ),
    );
  }

  private drawConnections(): void {
    this.connectionGraphics.clear();
    if (this.puzzle.selected.length < 2) {
      return;
    }

    // Translucent outer energy aura beam
    this.connectionGraphics.lineStyle(14, 0xffe082, 0.4);
    for (let index = 1; index < this.puzzle.selected.length; index += 1) {
      const previous = this.elementPositions.get(
        this.puzzle.selected[index - 1],
      );
      const current = this.elementPositions.get(this.puzzle.selected[index]);
      if (previous && current) {
        this.connectionGraphics.lineBetween(
          previous.x,
          previous.y,
          current.x,
          current.y,
        );
      }
    }

    // Inner bright white core beam
    this.connectionGraphics.lineStyle(5, 0xffffff, 0.95);
    for (let index = 1; index < this.puzzle.selected.length; index += 1) {
      const previous = this.elementPositions.get(
        this.puzzle.selected[index - 1],
      );
      const current = this.elementPositions.get(this.puzzle.selected[index]);
      if (previous && current) {
        this.connectionGraphics.lineBetween(
          previous.x,
          previous.y,
          current.x,
          current.y,
        );
      }
    }
  }

  private feedbackCopy(): string {
    switch (this.puzzle.feedback) {
      case "CORRECT":
        return gameText(
          "Đúng rồi — dòng chảy đang mở rộng!",
          "Correct — the flow is growing!",
        );
      case "WRONG":
        return gameText(
          "Chưa đúng thứ tự. Đường nối đã được làm mới, hãy thử lại.",
          "That order is not right. The path has reset; try again.",
        );
      case "HINT": {
        const expected = getExpectedMarbleElement(this.puzzle);
        return expected
          ? gameText(
              `Gợi ý ${this.puzzle.hintsUsed}/${MAX_MARBLE_HINTS}: nguyên tố tiếp theo là ${MARBLE_ELEMENT_LABELS[expected]}.`,
              `Hint ${this.puzzle.hintsUsed}/${MAX_MARBLE_HINTS}: the next element is ${MARBLE_ELEMENT_LABELS[expected]}.`,
            )
          : gameText("Chuỗi đã hoàn thành.", "The sequence is complete.");
      }
      case "HINTS_EXHAUSTED":
        return gameText(
          "Bạn đã dùng hết 3 gợi ý. Hãy quan sát các nguyên tố và thử lại.",
          "You used all 3 hints. Observe the elements and try again.",
        );
      case "COMPLETE":
        return gameText(
          "Đúng thứ tự! Năng lượng Ngũ Hành đã cộng hưởng.",
          "Correct order! The Five Elements energy resonates.",
        );
      case "SELECT":
        return gameText(
          "Chọn nguyên tố đầu tiên để bắt đầu đường nối.",
          "Choose the first element to begin the path.",
        );
      case "INTRO":
      default:
        return gameText(
          "Sẵn sàng giải mã dòng chảy Ngũ Hành.",
          "Ready to decode the Five Elements flow.",
        );
    }
  }

  private setButtonVisible(button: SceneButton, visible: boolean): void {
    button.background.setVisible(visible).setActive(visible);
    button.label.setVisible(visible).setActive(visible);
    if (visible) {
      button.background.setInteractive({ useHandCursor: true });
    } else {
      button.background.disableInteractive();
    }
  }

  private wasInteractPressed(): boolean {
    return this.wasPressed(this.interactKey, this.spaceKey);
  }

  private wasPressed(
    ...keys: Array<Phaser.Input.Keyboard.Key | undefined>
  ): boolean {
    return keys.some((key) =>
      Boolean(key && Phaser.Input.Keyboard.JustDown(key)),
    );
  }

  private questStatus() {
    return gameSession.getState().quests[MARBLE_QUEST_ID];
  }

  private emitQuestUpdate(state: QuestStatus): void {
    if (state === "LOCKED") return;
    bridge.emitGameToUi({
      type: "QUEST_UPDATED",
      questId: MARBLE_QUEST_ID,
      state,
    });
  }

  private cleanUp(): void {
    this.returnTimer?.remove(false);
    this.returnTimer = null;
    this.elementNodes.clear();
    this.elementPositions.clear();
  }
}
