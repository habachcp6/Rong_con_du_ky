export const ANALYTICS_EVENT_NAMES = [
  "game_start",
  "language_selected",
  "quest_start",
  "quest_complete",
  "postcard_open",
  "place_card_open",
  "google_maps_open",
  "food_preferences_submitted",
  "itinerary_created",
  "game_complete",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsProperties = Record<string, string | number | boolean>;

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  occurredAt: string;
  properties: AnalyticsProperties;
};

const MAX_PROPERTIES = 6;
const MAX_VALUE_LENGTH = 80;

/** Removes arbitrary/nested data before an integration can forward analytics.
 * The adapter intentionally does not retain identifiers, free text, or PII. */
export function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties = {},
): AnalyticsProperties {
  return Object.entries(properties)
    .slice(0, MAX_PROPERTIES)
    .reduce<AnalyticsProperties>((result, [key, value]) => {
      if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key)) return result;
      if (typeof value === "string") {
        result[key] = value.slice(0, MAX_VALUE_LENGTH);
      } else if (typeof value === "number" && Number.isFinite(value)) {
        result[key] = value;
      } else if (typeof value === "boolean") {
        result[key] = value;
      }
      return result;
    }, {});
}

/** In-memory browser event seam. Production analytics can subscribe/forward
 * this strictly sanitized event only after product consent is configured. */
export function trackAnalytics(
  name: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): AnalyticsEvent {
  const event: AnalyticsEvent = {
    name,
    occurredAt: new Date().toISOString(),
    properties: sanitizeAnalyticsProperties(properties),
  };

  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<AnalyticsEvent>("gg2026:analytics", { detail: event }),
    );
  }
  return event;
}
