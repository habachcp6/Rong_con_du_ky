import type { GameState, Language, QuestStatus } from "../../shared/types";
import { QUEST_ORDER, isJourneyComplete } from "../../shared/game-state";
import { QUESTS } from "../../shared/quests";
import { getLocationContent } from "../content";
import { useRef } from "react";
import { AppModalBackdrop } from "./AppModalBackdrop";
import { useModalAccessibility } from "./useModalAccessibility";

type PassportPanelProps = {
  state: GameState;
  onClose: () => void;
  onOpenEnding: () => void;
};

const statusCopy = (status: QuestStatus, language: Language): string => {
  const vi: Record<QuestStatus, string> = {
    LOCKED: "Chưa mở khóa",
    AVAILABLE: "Sẵn sàng khám phá",
    ACTIVE: "Đang thử thách",
    COMPLETED: "Đã hoàn thành",
    REWARDED: "Đã nhận Mảnh Ký Ức",
  };
  const en: Record<QuestStatus, string> = {
    LOCKED: "Locked",
    AVAILABLE: "Ready to explore",
    ACTIVE: "Challenge in progress",
    COMPLETED: "Completed",
    REWARDED: "Memory Fragment earned",
  };
  return (language === "vi" ? vi : en)[status];
};

export const PassportPanel = ({
  state,
  onClose,
  onOpenEnding,
}: PassportPanelProps) => {
  const complete = isJourneyComplete(state);
  const { language } = state;
  const panelRef = useRef<HTMLElement | null>(null);
  useModalAccessibility(panelRef, onClose);

  return (
    <AppModalBackdrop onClose={onClose} testId="passport-backdrop">
      <section
        ref={panelRef}
        className="passport-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passport-title"
        data-testid="passport-panel"
        tabIndex={-1}
      >
        <div className="passport-panel__heading">
          <div>
            <p className="passport-panel__eyebrow">
              {language === "vi" ? "Hộ chiếu hành trình" : "Journey passport"}
            </p>
            <h2 id="passport-title">
              {language === "vi"
                ? "Mảnh Ký Ức Đà Nẵng"
                : "Da Nang Memory Fragments"}
            </h2>
          </div>
          <button
            type="button"
            className="passport-panel__close"
            onClick={onClose}
            aria-label={language === "vi" ? "Đóng hộ chiếu" : "Close passport"}
          >
            ×
          </button>
        </div>
        <p className="passport-panel__progress">
          {language === "vi"
            ? `${state.memoryFragments} / ${QUEST_ORDER.length} Mảnh Ký Ức đã thu thập`
            : `${state.memoryFragments} / ${QUEST_ORDER.length} Memory Fragments collected`}
        </p>
        <div className="passport-panel__stamps">
          {QUEST_ORDER.map((questId, index) => {
            const quest = QUESTS[questId];
            const status = state.quests[questId];
            const location = getLocationContent(language, quest.landmarkKey);
            const unlocked = status === "REWARDED";
            return (
              <article
                className={`passport-stamp ${unlocked ? "passport-stamp--earned" : "passport-stamp--locked"}`}
                key={questId}
              >
                <span className="passport-stamp__number" aria-hidden="true">
                  {index + 1}
                </span>
                {unlocked && location ? (
                  <img src={location.authoredImage} alt="" aria-hidden="true" />
                ) : (
                  <span
                    className="passport-stamp__placeholder"
                    aria-hidden="true"
                  >
                    ?
                  </span>
                )}
                <div>
                  <h3>
                    {location?.name ??
                      (language === "vi" ? quest.nameVi : quest.nameEn)}
                  </h3>
                  <p>{statusCopy(status, language)}</p>
                  {unlocked && location ? (
                    <small>
                      {language === "vi" ? "Nguồn: " : "Sources: "}
                      {location.sourceIds.join(", ")}
                    </small>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        {complete ? (
          <button
            type="button"
            className="passport-panel__ending"
            onClick={onOpenEnding}
            data-testid="passport-ending-open"
          >
            {language === "vi"
              ? "Mở kết thúc hành trình"
              : "Open journey ending"}
          </button>
        ) : (
          <p className="passport-panel__next">
            {language === "vi"
              ? "Hãy tiếp tục theo biểu tượng địa danh đang phát sáng trên bản đồ."
              : "Follow the softly glowing landmark icon on the map to continue."}
          </p>
        )}
      </section>
    </AppModalBackdrop>
  );
};

type JourneyEndingProps = {
  language: Language;
  onClose: () => void;
};

export const JourneyEnding = ({ language, onClose }: JourneyEndingProps) => {
  const panelRef = useRef<HTMLElement | null>(null);
  useModalAccessibility(panelRef, onClose);
  return (
    <AppModalBackdrop onClose={onClose} testId="journey-ending-backdrop">
      <section
        ref={panelRef}
        className="journey-ending"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-ending-title"
        data-testid="journey-ending"
        tabIndex={-1}
      >
        <p className="journey-ending__eyebrow">
          {language === "vi" ? "Hành trình hoàn tất" : "Journey complete"}
        </p>
        <h2 id="journey-ending-title">
          {language === "vi"
            ? `Rồng Con đã gom đủ ${QUEST_ORDER.length} Mảnh Ký Ức!`
            : `Little Dragon gathered all ${QUEST_ORDER.length} Memory Fragments!`}
        </h2>
        <p>
          {language === "vi"
            ? "Bạn đã mở khóa hành trình Đà Nẵng cá nhân hóa. Hãy mở Hộ chiếu để xem lại những dấu ấn đã khám phá; phần gợi ý và lịch trình sẽ luôn dùng dữ liệu đã biên tập khi AI không sẵn sàng."
            : "You unlocked a personalized Da Nang journey. Open the Passport to revisit your discoveries; recommendations and itineraries always keep an authored fallback when AI is unavailable."}
        </p>
        <button type="button" onClick={onClose}>
          {language === "vi" ? "Tiếp tục khám phá" : "Keep exploring"}
        </button>
      </section>
    </AppModalBackdrop>
  );
};
