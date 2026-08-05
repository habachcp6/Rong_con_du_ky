import { useRef } from "react";
import type { Language } from "../../shared/types";
import { getLandmarkGameDefinitionByLocationKey } from "../../shared/landmark-game-definitions";
import { getCuratedPlaceCards, getLocationContent } from "../content";
import { gameSession } from "../game/state/GameStateStore";
import { trackAnalytics } from "../services/analytics";
import { useModalAccessibility } from "./useModalAccessibility";

type LandmarkDetailPanelProps = {
  landmarkKey: string;
  language: Language;
  onClose: () => void;
  onOpenChallenge: (placeKey: string) => void;
};

const text = (language: Language, vi: string, en: string): string =>
  language === "vi" ? vi : en;

export const LandmarkDetailPanel = ({
  landmarkKey,
  language,
  onClose,
  onOpenChallenge,
}: LandmarkDetailPanelProps) => {
  const panelRef = useRef<HTMLElement | null>(null);
  useModalAccessibility(panelRef, onClose);

  const location = getLocationContent(language, landmarkKey);
  const foodCards = getCuratedPlaceCards(language).filter(
    (card) => card.landmarkKey === landmarkKey,
  );
  const definition = getLandmarkGameDefinitionByLocationKey(landmarkKey);
  const questStatus = definition
    ? gameSession.getState().quests[definition.questId]
    : undefined;

  if (!location) {
    return null;
  }

  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${location.name} Da Nang`,
  )}`;

  return (
    <div
      className="landmark-detail-overlay"
      onClick={onClose}
      data-testid="landmark-detail-backdrop"
    >
      <section
        ref={panelRef}
        className="landmark-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landmark-detail-title"
        tabIndex={-1}
        data-testid="landmark-detail-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="landmark-detail-panel__header">
          <div className="landmark-detail-panel__title-group">
            <div className="landmark-detail-panel__identity">
              {definition ? (
                <img
                  src={definition.mapIconPath}
                  alt=""
                  aria-hidden="true"
                  className="landmark-detail-panel__icon"
                />
              ) : null}
              <span className="landmark-detail-panel__category">
                {text(language, "Thắng cảnh Đà Nẵng", "Da Nang Landmark")}
              </span>
            </div>
            <h2 id="landmark-detail-title">{location.name}</h2>
          </div>
          <button
            type="button"
            className="landmark-detail-panel__close"
            onClick={onClose}
            aria-label={text(
              language,
              "Đóng chi tiết địa danh",
              "Close landmark detail",
            )}
            data-testid="landmark-detail-close"
          >
            ×
          </button>
        </div>

        <div className="landmark-detail-panel__body">
          <div className="landmark-detail-panel__image-container">
            <img
              src={location.authoredImage}
              alt={location.name}
              className="landmark-detail-panel__image"
            />
          </div>

          <div className="landmark-detail-panel__section">
            <h3>{text(language, "Giới thiệu & Lịch sử", "About & History")}</h3>
            <p className="landmark-detail-panel__desc">
              {location.shortDescription}
            </p>
            {definition && questStatus !== "REWARDED" ? (
              <button
                type="button"
                className="landmark-detail-panel__challenge-button"
                onClick={() => onOpenChallenge(definition.locationKey)}
                data-testid="landmark-detail-open-challenge"
              >
                {text(
                  language,
                  "Mở thử thách địa danh",
                  "Open landmark challenge",
                )}
              </button>
            ) : definition ? (
              <p className="landmark-detail-panel__challenge-complete">
                {text(
                  language,
                  "Thử thách đã hoàn thành — Mảnh Ký Ức đã được lưu.",
                  "Challenge completed — the Memory Fragment is saved.",
                )}
              </p>
            ) : null}
          </div>

          {location.funFact ? (
            <div className="landmark-detail-panel__box landmark-detail-panel__box--fact">
              <h4>{text(language, "💡 Bạn có biết?", "💡 Fun Fact")}</h4>
              <p>{location.funFact}</p>
            </div>
          ) : null}

          {location.visitTip ? (
            <div className="landmark-detail-panel__box landmark-detail-panel__box--tip">
              <h4>{text(language, "📌 Mẹo tham quan", "📌 Visit Tip")}</h4>
              <p>{location.visitTip}</p>
            </div>
          ) : null}

          {foodCards.length > 0 ? (
            <div className="landmark-detail-panel__food-section">
              <h3>
                {text(
                  language,
                  "🍽️ Gợi ý ẩm thực lân cận",
                  "🍽️ Nearby Food Suggestions",
                )}
              </h3>
              <div className="landmark-detail-panel__food-grid">
                {foodCards.map((card) => (
                  <article
                    className="place-card"
                    key={`${card.landmarkKey}-${card.name}`}
                  >
                    <h4>{card.name}</h4>
                    <p>{card.description}</p>
                    <p className="place-card__meta">
                      {card.address} · {card.priceRange} ·{" "}
                      {card.dietary === "vegetarian"
                        ? text(language, "Ăn chay", "Vegetarian")
                        : text(language, "Linh hoạt", "Flexible")}
                    </p>
                    <p className="place-card__source">
                      {text(language, "Nguồn: ", "Sources: ")}
                      {card.sourceIds.join(", ")}
                    </p>
                    <a
                      href={card.googleMapsUri}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        trackAnalytics("google_maps_open", {
                          landmark_key: card.landmarkKey,
                        })
                      }
                    >
                      {text(
                        language,
                        "Mở trong Google Maps",
                        "Open in Google Maps",
                      )}
                    </a>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="landmark-detail-panel__footer">
            <div className="landmark-detail-panel__sources">
              <small>
                {text(
                  language,
                  "Nguồn dữ liệu & Trích dẫn: ",
                  "Sources & Attribution: ",
                )}
                {location.sourceIds.join(", ")}
              </small>
            </div>
            <a
              href={mapsSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="landmark-detail-panel__maps-link"
              onClick={() =>
                trackAnalytics("google_maps_open", {
                  landmark_key: location.key,
                })
              }
            >
              🗺️{" "}
              {text(
                language,
                "Xem vị trí trên Google Maps",
                "View location on Google Maps",
              )}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
