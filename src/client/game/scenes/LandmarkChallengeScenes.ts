import Phaser from "phaser";
import { bridge } from "../../app/PhaserBridge.js";
import {
  LANDMARK_CHALLENGE_RULES,
  applyLandmarkChallengeInput,
  createLandmarkChallengeAttempt,
  failLandmarkChallenge,
  getLocalizedChallengeText,
  remainingLandmarkChallengeSeconds,
  startLandmarkChallenge,
  type LandmarkChallengeAttempt,
  type LandmarkChallengeRule,
} from "../landmark-challenge-rules.js";
import { gameText } from "../locale.js";
import { gameSession } from "../state/GameStateStore.js";
import { QUESTS } from "../../../shared/quests.js";
import { getLandmarkGameDefinitionByQuestId } from "../../../shared/landmark-game-definitions.js";
import type { Language } from "../../../shared/types.js";

type SceneButton = {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  optionIndex?: number;
};

type ChallengeQuestId = keyof typeof LANDMARK_CHALLENGE_RULES;

const GAME_FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif";
const DIRECTION_MARKERS = ["↑", "→", "↓", "←"] as const;

/**
 * Enhanced visual rendering and lifecycle shell for the six landmark challenge destinations.
 * Maintains strict deterministic rule contracts while delivering rich themed backgrounds,
 * custom stage visualizers, tutorial overlays, affordances, and feedback.
 */
abstract class LandmarkChallengeScene extends Phaser.Scene {
  protected readonly rule: LandmarkChallengeRule;
  protected attempt!: LandmarkChallengeAttempt;
  protected deadline = 0;
  protected focusedOption = 0;
  protected resolving = false;
  protected optionButtons: SceneButton[] = [];
  protected titleText!: Phaser.GameObjects.Text;
  protected subtitleText!: Phaser.GameObjects.Text;
  protected instructionText!: Phaser.GameObjects.Text;
  protected statusText!: Phaser.GameObjects.Text;
  protected timerText!: Phaser.GameObjects.Text;
  protected startButton!: SceneButton;
  protected cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  protected interactKey?: Phaser.Input.Keyboard.Key;
  protected spaceKey?: Phaser.Input.Keyboard.Key;
  protected enterKey?: Phaser.Input.Keyboard.Key;
  protected escapeKey?: Phaser.Input.Keyboard.Key;
  /** Timestamp at which a help overlay paused an active challenge. */
  protected tutorialPausedAt = 0;

  // Visual enhancements
  protected bgImage?: Phaser.GameObjects.Image;
  protected stageContainer!: Phaser.GameObjects.Container;
  protected tutorialModalContainer?: Phaser.GameObjects.Container;
  protected isTutorialOpen = false;
  protected tutorialButton!: Phaser.GameObjects.Text;
  protected exitButton!: Phaser.GameObjects.Text;
  protected lastProgress = 0;

  protected constructor(sceneKey: string, questId: ChallengeQuestId) {
    super({ key: sceneKey });
    this.rule = LANDMARK_CHALLENGE_RULES[questId];
  }

  public create(): void {
    this.attempt = createLandmarkChallengeAttempt(this.rule);
    this.deadline = 0;
    this.focusedOption = 0;
    this.resolving = false;
    this.optionButtons = [];
    this.isTutorialOpen = false;
    this.tutorialPausedAt = 0;
    this.lastProgress = 0;

    this.ensureQuestActive();
    this.createBackground();
    this.drawHeaderHUD();
    this.drawStageVisualizer();
    this.drawBoard();
    this.createInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.render();
  }

  public update(): void {
    if (this.resolving) return;

    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      if (this.isTutorialOpen) {
        this.toggleTutorialOverlay(false);
      } else {
        this.leaveQuest();
      }
      return;
    }

    if (this.isTutorialOpen) {
      if (this.wasInteractPressed()) {
        this.toggleTutorialOverlay(false);
      }
      return;
    }

    if (this.attempt.phase === "INTRO" || this.attempt.phase === "FAILED") {
      if (this.wasInteractPressed()) this.beginAttempt();
      return;
    }

    if (this.attempt.phase === "SUCCESS") return;

    if (this.time.now >= this.deadline) {
      this.attempt = failLandmarkChallenge(this.attempt);
      this.triggerWrongFeedback();
      this.retryQuestState();
      this.render();
      return;
    }

    if (
      (this.cursors?.left &&
        Phaser.Input.Keyboard.JustDown(this.cursors.left)) ||
      (this.cursors?.up && Phaser.Input.Keyboard.JustDown(this.cursors.up))
    ) {
      this.focusedOption =
        (this.focusedOption + this.optionButtons.length - 1) %
        this.optionButtons.length;
      this.render();
    }
    if (
      (this.cursors?.right &&
        Phaser.Input.Keyboard.JustDown(this.cursors.right)) ||
      (this.cursors?.down && Phaser.Input.Keyboard.JustDown(this.cursors.down))
    ) {
      this.focusedOption = (this.focusedOption + 1) % this.optionButtons.length;
      this.render();
    }
    if (this.wasInteractPressed()) this.activateOption(this.focusedOption);

