import Phaser from "phaser";
import { bridge } from "../../app/PhaserBridge";
import { TouchJoystick } from "../input/TouchJoystick";
import { gameSession } from "../state/GameStateStore";
import {
  QUEST_INTERACTABLES,
  QUEST_SCENE_BY_ID,
  WORLD_BOUNDS,
  WORLD_COLLIDERS,
  getQuestInteractableCopy,
  isWithinInteractionRange,
  normalizeMovementVector,
  type QuestInteractable,
  type MovementVector,
} from "../world";
import { gameText } from "../locale";

type MovementKeys = {
  up: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

type Facing = "south" | "north" | "west" | "east";

const PLAYER_SPEED = 170;

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private movementKeys?: MovementKeys;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;
  private inputEnabled = true;
  private dialogueOpen = false;
  private nearbyInteractable: QuestInteractable | null = null;
  private facing: Facing = "south";
  private joystick!: TouchJoystick;
  private interactionText!: Phaser.GameObjects.Text;
  private touchInteractButton!: Phaser.GameObjects.Rectangle;
  private touchInteractLabel!: Phaser.GameObjects.Text;
  private bridgeUnsubscribe: (() => void) | null = null;

  public constructor() {
    super({ key: "OverworldScene" });
  }

  public create(): void {
    this.physics.world.setBounds(0, 0, WORLD_BOUNDS.width, WORLD_BOUNDS.height);
    this.drawWorld();

    const state = gameSession.getState();
    const hasRecoverablePosition =
      state.player.scene === "OverworldScene" ||
      Object.values(QUEST_SCENE_BY_ID).includes(state.player.scene);
    const restoredPosition = hasRecoverablePosition
      ? {
          x: Phaser.Math.Clamp(state.player.x, 20, WORLD_BOUNDS.width - 20),
          y: Phaser.Math.Clamp(state.player.y, 20, WORLD_BOUNDS.height - 20),
        }
      : { x: WORLD_BOUNDS.playerStart.x, y: WORLD_BOUNDS.playerStart.y };

    // Returning from any mini-game is a scene transition worth persisting. It
    // also prevents a later refresh from presenting an already-closed scene as
    // the active location.
    if (state.player.scene !== "OverworldScene") {
      gameSession.updatePlayer(
        "OverworldScene",
        restoredPosition.x,
        restoredPosition.y,
      );
      gameSession.flush();
    }

    this.player = this.physics.add.sprite(
      restoredPosition.x,
      restoredPosition.y,
      "dragon_player",
      "south-idle",
    );
    this.player.setDepth(20).setCollideWorldBounds(true);

    this.addColliders();
    this.createQuestNpcs();
    this.createHud();
    this.createInput();

    this.cameras.main.setBounds(0, 0, WORLD_BOUNDS.width, WORLD_BOUNDS.height);
    this.cameras.main.startFollow(this.player, true, 0.13, 0.13);
    this.cameras.main.setRoundPixels(true);

    this.joystick = new TouchJoystick(this);
    this.layoutTouchControls(this.scale.width, this.scale.height);
    this.scale.on("resize", this.handleResize, this);
    this.input.on("pointerdown", this.handlePointerDown, this);

    this.bridgeUnsubscribe = bridge.onUiToGame((event) => {
      if (event.type === "DIALOGUE_CLOSE") {
        this.closeDialogue();
      }
      if (event.type === "SET_INPUT_ENABLED") {
        this.inputEnabled = event.enabled && !this.dialogueOpen;
        if (!this.inputEnabled) {
          this.player.setVelocity(0, 0);
        }
      }
      if (event.type === "START_QUEST") {
        this.startQuest(event.questId);
      }
      if (event.type === "SET_LANGUAGE") {
        // Recreate only presentation; saved position and deterministic quest
        // state remain the authority across this lightweight scene restart.
        this.scene.restart();
      }
    });

    // A refresh during an active mini-game resumes safely at the overworld and
    // exposes a fresh deterministic attempt instead of leaving a stuck state.
    const activeQuest = QUEST_INTERACTABLES.find(
      (interactable) =>
        state.quests[interactable.questId] === "ACTIVE" &&
        state.player.scene === QUEST_SCENE_BY_ID[interactable.questId],
    );
    if (activeQuest) {
      const restoredQuest = gameSession.retryQuest(activeQuest.questId);
      if (restoredQuest) {
        bridge.emitGameToUi({
          type: "QUEST_UPDATED",
          questId: activeQuest.questId,
          state: restoredQuest.current,
        });
      }
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.updateInteractionState();
  }

  public update(): void {
    if (
      this.dialogueOpen &&
      this.escapeKey &&
      Phaser.Input.Keyboard.JustDown(this.escapeKey)
    ) {
      bridge.emitUiToGame({ type: "DIALOGUE_CLOSE" });
      return;
    }

    if (!this.inputEnabled) {
      this.player.setVelocity(0, 0);
      return;
    }

    const keyboardDirection = this.getKeyboardDirection();
    const direction =
      keyboardDirection.x !== 0 || keyboardDirection.y !== 0
        ? keyboardDirection
        : this.joystick.getDirection();
    this.movePlayer(direction);
    this.updateInteractionState();

    if (
      this.nearbyInteractable &&
      ((this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) ||
        (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)))
    ) {
      this.openQuestDialogue();
    }

    gameSession.updatePlayer("OverworldScene", this.player.x, this.player.y);
  }

  private drawWorld(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x244a4d, 1);
    graphics.fillRect(0, 0, WORLD_BOUNDS.width, WORLD_BOUNDS.height);

    // Authored map layers: land, river, road, then landmark decoration.
    graphics.fillStyle(0x2d6d5e, 1);
    graphics.fillRect(0, 0, 650, WORLD_BOUNDS.height);
    graphics.fillRect(1000, 0, WORLD_BOUNDS.width - 1000, WORLD_BOUNDS.height);
    graphics.fillStyle(0x14648d, 1);
    graphics.fillRect(650, 0, 350, WORLD_BOUNDS.height);
    graphics.lineStyle(2, 0x6ce5ff, 0.32);
    for (let y = 24; y < WORLD_BOUNDS.height; y += 38) {
      graphics.lineBetween(664, y, 978, y);
    }

    graphics.fillStyle(0xb79061, 1);
    graphics.fillRect(188, 430, 1110, 88);
    graphics.fillRect(202, 500, 92, 350);
    graphics.fillStyle(0x4f5567, 1);
    graphics.fillRoundedRect(570, 408, 510, 132, 10);
    graphics.lineStyle(3, 0xffd166, 0.88);
    graphics.strokeRoundedRect(570, 408, 510, 132, 10);

    for (let x = 615; x <= 1030; x += 58) {
      graphics.fillStyle(0xffc857, 0.66);
      graphics.fillRect(x, 423, 22, 9);
      graphics.fillRect(x, 516, 22, 9);
    }

    graphics.fillStyle(0x163343, 0.9);
    graphics.fillCircle(1105, 446, 38);
    graphics.fillStyle(0xffd166, 1);
    graphics.fillTriangle(1100, 416, 1138, 445, 1095, 454);

    this.add
      .text(825, 380, gameText("CẦU RỒNG", "DRAGON BRIDGE"), {
        fontFamily: "sans-serif",
        fontStyle: "bold",
        fontSize: "18px",
        color: "#fff3bf",
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.add
      .text(214, 890, gameText("LÀNG KHỞI HÀNH", "STARTING VILLAGE"), {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#e8f7ff",
      })
      .setDepth(5);
  }

  private addColliders(): void {
    WORLD_COLLIDERS.forEach((definition) => {
      const obstacle = this.add
        .rectangle(
          definition.x,
          definition.y,
          definition.width,
          definition.height,
          definition.color,
        )
        .setDepth(8);
      obstacle.setStrokeStyle(2, 0xe8f7ff, 0.22);
      this.physics.add.existing(obstacle, true);
      this.physics.add.collider(this.player, obstacle);
    });
  }

  private createQuestNpcs(): void {
    QUEST_INTERACTABLES.forEach((interactable) => {
      const copy = getQuestInteractableCopy(
        interactable,
        gameSession.getState().language,
      );
      this.add
        .sprite(interactable.x, interactable.y, interactable.npcTexture)
        .setTint(interactable.color)
        .setDepth(18);
      this.add
        .text(interactable.x, interactable.y - 34, copy.npcLabel, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#e8f7ff",
          backgroundColor: "#10233dcc",
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(19);
    });
  }

  private createHud(): void {
    this.interactionText = this.add
      .text(12, 12, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#10233dbd",
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(50)
      .setVisible(false);

    this.touchInteractButton = this.add
      .rectangle(0, 0, 120, 48, 0xffc857, 0.9)
      .setStrokeStyle(2, 0xfff3bf, 1)
      .setScrollFactor(0)
      .setDepth(50)
      .setVisible(false);
    this.touchInteractLabel = this.add
      .text(0, 0, gameText("TƯƠNG TÁC", "INTERACT"), {
        fontFamily: "sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#17243c",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(51)
      .setVisible(false);
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
      direction.x * PLAYER_SPEED,
      direction.y * PLAYER_SPEED,
    );
    if (Math.abs(direction.x) > Math.abs(direction.y)) {
      this.facing = direction.x > 0 ? "east" : "west";
    } else {
      this.facing = direction.y > 0 ? "south" : "north";
    }
    this.player.anims.play(`dragon-${this.facing}`, true);
  }

  private updateInteractionState(): void {
    const nextInteractable =
      QUEST_INTERACTABLES.find((interactable) =>
        isWithinInteractionRange(this.player, interactable),
      ) ?? null;
    if (this.nearbyInteractable?.id === nextInteractable?.id) {
      return;
    }

    this.nearbyInteractable = nextInteractable;
    const status = nextInteractable
      ? gameSession.getState().quests[nextInteractable.questId]
      : undefined;
    const localized = nextInteractable
      ? getQuestInteractableCopy(
          nextInteractable,
          gameSession.getState().language,
        )
      : null;
    const label = localized
      ? status === "LOCKED"
        ? gameText(
            `${localized.npcLabel} — hoàn thành điểm trước để mở khóa`,
            `${localized.npcLabel} — finish the previous landmark to unlock`,
          )
        : localized.label
      : null;
    this.interactionText.setText(label ?? "").setVisible(Boolean(label));
    this.touchInteractButton.setVisible(Boolean(label));
    this.touchInteractLabel.setVisible(Boolean(label));
    bridge.emitGameToUi({ type: "PLAYER_NEAR_INTERACTABLE", label });
  }

  private openQuestDialogue(): void {
    if (!this.nearbyInteractable || this.dialogueOpen) {
      return;
    }

    const currentStatus =
      gameSession.getState().quests[this.nearbyInteractable.questId];
    this.dialogueOpen = true;
    this.inputEnabled = false;
    this.player.setVelocity(0, 0);
    bridge.emitGameToUi({
      type: "DIALOGUE_OPEN",
      npcId: this.nearbyInteractable.npcId,
      nodeId:
        currentStatus === "LOCKED"
          ? "quest_locked"
          : currentStatus === "REWARDED"
            ? "quest_rewarded"
            : "quest_intro",
    });
  }

  private closeDialogue(): void {
    if (!this.dialogueOpen) {
      return;
    }

    this.dialogueOpen = false;
    this.inputEnabled = true;
  }

  private startQuest(questId: string): void {
    if (!this.dialogueOpen || this.nearbyInteractable?.questId !== questId) {
      return;
    }

    const started = gameSession.startQuest(questId);
    if (!started) {
      return;
    }

    bridge.emitGameToUi({
      type: "QUEST_UPDATED",
      questId,
      state: started.current,
    });
    this.dialogueOpen = false;
    this.inputEnabled = false;
    this.player.setVelocity(0, 0);
    bridge.emitGameToUi({ type: "PLAYER_NEAR_INTERACTABLE", label: null });
    gameSession.updatePlayer(
      QUEST_SCENE_BY_ID[questId] ?? "OverworldScene",
      this.player.x,
      this.player.y,
    );
    gameSession.flush();
    this.scene.start(QUEST_SCENE_BY_ID[questId] ?? "OverworldScene");
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.nearbyInteractable || !this.touchInteractButton.visible) {
      return;
    }

    const distance = Math.hypot(
      pointer.x - this.touchInteractButton.x,
      pointer.y - this.touchInteractButton.y,
    );
    if (distance <= 70) {
      this.openQuestDialogue();
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.layoutTouchControls(gameSize.width, gameSize.height);
  }

  private layoutTouchControls(width: number, height: number): void {
    this.joystick?.layout(width, height);
    const x = width - 84;
    const y = height - 62;
    this.touchInteractButton.setPosition(x, y);
    this.touchInteractLabel.setPosition(x, y);
  }

  private cleanUp(): void {
    gameSession.flush();
    this.bridgeUnsubscribe?.();
    this.bridgeUnsubscribe = null;
    this.scale.off("resize", this.handleResize, this);
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.joystick?.destroy();
  }
}
