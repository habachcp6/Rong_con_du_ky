import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  getCuratedPlaceCards,
  getDialogueContent,
  getLocationContent,
} from "../content";
import { gameSession } from "../game/state/GameStateStore";
import { trackAnalytics } from "../services/analytics";
import { createBrowserApiClient } from "../services/api-client";
import type { GameState, Language, PlaceCard } from "../../shared/types";
import { QUEST_ORDER } from "../../shared/game-state";
import { useModalAccessibility } from "./useModalAccessibility";

type TravelToolsPanelProps = {
  state: GameState;
  onClose: () => void;
  onStateChange: () => void;
};

export type ChatResult = {
  dialogue: string;
  hint?: string;
  source: "gemini" | "fallback" | "authored";
};

type ItineraryView = {
  title: string;
  summary: string;
  stops: Array<{
    placeKey: string;
    name: string;
    description: string;
    googleMapsUri?: string;
  }>;
  notes: string[];
  source: "gemini" | "fallback" | "authored";
};

const text = (language: Language, vi: string, en: string): string =>
  language === "vi" ? vi : en;

const toBudget = (value: string): number | undefined => {
  const parsed = Number.parseInt(value.replaceAll(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const mapsSearchUrl = (name: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} Da Nang`)}`;

/** Every canonical quest has an authored dialogue node. Keeping this total
 * mapping beside the companion entry point makes a missing new-landmark hint a
 * type error rather than silently falling back to Dragon Bridge copy. */
const DIALOGUE_NODE_BY_QUEST: Record<(typeof QUEST_ORDER)[number], string> = {
  dragon_bridge_lights: "dragon_bridge_npc",
  my_khe_clean_wave: "my_khe_npc",
  marble_five_elements: "marble_npc",
  son_tra_traces: "son_tra_npc",
  han_river_bridge_turn: "han_river_bridge_guide",
  linh_ung_quiet_path: "linh_ung_guide",
  cham_museum_relic_match: "cham_museum_guide",
  non_nuoc_carving_pattern: "non_nuoc_guide",
  han_market_basket_sort: "han_market_guide",
  ba_na_golden_bridge: "ba_na_guide",
};

/** Prefer a live challenge for a hint, then the one available campaign
 * frontier. The order comes from the canonical game state, never a UI list. */
export const getCompanionQuestId = (
  state: GameState,
): (typeof QUEST_ORDER)[number] | undefined =>
  QUEST_ORDER.find((questId) => state.quests[questId] === "ACTIVE") ??
  QUEST_ORDER.find((questId) => state.quests[questId] === "AVAILABLE");

export const createCompanionChatRequest = (
  state: GameState,
  message: string,
) => {
  const questId = getCompanionQuestId(state);
  return {
    language: state.language,
    message,
    unlockedPostcards: state.unlockedPostcards,
    ...(questId ? { questId } : {}),
  };
};

const localRecommendations = (
  language: Language,
  landmarkKey: string,
  dietary: "any" | "vegetarian",
): PlaceCard[] => {
  const cards = getCuratedPlaceCards(language);
  const landmarkMatches = landmarkKey
    ? cards.filter((card) => card.landmarkKey === landmarkKey)
    : cards;
  const dietaryMatches =
    dietary === "vegetarian"
      ? landmarkMatches.filter((card) => card.dietary === "vegetarian")
      : landmarkMatches;
  return (dietaryMatches.length ? dietaryMatches : landmarkMatches).slice(0, 5);
};

const authoredItinerary = (state: GameState): ItineraryView => {
  const locations = state.unlockedPostcards
    .map((placeKey) => getLocationContent(state.language, placeKey))
    .filter((location): location is NonNullable<typeof location> =>
      Boolean(location),
    );
  const language = state.language;
  return {
    title: text(language, "Lịch trình Dấu Ấn Đà Nẵng", "Da Nang Memory Trail"),
    summary:
      locations.length > 0
        ? text(
            language,
            `Lịch trình được tạo từ ${locations.length} địa danh bạn đã mở khóa và nội dung đã biên tập.`,
            `This route uses the ${locations.length} landmarks you unlocked and authored content.`,
          )
        : text(
            language,
            "Hãy hoàn thành một thử thách để mở khóa điểm dừng đầu tiên.",
            "Complete a challenge to unlock your first stop.",
          ),
    stops: locations.map((location) => ({
      placeKey: location.key,
      name: location.name,
      description: location.visitTip,
      googleMapsUri: mapsSearchUrl(location.name),
    })),
    notes: [
      text(
        language,
        "Kiểm tra thông tin hiện tại và điều kiện thời tiết trước khi đi.",
        "Check current information and weather before you go.",
      ),
    ],
    source: "authored",
  };
};

export const authoredChat = (state: GameState): ChatResult => {
  const questId = getCompanionQuestId(state);
  const npcId = questId ? DIALOGUE_NODE_BY_QUEST[questId] : undefined;
  const node = npcId ? getDialogueContent(state.language, npcId) : undefined;
  return {
    dialogue:
      node?.questPrompt ??
      text(
        state.language,
        "Hãy đến gần một địa danh và nhấn E hoặc Space để bắt đầu thử thách.",
        "Walk to a landmark and press E or Space to begin a challenge.",
      ),
    hint: node?.failureMessage,
    source: "authored",
  };
};

const sourceLabel = (
  source: ChatResult["source"] | ItineraryView["source"],
  language: Language,
): string => {
  if (source === "gemini") return "Gemini";
  if (source === "fallback")
    return text(language, "fallback được biên tập", "authored fallback");
  return text(
    language,
    "nội dung biên tập offline",
    "offline authored content",
  );
};

export const TravelToolsPanel = ({
  state,
  onClose,
  onStateChange,
}: TravelToolsPanelProps) => {
  const { language } = state;
  const panelRef = useRef<HTMLElement | null>(null);
  useModalAccessibility(panelRef, onClose);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatResult | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [budget, setBudget] = useState(
    state.preferences.budgetVnd
      ? String(state.preferences.budgetVnd)
      : "150000",
  );
  const [dietary, setDietary] = useState<"any" | "vegetarian">(
    state.preferences.dietary ?? "any",
  );
  const [landmarkKey, setLandmarkKey] = useState(
    state.unlockedPostcards.at(-1) ?? "",
  );
  const [places, setPlaces] = useState<PlaceCard[] | null>(null);
  const [recommendationNotice, setRecommendationNotice] = useState<
    string | null
  >(null);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryView | null>(null);
  const [itineraryBusy, setItineraryBusy] = useState(false);

  useEffect(() => {
    if (!places) return;
    places.forEach((place) => {
      trackAnalytics("place_card_open", { landmark_key: place.landmarkKey });
    });
  }, [places]);

  const requestChat = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || chatBusy) return;
    setChatBusy(true);
    try {
      const client = await createBrowserApiClient();
      const response = await client.chat(
        createCompanionChatRequest(state, trimmed),
      );
      setChat({
        dialogue: response.reply.dialogue,
        hint: response.reply.hint,
        source: response.source,
      });
    } catch {
      setChat(authoredChat(state));
    } finally {
      setChatBusy(false);
    }
  };

  const requestRecommendations = async (event: FormEvent) => {
    event.preventDefault();
    if (recommendationBusy) return;
    const budgetVnd = toBudget(budget);
    gameSession.updatePreferences({ budgetVnd, dietary });
    trackAnalytics("food_preferences_submitted", {
      dietary,
      has_budget: Boolean(budgetVnd),
      landmark_key: landmarkKey || "all",
    });
    onStateChange();
    setRecommendationBusy(true);
    try {
      const client = await createBrowserApiClient();
      const response = await client.recommendations({
        language,
        ...(landmarkKey ? { landmarkKey } : {}),
        ...(budgetVnd ? { budgetVnd } : {}),
        dietary,
      });
      setPlaces(response.places);
      setRecommendationNotice(response.notice);
    } catch {
      const fallback = localRecommendations(language, landmarkKey, dietary);
      setPlaces(fallback);
      setRecommendationNotice(
        text(
          language,
          "Không kết nối được dịch vụ; đang hiển thị các thẻ địa điểm đã biên tập trên thiết bị.",
          "The service is unavailable; showing authored place cards saved in this app.",
        ),
      );
    } finally {
      setRecommendationBusy(false);
    }
  };

  const requestItinerary = async () => {
    if (itineraryBusy) return;
    setItineraryBusy(true);
    try {
      const client = await createBrowserApiClient();
      const response = await client.itinerary({
        language,
        unlockedPostcards: state.unlockedPostcards,
        preferences: state.preferences,
      });
      setItinerary({ ...response.itinerary, source: response.source });
      trackAnalytics("itinerary_created", { source: response.source });
    } catch {
      const fallback = authoredItinerary(state);
      setItinerary(fallback);
      trackAnalytics("itinerary_created", { source: fallback.source });
    } finally {
      setItineraryBusy(false);
    }
  };

  return (
    <section
      ref={panelRef}
      className="travel-tools-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="travel-tools-title"
      tabIndex={-1}
      data-testid="travel-tools-panel"
    >
      <div className="travel-tools-panel__heading">
        <div>
          <p className="travel-tools-panel__eyebrow">
            {text(language, "Trợ lý hành trình", "Journey companion")}
          </p>
          <h2 id="travel-tools-title">
            {text(
              language,
              "Rồng Con giúp bạn lên đường",
              "Little Dragon helps you plan",
            )}
          </h2>
        </div>
        <button
          type="button"
          className="travel-tools-panel__close"
          onClick={onClose}
          aria-label={text(
            language,
            "Đóng trợ lý hành trình",
            "Close journey companion",
          )}
        >
          ×
        </button>
      </div>

      <form className="travel-tools-panel__section" onSubmit={requestChat}>
        <h3>{text(language, "Hỏi Rồng Con", "Ask Little Dragon")}</h3>
        <label>
          {text(language, "Câu hỏi hoặc xin gợi ý", "Question or hint request")}
          <textarea
            value={message}
            maxLength={500}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={text(
              language,
              "Ví dụ: Gợi ý cho thử thách này",
              "For example: Give me a hint for this challenge",
            )}
          />
        </label>
        <button type="submit" disabled={chatBusy || !message.trim()}>
          {chatBusy
            ? text(language, "Đang hỏi…", "Asking…")
            : text(language, "Hỏi", "Ask")}
        </button>
        {chat ? (
          <div
            className="travel-tools-panel__result"
            data-testid="dragon-chat-result"
          >
            <p>{chat.dialogue}</p>
            {chat.hint ? <p>{chat.hint}</p> : null}
            <small>
              {text(language, "Nguồn: ", "Source: ")}
              {sourceLabel(chat.source, language)}
            </small>
          </div>
        ) : null}
      </form>

      <form
        className="travel-tools-panel__section"
        onSubmit={requestRecommendations}
      >
        <h3>{text(language, "Rồng Con Ăn Gì", "Where to eat")}</h3>
        <div className="travel-tools-panel__fields">
          <label>
            {text(language, "Ngân sách VND", "Budget VND")}
            <input
              inputMode="numeric"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </label>
          <label>
            {text(language, "Chế độ ăn", "Diet")}
            <select
              value={dietary}
              onChange={(event) =>
                setDietary(event.target.value as "any" | "vegetarian")
              }
            >
              <option value="any">
                {text(language, "Không giới hạn", "Any")}
              </option>
              <option value="vegetarian">
                {text(language, "Ăn chay", "Vegetarian")}
              </option>
            </select>
          </label>
          <label>
            {text(language, "Gần địa danh", "Near landmark")}
            <select
              value={landmarkKey}
              onChange={(event) => setLandmarkKey(event.target.value)}
            >
              <option value="">
                {text(language, "Tất cả thẻ đã biên tập", "All authored cards")}
              </option>
              {state.unlockedPostcards.map((placeKey) => {
                const location = getLocationContent(language, placeKey);
                return (
                  <option value={placeKey} key={placeKey}>
                    {location?.name ?? placeKey}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={recommendationBusy}
          data-testid="recommendations-submit"
        >
          {recommendationBusy
            ? text(language, "Đang tìm…", "Finding…")
            : text(language, "Xem gợi ý", "Show suggestions")}
        </button>
        {recommendationNotice ? (
          <p className="travel-tools-panel__notice">{recommendationNotice}</p>
        ) : null}
        {places ? (
          <div className="place-card-list" data-testid="travel-recommendations">
            {places.map((place) => (
              <article
                className="place-card"
                key={`${place.landmarkKey}-${place.name}`}
              >
                <h4>{place.name}</h4>
                <p>{place.description}</p>
                <p className="place-card__meta">
                  {place.address} · {place.priceRange} ·{" "}
                  {place.dietary === "vegetarian"
                    ? text(language, "ăn chay", "vegetarian")
                    : text(language, "linh hoạt", "flexible")}
                </p>
                <p className="place-card__source">
                  {text(language, "Nguồn: ", "Sources: ")}
                  {place.sourceIds.join(", ")}
                </p>
                <a
                  href={place.googleMapsUri}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    trackAnalytics("google_maps_open", {
                      landmark_key: place.landmarkKey,
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
        ) : null}
      </form>

      <section className="travel-tools-panel__section">
        <h3>
          {text(language, "Lịch trình cá nhân hóa", "Personalized itinerary")}
        </h3>
        <p>
          {text(
            language,
            "Chỉ dùng các địa danh bạn đã mở khóa; Gemini không thể thay đổi tiến trình game.",
            "Uses only your unlocked landmarks; Gemini cannot change game progress.",
          )}
        </p>
        <button
          type="button"
          onClick={() => void requestItinerary()}
          disabled={itineraryBusy}
          data-testid="itinerary-submit"
        >
          {itineraryBusy
            ? text(language, "Đang tạo…", "Creating…")
            : text(language, "Tạo lịch trình", "Create itinerary")}
        </button>
        {itinerary ? (
          <div
            className="travel-tools-panel__result"
            data-testid="itinerary-result"
          >
            <h4>{itinerary.title}</h4>
            <p>{itinerary.summary}</p>
            <ol>
              {itinerary.stops.map((stop) => (
                <li key={stop.placeKey}>
                  <strong>{stop.name}</strong> — {stop.description}
                  {stop.googleMapsUri ? (
                    <a
                      href={stop.googleMapsUri}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        trackAnalytics("google_maps_open", {
                          landmark_key: stop.placeKey,
                        })
                      }
                    >
                      {" "}
                      {text(language, "Bản đồ", "Map")}
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
            {itinerary.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            <small>
              {text(language, "Nguồn: ", "Source: ")}
              {sourceLabel(itinerary.source, language)}
            </small>
          </div>
        ) : null}
      </section>
    </section>
  );
};