    this.timerText.setText(
      gameText(
        `⏱️ ${remainingLandmarkChallengeSeconds(this.deadline, this.time.now)}s`,
        `⏱️ ${remainingLandmarkChallengeSeconds(this.deadline, this.time.now)}s`,
      ),
    );
  }

  private createBackground(): void {
    const { width, height } = this.scale;
    const backgroundColor = `#${this.rule.background
      .toString(16)
      .padStart(6, "0")}`;
    this.cameras.main.setBackgroundColor(backgroundColor);

    // Render themed landmark postcard image if preloaded
    const def = getLandmarkGameDefinitionByQuestId(this.rule.questId);
    if (def && this.textures.exists(def.postcardAssetId)) {
      this.bgImage = this.add.image(width / 2, height / 2, def.postcardAssetId);
      const scale = Math.max(
        width / this.bgImage.width,
        height / this.bgImage.height,
      );
      this.bgImage.setScale(scale).setAlpha(0.28).setDepth(-10);
    }

    // Base color gradient overlay
    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      this.rule.background,
      0.82,
    );
    overlay.setDepth(-9);
  }

  private drawHeaderHUD(): void {
    const { width } = this.scale;
    const def = getLandmarkGameDefinitionByQuestId(this.rule.questId);

    // Header bar container
    this.add
      .rectangle(width / 2, 32, width - 24, 48, 0x0c1524, 0.92)
      .setStrokeStyle(2, this.rule.accent, 0.9)
      .setDepth(5);

    // Landmark icon
    if (def && this.textures.exists(def.mapIconAssetId)) {
      this.add
        .image(28, 32, def.mapIconAssetId)
        .setDisplaySize(32, 32)
        .setDepth(6);
    }

    // Quest title & subtitle
    this.titleText = this.add
      .text(width / 2 - 30, 22, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "17px",
        fontStyle: "bold",
        color: "#fff3bf",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.subtitleText = this.add
      .text(width / 2 - 30, 42, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "11px",
        color: "#d9edf7",
        align: "center",
      })
      .setOrigin(0.5)
      .setName("challenge-subtitle")
      .setDepth(6);

    // Timer display
    this.timerText = this.add
      .text(width - 125, 32, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffd166",
      })
      .setOrigin(1, 0.5)
      .setDepth(6);

    // Tutorial Button ℹ️
    const tutBg = this.add
      .rectangle(width - 80, 32, 32, 28, 0x22364f, 0.9)
      .setStrokeStyle(1.5, 0x88a9c1, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(6);
    this.tutorialButton = this.add
      .text(width - 80, 32, "ℹ️", { fontSize: "14px" })
      .setOrigin(0.5)
      .setDepth(7);
    tutBg.on("pointerdown", () => this.toggleTutorialOverlay(true));
    tutBg.on("pointerover", () => tutBg.setStrokeStyle(2, 0xffffff, 1));
    tutBg.on("pointerout", () => tutBg.setStrokeStyle(1.5, 0x88a9c1, 0.8));

    // Exit Button 🚪
    const exitBg = this.add
      .rectangle(width - 40, 32, 32, 28, 0x3d2222, 0.9)
      .setStrokeStyle(1.5, 0xe06c75, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(6);
    this.exitButton = this.add
      .text(width - 40, 32, "🚪", { fontSize: "14px" })
      .setOrigin(0.5)
      .setDepth(7);
    exitBg.on("pointerdown", () => this.leaveQuest());
    exitBg.on("pointerover", () => exitBg.setStrokeStyle(2, 0xffffff, 1));
    exitBg.on("pointerout", () => exitBg.setStrokeStyle(1.5, 0xe06c75, 0.8));
  }

  private drawBoard(): void {
    const { width, height } = this.scale;
    const columns = this.rule.options.length > 6 ? 2 : 3;
    const rows = Math.ceil(this.rule.options.length / columns);
    const denseGrid = rows > 2;

    // CRITICAL: Maintain exact hit-box coordinates matching optionPoint(optionCount, i)
    const buttonWidth = Math.min(
      180,
      (width - 56 - (columns - 1) * 12) / columns,
    );
    const buttonHeight = denseGrid ? 38 : 52;
    const rowGap = denseGrid ? 8 : 11;
    const startY = denseGrid ? 153 : 166;

    this.instructionText = this.add
      .text(width / 2, 60, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "12px",
        color: "#eff8ff",
        align: "center",
        wordWrap: { width: width - 56 },
      })
      .setOrigin(0.5, 0)
      .setDepth(5);

    this.statusText = this.add
      .text(width / 2, height - (denseGrid ? 16 : 24), "", {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: width - 48 },
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Option buttons setup
    this.rule.options.forEach((_, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x =
        width / 2 -
        ((columns - 1) * (buttonWidth + 12)) / 2 +
        column * (buttonWidth + 12);
      const y = startY + row * (buttonHeight + rowGap);

      const box = this.add
        .rectangle(x, y, buttonWidth, buttonHeight, 0x26374b, 0.96)
        .setStrokeStyle(2, 0x88a9c1, 0.85)
        .setInteractive({ useHandCursor: true })
        .setDepth(10);

      const label = this.add
        .text(x, y, "", {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: denseGrid ? "11px" : "12px",
          color: "#f8fbff",
          align: "center",
          wordWrap: { width: buttonWidth - 14 },
        })
        .setOrigin(0.5)
        .setDepth(11);

      box.on("pointerdown", () => {
        box.setScale(0.96);
        this.time.delayedCall(100, () => box.setScale(1.0));
        this.activateOption(index);
      });

      box.on("pointerover", () => {
        if (this.attempt.phase === "PLAYING") {
          box.setScale(1.02);
          box.setStrokeStyle(3, 0xffd166, 1);
        }
      });

      box.on("pointerout", () => {
        box.setScale(1.0);
        const focused = index === this.focusedOption;
        box.setStrokeStyle(focused ? 3 : 2, focused ? 0xffffff : 0x88a9c1, 0.9);
      });

      this.optionButtons.push({ box, label, optionIndex: index });
    });

    // CRITICAL: Start / Retry Button centered at (320, 180), size (194, 48) for test targets
    const startBox = this.add
      .rectangle(width / 2, height / 2, 194, 48, this.rule.accent, 1)
      .setStrokeStyle(2, 0xfff5c7, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    const startLabel = this.add
      .text(width / 2, height / 2, "", {
        fontFamily: GAME_FONT_FAMILY,
        fontStyle: "bold",
        fontSize: "15px",
        color: "#142033",
      })
      .setOrigin(0.5)
      .setDepth(21);

    startBox.on("pointerdown", () => this.beginAttempt());
    startBox.on("pointerover", () => startBox.setScale(1.04));
    startBox.on("pointerout", () => startBox.setScale(1.0));
    this.startButton = { box: startBox, label: startLabel };
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
    this.enterKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER,
    );
    this.escapeKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
  }

  private ensureQuestActive(): void {
    const status = gameSession.getState().quests[this.rule.questId];
    if (status === "AVAILABLE") {
      const started = gameSession.startQuest(this.rule.questId);
      if (started) this.emitQuestUpdate(started.current);
    }
  }

  private beginAttempt(): void {
    if (this.resolving || this.attempt.phase === "PLAYING") return;
    const started =
      gameSession.getState().quests[this.rule.questId] === "AVAILABLE"
        ? gameSession.startQuest(this.rule.questId)
        : null;
    if (started) this.emitQuestUpdate(started.current);
    this.attempt = startLandmarkChallenge(this.attempt);
    if (this.attempt.phase !== "PLAYING") return;
    this.deadline = this.time.now + this.rule.durationMs;
    this.focusedOption = 0;
    this.lastProgress = 0;
    this.toggleTutorialOverlay(false);
    this.render();
  }

  private activateOption(index: number): void {
    if (this.attempt.phase !== "PLAYING" || this.resolving) return;
    const prevProgress = this.attempt.progress;
    this.attempt = applyLandmarkChallengeInput(this.rule, this.attempt, index);

    if (this.rule.mode === "sequence") {
      if (this.attempt.progress > prevProgress) {
        const btn = this.optionButtons[index];
        if (btn) this.emitSparkles(btn.box.x, btn.box.y, 0x9fe3c0);
      } else if (this.attempt.feedback?.vi.includes("Chưa đúng")) {
        this.triggerWrongFeedback();
      }
    } else {
      const btn = this.optionButtons[index];
      if (btn) this.emitSparkles(btn.box.x, btn.box.y, 0xffd166);
    }

    if (this.attempt.phase === "SUCCESS") {
      this.resolveSuccess();
      return;
    }
    this.render();
  }

  protected triggerWrongFeedback(): void {
    this.cameras.main.shake(150, 0.005);
    const flash = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0xff0000,
      0.2,
    );
    flash.setDepth(90);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });
  }

  private emitSparkles(x: number, y: number, color = 0xffd166): void {
    try {
      for (let i = 0; i < 8; i += 1) {
        const angle = (i * Math.PI * 2) / 8;
        const dist = 25 + Math.random() * 15;
        const dot = this.add.circle(x, y, 3, color, 0.95).setDepth(80);
        this.tweens.add({
          targets: dot,
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          alpha: 0,
          scale: 0.2,
          duration: 350,
          onComplete: () => dot.destroy(),
        });
      }
    } catch {
      // Ignored if shutting down
    }
  }

  private resolveSuccess(): void {
    if (this.resolving) return;
    this.resolving = true;
    this.emitSparkles(this.scale.width / 2, 100, 0xffd166);
    const completed = gameSession.completeQuest(this.rule.questId);
    if (!completed) {
      this.scene.start("OverworldScene");
      return;
    }
    this.emitQuestUpdate(completed.current);
    this.render();
    this.time.delayedCall(700, () => {
      const rewarded = gameSession.rewardQuest(this.rule.questId);
      if (rewarded) {
        this.emitQuestUpdate(rewarded.current);
        const placeKey = QUESTS[this.rule.questId]?.landmarkKey;
        if (placeKey) {
          bridge.emitGameToUi({ type: "POSTCARD_UNLOCKED", placeKey });
        }
      }
      gameSession.flush();
      this.scene.start("OverworldScene");
    });
  }

  private retryQuestState(): void {
    const retried = gameSession.retryQuest(this.rule.questId);
    if (retried) this.emitQuestUpdate(retried.current);
  }

  private leaveQuest(): void {
    if (this.resolving) return;
    if (gameSession.getState().quests[this.rule.questId] === "ACTIVE") {
      this.retryQuestState();
    }
    gameSession.flush();
    this.scene.start("OverworldScene");
  }

  private emitQuestUpdate(
    state: "LOCKED" | "AVAILABLE" | "ACTIVE" | "COMPLETED" | "REWARDED",
  ): void {
    bridge.emitGameToUi({
      type: "QUEST_UPDATED",
      questId: this.rule.questId,
      state,
    });
  }

  private wasInteractPressed(): boolean {
    return Boolean(
      (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) ||
      (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) ||
      (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)),
    );
  }

  protected optionLabel(index: number, language: Language): string {
    const option = getLocalizedChallengeText(
      this.rule.options[index],
      language,
    );
    const value = this.attempt.values[index] ?? 0;
    if (this.rule.mode === "rotate") {
      const direction = DIRECTION_MARKERS[value] ?? "↑";
      return `${option}\n${direction}`;
    }
    if (this.rule.mode === "cycle") {
      const category = this.rule.cycleLabels?.[value];
      const categoryLabel = category
        ? getLocalizedChallengeText(category, language)
        : "";
      return `${option}\n${categoryLabel}`;
    }
    if (this.rule.mode === "toggle") {
      const toggleLabel = value
        ? gameText("SÁNG", "ON")
        : gameText("TẮT", "OFF");
      return `${option}\n${toggleLabel}`;
    }
    const done = this.rule.expected
      .slice(0, this.attempt.progress)
      .includes(index);
    return `${done ? "✓ " : ""}${option}`;
  }

  protected toggleTutorialOverlay(show: boolean): void {
    if (show === this.isTutorialOpen) return;

    if (show && this.attempt.phase === "PLAYING") {
      this.tutorialPausedAt = this.time.now;
    }

    if (!show && this.tutorialPausedAt > 0) {
      this.deadline += this.time.now - this.tutorialPausedAt;
      this.tutorialPausedAt = 0;
    }

    this.isTutorialOpen = show;
    if (show) {
      if (!this.tutorialModalContainer) {
        this.buildTutorialModal();
      }
      this.tutorialModalContainer?.setVisible(true);
    } else {
      this.tutorialModalContainer?.setVisible(false);
    }
  }

  protected abstract getTutorialInfo(language: Language): {
    title: string;
    objective: string;
    steps: string[];
  };

  private buildTutorialModal(): void {
    const { width, height } = this.scale;
    const language = gameSession.getState().language;
    const info = this.getTutorialInfo(language);

    this.tutorialModalContainer = this.add.container(0, 0).setDepth(100);

    // Dim background overlay
    const overlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setInteractive();
    this.tutorialModalContainer.add(overlay);

    // Card frame
    const modalBox = this.add
      .rectangle(width / 2, height / 2, 520, 270, 0x111c2e, 0.98)
      .setStrokeStyle(3, this.rule.accent, 1);
    this.tutorialModalContainer.add(modalBox);

    // Title
    const title = this.add
      .text(width / 2, height / 2 - 110, `ℹ️ HƯỚNG DẪN: ${info.title}`, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "16px",
        fontStyle: "bold",
        color: "#fff3bf",
      })
      .setOrigin(0.5);
    this.tutorialModalContainer.add(title);

    // Objective
    const objText = this.add
      .text(width / 2, height / 2 - 80, info.objective, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "12px",
        color: "#eff8ff",
        align: "center",
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5);
    this.tutorialModalContainer.add(objText);

    // Steps list
    info.steps.forEach((step, idx) => {
      const stepText = this.add
        .text(width / 2 - 230, height / 2 - 45 + idx * 26, step, {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "12px",
          color: "#d9edf7",
          wordWrap: { width: 460 },
        })
        .setOrigin(0, 0.5);
      this.tutorialModalContainer?.add(stepText);
    });

    // Control hint
    const ctrlHint = this.add
      .text(
        width / 2,
        height / 2 + 55,
        gameText(
          "🎮 Bàn phím: ← → chọn · E / Space / Enter kích hoạt · Esc thoát | 📱 Cảm ứng: Chạm trực tiếp",
          "🎮 Keys: ← → select · E / Space / Enter activate · Esc exit | 📱 Touch: Tap items directly",
        ),
        {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "11px",
          color: "#9fe3c0",
        },
      )
      .setOrigin(0.5);
    this.tutorialModalContainer.add(ctrlHint);

    // Close button
    const closeBtn = this.add
      .rectangle(width / 2, height / 2 + 100, 140, 32, this.rule.accent, 1)
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.add
      .text(width / 2, height / 2 + 100, gameText("Đã hiểu", "Got it"), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#142033",
      })
      .setOrigin(0.5);

    closeBtn.on("pointerdown", () => this.toggleTutorialOverlay(false));
    this.tutorialModalContainer.add(closeBtn);
    this.tutorialModalContainer.add(closeLabel);

    this.tutorialModalContainer.setVisible(false);
  }

  protected drawStageVisualizer(): void {
    this.stageContainer = this.add.container(0, 0).setDepth(2);
  }

  protected updateStageVisualizer(): void {
    // Overridden by sub-classes to dynamically update stage elements
  }

  protected render(): void {
    const language = gameSession.getState().language;
    this.titleText.setText(
      getLocalizedChallengeText(this.rule.title, language),
    );
    this.subtitleText.setText(
      getLocalizedChallengeText(this.rule.subtitle, language),
    );

    const playing = this.attempt.phase === "PLAYING";
    this.optionButtons.forEach((button, index) => {
      const focused = playing && index === this.focusedOption;
      const done =
        this.rule.mode === "sequence" &&
        this.rule.expected.slice(0, this.attempt.progress).includes(index);
      button.box
        .setVisible(playing)
        .setFillStyle(
          done ? this.rule.accent : focused ? 0x385c7d : 0x26374b,
          0.96,
        )
        .setStrokeStyle(focused ? 3 : 2, focused ? 0xffffff : 0x88a9c1, 0.9);
      button.label
        .setVisible(playing)
        .setText(this.optionLabel(index, language));
    });

    this.startButton.box.setVisible(!playing && !this.resolving);
    this.startButton.label
      .setVisible(!playing && !this.resolving)
      .setText(
        this.attempt.phase === "FAILED"
          ? gameText("Thử lại", "Try again")
          : gameText("Bắt đầu", "Start"),
      );

    if (playing) {
      this.instructionText.setText(
        getLocalizedChallengeText(this.rule.objective, language),
      );
      this.statusText.setText(
        this.attempt.feedback
          ? getLocalizedChallengeText(this.attempt.feedback, language)
          : gameText(
              "← → chọn · E / Space hoặc chạm",
              "← → select · E / Space or tap",
            ),
      );
      this.timerText.setVisible(true);
    } else if (this.attempt.phase === "SUCCESS" || this.resolving) {
      this.instructionText.setText(
        getLocalizedChallengeText(this.rule.success, language),
      );
      this.statusText.setText(
        gameText("Đang nhận Mảnh Ký Ức…", "Receiving a Memory Fragment…"),
      );
      this.timerText.setVisible(false);
    } else if (this.attempt.phase === "FAILED") {
      this.instructionText.setText(
        getLocalizedChallengeText(this.rule.failure, language),
      );
      this.statusText.setText(
        gameText(
          "Nhấn E / Space hoặc chạm để thử lại.",
          "Press E / Space / Enter or tap to retry.",
        ),
      );
      this.timerText.setVisible(false);
    } else {
      this.instructionText.setText(
        getLocalizedChallengeText(this.rule.objective, language),
      );
      this.statusText.setText(
        gameText(
          "Nhấn E / Space hoặc chạm để bắt đầu.",
          "Press E / Space / Enter or tap to start.",
        ),
      );
      this.timerText.setVisible(false);
    }

    this.updateStageVisualizer();
  }

  private cleanUp(): void {
    this.optionButtons.forEach((button) => button.box.removeAllListeners());
    this.startButton?.box.removeAllListeners();
    this.tutorialModalContainer?.destroy();
  }
}

