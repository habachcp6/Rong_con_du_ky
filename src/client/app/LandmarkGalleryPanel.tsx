import { useRef } from "react";
import type { Language } from "../../shared/types";
import { getLandmarkGameDefinitionByLocationKey } from "../../shared/landmark-game-definitions";
import { getAllLocationContent } from "../content";
import { gameSession } from "../game/state/GameStateStore";
import { useModalAccessibility } from "./useModalAccessibility";

type LandmarkGalleryPanelProps = {
  language: Language;
  onClose: () => void;
  onSelectLandmark: (key: string) => void;
};

const text = (language: Language, vi: string, en: string): string =>
  language === "vi" ? vi : en;

export const LandmarkGalleryPanel = ({
  language,
  onClose,
  onSelectLandmark,
}: LandmarkGalleryPanelProps) => {
  const panelRef = useRef<HTMLElement | null>(null);
  useModalAccessibility(panelRef, onClose);
  const locations = getAllLocationContent(language);

  return (
    <div
      className="landmark-gallery-backdrop"
      onClick={onClose}
      data-testid="landmark-gallery-backdrop"
    >
      <section
        ref={panelRef}
        className="landmark-gallery-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landmark-gallery-title"
        tabIndex={-1}
        data-testid="landmark-gallery-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="landmark-gallery-panel__heading">
          <div>
            <p className="landmark-gallery-panel__eyebrow">
              {text(language, "Danh thắng Đà Nẵng", "Da Nang Landmarks")}
            </p>
            <h2 id="landmark-gallery-title">
              {text(language, "Khám phá 10 Địa danh", "Explore 10 Landmarks")}
            </h2>
          </div>
          <button
            type="button"
            className="landmark-gallery-panel__close"
            onClick={onClose}
            aria-label={text(
              language,
              "Đóng bộ sưu tập địa danh",
              "Close landmark gallery",
            )}
            data-testid="landmark-gallery-close"
          >
            ×
          </button>
        </div>
        <p className="landmark-gallery-panel__intro">
          {text(
            language,
            "Bộ sưu tập postcard pixel-art 8/16-bit độc quyền về 10 địa danh thắng cảnh tại Đà Nẵng.",
            "Exclusive 8/16-bit retro pixel-art postcard gallery featuring 10 landmark locations in Da Nang.",
          )}
        </p>

        <div
          className="landmark-gallery-grid"
          data-testid="landmark-gallery-grid"
        >
          {locations.map((location) => {
            const definition = getLandmarkGameDefinitionByLocationKey(
              location.key,
            );
            const status = definition
              ? gameSession.getState().quests[definition.questId]
              : undefined;
            const statusText =
              status === "REWARDED"
                ? text(language, "Đã nhận fragment", "Fragment earned")
                : status === "AVAILABLE"
                  ? text(language, "Có thử thách", "Challenge ready")
                  : text(language, "Theo hành trình", "In journey order");
            return (
              <article
                className="landmark-gallery-card"
                key={location.key}
                data-testid={`landmark-card-${location.key}`}
                onClick={() => onSelectLandmark(location.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectLandmark(location.key);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${location.name} — ${text(language, "Xem chi tiết", "View Details")}`}
              >
                <img
                  src={location.authoredImage}
                  alt={location.name}
                  className="landmark-gallery-card__image"
                />
                <div className="landmark-gallery-card__content">
                  <div className="landmark-gallery-card__title-row">
                    {definition ? (
                      <img
                        className="landmark-gallery-card__icon"
                        src={definition.mapIconPath}
                        alt=""
                        aria-hidden="true"
                      />
                    ) : null}
                    <h3>{location.name}</h3>
                  </div>
                  <p className="landmark-gallery-card__desc">
                    {location.shortDescription}
                  </p>
                  <div className="landmark-gallery-card__footer">
                    <div>
                      <span className="landmark-gallery-card__badge">
                        {statusText}
                      </span>
                      <span className="landmark-gallery-card__badge">
                        {text(language, "Nguồn", "Sources")}:{" "}
                        {location.sourceIds.join(", ")}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="landmark-gallery-card__button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLandmark(location.key);
                      }}
                    >
                      {text(language, "Chi tiết", "Details")} &rarr;
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
