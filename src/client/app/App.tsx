import React, { useEffect, useState } from "react";
import { isJourneyComplete, QUEST_ORDER } from "../../shared/game-state";
import { getLandmarkGameDefinitionByLocationKey } from "../../shared/landmark-game-definitions";
import { gameSession } from "../game/state/GameStateStore";
import { trackAnalytics } from "../services/analytics";
import type {
  GameStateMirror,
  GameStateSyncStatus,
} from "../services/firebase-game-state";
import { LegalPage, type LegalDocument } from "./LegalPage";
import { JourneyEnding, PassportPanel } from "./PassportPanel";
import { bridge } from "./PhaserBridge";
import { TravelToolsPanel } from "./TravelToolsPanel";
import { LandmarkGalleryPanel } from "./LandmarkGalleryPanel";
import { LandmarkDetailPanel } from "./LandmarkDetailPanel";
import { LandmarkChallengePanel } from "./LandmarkChallengePanel";
import "./App.css";

const uiText = (language: "vi" | "en", vi: string, en: string): string =>
  language === "vi" ? vi : en;

type LandmarkChallengeSelection = {
  questId: string;
  placeKey: string;
};

const e2eBridgeRequested =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_E2E_BRIDGE === "true";

// Phaser is the largest browser dependency. Keeping it behind this boundary
// lets the shell and public legal routes paint without downloading the engine.
const GameContainer = React.lazy(async () => {
  const module = await import("./GameContainer");
  return { default: module.GameContainer };
});

const persistenceLabel = (
  status: GameStateSyncStatus,
  language: "vi" | "en",
): string => {
  if (status.mode === "ready")
    return language === "vi" ? "Đã đồng bộ" : "Synced";
  if (status.mode === "offline")
    return language === "vi" ? "Lưu cục bộ" : "Saved locally";
  if (status.mode === "disabled")
    return language === "vi" ? "Lưu cục bộ" : "Local save";
  return language === "vi" ? "Đang chuẩn bị" : "Preparing";
};