/** 1. Han River Bridge Turn (`rotate` mode) */
export class HanRiverBridgeQuestScene extends LandmarkChallengeScene {
  private spans: Phaser.GameObjects.Rectangle[] = [];
  private spanLabels: Phaser.GameObjects.Text[] = [];
  private lightBeam?: Phaser.GameObjects.Rectangle;

  public constructor() {
    super("HanRiverBridgeQuestScene", "han_river_bridge_turn");
  }

  protected getTutorialInfo(language: Language) {
    return {
      title: getLocalizedChallengeText(this.rule.title, language),
      objective: gameText(
        "Xoay 4 nhịp cầu về đúng hướng để nối liền hai bờ sông Hàn.",
        "Rotate the 4 bridge spans to their lighted direction to connect both riverbanks.",
      ),
      steps: [
        gameText(
          "1. Chạm từng nhịp cầu để xoay 90° theo chiều kim đồng hồ.",
          "1. Tap each bridge span to rotate it 90° clockwise.",
        ),
        gameText(
          "2. Quan sát mũi tên chỉ hướng (↑ → ↓ ←) trên từng nhịp.",
          "2. Watch the directional indicator (↑ → ↓ ←) on each span.",
        ),
        gameText(
          "3. Khi cả 4 nhịp khớp hướng sáng, luồng sáng sẽ nối 2 bờ!",
          "3. When all 4 spans align, a glowing light ray connects both banks!",
        ),
      ],
    };
  }

