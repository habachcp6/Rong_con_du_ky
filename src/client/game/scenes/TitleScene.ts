import Phaser from "phaser";
import { bridge } from "../../app/PhaserBridge";
import { gameText } from "../locale";
import { gameSession } from "../state/GameStateStore";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const titleText = this.add.text(width / 2, height / 3, "", {
      font: "bold 28px sans-serif",
      color: "#FFD700",
    });
    titleText.setOrigin(0.5);

    const subtitleText = this.add.text(width / 2, height / 3 + 40, "", {
      font: "18px sans-serif",
      color: "#00E5FF",
    });
    subtitleText.setOrigin(0.5);

    const continueButton = this.add.text(width / 2, height / 2 + 46, "", {
      font: "bold 16px sans-serif",
      color: "#FFFFFF",
      backgroundColor: "#2E7D32",
      padding: { x: 16, y: 10 },
    });
    continueButton.setOrigin(0.5);

    const newGameButton = this.add.text(width / 2, height / 2 + 96, "", {
      font: "bold 15px sans-serif",
      color: "#FFFFFF",
      backgroundColor: "#1565C0",
      padding: { x: 16, y: 9 },
    });
    newGameButton.setOrigin(0.5);

    const instructionsText = this.add
      .text(width / 2, height / 2 + 148, "", {
        font: "13px sans-serif",
        color: "#b9ecff",
      })
      .setOrigin(0.5);
    const refreshCopy = () => {
      titleText.setText(gameText("RỒNG CON DU KÝ", "LITTLE DRAGON'S JOURNEY"));
      subtitleText.setText(gameText("Dấu Ấn Đà Nẵng", "Da Nang Imprints"));
      continueButton.setText(gameText("TIẾP TỤC", "CONTINUE"));
      newGameButton.setText(gameText("CHƠI MỚI", "NEW GAME"));
      instructionsText.setText(
        gameText(
          "Di chuyển: WASD / phím mũi tên · Tương tác: E / Space · Enter: chọn",
          "Move: WASD / arrow keys · Interact: E / Space · Enter: select",
        ),
      );
    };
    refreshCopy();

    const hasSave = gameSession.hasPersistedState();
    if (hasSave) {
      continueButton.setInteractive({ useHandCursor: true });
    } else {
      continueButton.setAlpha(0.45);
    }
    newGameButton.setInteractive({ useHandCursor: true });

    let hasStarted = false;
    const removeStartHandlers = () => {
      continueButton.off("pointerdown", continueGame);
      newGameButton.off("pointerdown", newGame);
      this.input.off("pointerdown", startGame);
      this.input.keyboard?.off("keydown-ENTER", startGame);
      this.input.keyboard?.off("keydown-SPACE", startGame);
    };
    const continueGame = () => {
      if (hasStarted) {
        return;
      }
      if (!hasSave) {
        return;
      }
      hasStarted = true;
      removeStartHandlers();
      this.scene.start("OverworldScene");
    };
    const newGame = () => {
      if (hasStarted) {
        return;
      }
      hasStarted = true;
      gameSession.reset();
      removeStartHandlers();
      this.scene.start("OverworldScene");
    };
    // The gallery is available before the title screen begins. Preserve that
    // useful content path by carrying a requested landmark into the map
    // instead of silently dropping the event while Overworld is not active.
    const startRequestedLandmarkChallenge = (
      questId: string,
      placeKey: string,
    ) => {
      if (hasStarted) {
        return;
      }
      hasStarted = true;
      if (!gameSession.hasPersistedState()) {
        gameSession.reset();
      }
      removeStartHandlers();
      this.scene.start("OverworldScene", {
        requestedQuestId: questId,
        requestedPlaceKey: placeKey,
      });
    };
    const startGame = () => (hasSave ? continueGame() : newGame());
    continueButton.on("pointerdown", continueGame);
    newGameButton.on("pointerdown", newGame);
    // Mobile browsers can deliver a valid Phaser pointer event outside the text
    // object's hit area. Any first canvas touch starts the title safely.
    this.input.once("pointerdown", startGame);
    this.input.keyboard?.once("keydown-ENTER", startGame);
    this.input.keyboard?.once("keydown-SPACE", startGame);
    const unsubscribe = bridge.onUiToGame((event) => {
      if (event.type === "SET_LANGUAGE") refreshCopy();
      if (event.type === "OPEN_LANDMARK_CHALLENGE") {
        startRequestedLandmarkChallenge(event.questId, event.placeKey);
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      removeStartHandlers();
      unsubscribe();
    });
  }
}
