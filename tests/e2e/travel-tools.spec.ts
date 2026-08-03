import { expect, test } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";

type CapturedAnalyticsEvent = {
  name: string;
  occurredAt: string;
  properties: Record<string, string | number | boolean>;
};

const installAnalyticsCapture = async (page: import("@playwright/test").Page) =>
  page.addInitScript(() => {
    const events: unknown[] = [];
    Object.defineProperty(window, "__gg2026AnalyticsEvents", {
      configurable: true,
      value: events,
      writable: false,
    });
    window.addEventListener("gg2026:analytics", (event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (detail && typeof detail === "object") {
        events.push(JSON.parse(JSON.stringify(detail)));
      }
    });
  });

const readAnalyticsCapture = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      ((window as unknown as { __gg2026AnalyticsEvents?: unknown[] })
        .__gg2026AnalyticsEvents ?? []) as CapturedAnalyticsEvent[],
  );

test.describe("travel tools authored fallback @m6-m7", () => {
  test("keeps chat, curated recommendations, and itinerary usable when the API is unavailable", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The fallback panel is exercised once on desktop.",
    );
    const browserErrors = collectSeriousBrowserErrors(page);
    await installAnalyticsCapture(page);
    await page.goto("/");
    await waitForGameCanvas(page);

    await page.getByTestId("travel-tools-open").click();
    await expect(page.getByTestId("travel-tools-panel")).toBeVisible();
    await page.getByLabel("Câu hỏi hoặc xin gợi ý").fill("Cho mình một gợi ý");
    await page.getByRole("button", { name: "Hỏi", exact: true }).click();
    await expect(page.getByTestId("dragon-chat-result")).toBeVisible();

    await page.getByTestId("recommendations-submit").click();
    const recommendations = page.getByTestId("travel-recommendations");
    await expect(recommendations).toBeVisible();
    const placeCards = recommendations.locator(".place-card");
    const cardCount = await placeCards.count();
    expect(cardCount).toBeGreaterThan(0);
    const mapsLink = recommendations
      .getByRole("link", { name: "Mở trong Google Maps" })
      .first();
    await expect(mapsLink).toHaveAttribute("target", "_blank");

    await expect.poll(readAnalyticsCapture.bind(null, page)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "food_preferences_submitted",
          properties: expect.objectContaining({
            dietary: "any",
            has_budget: true,
            landmark_key: "all",
          }),
        }),
      ]),
    );
    await expect
      .poll(async () => {
        const events = await readAnalyticsCapture(page);
        return events.filter((event) => event.name === "place_card_open")
          .length;
      })
      .toBeGreaterThanOrEqual(cardCount);

    // Prevent a real external navigation while preserving the browser click and
    // the React click handler which records the Maps-open action.
    await mapsLink.evaluate((anchor) => {
      anchor.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
    });
    const mapsOpenCount = (await readAnalyticsCapture(page)).filter(
      (event) => event.name === "google_maps_open",
    ).length;
    await mapsLink.click();
    await expect
      .poll(
        async () =>
          (await readAnalyticsCapture(page)).filter(
            (event) => event.name === "google_maps_open",
          ).length,
      )
      .toBe(mapsOpenCount + 1);
    const lastMapsEvent = (await readAnalyticsCapture(page))
      .filter((event) => event.name === "google_maps_open")
      .at(-1);
    expect(lastMapsEvent).toMatchObject({
      properties: { landmark_key: expect.any(String) },
    });

    await page.getByTestId("itinerary-submit").click();
    await expect(page.getByTestId("itinerary-result")).toBeVisible();
    await expect.poll(readAnalyticsCapture.bind(null, page)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "itinerary_created",
          properties: expect.objectContaining({ source: "authored" }),
        }),
      ]),
    );
    await captureVisualEvidence(
      page,
      testInfo,
      "travel-tools-authored-fallback",
    );
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