  protected override drawStageVisualizer(): void {
    super.drawStageVisualizer();
    const { width } = this.scale;
    const stageY = 105;

    // River background
    const river = this.add.rectangle(width / 2, stageY, 520, 56, 0x0e2540, 0.9);
    river.setStrokeStyle(1.5, 0x1e4976, 0.8);
    this.stageContainer.add(river);

    // River banks
    const westBank = this.add.rectangle(60, stageY, 50, 60, 0x1c3144, 0.95);
    const eastBank = this.add.rectangle(
      width - 60,
      stageY,
      50,
      60,
      0x1c3144,
      0.95,
    );
    westBank.setStrokeStyle(1.5, 0x5a7d9a);
    eastBank.setStrokeStyle(1.5, 0x5a7d9a);
    this.stageContainer.add(westBank);
    this.stageContainer.add(eastBank);

    const westText = this.add
      .text(60, stageY, "Bờ Tây\nWest", {
        fontSize: "9px",
        color: "#88a9c1",
        align: "center",
      })
      .setOrigin(0.5);
    const eastText = this.add
      .text(width - 60, stageY, "Bờ Đông\nEast", {
        fontSize: "9px",
        color: "#88a9c1",
        align: "center",
      })
      .setOrigin(0.5);
    this.stageContainer.add(westText);
    this.stageContainer.add(eastText);

    // Continuous light beam for win state
    this.lightBeam = this.add
      .rectangle(width / 2, stageY, 440, 10, 0xffd166, 0)
      .setDepth(4);
    this.stageContainer.add(this.lightBeam);

    // 4 bridge span graphics
    const spanXs = [145, 260, 385, 495];
    spanXs.forEach((x, i) => {
      const span = this.add.rectangle(x, stageY, 75, 18, 0x26374b, 0.95);
      span.setStrokeStyle(2, 0x88a9c1);
      this.spans.push(span);
      this.stageContainer.add(span);

      const label = this.add
        .text(x, stageY, `Span ${i + 1}`, {
          fontSize: "11px",
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      this.spanLabels.push(label);
      this.stageContainer.add(label);
    });
  }

  protected override updateStageVisualizer(): void {
    const isSuccess = this.attempt.phase === "SUCCESS";
    this.spans.forEach((span, i) => {
      const val = this.attempt.values[i] ?? 0;
      const targetVal = this.rule.expected[i];
      const isMatched = val === targetVal;
      const angle = val * 90;

      span.setAngle(angle);
      if (isMatched || isSuccess) {
        span.setFillStyle(0x3a6073, 0.98);
        span.setStrokeStyle(2.5, 0xffd166, 1);
        this.spanLabels[i].setColor("#ffd166");
      } else {
        span.setFillStyle(0x26374b, 0.95);
        span.setStrokeStyle(2, 0x88a9c1, 0.85);
        this.spanLabels[i].setColor("#ffffff");
      }
    });

    if (this.lightBeam) {
      this.lightBeam.setAlpha(isSuccess ? 0.9 : 0);
    }
  }
}

/** 2. Linh Ung Quiet Path (`sequence` mode) */
export class LinhUngQuestScene extends LandmarkChallengeScene {
  private lotusStones: Phaser.GameObjects.Container[] = [];
  private pathLine?: Phaser.GameObjects.Graphics;

  public constructor() {
    super("LinhUngQuestScene", "linh_ung_quiet_path");
  }

  protected getTutorialInfo(language: Language) {
    return {
      title: getLocalizedChallengeText(this.rule.title, language),
      objective: gameText(
        "Chọn 5 điểm quan sát theo đúng lộ trình trang nghiêm tại Chùa Linh Ứng.",
        "Choose the 5 respectful observation stops in order at Linh Ung Pagoda.",
      ),
      steps: [
        gameText(
          "1. Thứ tự chuẩn: Biển chỉ dẫn 🪧 → Lối đi ⛩️ → Điểm ngắm 🏔️ → Thùng rác 🗑️ → Lối ra 🚪.",
          "1. Respectful order: Trail sign 🪧 → Walkway ⛩️ → Viewpoint 🏔️ → Waste 🗑️ → Exit 🚪.",
        ),
        gameText(
          "2. Tránh chọn các khu vực cấm 🚫 hoặc gây tiếng ồn 🔊.",
          "2. Avoid restricted areas 🚫 or loud noise 🔊.",
        ),
        gameText(
          "3. Mỗi bước đúng làm hoa sen 🪷 thắp sáng đường đi xanh mát.",
          "3. Each correct step blooms a glowing lotus 🪷 on the serene path.",
        ),
      ],
    };
  }

  protected override drawStageVisualizer(): void {
    super.drawStageVisualizer();
    const stageY = 105;

    this.pathLine = this.add.graphics();
    this.stageContainer.add(this.pathLine);

    const stoneXs = [100, 210, 320, 430, 540];
    stoneXs.forEach((x, i) => {
      const container = this.add.container(x, stageY);
      const bg = this.add.circle(0, 0, 22, 0x1f3833, 0.95);
      bg.setStrokeStyle(2, 0x5a8a7c);
      const txt = this.add
        .text(0, 0, `${i + 1}`, {
          fontSize: "13px",
          fontStyle: "bold",
          color: "#9fe3c0",
        })
        .setOrigin(0.5);

      container.add(bg);
      container.add(txt);
      this.lotusStones.push(container);
      this.stageContainer.add(container);
    });
  }

  protected override updateStageVisualizer(): void {
    const progress = this.attempt.progress;
    const stoneXs = [100, 210, 320, 430, 540];
    const stageY = 105;

    if (this.pathLine) {
      this.pathLine.clear();
      this.pathLine.lineStyle(3, 0x3d6658, 0.6);
      this.pathLine.beginPath();
      this.pathLine.moveTo(stoneXs[0], stageY);
      for (let i = 1; i < stoneXs.length; i++) {
        this.pathLine.lineTo(stoneXs[i], stageY);
      }
      this.pathLine.strokePath();

      if (progress > 1) {
        this.pathLine.lineStyle(4, 0x9fe3c0, 0.95);
        this.pathLine.beginPath();
        this.pathLine.moveTo(stoneXs[0], stageY);
        for (let i = 1; i < Math.min(progress, stoneXs.length); i++) {
          this.pathLine.lineTo(stoneXs[i], stageY);
        }
        this.pathLine.strokePath();
      }
    }

    this.lotusStones.forEach((stone, i) => {
      const bg = stone.first as Phaser.GameObjects.Arc;
      const txt = stone.last as Phaser.GameObjects.Text;
      if (i < progress) {
        bg.setFillStyle(0x326955, 0.98);
        bg.setStrokeStyle(2.5, 0x9fe3c0, 1);
        txt.setText("🪷");
      } else {
        bg.setFillStyle(0x1f3833, 0.95);
        bg.setStrokeStyle(2, 0x5a8a7c, 0.85);
        txt.setText(`${i + 1}`);
      }
    });
  }
}

/** 3. Cham Museum Relic Match (`sequence` mode) */
export class ChamMuseumQuestScene extends LandmarkChallengeScene {
  private pedestals: Phaser.GameObjects.Container[] = [];
  private readonly icons = ["☀️", "💃", "⛩️", "🍃"];

  public constructor() {
    super("ChamMuseumQuestScene", "cham_museum_relic_match");
  }

  protected getTutorialInfo(language: Language) {
    return {
      title: getLocalizedChallengeText(this.rule.title, language),
      objective: gameText(
        "Ghép 4 motif cổ vật Chăm theo đúng thứ tự nhãn trưng bày.",
        "Match the 4 Cham sculpture motifs in order shown on the exhibit labels.",
      ),
      steps: [
        gameText(
          "1. Thứ tự ghép: Mặt trời ☀️ → Vũ nữ 💃 → Tháp ⛩️ → Hoa văn lá 🍃.",
          "1. Match order: Sun ☀️ → Dancer 💃 → Tower ⛩️ → Leaf 🍃.",
        ),
        gameText(
          "2. Cổ vật ghép đúng sẽ hiện lên khung trưng bày sang trọng.",
          "2. Correctly placed artifacts glow warmly on their exhibit pedestals.",
        ),
        gameText(
          "3. Ghép đủ 4 motif để tôn vinh di sản điêu khắc Chăm Pa!",
          "3. Match all 4 labels to complete the museum display!",
        ),
      ],
    };
  }

  protected override drawStageVisualizer(): void {
    super.drawStageVisualizer();
    const stageY = 105;
    const pedXs = [110, 250, 390, 530];

    pedXs.forEach((x, i) => {
      const container = this.add.container(x, stageY);
      const box = this.add.rectangle(0, 0, 115, 54, 0x3d271e, 0.95);
      box.setStrokeStyle(2, 0x8a5d43);
      const label = this.add
        .text(0, -12, `Exhibit ${i + 1}`, {
          fontSize: "10px",
          color: "#e9a96b",
        })
        .setOrigin(0.5);
      const icon = this.add
        .text(0, 10, "❓", {
          fontSize: "16px",
        })
        .setOrigin(0.5);

      container.add(box);
      container.add(label);
      container.add(icon);
      this.pedestals.push(container);
      this.stageContainer.add(container);
    });
  }

  protected override updateStageVisualizer(): void {
    const progress = this.attempt.progress;
    this.pedestals.forEach((ped, i) => {
      const box = ped.first as Phaser.GameObjects.Rectangle;
      const icon = ped.last as Phaser.GameObjects.Text;
      if (i < progress) {
        box.setFillStyle(0x6e4331, 0.98);
        box.setStrokeStyle(2.5, 0xe9a96b, 1);
        icon.setText(this.icons[i] ?? "✓");
      } else {
        box.setFillStyle(0x3d271e, 0.95);
        box.setStrokeStyle(2, 0x8a5d43, 0.85);
        icon.setText("❓");
      }
    });
  }
}

/** 4. Non Nuoc Carving Pattern (`sequence` mode) */
export class NonNuocQuestScene extends LandmarkChallengeScene {
  private marbleBlock?: Phaser.GameObjects.Rectangle;
  private carvingProgressText?: Phaser.GameObjects.Text;
  private dragonArtText?: Phaser.GameObjects.Text;

  public constructor() {
    super("NonNuocQuestScene", "non_nuoc_carving_pattern");
  }

  protected getTutorialInfo(language: Language) {
    return {
      title: getLocalizedChallengeText(this.rule.title, language),
      objective: gameText(
        "Thực hiện 6 nét đục đá theo đúng quy trình chạm khắc rồng.",
        "Execute the 6 chisel strokes in proper order from outline to detail.",
      ),
      steps: [
        gameText(
          "1. Thứ tự đục: Viền trái ↖️ → Đỉnh ⬆️ → Viền phải ↗️ → Chân đế ⬇️ → Nét giữa ⏺️ → Chi tiết ✨.",
          "1. Chisel order: Left outline ↖️ → Top ⬆️ → Right outline ↗️ → Base ⬇️ → Centre ⏺️ → Highlight ✨.",
        ),
        gameText(
          "2. Mỗi nét đục chính xác tạo tàn lửa và khắc rõ tác phẩm rồng.",
          "2. Accurate strokes release stone sparkles and carve out the dragon.",
        ),
        gameText(
          "3. Tránh chọn vết thử lỗi ❓ để hoàn thiện pho tượng đá.",
          "3. Avoid test marks ❓ to complete the marble masterpiece.",
        ),
      ],
    };
  }

  protected override drawStageVisualizer(): void {
    super.drawStageVisualizer();
    const { width } = this.scale;
    const stageY = 105;

    this.marbleBlock = this.add.rectangle(
      width / 2,
      stageY,
      320,
      56,
      0x323a40,
      0.95,
    );
    this.marbleBlock.setStrokeStyle(2, 0xbfc5bf);
    this.stageContainer.add(this.marbleBlock);

    this.dragonArtText = this.add
      .text(width / 2, stageY - 8, "🗿 🗿 🗿", {
        fontSize: "16px",
        align: "center",
      })
      .setOrigin(0.5);
    this.stageContainer.add(this.dragonArtText);

    this.carvingProgressText = this.add
      .text(width / 2, stageY + 14, "Khối đá nguyên bản", {
        fontSize: "11px",
        color: "#bfc5bf",
      })
      .setOrigin(0.5);
    this.stageContainer.add(this.carvingProgressText);
  }

  protected override updateStageVisualizer(): void {
    const progress = this.attempt.progress;
    const stages = [
      "🗿 🗿 🗿",
      "✍️ Viền trái ↖️",
      "✍️ Đỉnh ⬆️",
      "✍️ Viền phải ↗️",
      "✍️ Chân đế ⬇️",
      "✍️ Nét giữa ⏺️",
      "🐉 TƯỢNG RỒNG HOÀN THIỆN ✨",
    ];

    if (this.dragonArtText) {
      this.dragonArtText.setText(stages[Math.min(progress, 6)]);
    }

    if (this.carvingProgressText) {
      const pct = Math.round((progress / 6) * 100);
      this.carvingProgressText.setText(
        progress === 6
          ? "Đã hoàn thành 100% tuyệt tác Non Nước!"
          : `Tiến độ chạm khắc: ${progress}/6 nét (${pct}%)`,
      );
      this.carvingProgressText.setColor(progress === 6 ? "#ffd166" : "#bfc5bf");
    }

    if (this.marbleBlock && progress > 0) {
      this.marbleBlock.setStrokeStyle(
        2.5,
        progress === 6 ? 0xffd166 : 0xbfc5bf,
        1,
      );
    }
  }
}

/** 5. Han Market Basket Sort (`cycle` mode) */
export class HanMarketQuestScene extends LandmarkChallengeScene {
  private basketContainers: Phaser.GameObjects.Container[] = [];
  private basketCounts: Phaser.GameObjects.Text[] = [];

  public constructor() {
    super("HanMarketQuestScene", "han_market_basket_sort");
  }

  protected getTutorialInfo(language: Language) {
    return {
      title: getLocalizedChallengeText(this.rule.title, language),
      objective: gameText(
        "Phân loại 8 món hàng vào đúng 3 giỏ: Đặc sản 🍜, Quà tặng 🎁, Dùng ngay 🥤.",
        "Sort 8 market items into 3 baskets: Local food 🍜, Gift 🎁, Ready now 🥤.",
      ),
      steps: [
        gameText(
          "1. Chạm từng món hàng bên dưới để xoay vòng 3 loại giỏ.",
          "1. Tap each item card to cycle through the 3 basket categories.",
        ),
        gameText(
          "2. Cá khô 🐟, Bánh khô 🍪 → Giỏ Đặc sản 🍜.",
          "2. Dried fish 🐟, Dry cake 🍪 → Local food basket 🍜.",
        ),
        gameText(
          "3. Khăn 🧣, Móc khóa 🔑, Túi 🛍️ → Quà tặng 🎁 | Mì 🍜, Trái cây 🥭, Nước 🍹 → Dùng ngay 🥤.",
          "3. Scarf 🧣, Keyring 🔑, Bag 🛍️ → Gift 🎁 | Mi Quang 🍜, Fruit 🥭, Juice 🍹 → Ready now 🥤.",
        ),
      ],
    };
  }

  protected override drawStageVisualizer(): void {
    super.drawStageVisualizer();
    const stageY = 105;
    const basketData = [
      { name: "🍜 Đặc sản", color: 0xffc857, x: 130 },
      { name: "🎁 Quà tặng", color: 0xff6b6b, x: 320 },
      { name: "🥤 Dùng ngay", color: 0x4ecdc4, x: 510 },
    ];

    basketData.forEach((b) => {
      const container = this.add.container(b.x, stageY);
      const box = this.add.rectangle(0, 0, 140, 54, 0x3d2719, 0.95);
      box.setStrokeStyle(2, b.color);
      const title = this.add
        .text(0, -10, b.name, {
          fontSize: "12px",
          fontStyle: "bold",
          color: `#${b.color.toString(16)}`,
        })
        .setOrigin(0.5);
      const count = this.add
        .text(0, 10, "0 món", {
          fontSize: "11px",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      container.add(box);
      container.add(title);
      container.add(count);
      this.basketContainers.push(container);
      this.basketCounts.push(count);
      this.stageContainer.add(container);
    });
  }

  protected override updateStageVisualizer(): void {
    const counts = [0, 0, 0];
    this.attempt.values.forEach((v) => {
      if (counts[v] !== undefined) counts[v] += 1;
    });

    this.basketCounts.forEach((cntText, i) => {
      cntText.setText(`${counts[i]} món`);
    });
  }

  protected override optionLabel(index: number, language: Language): string {
    const option = getLocalizedChallengeText(
      this.rule.options[index],
      language,
    );
    const value = this.attempt.values[index] ?? 0;
    const category = this.rule.cycleLabels?.[value];
    const categoryLabel = category
      ? getLocalizedChallengeText(category, language)
      : "";
    const emojis = ["🍜", "🐟", "🧣", "🔑", "🥭", "🍹", "🍪", "🛍️"];
    const itemEmoji = emojis[index] ?? "📦";
    const isMatched =
      this.attempt.values[index] === this.rule.expected[index] &&
      this.attempt.touched[index];
    return `${isMatched ? "✓ " : ""}${itemEmoji} ${option}\n[${categoryLabel}]`;
  }
}

/** 6. Ba Na Golden Bridge Path (`toggle` mode) */
export class BaNaGoldenBridgeQuestScene extends LandmarkChallengeScene {
  private bridgeTiles: Phaser.GameObjects.Rectangle[] = [];
  private handLeft?: Phaser.GameObjects.Text;
  private handRight?: Phaser.GameObjects.Text;

  public constructor() {
    super("BaNaGoldenBridgeQuestScene", "ba_na_golden_bridge");
  }

  protected getTutorialInfo(language: Language) {
    return {
      title: getLocalizedChallengeText(this.rule.title, language),
      objective: gameText(
        "Bật sáng cả 6 cột mốc gạch để nối liền Cầu Vàng giữa đôi bàn tay đá.",
        "Light up all 6 path tiles to connect the Golden Bridge walkway across the clouds.",
      ),
      steps: [
        gameText(
          "1. Chạm vào các tile gạch (Cột mốc 1 đến 6) để chuyển SÁNG / TẮT.",
          "1. Tap path tiles (Tile 1 to 6) to toggle them ON / OFF.",
        ),
        gameText(
          "2. Khi bật SÁNG cả 6 tile, dải Cầu Vàng sẽ tỏa sáng rực rỡ trên mây.",
          "2. Lighting all 6 tiles connects the radiant walkway between giant stone hands.",
        ),
        gameText(
          "3. Thắp sáng toàn bộ cầu để hoàn thành thử thách Bà Nà Hills!",
          "3. Illuminate the full bridge to complete the Cloud Path challenge!",
        ),
      ],
    };
  }

  protected override drawStageVisualizer(): void {
    super.drawStageVisualizer();
    const { width } = this.scale;
    const stageY = 105;

    this.handLeft = this.add
      .text(65, stageY, "🤲 Bàn Tay Đá", {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#f6cf63",
      })
      .setOrigin(0.5);

    this.handRight = this.add
      .text(width - 65, stageY, "Bàn Tay Đá 🤲", {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#f6cf63",
      })
      .setOrigin(0.5);

    this.stageContainer.add(this.handLeft);
    this.stageContainer.add(this.handRight);

    const tileXs = [150, 218, 286, 354, 422, 490];
    tileXs.forEach((x) => {
      const tile = this.add.rectangle(x, stageY, 54, 42, 0x223648, 0.95);
      tile.setStrokeStyle(2, 0x5a7d9a);
      this.bridgeTiles.push(tile);
      this.stageContainer.add(tile);
    });
  }

  protected override updateStageVisualizer(): void {
    this.bridgeTiles.forEach((tile, i) => {
      const isOn = this.attempt.values[i] === 1;
      if (isOn) {
        tile.setFillStyle(0x8a6f2d, 0.98);
        tile.setStrokeStyle(2.5, 0xf6cf63, 1);
      } else {
        tile.setFillStyle(0x223648, 0.95);
        tile.setStrokeStyle(2, 0x5a7d9a, 0.85);
      }
    });
  }
}

export { LandmarkChallengeScene };
