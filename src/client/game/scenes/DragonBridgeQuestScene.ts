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

/**
 * The mini-game is intentionally deterministic. Gemini is never called here and
 * cannot influence beats, thresholds, quest transitions, or rewards.
 */
export class DragonBridgeQuestScene extends Phaser.Scene {
  private readonly beatMarkers: Phaser.GameObjects.Arc[] = [];
  private readonly bridgeSegments: Phaser.GameObjects.Rectangle[] = [];
  private active = false;
  private currentBeat = 0;
  private correctBeats = 0;
  private incorrectBeats = 0;
  private deadline = 0;
  private beatWasHandled = false;
  private resultVisible = false;
  private resolvingSuccess = false;
  private resultReadyAt = 0;
  private beatTimer: Phaser.Time.TimerEvent | null = null;
  private feedbackText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private tutorialText!: Phaser.GameObjects.Text;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;

  public constructor() {
    super({ key: "DragonBridgeQuestScene" });
  }

  public create(): void {
    this.resetAttemptState();
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#07172d");
    this.drawBridge(width, height);

    this.add
      .text(
        width / 2,
        28,
        gameText("THẮP SÁNG CẦU RỒNG", "LIGHT UP DRAGON BRIDGE"),
        {
          fontFamily: "sans-serif",
          fontSize: "22px",
          fontStyle: "bold",
          color: "#ffe082",
        },
      )
      .setOrigin(0.5);

    this.scoreText = this.add
      .text(18, 18, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(0, 0);
    this.timerText = this.add
      .text(width - 18, 18, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#b9ecff",
      })
      .setOrigin(1, 0);
    this.feedbackText = this.add
      .text(width / 2, height - 62, "", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5);
    this.tutorialText = this.add
      .text(
        width / 2,
        height - 106,
        gameText(
          "Nhấn Space / E hoặc chạm khi vòng tròn phát sáng vàng.\nCần ít nhất 7 / 10 nhịp đúng.",
          "Press Space / E or tap when the circle glows gold.\nYou need at least 7 / 10 correct beats.",
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "15px",
          color: "#e8f7ff",
          align: "center",
          wordWrap: { width: width - 46 },
        },
      )
      .setOrigin(0.5);

    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE,
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
    this.beatMarkers.length = 0;
    this.bridgeSegments.length = 0;
    this.active = false;
    this.currentBeat = 0;
    this.correctBeats = 0;
    this.incorrectBeats = 0;
    this.deadline = 0;
    this.beatWasHandled = false;
    this.resultVisible = false;
    this.resolvingSuccess = false;
    this.resultReadyAt = 0;
  }

  public update(): void {
    if (this.resolvingSuccess) {
      return;
    }

    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.leaveQuest();
      return;
    }

    if (this.resultVisible) {
      if (
        (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) ||
        (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
      ) {
        this.retryFromResult();
      }
      return;
    }

    if (!this.active) {
      if (
        (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) ||
        (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey))
      ) {
        this.beginRhythm();
      }
      return;
    }

