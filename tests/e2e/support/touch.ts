import type { Locator, Page } from "@playwright/test";

export const LOGICAL_GAME_SIZE = { width: 640, height: 360 } as const;

export type LogicalPoint = { x: number; y: number };

export async function logicalCanvasPoint(
  canvas: Locator,
  x: number,
  y: number,
): Promise<LogicalPoint> {
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Game canvas did not have a screen bounding box.");
  }

  return {
    x: box.x + (x / LOGICAL_GAME_SIZE.width) * box.width,
    y: box.y + (y / LOGICAL_GAME_SIZE.height) * box.height,
  };
}

/** Dispatches an actual CDP touch gesture rather than mouse emulation. */
export async function tapCanvasByTouch(
  page: Page,
  canvas: Locator,
  logicalX: number,
  logicalY: number,
  holdMs = 80,
): Promise<void> {
  const point = await logicalCanvasPoint(canvas, logicalX, logicalY);
  const session = await page.context().newCDPSession(page);

  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: point.x, y: point.y }],
    });
    await page.waitForTimeout(holdMs);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

/** Holds the in-canvas joystick in a logical direction for a real touch duration. */
export async function moveWithTouchJoystick(
  page: Page,
  canvas: Locator,
  direction: { x: number; y: number },
  durationMs: number,
): Promise<void> {
  const base = await logicalCanvasPoint(canvas, 72, 288);
  const target = await logicalCanvasPoint(
    canvas,
    72 + direction.x * 30,
    288 + direction.y * 30,
  );
  const session = await page.context().newCDPSession(page);

  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: base.x, y: base.y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: target.x, y: target.y }],
    });
    await page.waitForTimeout(durationMs);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}
