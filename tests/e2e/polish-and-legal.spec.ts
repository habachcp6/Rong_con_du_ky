import { expect, test } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectNoSeriousBrowserErrors,
  waitForGameCanvas,
} from "./support/evidence";

test.describe("polish, accessibility, and legal routes @m8", () => {
  test("updates language, exposes optional controls, and closes React modals with Escape", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The full keyboard focus sequence is exercised once on desktop.",
    );
    const browserErrors = collectSeriousBrowserErrors(page);
    await page.goto("/");
    await waitForGameCanvas(page);

    await page.getByTestId("language-toggle").click();
    await expect(
      page.getByRole("heading", {
        name: /Little Dragon's Journey — Da Nang Imprints/i,
      }),
    ).toBeVisible();

    const mute = page.getByTestId("mute-toggle");
    await expect(mute).toHaveAttribute("aria-pressed", "true");
    await mute.click();
    await expect(mute).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("fullscreen-toggle")).toHaveAttribute(
      "aria-pressed",
      /true|false/,
    );

    await page.getByTestId("travel-tools-open").click();
    const companion = page.getByTestId("travel-tools-panel");
    await expect(companion).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close journey companion" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(companion).toBeHidden();
    await expect(page.getByTestId("travel-tools-open")).toBeFocused();

    await page.getByTestId("passport-open").click();
    const passport = page.getByTestId("passport-panel");
    await expect(passport).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close passport" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(passport).toBeHidden();
    await expect(page.getByTestId("passport-open")).toBeFocused();

    await captureVisualEvidence(page, testInfo, "desktop-polish-en");
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("cycles Tab inside the companion and returns focus to its opener", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The complete keyboard focus cycle is exercised once on desktop.",
    );
    await page.goto("/");
    await waitForGameCanvas(page);

    const opener = page.getByTestId("travel-tools-open");
    await opener.focus();
    await page.keyboard.press("Enter");
    const companion = page.getByTestId("travel-tools-panel");
    await expect(companion).toBeVisible();
    const focusable = companion.locator(
      "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    expect(await focusable.count()).toBeGreaterThan(3);
    await expect(focusable.first()).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(focusable.last()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(focusable.first()).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(companion).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("uses the browser fullscreen contract when it is available", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Fullscreen API behavior is exercised once on desktop.",
    );
    await page.goto("/");
    await waitForGameCanvas(page);

    await page.evaluate(() => {
      let activeElement: Element | null = null;
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => activeElement,
      });
      HTMLElement.prototype.requestFullscreen = async () => {
        activeElement = document.querySelector(".app-layout");
        document.dispatchEvent(new Event("fullscreenchange"));
      };
      document.exitFullscreen = async () => {
        activeElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      };
    });

    const toggle = page.getByTestId("fullscreen-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  test("renders public privacy and terms pages without starting the game", async ({
    page,
  }, testInfo) => {
    const browserErrors = collectSeriousBrowserErrors(page);
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Chính sách quyền riêng tư" }),
    ).toBeVisible();
    await expect(page.locator("#game-container canvas")).toHaveCount(0);
    await captureVisualEvidence(page, testInfo, "privacy");

    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: "Điều khoản sử dụng" }),
    ).toBeVisible();
    await expect(page.locator("#game-container canvas")).toHaveCount(0);
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });

  test("keeps the companion reachable at 390 by 844", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile",
      "Responsive assertion runs in the mobile project.",
    );
    const browserErrors = collectSeriousBrowserErrors(page);
    await page.goto("/");
    await waitForGameCanvas(page);
    await page.getByTestId("travel-tools-open").click();
    const companion = page.getByTestId("travel-tools-panel");
    await expect(companion).toBeVisible();
    const panelBounds = await companion.boundingBox();
    expect(panelBounds).not.toBeNull();
    if (!panelBounds) throw new Error("Companion panel has no layout bounds.");
    expect(panelBounds.x).toBeGreaterThanOrEqual(0);
    expect(panelBounds.y).toBeGreaterThanOrEqual(0);
    expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(390);
    expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(844);
    await captureVisualEvidence(page, testInfo, "mobile-companion");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("travel-tools-panel")).toBeHidden();
    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
