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

type SceneButton = {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  optionIndex?: number;
};

type ChallengeQuestId = keyof typeof LANDMARK_CHALLENGE_RULES;

const DIRECTION_MARKERS = ["↑", "→", "↓", "←"] as const;

/**
 * Shared rendering/lifecycle shell for the six new destinations. The rules
 * live in a pure module; this scene only translates deterministic input into
 * pixels, native keyboard controls and touch targets.
 */
abstract class LandmarkChallengeScene extends Phaser.Scene {
  private readonly rule: LandmarkChallengeRule;
  private attempt!: LandmarkChallengeAttempt;
  private deadline = 0;
  private focusedOption = 0;
  private resolving = false;
  private optionButtons: SceneButton[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private startButton!: SceneButton;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;

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
    this.ensureQuestActive();
    this.drawBoard();
    this.createInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.render();
  }

  public update(): void {
    if (this.resolving) return;
    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.leaveQuest();
      return;
    }

    if (this.attempt.phase === "INTRO" || this.attempt.phase === "FAILED") {
      if (this.wasInteractPressed()) this.beginAttempt();
      return;
    }

    if (this.attempt.phase === "SUCCESS") return;

    if (this.time.now >= this.deadline) {
      this.attempt = failLandmarkChallenge(this.attempt);
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
        `Còn ${remainingLandmarkChallengeSeconds(this.deadline, this.time.now)} giây`,
        `${remainingLandmarkChallengeSeconds(this.deadline, this.time.now)}s left`,
      ),
    );
  }

  private ensureQuestActive(): void {
    const status = gameSession.getState().quests[this.rule.questId];
    if (status === "AVAILABLE") {
      const started = gameSession.startQuest(this.rule.questId);
      if (started) this.emitQuestUpdate(started.current);
    }
  }

  private drawBoard(): void {
    const { width, height } = this.scale;
    const columns = this.rule.options.length > 6 ? 2 : 3;
    const rows = Math.ceil(this.rule.options.length / columns);
    const denseGrid = rows > 2;
    const buttonWidth = Math.min(
      180,
      (width - 56 - (columns - 1) * 12) / columns,
    );
    const buttonHeight = denseGrid ? 38 : 52;
    const rowGap = denseGrid ? 8 : 11;
    const startY = denseGrid ? 153 : 166;
    const backgroundColor = `#${this.rule.background
      .toString(16)
      .padStart(6, "0")}`;
    this.cameras.main.setBackgroundColor(backgroundColor);
    this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      this.rule.background,
    );
    this.add
      .rectangle(width / 2, 62, width - 30, 82, 0x101a29, 0.9)
      .setStrokeStyle(2, this.rule.accent, 0.92);

    this.titleText = this.add
      .text(width / 2, 34, "", {
        fontFamily: "sans-serif",
        fontSize: "21px",
        fontStyle: "bold",
        color: "#fff3bf",
        align: "center",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 59, "", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#d9edf7",
      })
      .setOrigin(0.5)
      .setName("challenge-subtitle");
    this.timerText = this.add
      .text(width - 18, 105, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(1, 0.5);
    this.instructionText = this.add
      .text(width / 2, 113, "", {
        fontFamily: "sans-serif",
        fontSize: denseGrid ? "12px" : "14px",
        color: "#eff8ff",
        align: "center",
        wordWrap: { width: width - 56 },
      })
      .setOrigin(0.5, 0);
    this.statusText = this.add
      .text(width / 2, height - (denseGrid ? 22 : 34), "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: width - 48 },
      })
      .setOrigin(0.5);

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
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, y, "", {
          fontFamily: "sans-serif",
          fontSize: denseGrid ? "11px" : "12px",
          color: "#f8fbff",
          align: "center",
          wordWrap: { width: buttonWidth - 14 },
        })
        .setOrigin(0.5);
      box.on("pointerdown", () => this.activateOption(index));
      this.optionButtons.push({ box, label, optionIndex: index });
    });

    const box = this.add
      .rectangle(width / 2, height / 2, 194, 48, this.rule.accent, 1)
      .setStrokeStyle(2, 0xfff5c7, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    const label = this.add
      .text(width / 2, height / 2, "", {
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fontSize: "15px",
        color: "#142033",
      })
      .setOrigin(0.5)
      .setDepth(21);
    box.on("pointerdown", () => this.beginAttempt());
    this.startButton = { box, label };
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
    this.render();
  }

  private activateOption(index: number): void {
    if (this.attempt.phase !== "PLAYING" || this.resolving) return;
    this.attempt = applyLandmarkChallengeInput(this.rule, this.attempt, index);
    if (this.attempt.phase === "SUCCESS") {
      this.resolveSuccess();
      return;
    }
    this.render();
  }

  private resolveSuccess(): void {
    if (this.resolving) return;
    this.resolving = true;
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
      (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)),
    );
  }

  private optionLabel(index: number, language: "vi" | "en"): string {
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

  private render(): void {
    const language = gameSession.getState().language;
    this.titleText.setText(
      getLocalizedChallengeText(this.rule.title, language),
    );
    const subtitle = this.children.getByName(
      "challenge-subtitle",
    ) as Phaser.GameObjects.Text | null;
    subtitle?.setText(getLocalizedChallengeText(this.rule.subtitle, language));

    const playing = this.attempt.phase === "PLAYING";
    this.optionButtons.forEach((button, index) => {
      const focused = playing && index === this.focusedOption;
      const done =
        this.rule.mode === "sequence" &&
        this.rule.expected.slice(0, this.attempt.progress).includes(index);
      button.box
        .setVisible(playing)
        .setFillStyle(
          done ? this.rule.accent : focused ? 0x496984 : 0x26374b,
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
          "Press E / Space or tap to retry.",
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
          "Press E / Space or tap to start.",
        ),
      );
      this.timerText.setVisible(false);
    }
  }

  private cleanUp(): void {
    this.optionButtons.forEach((button) => button.box.removeAllListeners());
    this.startButton?.box.removeAllListeners();
  }
}

export class HanRiverBridgeQuestScene extends LandmarkChallengeScene {
  public constructor() {
    super("HanRiverBridgeQuestScene", "han_river_bridge_turn");
  }
}

export class LinhUngQuestScene extends LandmarkChallengeScene {
  public constructor() {
    super("LinhUngQuestScene", "linh_ung_quiet_path");
  }
}

export class ChamMuseumQuestScene extends LandmarkChallengeScene {
  public constructor() {
    super("ChamMuseumQuestScene", "cham_museum_relic_match");
  }
}

export class NonNuocQuestScene extends LandmarkChallengeScene {
  public constructor() {
    super("NonNuocQuestScene", "non_nuoc_carving_pattern");
  }
}

export class HanMarketQuestScene extends LandmarkChallengeScene {
  public constructor() {
    super("HanMarketQuestScene", "han_market_basket_sort");
  }
}

export class BaNaGoldenBridgeQuestScene extends LandmarkChallengeScene {
  public constructor() {
    super("BaNaGoldenBridgeQuestScene", "ba_na_golden_bridge");
  }
}
