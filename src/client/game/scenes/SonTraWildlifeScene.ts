import Phaser from "phaser";
import { bridge } from "../../app/PhaserBridge";
import {
  SON_TRA_TRACE_IDS,
  createSonTraObservationState,
  observeTrace,
  remainingTraces,
  type SonTraTraceId,
} from "../son-tra";
import { gameSession } from "../state/GameStateStore";
import { gameText } from "../locale";

const QUEST_ID = "son_tra_traces";
const PLACE_KEY = "son_tra_peninsula";
const ATTEMPT_DURATION_MS = 60_000;

type TraceView = {
  id: SonTraTraceId;
  label: string;
  description: string;
  x: number;
  y: number;
  marker: Phaser.GameObjects.Arc;
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
  private resolving = false;
  private failed = false;
  private deadline = 0;
  private state = createSonTraObservationState();
  private statusText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private tutorialText!: Phaser.GameObjects.Text;
  private resultPanel?: Phaser.GameObjects.Container;
  private cursors?: Phaser.Input.Keyboard.CursorKeys;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private escapeKey?: Phaser.Input.Keyboard.Key;
  private restartKey?: Phaser.Input.Keyboard.Key;

  public constructor() {
    super({ key: "SonTraWildlifeScene" });
  }

  public create(): void {
    this.resetAttemptState();
    this.ensureQuestActive();
    this.drawForest();
    this.createHud();
    this.createTraces();
    this.createInput();
    this.input.on("pointerdown", this.handleCanvasPointer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
    this.refreshHud();
  }

  public update(): void {
    if (this.resolving) return;
    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.leaveQuest();
      return;
    }
    if (this.tutorialVisible) {
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
    this.timerText.setText(
      gameText(
        `Còn ${Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000))} giây`,
        `${Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000))}s left`,
      ),
    );
  }

  private resetAttemptState(): void {
    this.traceViews = [];
    this.selectedIndex = 0;
    this.tutorialVisible = true;
    this.resolving = false;
    this.failed = false;
    this.deadline = 0;
    this.state = createSonTraObservationState();
    this.resultPanel = undefined;
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
    this.cameras.main.setBackgroundColor("#102f2d");
    this.add.rectangle(width / 2, height / 2, width, height, 0x225c50);
    this.add
      .rectangle(width / 2, height - 42, width, 100, 0x7c7141)
      .setAlpha(0.9);
    for (let x = 36; x < width; x += 78) {
      const canopyY = 72 + ((x * 7) % 75);
      this.add
        .circle(x, canopyY, 42, 0x194235)
        .setStrokeStyle(2, 0x78b06f, 0.42);
      this.add.circle(x + 18, canopyY + 18, 28, 0x2b6a4b).setAlpha(0.9);
    }
    this.add
      .text(width / 2, 20, gameText("DẤU VẾT SƠN TRÀ", "SON TRA TRACES"), {
        fontFamily: "sans-serif",
        fontSize: "21px",
        fontStyle: "bold",
        color: "#fff1b0",
      })
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        height - 18,
        gameText(
          "Quan sát từ xa · Không đuổi theo · Không cho động vật ăn",
          "Observe from afar · Do not chase · Do not feed wildlife",
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#e8f7d5",
        },
      )
      .setOrigin(0.5);
  }

  private createHud(): void {
    this.counterText = this.add.text(18, 16, "", {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#ffffff",
    });
    this.timerText = this.add
      .text(this.scale.width - 18, 16, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#d9f8ff",
      })
      .setOrigin(1, 0);
    this.statusText = this.add
      .text(this.scale.width / 2, this.scale.height - 54, "", {
        fontFamily: "sans-serif",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: this.scale.width - 44 },
      })
      .setOrigin(0.5);
    this.tutorialText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        gameText(
          "Quan sát ba dấu vết thay vì tìm hay đuổi theo động vật.\nDùng ← → và E/Space, hoặc chạm vào dấu vết.\n\nNhấn E / Space hoặc chạm để bắt đầu.",
          "Observe three traces instead of looking for or chasing animals.\nUse ← → and E/Space, or tap a trace.\n\nPress E / Space or tap to begin.",
        ),
        {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: "#ffffff",
          align: "center",
          backgroundColor: "#102a29e8",
          padding: { x: 18, y: 16 },
          wordWrap: { width: this.scale.width - 88 },
        },
      )
      .setOrigin(0.5)
      .setDepth(30);
  }

  private createTraces(): void {
    const definitions: Array<Omit<TraceView, "marker" | "labelText">> = [
      {
        id: "canopy",
        label: gameText("Tán cây rung", "Moving canopy"),
        description: gameText(
          "Một chuyển động nhẹ trên tán cây",
          "A small movement in the canopy",
        ),
        x: 148,
        y: 134,
      },
      {
        id: "footprint",
        label: gameText("Dấu chân", "Footprint"),
        description: gameText(
          "Dấu chân nhỏ trên lối mòn",
          "A small footprint on the trail",
        ),
        x: 334,
        y: 244,
      },
      {
        id: "fruit",
        label: gameText("Quả rơi", "Fallen fruit"),
        description: gameText(
          "Quả rừng còn mới dưới gốc cây",
          "Fresh forest fruit beneath a tree",
        ),
        x: 518,
        y: 162,
      },
    ];
    this.traceViews = definitions.map((definition) => {
      const marker = this.add
        .circle(definition.x, definition.y, 22, 0x9ed86b, 0.72)
        .setStrokeStyle(3, 0xf4ffbd, 0.88)
        .setInteractive({ useHandCursor: true });
      const labelText = this.add
        .text(definition.x, definition.y + 33, definition.label, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#f6ffe6",
          backgroundColor: "#102a29b8",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5);
      marker.on("pointerdown", () => this.inspect(definition.id));
      return { ...definition, marker, labelText };
    });
    this.renderSelection();
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
    if (this.tutorialVisible) this.beginObservation();
    else if (this.failed) this.restartAttempt();
  }

  private isInteractPressed(): boolean {
    return Boolean(
      (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) ||
      (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)),
    );
  }

  private beginObservation(): void {
    if (!this.tutorialVisible) return;
    this.tutorialVisible = false;
    this.tutorialText.setVisible(false);
    this.deadline = this.time.now + ATTEMPT_DURATION_MS;
    this.statusText
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
      trace.marker
        .setFillStyle(found ? 0x70d68d : 0x9ed86b, found ? 0.38 : 0.72)
        .setStrokeStyle(
          index === this.selectedIndex ? 4 : 2,
          index === this.selectedIndex ? 0xffd166 : 0xf4ffbd,
          1,
        )
        .setScale(index === this.selectedIndex ? 1.16 : 1);
      trace.labelText.setAlpha(found ? 0.58 : 1);
    });
  }

  private inspect(traceId: string): void {
    if (this.tutorialVisible || this.failed || this.resolving) return;
    const result = observeTrace(this.state, traceId);
    this.state = result.state;
    if (result.kind === "INVALID") {
      this.statusText
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
      this.statusText
        .setText(
          gameText(
            "Dấu vết này đã được ghi nhận. Hãy tìm dấu hiệu khác.",
            "This trace is already recorded. Find another sign.",
          ),
        )
        .setColor("#ffdb9b");
      return;
    }

    const trace = this.traceViews.find((entry) => entry.id === traceId);
    this.statusText
      .setText(
        gameText(
          `${trace?.description ?? "Đã ghi nhận dấu vết"}! Còn ${remainingTraces(this.state)} dấu vết.`,
          `${trace?.description ?? "Trace recorded"}! ${remainingTraces(this.state)} traces left.`,
        ),
      )
      .setColor("#b9f5b3");
    this.renderSelection();
    this.refreshHud();
    if (result.kind === "COMPLETE") this.completeObservation();
  }

  private completeObservation(): void {
    this.resolving = true;
    this.statusText
      .setText(
        gameText(
          "Quan sát hoàn tất! Sơn Trà cần sự tôn trọng và bảo vệ.",
          "Observation complete! Son Tra deserves respect and protection.",
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
      .rectangle(0, 0, this.scale.width - 70, 138, 0x102a29, 0.98)
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
        `Dấu vết: ${this.state.found.length} / ${SON_TRA_TRACE_IDS.length}`,
        `Traces: ${this.state.found.length} / ${SON_TRA_TRACE_IDS.length}`,
      ),
    );
    if (this.tutorialVisible)
      this.timerText.setText(gameText("Quan sát an toàn", "Safe observation"));
  }

  private cleanUp(): void {
    this.input.off("pointerdown", this.handleCanvasPointer, this);
    this.resultPanel?.destroy();
  }
}