    if (
      (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) ||
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

  private drawBridge(width: number, height: number): void {
    const river = this.add
      .rectangle(width / 2, height / 2, width, 136, 0x135a88)
      .setAlpha(0.95);
    river.setStrokeStyle(2, 0x6ce5ff, 0.4);

    const bridgeY = height / 2;
    const bridgeStart = 104;
    const segmentWidth = 86;
    const gap = 10;
    for (let index = 0; index < 5; index += 1) {
      const segment = this.add.rectangle(
        bridgeStart + index * (segmentWidth + gap),
        bridgeY,
        segmentWidth,
        44,
        0x3e4a62,
      );
      segment.setStrokeStyle(2, 0x8095ad, 0.85);
      this.bridgeSegments.push(segment);
    }

    this.add
      .text(width / 2, bridgeY - 6, "🐉", {
        fontFamily: "sans-serif",
        fontSize: "42px",
      })
      .setOrigin(0.5);

    const markerStart = 136;
    for (let index = 0; index < DRAGON_BRIDGE_RHYTHM.totalBeats; index += 1) {
      const marker = this.add
        .circle(markerStart + index * 41, bridgeY + 86, 12, 0x243956, 1)
        .setStrokeStyle(2, 0x6c8fb0, 0.95);
      this.beatMarkers.push(marker);
    }

    this.add
      .text(
        width / 2,
        bridgeY + 120,
        gameText("Theo nhịp đèn năng lượng", "Follow the energy lights"),
        {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#b9ecff",
        },
      )
      .setOrigin(0.5);
  }

  private beginRhythm(): void {
    if (this.active || this.resultVisible) {
      return;
    }

    this.active = true;
    this.currentBeat = 0;
    this.correctBeats = 0;
    this.incorrectBeats = 0;
    this.deadline = this.time.now + DRAGON_BRIDGE_RHYTHM.maximumDurationMs;
    this.tutorialText.setVisible(false);
    this.feedbackText
      .setText(
        gameText(
          "Bắt đầu! Chạm hoặc nhấn đúng nhịp.",
          "Start! Tap or press on the beat.",
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
    this.beatMarkers.forEach((marker, index) => {
      if (index === this.currentBeat) {
        marker.setFillStyle(0xffd166, 1).setScale(1.32);
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

  private handlePointerDown(): void {
    if (this.resolvingSuccess) {
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
    if (!this.active || this.beatWasHandled) {
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
      marker?.setFillStyle(0x7ef29a, 1).setScale(1.08);
      this.lightProgressSegment();
      this.feedbackText
        .setText(
          gameText(
            "Đúng nhịp! Đèn năng lượng đã sáng.",
            "On beat! An energy light is on.",
          ),
        )
        .setColor("#a8ffbd");
    } else {
      this.incorrectBeats += 1;
      marker?.setFillStyle(0xad3d54, 1).setScale(1);
      this.feedbackText
        .setText(
          gameText(
            "Chưa đúng nhịp — đợi vòng tròn vàng tiếp theo.",
            "Not on beat — wait for the next gold circle.",
          ),
        )
        .setColor("#ffb3c1");
    }

    this.refreshHud();
  }

  private lightProgressSegment(): void {
    const index = Math.min(
      this.correctBeats - 1,
      this.bridgeSegments.length - 1,
    );
    this.bridgeSegments[index]
      ?.setFillStyle(0xffc857, 1)
      .setStrokeStyle(2, 0xfff0a8, 1);
  }

  private finishRhythm(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.beatTimer?.remove(false);
    this.beatTimer = null;

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

      this.bridgeSegments.forEach((segment) =>
        segment.setFillStyle(0xffc857, 1).setStrokeStyle(2, 0xfff0a8, 1),
      );
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
      .rectangle(width / 2, height / 2, width - 48, 136, 0x101b2e, 0.96)
      .setStrokeStyle(2, 0xffa3b5, 1);
    this.add
      .text(
        width / 2,
        height / 2,
        gameText(
          `Chưa đủ nhịp (${this.correctBeats} / ${DRAGON_BRIDGE_RHYTHM.totalBeats}).\nHãy thử lại — cần ${requiredRhythmScore()} nhịp đúng.\n\nNhấn E / Space hoặc chạm để thử lại.`,
          `Not enough beats (${this.correctBeats} / ${DRAGON_BRIDGE_RHYTHM.totalBeats}).\nTry again — you need ${requiredRhythmScore()} correct beats.\n\nPress E / Space or tap to retry.`,
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: width - 80 },
        },
      )
      .setOrigin(0.5);
  }

  private playBridgeCelebration(): void {
    const flame = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 42, "🔥  ✨  🔥", {
        fontFamily: "sans-serif",
        fontSize: "32px",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: flame,
      alpha: { from: 0, to: 1 },
      y: flame.y - 24,
      duration: 420,
      yoyo: true,
      repeat: 1,
      onComplete: () => flame.destroy(),
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

    if (this.active) {
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
        : gameText("Tối đa: 60 giây", "Time: 60s"),
    );
  }

  private cleanUp(): void {
    this.beatTimer?.remove(false);
    this.input.off("pointerdown", this.handlePointerDown, this);
  }
}
