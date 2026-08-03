import { useEffect, useRef, useState } from "react";
import { getDialogueContent, getLocationContent } from "../content";
import { gameSession } from "../game/state/GameStateStore";
import { bridge } from "./PhaserBridge";
import { useModalAccessibility } from "./useModalAccessibility";
import type { Language } from "../../shared/types";

type DialogueState = {
  npcId: string;
  nodeId: string;
};

const QUEST_BY_NPC: Record<string, string> = {
  dragon_bridge_npc: "dragon_bridge_lights",
  my_khe_npc: "my_khe_clean_wave",
  marble_npc: "marble_five_elements",
  son_tra_npc: "son_tra_traces",
};

const PLACE_BY_NPC: Record<string, string> = {
  dragon_bridge_npc: "dragon_bridge",
  my_khe_npc: "my_khe_beach",
  marble_npc: "marble_mountains",
  son_tra_npc: "son_tra_peninsula",
};

type GameUiOverlayProps = {
  language: Language;
};

export const GameUiOverlay = ({ language }: GameUiOverlayProps) => {
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [nearbyLabel, setNearbyLabel] = useState<string | null>(null);
  const [postcardPlaceKey, setPostcardPlaceKey] = useState<string | null>(
    () => gameSession.getState().unlockedPostcards.at(-1) ?? null,
  );
  const lastKnownPostcardRef = useRef<string | null>(postcardPlaceKey);
  const dialogueRef = useRef<HTMLElement | null>(null);
  const postcardRef = useRef<HTMLElement | null>(null);

  useEffect(
    () =>
      bridge.onGameToUi((event) => {
        if (event.type === "DIALOGUE_OPEN")
          setDialogue({ npcId: event.npcId, nodeId: event.nodeId });
        if (event.type === "PLAYER_NEAR_INTERACTABLE")
          setNearbyLabel(event.label);
        if (event.type === "POSTCARD_UNLOCKED")
          setPostcardPlaceKey(event.placeKey);
      }),
    [],
  );

  // The game emits POSTCARD_UNLOCKED for the immediate visual response, but
  // the state store is the durable authority. Watching it as well prevents a
  // slow/mobile React mount from missing the one-shot bridge event after a
  // reward has already been persisted.
  useEffect(
    () =>
      gameSession.subscribe(({ state }) => {
        const latest = state.unlockedPostcards.at(-1) ?? null;
        if (latest === lastKnownPostcardRef.current) return;
        lastKnownPostcardRef.current = latest;
        setPostcardPlaceKey(latest);
      }),
    [],
  );

  useEffect(
    () =>
      bridge.onUiToGame((event) => {
        if (event.type === "DIALOGUE_CLOSE") setDialogue(null);
        if (event.type === "POSTCARD_CLOSE") setPostcardPlaceKey(null);
      }),
    [],
  );

  const closeDialogue = () => {
    bridge.emitUiToGame({ type: "DIALOGUE_CLOSE" });
    bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: true });
  };
  const closePostcard = () => bridge.emitUiToGame({ type: "POSTCARD_CLOSE" });

  useModalAccessibility(dialogueRef, closeDialogue, Boolean(dialogue));
  useModalAccessibility(postcardRef, closePostcard, Boolean(postcardPlaceKey));

  useEffect(() => {
    if (!dialogue) return;
    bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: false });
  }, [dialogue]);

  const questId = dialogue ? QUEST_BY_NPC[dialogue.npcId] : undefined;
  const dialogueContent = dialogue
    ? getDialogueContent(language, dialogue.npcId)
    : undefined;
  const place = dialogue
    ? getLocationContent(language, PLACE_BY_NPC[dialogue.npcId] ?? "")
    : undefined;
  const postcard = postcardPlaceKey
    ? getLocationContent(language, postcardPlaceKey)
    : undefined;
  const dialogueTitle =
    place?.name ??
    (language === "vi"
      ? "Người bạn trên hành trình"
      : "A friend on the journey");
  const dialogueBody =
    dialogue?.nodeId === "quest_locked"
      ? language === "vi"
        ? "Hãy hoàn thành địa danh trước đó để mở khóa thử thách này nhé."
        : "Complete the previous landmark to unlock this challenge."
      : dialogue?.nodeId === "quest_rewarded"
        ? dialogueContent?.successMessage
        : dialogueContent
          ? `${dialogueContent.greeting} ${dialogueContent.questPrompt}`
          : language === "vi"
            ? "Hãy tiếp tục khám phá Đà Nẵng cùng Rồng Con."
            : "Keep exploring Da Nang with Little Dragon.";
  const canStartQuest = dialogue?.nodeId === "quest_intro" && Boolean(questId);

  return (
    <div className="game-ui-overlay" aria-live="polite">
      {nearbyLabel && !dialogue && !postcardPlaceKey ? (
        <p className="game-ui-overlay__hint" data-testid="interaction-hint">
          {nearbyLabel}
        </p>
      ) : null}

      {dialogue ? (
        <section
          ref={dialogueRef}
          className="game-dialogue"
          data-testid="dragon-dialogue"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quest-dialogue-title"
          tabIndex={-1}
        >
          <h2 id="quest-dialogue-title">{dialogueTitle}</h2>
          <p>{dialogueBody}</p>
          {place ? (
            <p className="game-dialogue__source">
              {language === "vi" ? "Nguồn nội dung: " : "Content source: "}
              {place.sourceIds.join(", ")}
            </p>
          ) : null}
          <div className="game-dialogue__actions">
            {canStartQuest && questId ? (
              <button
                type="button"
                data-testid="dragon-quest-start"
                onClick={() => {
                  bridge.emitUiToGame({ type: "START_QUEST", questId });
                  setDialogue(null);
                }}
              >
                {language === "vi" ? "Bắt đầu thử thách" : "Start challenge"}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="dragon-dialogue-close"
              className="game-dialogue__secondary"
              onClick={closeDialogue}
            >
              {language === "vi" ? "Đóng" : "Close"}{" "}
              <span aria-hidden="true">(Esc)</span>
            </button>
          </div>
        </section>
      ) : null}

      {postcardPlaceKey ? (
        <section
          ref={postcardRef}
          className="game-postcard"
          data-testid="dragon-postcard"
          role="dialog"
          aria-modal="true"
          aria-labelledby="postcard-title"
          tabIndex={-1}
        >
          <p className="game-postcard__eyebrow">
            {language === "vi" ? "Mảnh Ký Ức mới" : "New Memory Fragment"}
          </p>
          <h2 id="postcard-title">{postcard?.name ?? postcardPlaceKey}</h2>
          {postcard ? (
            <img
              className="game-postcard__image"
              src={postcard.authoredImage}
              alt={postcard.name}
            />
          ) : null}
          <p>
            {postcard?.shortDescription ??
              (language === "vi"
                ? "Tiến trình của bạn đã được lưu trên thiết bị này."
                : "Your progress has been saved on this device.")}
          </p>
          {postcard ? (
            <p className="game-postcard__source">
              {language === "vi" ? "Nguồn: " : "Sources: "}
              {postcard.sourceIds.join(", ")}
            </p>
          ) : null}
          <button
            type="button"
            data-testid="dragon-postcard-close"
            onClick={closePostcard}
          >
            {language === "vi" ? "Tiếp tục khám phá" : "Keep exploring"}
          </button>
        </section>
      ) : null}
    </div>
  );
};
