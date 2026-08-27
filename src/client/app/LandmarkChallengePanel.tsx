import { useRef } from "react";
import type { Language } from "../../shared/types";
import { getLandmarkGameDefinitionByQuestId } from "../../shared/landmark-game-definitions";
import { QUESTS } from "../../shared/quests";
import { getLocationContent, getPrerequisiteLandmarkName } from "../content";
import { gameSession } from "../game/state/GameStateStore";
import { AppModalBackdrop } from "./AppModalBackdrop";
import { useModalAccessibility } from "./useModalAccessibility";

type LandmarkChallengePanelProps = {
  questId: string;
  placeKey: string;
  language: Language;
  onClose: () => void;
  onStart: (questId: string) => void;
  onOpenDetails: (placeKey: string) => void;
};

const text = (language: Language, vi: string, en: string): string =>
  language === "vi" ? vi : en;

/**
 * A shared, accessible launch surface for all ten deterministic landmark
 * games. The panel reads state but never changes rewards or quest order.
 */
export const LandmarkChallengePanel = ({
  questId,
  placeKey,
  language,
  onClose,
  onStart,
  onOpenDetails,
}: LandmarkChallengePanelProps) => {
  const panelRef = useRef<HTMLElement | null>(null);
  useModalAccessibility(panelRef, onClose);

  const definition = getLandmarkGameDefinitionByQuestId(questId);
  const canonicalPlaceKey = definition?.locationKey ?? placeKey;
  const location = getLocationContent(language, canonicalPlaceKey);
  const quest = definition ? QUESTS[definition.questId] : undefined;
  const status = definition
    ? gameSession.getState().quests[definition.questId]
    : undefined;
  const prerequisite = definition
    ? getPrerequisiteLandmarkName(definition.questId, language)
    : undefined;

  if (!definition || !quest || !location || !status) {
    return null;
  }

  const objective =
    language === "vi" ? quest.descriptionVi : quest.descriptionEn;
  const isLocked = status === "LOCKED";
  const canStart = status === "AVAILABLE";
  const stateLabel = isLocked
    ? text(language, "Chưa mở khóa", "Locked")
    : status === "REWARDED"
      ? text(language, "Đã hoàn thành", "Completed")
      : status === "COMPLETED"
        ? text(language, "Đang lưu phần thưởng", "Saving reward")
        : status === "ACTIVE"
          ? text(language, "Đang thử thách", "In progress")
          : text(language, "Sẵn sàng", "Ready");
  const stateMessage = isLocked
    ? prerequisite
      ? text(
          language,
          `Hoàn thành ${prerequisite} để mở khóa thử thách này.`,
          `Complete ${prerequisite} to unlock this challenge.`,
        )
      : text(
          language,
          "Hoàn thành địa danh ngay trước đó để mở khóa.",
          "Complete the previous landmark to unlock this challenge.",
        )
    : status === "REWARDED"
      ? text(
          language,
          "Mảnh Ký Ức và postcard của địa danh này đã được lưu.",
          "This landmark's Memory Fragment and postcard are saved.",
        )
      : status === "COMPLETED"
        ? text(
            language,
            "Phần thưởng đang được hoàn tất an toàn. Hãy quay lại bản đồ nếu cần.",
            "The reward is being finalized safely. Return to the map if needed.",
          )
        : status === "ACTIVE"
          ? text(
              language,
              "Thử thách đang được khôi phục an toàn. Hãy quay lại bản đồ nếu cần.",
              "This challenge is being safely restored. Return to the map if needed.",
            )
          : text(
              language,
              "Hoàn thành trò chơi để nhận đúng một Mảnh Ký Ức.",
              "Finish the game to earn exactly one Memory Fragment.",
            );

  return (
    <AppModalBackdrop
      onClose={onClose}
      dismissOnBackdrop
      className="landmark-challenge-backdrop"
      testId="landmark-challenge-backdrop"
    >
      <section
        ref={panelRef}
        className="landmark-challenge-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landmark-challenge-title"
        tabIndex={-1}
        data-testid="landmark-challenge-panel"
      >
        <div className="landmark-challenge-panel__heading">
          <img
            className="landmark-challenge-panel__icon"
            src={definition.mapIconPath}
            alt=""
            aria-hidden="true"
          />
          <div>
            <p className="landmark-challenge-panel__eyebrow">
              {text(language, "Thử thách địa danh", "Landmark challenge")}
            </p>
            <h2 id="landmark-challenge-title">{location.name}</h2>
          </div>
          <button
            type="button"
            className="landmark-challenge-panel__close"
            onClick={onClose}
            aria-label={text(language, "Đóng thử thách", "Close challenge")}
            data-testid="landmark-challenge-close"
          >
            ×
          </button>
        </div>

        <p className="landmark-challenge-panel__quest-name">
          {language === "vi" ? quest.nameVi : quest.nameEn}
        </p>
        <p className="landmark-challenge-panel__objective">{objective}</p>
        <p
          className={`landmark-challenge-panel__state landmark-challenge-panel__state--${status.toLowerCase()}`}
        >
          <strong>{stateLabel}.</strong> {stateMessage}
        </p>
        <p className="landmark-challenge-panel__source">
          {text(language, "Nguồn nội dung: ", "Content source: ")}
          {location.sourceIds.join(", ")}
        </p>

        <div className="landmark-challenge-panel__actions">
          {canStart ? (
            <button
              type="button"
              className="landmark-challenge-panel__primary"
              data-testid="landmark-challenge-start"
              onClick={() => onStart(definition.questId)}
            >
              {text(language, "Bắt đầu thử thách", "Start challenge")}
            </button>
          ) : null}
          <button
            type="button"
            className="landmark-challenge-panel__secondary"
            onClick={() => onOpenDetails(canonicalPlaceKey)}
          >
            {text(language, "Xem nội dung địa danh", "View landmark details")}
          </button>
          <button
            type="button"
            className="landmark-challenge-panel__secondary"
            onClick={onClose}
          >
            {text(language, "Đóng", "Close")}{" "}
            <span aria-hidden="true">(Esc)</span>
          </button>
        </div>
      </section>
    </AppModalBackdrop>
  );
};
