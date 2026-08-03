import { test, type Locator, type Page } from "@playwright/test";
import {
  captureVisualEvidence,
  collectSeriousBrowserErrors,
  expectCanvasToChange,
  expectNoSeriousBrowserErrors,
  screenshotHash,
  waitForGameCanvas,
} from "./support/evidence";

const LOGICAL_GAME_SIZE = { width: 640, height: 360 } as const;

async function logicalCanvasPoint(
  canvas: Locator,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Game canvas did not have a screen bounding box.");
  }

  return {
    x: box.x + (x / LOGICAL_GAME_SIZE.width) * box.width,
    y: box.y + (y / LOGICAL_GAME_SIZE.height) * box.height,
  };
}

async function dragTouchJoystickRight(
  page: Page,
  canvas: Locator,
): Promise<void> {
  const session = await page.context().newCDPSession(page);
  const joystickBase = await logicalCanvasPoint(canvas, 72, 288);
  const joystickRight = await logicalCanvasPoint(canvas, 102, 288);

  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: joystickBase.x, y: joystickBase.y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: joystickRight.x, y: joystickRight.y }],
    });
    await page.waitForTimeout(700);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

async function tapCanvasByTouch(
  page: Page,
  point: { x: number; y: number },
): Promise<void> {
  const session = await page.context().newCDPSession(page);

  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: point.x, y: point.y }],
    });
    await page.waitForTimeout(80);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

test.describe("mobile touch controls @touch", () => {
  test("moves the overworld player with a real canvas touch joystick gesture", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile",
      "Touch control assertions run in the mobile emulation project.",
    );

    const browserErrors = collectSeriousBrowserErrors(page);
    await page.goto("/");
    const gameCanvas = await waitForGameCanvas(page);
    await captureVisualEvidence(page, testInfo, "touch-title");
    const titleFrame = await screenshotHash(gameCanvas);

    // The title owns an explicit mobile fallback for the first canvas touch.
    // This dispatches browser touchStart/touchEnd, not mouse emulation.
    const titleTouchPoint = await logicalCanvasPoint(gameCanvas, 320, 180);
    await tapCanvasByTouch(page, titleTouchPoint);
    await expectCanvasToChange(
      gameCanvas,
      titleFrame,
      "A real mobile touch did not advance the title into the overworld.",
    );

    const overworldFrame = await screenshotHash(gameCanvas);
    await dragTouchJoystickRight(page, gameCanvas);
    await expectCanvasToChange(
      gameCanvas,
      overworldFrame,
      "The mobile touch joystick did not produce a visible overworld movement update.",
    );
    await captureVisualEvidence(page, testInfo, "touch-joystick-overworld");

    await expectNoSeriousBrowserErrors(testInfo, browserErrors);
  });
});
