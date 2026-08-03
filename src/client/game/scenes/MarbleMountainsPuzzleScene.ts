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

const ELEMENT_COLORS: Record<MarbleElementId, number> = {
  kim: 0xd8d2b8,
  moc: 0x63b77a,
  thuy: 0x55b5e6,
  hoa: 0xe66b55,
  tho: 0xaf8154,
};

/**
 * A self-contained, deterministic Five Elements puzzle.  Its only stateful
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
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private movementKeys?: MovementKeys;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private hintKey?: Phaser.Input.Keyboard.Key;
  private retryKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;
  private focusedElementIndex = 0;
  private resolvingSuccess = false;
  private feedbackOverride: string | null = null;
  private returnTimer: Phaser.Time.TimerEvent | null = null;

  public constructor() {
    super({ key: "MarbleMountainsPuzzleScene" });
  }

  public create(): void {
    this.resetSceneState();
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#102b31");
    this.drawBackdrop(width, height);
    this.connectionGraphics = this.add.graphics().setDepth(2);
    this.createElementNodes(width, height);
    this.createHud(width, height);
    this.createInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);

    if (this.questStatus() === "REWARDED") {
      this.feedbackOverride = gameText(
        "Mảnh Ký Ức Ngũ Hành đã được mở khóa.",
        "The Five Elements Memory Fragment is unlocked.",
      );
    }
    this.refreshView();
  }

  public update(): void {
    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.leaveQuest();
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
  }

  private drawBackdrop(width: number, height: number): void {
    const sky = this.add.graphics();
    sky.fillStyle(0x102b31, 1);
    sky.fillRect(0, 0, width, height);
    sky.fillStyle(0x1d4a47, 0.9);
    sky.fillTriangle(
      0,
      height,
      width * 0.2,
      height * 0.31,
      width * 0.46,
      height,
    );
    sky.fillStyle(0x315d55, 0.9);
    sky.fillTriangle(
      width * 0.28,
      height,
      width * 0.58,
      height * 0.22,
      width * 0.83,
      height,
    );
    sky.fillStyle(0x173a38, 1);
    sky.fillTriangle(
      width * 0.58,
      height,
      width * 0.81,
      height * 0.35,
      width,
      height,
    );
    sky.lineStyle(2, 0xa9d8c8, 0.25);
    sky.lineBetween(0, height - 42, width, height - 42);

    this.add
      .text(
        width / 2,
        18,
        gameText("NGŨ HÀNH KỲ BÍ", "FIVE ELEMENTS MYSTERY"),
        {
          fontFamily: "sans-serif",
          fontSize: "22px",
          fontStyle: "bold",
          color: "#fff2bd",
        },
      )
      .setOrigin(0.5)
      .setDepth(5);
    this.add
      .text(
        width / 2,
        43,
        gameText(
          "Núi Ngũ Hành · nối đúng dòng chảy của năm nguyên tố",
          "Marble Mountains · connect the five elements in order",
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#d2f5e9",
        },
      )
      .setOrigin(0.5)
      .setDepth(5);
  }

  private createElementNodes(width: number, height: number): void {
    const centerX = width / 2;
    const centerY = height / 2 - 7;
    const radius = Math.min(83, width * 0.18);

    MARBLE_ELEMENT_ORDER.forEach((element, index) => {
      const angle = Phaser.Math.DegToRad(-90 + index * 72);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const node = this.add
        .circle(x, y, 29, ELEMENT_COLORS[element], 0.92)
        .setStrokeStyle(3, 0xe7f9f2, 0.82)
        .setDepth(4)
        .setInteractive({ useHandCursor: true });
      node.on("pointerdown", () => this.selectElement(element));
      this.add
        .text(x, y, MARBLE_ELEMENT_LABELS[element], {
          fontFamily: "sans-serif",
          fontSize: "16px",
          fontStyle: "bold",
          color: "#102128",
        })
        .setOrigin(0.5)
        .setDepth(5);

      this.elementNodes.set(element, node);
      this.elementPositions.set(element, new Phaser.Math.Vector2(x, y));
    });
  }

  private createHud(width: number, height: number): void {
    this.progressText = this.add
      .text(width / 2, height - 110, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.instructionText = this.add
      .text(width / 2, height - 87, "", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#d2f5e9",
        align: "center",
        wordWrap: { width: width - 38 },
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.feedbackText = this.add
      .text(width / 2, height - 20, "", {
        fontFamily: "sans-serif",
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
      () => this.startPuzzle(),
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
      gameText("Về bản đồ", "Back to map"),
      () => this.leaveQuest(),
    );
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
        fontFamily: "sans-serif",
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
    this.interactKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.E,
    );
    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
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

    this.feedbackOverride = null;
    this.focusedElementIndex = MARBLE_ELEMENT_ORDER.indexOf(element);
    this.puzzle = reduceMarblePuzzle(this.puzzle, { type: "SELECT", element });
    this.refreshView();
    if (this.puzzle.phase === "SUCCESS") {
      this.resolveSuccess();
    }
  }

  private requestHint(): void {
    if (this.resolvingSuccess || this.puzzle.phase !== "PLAYING") {
      return;
    }

    this.feedbackOverride = null;
    this.puzzle = reduceMarblePuzzle(this.puzzle, { type: "REQUEST_HINT" });
    this.refreshView();
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
      const isSelected = selected.has(element);
      const isFocused = this.puzzle.phase === "PLAYING" && element === focused;
      node
        .setFillStyle(ELEMENT_COLORS[element], isSelected ? 1 : 0.74)
        .setScale(isSelected ? 1.13 : isFocused ? 1.08 : 1)
        .setStrokeStyle(
          isSelected ? 4 : isFocused ? 4 : 3,
          isSelected ? 0xfff2a8 : isFocused ? 0xffffff : 0xe7f9f2,
          1,
        );
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
            "Nhấn E / Space hoặc chạm một nguyên tố để bắt đầu.",
            "Press E / Space or tap an element to start.",
          )
        : gameText(
            "← → / W A S D chọn · E / Space nối · H gợi ý · R thử lại · Esc về bản đồ",
            "← → / W A S D select · E / Space connect · H hint · R retry · Esc map",
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

    this.connectionGraphics.lineStyle(6, 0xffe58c, 0.9);
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

  private emitQuestUpdate(
    state: "AVAILABLE" | "ACTIVE" | "COMPLETED" | "REWARDED",
  ): void {
    bridge.emitGameToUi({
      type: "QUEST_UPDATED",
      questId: MARBLE_QUEST_ID,
      state,
    });
  }

  private cleanUp(): void {
    this.returnTimer?.remove(false);
    this.returnTimer = null;
  }
}