const GameApp: React.FC = () => {
  const [, setVersion] = useState(0);
  const [passportOpen, setPassportOpen] = useState(false);
  const [endingOpen, setEndingOpen] = useState(false);
  const [travelToolsOpen, setTravelToolsOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedLandmarkKey, setSelectedLandmarkKey] = useState<string | null>(
    null,
  );
  const [challenge, setChallenge] = useState<LandmarkChallengeSelection | null>(
    null,
  );
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<GameStateSyncStatus>({ mode: "idle" });
  const state = gameSession.getState();
  const { language } = state;

  useEffect(
    () =>
      bridge.onGameToUi((event) => {
        if (
          event.type === "QUEST_UPDATED" ||
          event.type === "POSTCARD_UNLOCKED"
        ) {
          setVersion((current) => current + 1);
        }
        if (event.type === "QUEST_UPDATED" && event.state === "ACTIVE") {
          trackAnalytics("quest_start", { quest_id: event.questId });
        }
        if (event.type === "QUEST_UPDATED" && event.state === "COMPLETED") {
          trackAnalytics("quest_complete", { quest_id: event.questId });
        }
        if (event.type === "POSTCARD_UNLOCKED") {
          trackAnalytics("postcard_open", { place_key: event.placeKey });
        }
        if (event.type === "LANDMARK_CHALLENGE_OPEN") {
          bridge.emitUiToGame({ type: "POSTCARD_CLOSE" });
          setPassportOpen(false);
          setTravelToolsOpen(false);
          setEndingOpen(false);
          setGalleryOpen(false);
          setSelectedLandmarkKey(null);
          setChallenge({ questId: event.questId, placeKey: event.placeKey });
          bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: false });
          trackAnalytics("landmark_challenge_open", {
            quest_id: event.questId,
            place_key: event.placeKey,
          });
        }
        if (event.type === "OPEN_LANDMARK_DETAIL") {
          bridge.emitUiToGame({ type: "POSTCARD_CLOSE" });
          bridge.emitUiToGame({ type: "DIALOGUE_CLOSE" });
          bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: false });
          setPassportOpen(false);
          setTravelToolsOpen(false);
          setEndingOpen(false);
          setGalleryOpen(false);
          setChallenge(null);
          setSelectedLandmarkKey(event.locationKey);
          trackAnalytics("landmark_detail_open", {
            place_key: event.locationKey,
          });
        }
      }),
    [],
  );

  useEffect(() => {
    trackAnalytics("game_start", { language: gameSession.getState().language });
  }, []);

  useEffect(() => {
    if (!e2eBridgeRequested) return;
    let disposed = false;
    let uninstall: (() => void) | undefined;

    void import("../game/testBridge")
      .then(({ installGameTestBridge }) => {
        if (!disposed) uninstall = installGameTestBridge();
      })
      .catch(() => {
        // A test-only helper must never affect normal game play.
      });

    return () => {
      disposed = true;
      uninstall?.();
    };
  }, []);

  useEffect(() => {
    const updateFullscreen = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    return gameSession.subscribe(() => {
      setVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    let mirror: GameStateMirror | null = null;
    let unsubscribe: (() => void) | null = null;

    const bootstrap = async () => {
      try {
        // Firebase is dynamically loaded after the local game state is ready,
        // so first playable does not download Auth/Firestore on every visit.
        const { createBrowserGameStateMirror } =
          await import("../services/firebase-game-state");
        if (!mounted) return;
        mirror = createBrowserGameStateMirror();
        unsubscribe = gameSession.subscribe((change) => {
          mirror?.queueSave(change.state);
          if (change.persistence === "immediate") {
            void mirror?.flush().then((result) => {
              if (mounted) setPersistenceStatus(result.status);
            });
          }
        });
        const result = await mirror.bootstrap(gameSession.getState());
        if (!mounted) return;
        gameSession.replaceState({
          ...result.state,
          language: gameSession.getState().language,
        });
        setPersistenceStatus(result.status);
      } catch {
        if (mounted)
          setPersistenceStatus({
            mode: "offline",
            reason: "REMOTE_UNAVAILABLE",
          });
      } finally {
        if (mounted) {
          setVersion((current) => current + 1);
        }
      }
    };

    const flushWhenHidden = () => {
      if (document.visibilityState !== "hidden") return;
      gameSession.flush();
      void mirror?.flush().then((result) => {
        if (mounted) setPersistenceStatus(result.status);
      });
    };

    void bootstrap();
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", flushWhenHidden);
      gameSession.flush();
      void mirror?.flush();
      unsubscribe?.();
      mirror?.dispose();
    };
  }, []);

  const toggleLanguage = () => {
    const selected = language === "vi" ? "en" : "vi";
    gameSession.setLanguage(selected);
    bridge.emitUiToGame({ type: "DIALOGUE_CLOSE" });
    bridge.emitUiToGame({ type: "POSTCARD_CLOSE" });
    setChallenge(null);
    bridge.emitUiToGame({ type: "SET_LANGUAGE", language: selected });
    trackAnalytics("language_selected", { language: selected });
    setVersion((current) => current + 1);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector(".app-layout")?.requestFullscreen();
    } catch {
      // Fullscreen is optional; the game stays playable in the viewport.
    }
  };

  const closeChallenge = () => {
    setChallenge(null);
    bridge.emitUiToGame({ type: "DIALOGUE_CLOSE" });
    bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: true });
  };

  const openChallengeFromContent = (placeKey: string) => {
    const definition = getLandmarkGameDefinitionByLocationKey(placeKey);
    if (!definition) return;
    setSelectedLandmarkKey(null);
    bridge.emitUiToGame({
      type: "OPEN_LANDMARK_CHALLENGE",
      questId: definition.questId,
      placeKey: definition.locationKey,
    });
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>
          {language === "vi"
            ? "Rồng Con Du Ký — Dấu Ấn Đà Nẵng"
            : "Little Dragon's Journey — Da Nang Imprints"}
        </h1>
        <div className="app-header__actions">
          <button
            type="button"
            className="app-header__button"
            onClick={toggleLanguage}
            data-testid="language-toggle"
          >
            {language === "vi" ? "English" : "Tiếng Việt"}
          </button>
          <button
            type="button"
            className="app-header__button"
            onClick={() => {
              bridge.emitUiToGame({ type: "DIALOGUE_CLOSE" });
              bridge.emitUiToGame({ type: "POSTCARD_CLOSE" });
              bridge.emitUiToGame({
                type: "SET_INPUT_ENABLED",
                enabled: false,
              });
              setTravelToolsOpen(false);
              setEndingOpen(false);
              setGalleryOpen(false);
              setSelectedLandmarkKey(null);
              setChallenge(null);
              setPassportOpen(true);
            }}
            data-testid="passport-open"
          >
            {language === "vi"
              ? `Hộ chiếu ${state.memoryFragments}/${QUEST_ORDER.length}`
              : `Passport ${state.memoryFragments}/${QUEST_ORDER.length}`}
          </button>
          <button
            type="button"
            className="app-header__button"
            onClick={() => {
              bridge.emitUiToGame({ type: "DIALOGUE_CLOSE" });
              bridge.emitUiToGame({ type: "POSTCARD_CLOSE" });
              bridge.emitUiToGame({
                type: "SET_INPUT_ENABLED",
                enabled: false,
              });
              setPassportOpen(false);
              setTravelToolsOpen(false);
              setEndingOpen(false);
              setSelectedLandmarkKey(null);
              setChallenge(null);
              setGalleryOpen(true);
              trackAnalytics("gallery_open");
            }}
            data-testid="landmark-gallery-open"
          >
            {language === "vi" ? "Khám phá" : "Explore"}
          </button>
          <button
            type="button"
            className="app-header__button"
            onClick={() => {
              bridge.emitUiToGame({ type: "DIALOGUE_CLOSE" });
              bridge.emitUiToGame({ type: "POSTCARD_CLOSE" });
              bridge.emitUiToGame({
                type: "SET_INPUT_ENABLED",
                enabled: false,
              });
              setPassportOpen(false);
              setEndingOpen(false);
              setGalleryOpen(false);
              setSelectedLandmarkKey(null);
              setChallenge(null);
              setTravelToolsOpen(true);
            }}
            data-testid="travel-tools-open"
          >
            {language === "vi" ? "Trợ lý" : "Companion"}
          </button>
          <button
            type="button"
            className="app-header__button app-header__icon-button"
            onClick={() => setMuted((current) => !current)}
            aria-pressed={muted}
            title={uiText(
              language,
              "Âm thanh là tùy chọn; mini-game luôn có tín hiệu hình ảnh.",
              "Audio is optional; every mini-game has visual cues.",
            )}
            data-testid="mute-toggle"
          >
            {muted
              ? uiText(language, "Âm", "Snd")
              : uiText(language, "Âm+", "Snd+")}
            <span className="app-header__sr-only">
              {muted
                ? uiText(language, "Bật âm thanh", "Unmute audio")
                : uiText(language, "Tắt âm thanh", "Mute audio")}
            </span>
          </button>
          <button
            type="button"
            className="app-header__button app-header__icon-button"
            onClick={() => void toggleFullscreen()}
            aria-pressed={fullscreen}
            title={uiText(language, "Toàn màn hình", "Fullscreen")}
            data-testid="fullscreen-toggle"
          >
            FS
            <span className="app-header__sr-only">
              {fullscreen
                ? uiText(language, "Thoát toàn màn hình", "Exit fullscreen")
                : uiText(language, "Toàn màn hình", "Fullscreen")}
            </span>
          </button>
          <div className="app-badge">
            {isJourneyComplete(state)
              ? language === "vi"
                ? "Hoàn tất"
                : "Complete"
              : "Starter MVP"}
          </div>
          <span className="app-save-status" aria-live="polite">
            {persistenceLabel(persistenceStatus, language)}
          </span>
          <span className="app-header__legal-links" aria-label="Legal links">
            <a href="/privacy">{language === "vi" ? "Riêng tư" : "Privacy"}</a>
            <a href="/terms">{language === "vi" ? "Điều khoản" : "Terms"}</a>
          </span>
        </div>
      </header>
      <main className="app-main">
        <React.Suspense
          fallback={
            <p className="game-loading" role="status" aria-live="polite">
              {uiText(language, "Đang tải hành trình…", "Loading journey…")}
            </p>
          }
        >
          <GameContainer language={language} />
        </React.Suspense>
        {passportOpen ? (
          <PassportPanel
            state={state}
            onClose={() => {
              setPassportOpen(false);
              bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: true });
            }}
            onOpenEnding={() => {
              setPassportOpen(false);
              setEndingOpen(true);
              trackAnalytics("game_complete", {
                memory_fragments: state.memoryFragments,
              });
            }}
          />
        ) : null}
        {endingOpen ? (
          <JourneyEnding
            language={language}
            onClose={() => {
              setEndingOpen(false);
              bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: true });
            }}
          />
        ) : null}
        {travelToolsOpen ? (
          <TravelToolsPanel
            state={state}
            onClose={() => {
              setTravelToolsOpen(false);
              bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: true });
            }}
            onStateChange={() => setVersion((current) => current + 1)}
          />
        ) : null}
        {galleryOpen ? (
          <LandmarkGalleryPanel
            language={language}
            onClose={() => {
              setGalleryOpen(false);
              bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: true });
            }}
            onSelectLandmark={(key) => {
              setGalleryOpen(false);
              setSelectedLandmarkKey(key);
            }}
          />
        ) : null}
        {selectedLandmarkKey ? (
          <LandmarkDetailPanel
            landmarkKey={selectedLandmarkKey}
            language={language}
            onClose={() => {
              setSelectedLandmarkKey(null);
              bridge.emitUiToGame({ type: "SET_INPUT_ENABLED", enabled: true });
            }}
            onOpenChallenge={openChallengeFromContent}
          />
        ) : null}
        {challenge ? (
          <LandmarkChallengePanel
            questId={challenge.questId}
            placeKey={challenge.placeKey}
            language={language}
            onClose={closeChallenge}
            onStart={(questId) => {
              setChallenge(null);
              bridge.emitUiToGame({ type: "START_QUEST", questId });
            }}
            onOpenDetails={(placeKey) => {
              setChallenge(null);
              bridge.emitUiToGame({ type: "DIALOGUE_CLOSE" });
              bridge.emitUiToGame({
                type: "SET_INPUT_ENABLED",
                enabled: false,
              });
              setSelectedLandmarkKey(placeKey);
            }}
          />
        ) : null}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  const legalDocument: LegalDocument | null =
    typeof window !== "undefined" && window.location.pathname === "/privacy"
      ? "privacy"
      : typeof window !== "undefined" && window.location.pathname === "/terms"
        ? "terms"
        : null;
  return legalDocument ? <LegalPage document={legalDocument} /> : <GameApp />;
};

export default App;
