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
import { getPrerequisiteLandmarkName } from "../../content";

type MovementKeys = {
  up: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

type Facing = "south" | "north" | "west" | "east";

type OverworldSceneData = {
  requestedQuestId?: string;
  requestedPlaceKey?: string;
};

const PLAYER_SPEED = 170;

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private movementKeys?: MovementKeys;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private inputEnabled = true;
  private challengeOpen = false;
  private openedQuestId: string | null = null;
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

  public create(data: OverworldSceneData = {}): void {
    this.nearbyInteractable = null;
    this.openedQuestId = null;
    this.challengeOpen = false;
    // Scene instances are reused after a quest. A quest deliberately locks
    // movement before starting, so each map entry must restore its baseline;
    // an open DOM modal immediately acquires the lock again via the bridge.
    this.inputEnabled = true;
    this.physics.world.setBounds(0, 0, WORLD_BOUNDS.width, WORLD_BOUNDS.height);
    this.drawWorld();

    let state = gameSession.getState();
    const recoveredQuestUpdates: Array<{
      questId: string;
      state: "AVAILABLE" | "REWARDED";
      placeKey?: string;
    }> = [];

    // A refresh during an active mini-game resumes safely at the overworld and
    // exposes a fresh deterministic attempt instead of leaving a stuck state.
    const activeQuest = QUEST_INTERACTABLES.find(
      (interactable) => state.quests[interactable.questId] === "ACTIVE",
    );
    if (activeQuest) {
      const restoredQuest = gameSession.retryQuest(activeQuest.questId);
      if (restoredQuest) {
        recoveredQuestUpdates.push({
          questId: activeQuest.questId,
          state: "AVAILABLE",
        });
        state = restoredQuest.state;
      }
    }

    // A browser can also refresh in the short success-animation window after
    // ACTIVE → COMPLETED. Finish that deterministic reducer transition before
    // drawing icon state so no quest becomes stranded without its reward.
    const completedQuest = QUEST_INTERACTABLES.find(
      (interactable) => state.quests[interactable.questId] === "COMPLETED",
    );
    if (completedQuest) {
      const recoveredReward = gameSession.rewardQuest(completedQuest.questId);
      if (recoveredReward) {
        recoveredQuestUpdates.push({
          questId: completedQuest.questId,
          state: "REWARDED",
          placeKey: completedQuest.placeKey,
        });
        state = recoveredReward.state;
      }
    }

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
    this.createQuestLandmarks();
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
        this.closeChallenge();
      }
      if (event.type === "SET_INPUT_ENABLED") {
        this.inputEnabled = event.enabled && !this.challengeOpen;
        if (!this.inputEnabled) {
          this.player.setVelocity(0, 0);
        }
      }
      if (event.type === "START_QUEST") {
        this.startQuest(event.questId);
      }
      if (event.type === "OPEN_LANDMARK_CHALLENGE") {
        const interactable = QUEST_INTERACTABLES.find(
          (candidate) =>
            candidate.questId === event.questId &&
            candidate.placeKey === event.placeKey,
        );
        if (interactable) this.openLandmarkChallenge(interactable, true);
      }
      if (event.type === "SET_LANGUAGE") {
        // Recreate only presentation; saved position and deterministic quest
        // state remain the authority across this lightweight scene restart.
        this.scene.restart();
      }
    });

    for (const recovered of recoveredQuestUpdates) {
      bridge.emitGameToUi({
        type: "QUEST_UPDATED",
        questId: recovered.questId,
        state: recovered.state,
      });
      if (recovered.placeKey) {
        bridge.emitGameToUi({
          type: "POSTCARD_UNLOCKED",
          placeKey: recovered.placeKey,
        });
      }
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.updateInteractionState();

    if (
      import.meta.env.VITE_ENABLE_E2E_BRIDGE === "true" &&
      typeof window !== "undefined"
    ) {
      (window as any).__QUEST_POSITIONS__ = QUEST_INTERACTABLES.map((q) => ({
        id: q.id,
        key: q.placeKey,
        questId: q.questId,
        x: q.x,
        y: q.y,
      }));
      (window as any).__RIVER_BOUNDS__ = RIVER_BOUNDS;
    }

    bridge.emitGameToUi({ type: "OVERWORLD_READY" });

    const requestedLandmark = QUEST_INTERACTABLES.find(
      (interactable) =>
        interactable.questId === data.requestedQuestId &&
        interactable.placeKey === data.requestedPlaceKey,
    );
    if (requestedLandmark) {
      this.openLandmarkChallenge(requestedLandmark, true);
    }
  }

  public update(): void {
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
      if (this.nearbyInteractable) {
        this.openLandmarkChallenge(this.nearbyInteractable);
      }
    }

    gameSession.updatePlayer("OverworldScene", this.player.x, this.player.y);
  }

  private drawWorld(): void {
    this.add
      .image(0, 0, "map_background_overworld_night")
      .setOrigin(0, 0)
      .setDepth(0);

    this.createAnimationOverlays();
  }

  private createAnimationOverlays(): void {
    // 1. River water waves on Han River (x=760 to 940)
    const riverWaveGraphics = this.add.graphics().setDepth(1);
    riverWaveGraphics.lineStyle(2, 0x6ce5ff, 0.4);
    for (let y = 30; y < WORLD_BOUNDS.height; y += 45) {
      riverWaveGraphics.lineBetween(760, y, 940, y);
    }
    this.tweens.add({
      targets: riverWaveGraphics,
      x: { from: -8, to: 8 },
      alpha: { from: 0.3, to: 0.75 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // 2. Lantern flickering: Alpha flickering tweens on decorative lantern light points
    const lanternPositions = [
      { x: 260, y: 240 }, // Ba Na Hills
      { x: 480, y: 490 }, // Han Market
      { x: 710, y: 470 }, // Cham Museum
      { x: 830, y: 250 }, // Han River Bridge
      { x: 880, y: 630 }, // Dragon Bridge
      { x: 1250, y: 210 }, // Son Tra Peninsula
      { x: 1420, y: 220 }, // Linh Ung
      { x: 1200, y: 480 }, // My Khe Beach
      { x: 740, y: 850 }, // Marble Mountains
      { x: 660, y: 880 }, // Non Nuoc
      { x: 230, y: 800 }, // Starter Village
    ];
    lanternPositions.forEach((pos, index) => {
      const outerGlow = this.add
        .circle(pos.x, pos.y, 10, 0xffa500, 0.4)
        .setDepth(2);
      const innerCore = this.add
        .circle(pos.x, pos.y, 4, 0xffd166, 0.85)
        .setDepth(3);

      this.tweens.add({
        targets: [outerGlow, innerCore],
        alpha: { from: 0.25, to: 0.9 },
        scale: { from: 0.85, to: 1.25 },
        duration: 450 + (index % 5) * 150,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // 3. Dragon Bridge fire particles: Particle emitter at dragon head (880, 630) emitting orange/red fire spark particles
    if (!this.textures.exists("fire_particle")) {
      const canvas = this.textures.createCanvas("fire_particle", 8, 8);
      if (canvas) {
        const ctx = canvas.getContext();
        ctx.fillStyle = "#ff5500";
        ctx.beginPath();
        ctx.arc(4, 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.arc(4, 4, 2, 0, Math.PI * 2);
        ctx.fill();
        canvas.refresh();
      }
    }

    try {
      const fireEmitter = this.add.particles(880, 630, "fire_particle", {
        speed: { min: 25, max: 65 },
        angle: { min: 220, max: 320 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 400, max: 850 },
        frequency: 120,
        blendMode: "ADD",
      });
      fireEmitter.setDepth(5);
    } catch {
      const fallbackFire = this.add
        .circle(880, 630, 16, 0xff5500, 0.6)
        .setDepth(5);
      this.tweens.add({
        targets: fallbackFire,
        scale: { from: 0.8, to: 1.5 },
        alpha: { from: 0.3, to: 0.9 },
        duration: 400,
        yoyo: true,
        repeat: -1,
      });
    }

    // 4. My Khe sea waves: Sine wave position/alpha tweens on ocean wave graphics (x > 1200)
    const seaWaveGraphics = this.add.graphics().setDepth(1);
    seaWaveGraphics.lineStyle(3, 0x8ee5ff, 0.5);
    for (let y = 60; y < WORLD_BOUNDS.height; y += 60) {
      seaWaveGraphics.beginPath();
      seaWaveGraphics.arc(1250, y, 25, 0, Math.PI, false);
      seaWaveGraphics.strokePath();
      seaWaveGraphics.beginPath();
      seaWaveGraphics.arc(1350, y + 30, 30, 0, Math.PI, false);
      seaWaveGraphics.strokePath();
    }
    this.tweens.add({
      targets: seaWaveGraphics,
      x: { from: 0, to: 18 },
      alpha: { from: 0.25, to: 0.8 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
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
      obstacle.setVisible(false);
      this.physics.add.existing(obstacle, true);
      this.physics.add.collider(this.player, obstacle);
    });
  }

  /**
   * The landmark icon is the interactive object for every destination. NPCs
   * remain only as four nearby guides; no generic circle marker is used.
   */
  private createQuestLandmarks(): void {
    QUEST_INTERACTABLES.forEach((interactable) => {
      const copy = getQuestInteractableCopy(
        interactable,
        gameSession.getState().language,
      );
      const status = gameSession.getState().quests[interactable.questId];

      if (status === "AVAILABLE") {
        const glow = this.add
          .sprite(interactable.x, interactable.y, interactable.mapIconAssetId)
          .setTint(interactable.color)
          .setScale(1.55)
          .setAlpha(0.22)
          .setDepth(16);
        this.tweens.add({
          targets: glow,
          scaleX: 1.92,
          scaleY: 1.92,
          alpha: 0.03,
          duration: 1250,
          repeat: -1,
          yoyo: true,
          ease: "Sine.easeInOut",
        });
      }

      const icon = this.add
        .sprite(interactable.x, interactable.y, interactable.mapIconAssetId)
        .setScale(1.48)
        .setDepth(18)
        .setInteractive({ useHandCursor: true });
      if (status === "LOCKED") {
        icon.setTint(0x718092).setAlpha(0.58);
      }
      icon.on("pointerdown", () => this.openLandmarkChallenge(interactable));

      if (status === "LOCKED") {
        this.add
          .text(interactable.x + 17, interactable.y + 16, "🔒", {
            fontFamily: "sans-serif",
            fontSize: "13px",
          })
          .setOrigin(0.5)
          .setDepth(20);
      } else if (status === "REWARDED") {
        this.add
          .text(interactable.x + 17, interactable.y + 16, "★", {
            fontFamily: "sans-serif",
            fontSize: "18px",
            color: "#ffd166",
            stroke: "#17243c",
            strokeThickness: 2,
          })
          .setOrigin(0.5)
          .setDepth(20);
      }

      this.add
        .text(interactable.x, interactable.y - 35, copy.name, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#e8f7ff",
          backgroundColor: "#10233dcc",
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(19);
      if (interactable.guide) {
        this.add
          .sprite(
            interactable.x + 31,
            interactable.y + 18,
            interactable.guide.npcTexture,
          )
          .setTint(interactable.color)
          .setScale(0.8)
          .setDepth(19);
      }
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
    const nextQuest =
      QUEST_INTERACTABLES.find((interactable) =>
        isWithinInteractionRange(this.player, interactable),
      ) ?? null;
    if (this.nearbyInteractable?.id === nextQuest?.id) {
      return;
    }

    this.nearbyInteractable = nextQuest;

    let label: string | null = null;

    if (nextQuest) {
      const currentLanguage = gameSession.getState().language;
      const status = gameSession.getState().quests[nextQuest.questId];
      const localized = getQuestInteractableCopy(nextQuest, currentLanguage);
      if (status === "LOCKED") {
        const prereqName = getPrerequisiteLandmarkName(
          nextQuest.questId,
          currentLanguage,
        );
        const lockedTextVi = prereqName
          ? `${localized.name} — Hoàn thành ${prereqName} để mở khóa`
          : `${localized.name} — hoàn thành điểm trước để mở khóa`;
        const lockedTextEn = prereqName
          ? `${localized.name} — Complete ${prereqName} to unlock`
          : `${localized.name} — finish the previous landmark to unlock`;
        label = gameText(lockedTextVi, lockedTextEn);
      } else {
        label =
          status === "REWARDED"
            ? gameText(
                `${localized.name} — xem postcard`,
                `${localized.name} — view postcard`,
              )
            : localized.label;
      }
    }

    this.interactionText.setText(label ?? "").setVisible(Boolean(label));
    this.touchInteractButton.setVisible(Boolean(label));
    this.touchInteractLabel.setVisible(Boolean(label));
    bridge.emitGameToUi({ type: "PLAYER_NEAR_INTERACTABLE", label });
  }

  private openLandmarkChallenge(
    interactable: QuestInteractable,
    fromUi = false,
  ): void {
    if (this.challengeOpen || (!fromUi && !this.inputEnabled)) {
      return;
    }

    const currentStatus = gameSession.getState().quests[interactable.questId];
    if (currentStatus === "REWARDED") {
      this.inputEnabled = false;
      bridge.emitGameToUi({
        type: "OPEN_LANDMARK_DETAIL",
        locationKey: interactable.placeKey,
      });
      return;
    }

    this.challengeOpen = true;
    this.openedQuestId = interactable.questId;
    this.inputEnabled = false;
    this.player.setVelocity(0, 0);
    bridge.emitGameToUi({
      type: "LANDMARK_CHALLENGE_OPEN",
      questId: interactable.questId,
      placeKey: interactable.placeKey,
    });
  }

  private closeChallenge(): void {
    if (!this.challengeOpen) {
      return;
    }

    this.challengeOpen = false;
    this.openedQuestId = null;
    this.inputEnabled = true;
  }

  private startQuest(questId: string): void {
    if (!this.challengeOpen || this.openedQuestId !== questId) {
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
    this.challengeOpen = false;
    this.openedQuestId = null;
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
      this.openLandmarkChallenge(this.nearbyInteractable);
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
