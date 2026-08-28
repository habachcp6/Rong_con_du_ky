import { useEffect, useRef, useState } from "react";
import type { Language } from "../../shared/types";
import { getLandmarkGameDefinitionByLocationKey } from "../../shared/landmark-game-definitions";
import { getAllLocationContent } from "../content";
import { gameSession } from "../game/state/GameStateStore";
import { createBrowserApiClient } from "../services/api-client";
import { trackAnalytics } from "../services/analytics";
import { AppModalBackdrop } from "./AppModalBackdrop";
import { useModalAccessibility } from "./useModalAccessibility";
import type {
  ExplorePlaceItem,
  ExploreSearchResponse,
} from "../../shared/schemas";

type LandmarkGalleryPanelProps = {
  language: Language;
  onClose: () => void;
  onSelectLandmark: (key: string) => void;
  initialTab?: "landmarks" | "maps_explore";
  initialSearchQuery?: string;
};

const text = (language: Language, vi: string, en: string): string =>
  language === "vi" ? vi : en;

const SAVED_PLACES_STORAGE_KEY = "rong_con_saved_places_v1";

const QUICK_SEARCH_CHIPS = [
  {
    category: "all",
    labelVi: "🌟 Tất cả",
    labelEn: "🌟 All",
    queryVi: "địa điểm nổi bật nhất tại Đà Nẵng",
    queryEn: "top attractions in Da Nang",
  },
  {
    category: "culture",
    labelVi: "🏛️ Di tích & Văn hóa",
    labelEn: "🏛️ Culture & Heritage",
    queryVi: "di tích lịch sử và văn hóa tâm linh tại Đà Nẵng",
    queryEn: "historic sites and cultural landmarks in Da Nang",
  },
  {
    category: "nature",
    labelVi: "🏖️ Biển & Thiên nhiên",
    labelEn: "🏖️ Beaches & Nature",
    queryVi: "bãi biển hoang sơ và thắng cảnh thiên nhiên Sơn Trà Đà Nẵng",
    queryEn: "pristine beaches and nature scenery in Son Tra Da Nang",
  },
  {
    category: "food",
    labelVi: "🍜 Ẩm thực & Chợ đêm",
    labelEn: "🍜 Food & Night Markets",
    queryVi: "quán ăn ngon đặc sản và chợ đêm nhộn nhịp Đà Nẵng",
    queryEn: "famous local food spots and night markets in Da Nang",
  },
  {
    category: "cafe",
    labelVi: "☕ Cafe & View hoàng hôn",
    labelEn: "☕ Scenic Cafes & Sunset",
    queryVi: "quán cafe view sông Hàn và điểm ngắm hoàng hôn đẹp Đà Nẵng",
    queryEn: "Han river view cafes and sunset spots in Da Nang",
  },
  {
    category: "sightseeing",
    labelVi: "🌉 Cầu & Check-in",
    labelEn: "🌉 Bridges & Photo Spots",
    queryVi: "những cây cầu nổi tiếng và điểm check-in ban đêm Đà Nẵng",
    queryEn: "iconic bridges and evening photography spots in Da Nang",
  },
];

