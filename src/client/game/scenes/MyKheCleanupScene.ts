import Phaser from "phaser";
import { bridge } from "../../app/PhaserBridge.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import {
  MY_KHE_CLEANUP_RULES,
  MY_KHE_OBSTACLES,
  MY_KHE_POSTCARD_KEY,
  MY_KHE_QUEST_ID,
  MY_KHE_TRASH,
  cleanupDeadline,
  collectTrash,
  createCleanupAttempt,
  getCleanupOutcome,
  remainingCleanupSeconds,
  type CleanupAttempt,
} from "../my-khe.js";
import { gameSession } from "../state/GameStateStore.js";
import { gameText } from "../locale.js";
import { normalizeMovementVector, type MovementVector } from "../world.js";

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
    Phaser.GameObjects.Rectangle
  >();
  private readonly trashIcons = new Map<string, Phaser.GameObjects.Text>();
  private attempt: CleanupAttempt | null = null;
  private active = false;
  private resultVisible = false;
  private resolvingSuccess = false;
  private resultReadyAt = 0;
  private facing: Facing = "south";
  private countText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private tutorialText!: Phaser.GameObjects.Text;
  private rewardTimer: Phaser.Time.TimerEvent | null = null;

  public constructor() {
    super({ key: "MyKheCleanupScene" });
  }

  public create(): void {
    this.resetAttemptState();
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#75c8df");
    this.drawBeach(width, height);
    this.createPlayer();
    this.createObstacles();
    this.createTrash();
    this.createHud(width, height);
    this.createInput();

    this.joystick = new TouchJoystick(this);
    this.joystick.layout(width, height);
    this.scale.on("resize", this.handleResize, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.refreshHud();
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

    if (this.wasInteractPressed()) {
      this.collectNearestTrash();
    }

    this.refreshHud();
  }

  private resetAttemptState(): void {
    this.rewardTimer?.remove(false);
    this.rewardTimer = null;
    this.trashObjects.clear();
    this.trashIcons.clear();
    this.attempt = null;
    this.active = false;
    this.resultVisible = false;
    this.resolvingSuccess = false;
    this.resultReadyAt = 0;
    this.facing = "south";
  }

  private drawBeach(width: number, height: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x35abd0, 1);
    graphics.fillRect(0, 0, width, 70);
    graphics.lineStyle(2, 0xb8f3ff, 0.72);
    for (let x = 8; x < width; x += 38) {
      graphics.lineBetween(x, 44, x + 20, 44);
    }
    graphics.fillStyle(0xf0cc82, 1);
    graphics.fillRect(0, 70, width, height - 70);
    graphics.fillStyle(0xffe7ae, 0.5);
    for (let x = 16; x < width; x += 72) {
      graphics.fillCircle(x, 91 + ((x / 72) % 2) * 20, 6);
    }

    this.add
      .text(width / 2, 16, gameText("SÓNG XANH MỸ KHÊ", "MY KHE BLUE WAVE"), {
        fontFamily: "sans-serif",
        fontSize: "21px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.add
      .text(
        width / 2,
        44,
        gameText(
          "Giữ bãi biển sạch đẹp cùng Rồng Con",
          "Keep the beach clean with Little Dragon",
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#d7f9ff",
        },
      )
      .setOrigin(0.5)
      .setDepth(20);
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
  }

  private createObstacles(): void {
    MY_KHE_OBSTACLES.forEach((definition) => {
      const obstacle = this.add
        .rectangle(
          definition.x,
          definition.y,
          definition.width,
          definition.height,
          definition.color,
        )
        .setDepth(5);
      obstacle.setStrokeStyle(2, 0xffffff, 0.3);
      this.physics.add.existing(obstacle, true);
      this.physics.add.collider(this.player, obstacle);
      this.add
        .text(definition.x, definition.y, definition.label, {
          fontFamily: "sans-serif",
          fontSize: "10px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: definition.width - 8 },
        })
        .setOrigin(0.5)
        .setDepth(6);
    });
  }

  private createTrash(): void {
    MY_KHE_TRASH.forEach((trash) => {
      const item = this.add
        .rectangle(trash.x, trash.y, 20, 16, trash.color)
        .setStrokeStyle(2, 0x1b4051, 0.7)
        .setDepth(10)
        .setInteractive({ useHandCursor: true });
      item.on("pointerdown", () => this.tryCollectTrash(trash.id));
      this.trashObjects.set(trash.id, item);
      const icon = this.add
        .text(trash.x, trash.y - 16, "♻", {
          fontFamily: "sans-serif",
          fontSize: "13px",
        })
        .setOrigin(0.5)
        .setDepth(11);
      this.trashIcons.set(trash.id, icon);
    });
  }

  private createHud(width: number, height: number): void {
    this.countText = this.add
      .text(14, 78, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#173f52",
        backgroundColor: "#fff5d6cf",
        padding: { x: 7, y: 5 },
      })
      .setDepth(30);
    this.timerText = this.add
      .text(width - 14, 78, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#173f52",
        backgroundColor: "#fff5d6cf",
        padding: { x: 7, y: 5 },
      })
      .setOrigin(1, 0)
      .setDepth(30);
    this.feedbackText = this.add
      .text(width / 2, height - 34, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#173f52",
        align: "center",
        backgroundColor: "#fff5d6d9",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tutorialText = this.add
      .text(
        width / 2,
        height / 2,
        gameText(
          "Thu gom 8 món rác trong 60 giây.\nDi chuyển: WASD / mũi tên hoặc joystick.\nĐến gần rác rồi nhấn E / Space, hoặc chạm trực tiếp vào rác.\n\nNhấn E / Space hoặc chạm để bắt đầu · Esc để quay lại.",
          "Collect 8 pieces of litter in 60 seconds.\nMove with WASD / arrows or the joystick.\nStand near litter and press E / Space, or tap it directly.\n\nPress E / Space or tap to start · Esc returns to the map.",
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "15px",
          color: "#ffffff",
          align: "center",
          backgroundColor: "#163a4be8",
          padding: { x: 16, y: 14 },
          wordWrap: { width: width - 72 },
        },
      )
      .setOrigin(0.5)
      .setDepth(40);
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
    this.tutorialText.setVisible(false);
    this.feedbackText
      .setText(
        gameText(
          "Bắt đầu! Hãy nhặt rác trước khi hết giờ.",
          "Start! Pick up the litter before time runs out.",
        ),
      )
      .setColor("#173f52");
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
            "Hãy đứng gần món rác rồi nhấn E / Space.",
            "Stand close to the litter, then press E / Space.",
          ),
        )
        .setColor("#7c4552");
      return;
    }
    this.tryCollectTrash(nearest.trash.id);
  }

  private tryCollectTrash(trashId: string): void {
    if (
      !this.active ||
      !this.attempt ||
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
    item?.disableInteractive();
    item?.destroy();
    this.trashIcons.get(trashId)?.destroy();
    this.trashObjects.delete(trashId);
    this.trashIcons.delete(trashId);
    this.feedbackText
      .setText(
        gameText(
          `Đã nhặt ${this.attempt.collectedIds.length} / ${MY_KHE_CLEANUP_RULES.requiredTrash} món rác!`,
          `Collected ${this.attempt.collectedIds.length} / ${MY_KHE_CLEANUP_RULES.requiredTrash} pieces of litter!`,
        ),
      )
      .setColor("#226c53");
    this.refreshHud();

    if (getCleanupOutcome(this.attempt, this.time.now) === "SUCCESS") {
      this.finishSuccess();
    }
  }

  private finishSuccess(): void {
    if (this.resolvingSuccess || !this.active) {
      return;
    }
    this.active = false;
    this.resolvingSuccess = true;
    this.player.setVelocity(0, 0);

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
          "Bãi biển đã sạch! Đang nhận Mảnh Ký Ức...",
          "The beach is clean! Receiving a Memory Fragment...",
        ),
      )
      .setColor("#226c53");
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
      .rectangle(width / 2, height / 2, width - 54, 150, 0x163a4b, 0.96)
      .setStrokeStyle(2, 0xffd58a, 1)
      .setDepth(50);
    this.add
      .text(
        width / 2,
        height / 2,
        gameText(
          `Chưa kịp dọn sạch (${collected} / ${MY_KHE_CLEANUP_RULES.requiredTrash}).\nMỗi lần thử lại sẽ bắt đầu từ đầu.\n\nNhấn E / Space hoặc chạm để thử lại · Esc để quay lại.`,
          `The beach is not clean yet (${collected} / ${MY_KHE_CLEANUP_RULES.requiredTrash}).\nEach retry starts from the beginning.\n\nPress E / Space or tap to retry · Esc returns to the map.`,
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
        `Rác: ${collected} / ${MY_KHE_CLEANUP_RULES.requiredTrash}`,
        `Litter: ${collected} / ${MY_KHE_CLEANUP_RULES.requiredTrash}`,
      ),
    );
    const seconds = this.attempt
      ? remainingCleanupSeconds(cleanupDeadline(this.attempt), this.time.now)
      : 60;
    this.timerText.setText(
      gameText(`Thời gian: ${seconds}s`, `Time: ${seconds}s`),
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
      this.beginCleanup();
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.joystick.layout(gameSize.width, gameSize.height);
  }

  private cleanUp(): void {
    this.rewardTimer?.remove(false);
    this.rewardTimer = null;
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.scale.off("resize", this.handleResize, this);
    this.joystick?.destroy();
  }
}