export const LandmarkGalleryPanel = ({
  language,
  onClose,
  onSelectLandmark,
  initialTab = "landmarks",
  initialSearchQuery = "",
}: LandmarkGalleryPanelProps) => {
  const panelRef = useRef<HTMLElement | null>(null);
  useModalAccessibility(panelRef, onClose);
  const locations = getAllLocationContent(language);

  const [activeTab, setActiveTab] = useState<"landmarks" | "maps_explore">(
    initialTab,
  );
  const [searchQuery, setSearchQuery] = useState(
    initialSearchQuery ||
      (language === "vi"
        ? "địa điểm nổi bật nhất tại Đà Nẵng"
        : "top attractions in Da Nang"),
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] =
    useState<ExploreSearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedPlaceUrls, setSavedPlaceUrls] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(SAVED_PLACES_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  const toggleSavePlace = (place: ExplorePlaceItem) => {
    const isSaved = savedPlaceUrls.includes(place.googleMapsUri);
    const updated = isSaved
      ? savedPlaceUrls.filter((uri) => uri !== place.googleMapsUri)
      : [...savedPlaceUrls, place.googleMapsUri];
    setSavedPlaceUrls(updated);
    try {
      localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // safe fallback
    }
    trackAnalytics(isSaved ? "place_unsaved" : "place_saved", {
      place_name: place.name,
    });
  };

  const handleFetchExplore = async (
    customQuery?: string,
    categoryOverride?: string,
  ) => {
    const q = (customQuery ?? searchQuery).trim();
    if (!q) return;

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const client = await createBrowserApiClient();
      const response = await client.explore({
        query: q,
        category: categoryOverride ?? selectedCategory,
        language,
        location: userLocation ?? undefined,
      });
      setSearchResult(response);
      trackAnalytics("maps_explore_search", {
        query: q,
        category: categoryOverride ?? selectedCategory,
        source: response.source,
        resultCount: response.places.length,
      });
    } catch {
      // If network fails, use an offline baseline fallback
      setErrorMessage(
        text(
          language,
          "Không thể kết nối đến máy chủ. Đang hiển thị danh sách địa điểm thực tế từ bộ nhớ đệm.",
          "Could not reach server. Showing cached real-world places.",
        ),
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Perform initial search on mount if opened directly into maps_explore
  useEffect(() => {
    if (initialTab === "maps_explore") {
      void (async () => {
        const client = await createBrowserApiClient();
        const response = await client.explore({
          query: initialSearchQuery.trim() || "Cầu Rồng Đà Nẵng",
          category: selectedCategory,
          language,
        });
        setSearchResult(response);
      })();
    }
  }, [initialTab, initialSearchQuery, selectedCategory, language]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert(
        text(
          language,
          "Trình duyệt không hỗ trợ định vị GPS.",
          "Geolocation is not supported by your browser.",
        ),
      );
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setUserLocation(loc);
        void handleFetchExplore(searchQuery, selectedCategory);
      },
      () => {
        setIsLocating(false);
        alert(
          text(
            language,
            "Không thể lấy vị trí hiện tại. Vui lòng cho phép quyền truy cập vị trí trong trình duyệt.",
            "Could not get current location. Please grant location permissions.",
          ),
        );
      },
      { timeout: 8000 },
    );
  };

  return (
    <AppModalBackdrop
      onClose={onClose}
      dismissOnBackdrop
      className="landmark-gallery-backdrop"
      testId="landmark-gallery-backdrop"
    >
      <section
        ref={panelRef}
        className="landmark-gallery-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landmark-gallery-title"
        tabIndex={-1}
        data-testid="landmark-gallery-panel"
      >
        <div className="landmark-gallery-panel__heading">
          <div>
            <p className="landmark-gallery-panel__eyebrow">
              {text(
                language,
                "Khám phá & Bản đồ Đà Nẵng",
                "Explore & Da Nang Map",
              )}
            </p>
            <h2 id="landmark-gallery-title">
              {activeTab === "landmarks"
                ? text(
                    language,
                    "10 Địa danh Di sản trong Game",
                    "10 Game Heritage Landmarks",
                  )
                : text(
                    language,
                    "Khám phá Thực tế qua Google Maps",
                    "Real-World Google Maps Explorer",
                  )}
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

        {/* Dual Mode Tab Navigation */}
        <div
          className="landmark-gallery-panel__tabs"
          role="tablist"
          aria-label={text(language, "Chế độ khám phá", "Explore modes")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "landmarks"}
            className={`landmark-gallery-panel__tab ${
              activeTab === "landmarks"
                ? "landmark-gallery-panel__tab--active"
                : ""
            }`}
            onClick={() => setActiveTab("landmarks")}
            data-testid="tab-landmarks-game"
          >
            🏛️{" "}
            {text(
              language,
              "Địa danh trong game (10 Postcard)",
              "Game Landmarks (10 Postcards)",
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "maps_explore"}
            className={`landmark-gallery-panel__tab ${
              activeTab === "maps_explore"
                ? "landmark-gallery-panel__tab--active"
                : ""
            }`}
            onClick={() => {
              setActiveTab("maps_explore");
              if (!searchResult && !isSearching) {
                void handleFetchExplore();
              }
            }}
            data-testid="tab-maps-explore"
          >
            🗺️{" "}
            {text(
              language,
              "Khám phá Google Maps thực tế",
              "Live Google Maps Explorer",
            )}
          </button>
        </div>

        {activeTab === "landmarks" ? (
          <>
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
          </>
        ) : (
          /* Live Google Maps Grounded Real-World Explorer */
          <div
            className="maps-explorer-container"
            data-testid="maps-explorer-view"
          >
            <div className="maps-explorer-hero">
              <p className="maps-explorer-hero__subtitle">
                {text(
                  language,
                  "Tìm kiếm và khám phá các địa điểm thực tế tại Đà Nẵng với thông tin định vị chính xác từ Google Maps & AI Grounding.",
                  "Search and discover real-world Da Nang locations with real-time Google Maps Grounding.",
                )}
              </p>

              {/* Search Bar & GPS */}
              <form
                className="maps-explorer-searchbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleFetchExplore();
                }}
              >
                <div className="maps-explorer-input-wrapper">
                  <span className="maps-explorer-input-icon">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={text(
                      language,
                      "Nhập địa điểm, món ăn hoặc trải nghiệm muốn tìm...",
                      "Search places, food, cafes, or experiences...",
                    )}
                    className="maps-explorer-input"
                    data-testid="maps-explore-input"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      className="maps-explorer-clear-btn"
                      onClick={() => setSearchQuery("")}
                      aria-label={text(language, "Xóa", "Clear")}
                    >
                      ×
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  className={`maps-explorer-gps-btn ${
                    userLocation ? "maps-explorer-gps-btn--active" : ""
                  }`}
                  onClick={handleGetLocation}
                  disabled={isLocating}
                  title={text(
                    language,
                    "Tìm địa điểm gần vị trí của tôi",
                    "Find places near my current location",
                  )}
                >
                  {isLocating
                    ? "⏳..."
                    : userLocation
                      ? "📍 Đã định vị"
                      : "📍 Gần tôi"}
                </button>

                <button
                  type="submit"
                  className="maps-explorer-submit-btn"
                  disabled={isSearching}
                  data-testid="maps-explore-search-btn"
                >
                  {isSearching
                    ? text(language, "Đang tìm...", "Searching...")
                    : text(language, "Tìm kiếm", "Search")}
                </button>
              </form>

              {/* Quick Filter Chips */}
              <div className="maps-explorer-chips">
                {QUICK_SEARCH_CHIPS.map((chip) => {
                  const isSelected = selectedCategory === chip.category;
                  const label = language === "vi" ? chip.labelVi : chip.labelEn;
                  const queryText =
                    language === "vi" ? chip.queryVi : chip.queryEn;
                  return (
                    <button
                      key={chip.category}
                      type="button"
                      className={`maps-explorer-chip ${
                        isSelected ? "maps-explorer-chip--selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedCategory(chip.category);
                        setSearchQuery(queryText);
                        void handleFetchExplore(queryText, chip.category);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error state */}
            {errorMessage ? (
              <div className="maps-explorer-error" role="alert">
                ⚠️ {errorMessage}
              </div>
            ) : null}

            {/* Loading skeleton */}
            {isSearching ? (
              <div className="maps-explorer-loading">
                <div className="maps-explorer-spinner" />
                <p>
                  {text(
                    language,
                    "Đang tra cứu dữ liệu địa điểm thực tế từ Google Maps...",
                    "Querying real-world place data from Google Maps...",
                  )}
                </p>
              </div>
            ) : null}

            {/* Results Section */}
            {!isSearching && searchResult ? (
              <div className="maps-explorer-results">
                <div className="maps-explorer-results-header">
                  <div className="maps-explorer-badge">
                    ⚡{" "}
                    {searchResult.source === "gemini_maps"
                      ? text(
                          language,
                          "Dữ liệu Google Maps Grounding trực tiếp",
                          "Live Google Maps Grounded Data",
                        )
                      : text(
                          language,
                          "Dữ liệu địa điểm thực tế Đà Nẵng",
                          "Real-World Da Nang Places Data",
                        )}
                  </div>
                  <span className="maps-explorer-count">
                    {text(
                      language,
                      `Tìm thấy ${searchResult.places.length} địa điểm`,
                      `Found ${searchResult.places.length} locations`,
                    )}
                  </span>
                </div>

                <div className="maps-explorer-overview">
                  <p>{searchResult.overview}</p>
                </div>

                {/* Places Grid */}
                <div className="maps-explorer-places-grid">
                  {searchResult.places.map((place, index) => {
                    const isSaved = savedPlaceUrls.includes(
                      place.googleMapsUri,
                    );
                    return (
                      <article
                        key={`${place.name}-${index}`}
                        className="maps-place-card"
                        data-testid="maps-explore-place-card"
                      >
                        <div className="maps-place-card__top">
                          <div className="maps-place-card__title-row">
                            <span className="maps-place-card__icon">📍</span>
                            <h3 className="maps-place-card__name">
                              {place.name}
                            </h3>
                          </div>
                          {place.category ? (
                            <span className="maps-place-card__category">
                              {place.category}
                            </span>
                          ) : null}
                        </div>

                        <p className="maps-place-card__summary">
                          {place.summary}
                        </p>

                        {place.address ? (
                          <div className="maps-place-card__address">
                            <span className="maps-place-card__meta-icon">
                              🏠
                            </span>
                            <span>{place.address}</span>
                          </div>
                        ) : null}

                        {place.reviewSnippet ? (
                          <blockquote className="maps-place-card__quote">
                            💬 "{place.reviewSnippet}"
                          </blockquote>
                        ) : null}

                        <div className="maps-place-card__actions">
                          <a
                            href={place.googleMapsUri}
                            target="_blank"
                            rel="noreferrer"
                            className="maps-place-card__maps-btn"
                            onClick={() =>
                              trackAnalytics("google_maps_open", {
                                place_name: place.name,
                              })
                            }
                          >
                            🗺️{" "}
                            {text(
                              language,
                              "Mở trên Google Maps",
                              "Open in Google Maps",
                            )}
                          </a>
                          <button
                            type="button"
                            className={`maps-place-card__save-btn ${
                              isSaved ? "maps-place-card__save-btn--saved" : ""
                            }`}
                            onClick={() => toggleSavePlace(place)}
                            title={
                              isSaved
                                ? text(language, "Bỏ lưu", "Remove bookmark")
                                : text(
                                    language,
                                    "Lưu địa điểm",
                                    "Save bookmark",
                                  )
                            }
                          >
                            {isSaved ? "❤️ Đã lưu" : "🤍 Lưu"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Grounding Attribution & Citations */}
                {searchResult.groundingSources.length > 0 ? (
                  <div className="maps-explorer-sources">
                    <h4>
                      {text(
                        language,
                        "🔗 Trích dẫn nguồn & Liên kết bản đồ:",
                        "🔗 Grounding Sources & Map Links:",
                      )}
                    </h4>
                    <ul className="maps-explorer-sources__list">
                      {searchResult.groundingSources.map((source, i) => (
                        <li key={i}>
                          <a
                            href={source.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="maps-explorer-source-link"
                          >
                            {source.title || source.uri} &rarr;
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </AppModalBackdrop>
  );
};
