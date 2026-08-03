import Phaser from "phaser";
import { normalizeMovementVector, type MovementVector } from "../world";

const EMPTY_DIRECTION: MovementVector = { x: 0, y: 0 };

/**
 * A canvas-native joystick keeps touch input inside Phaser, so the React UI never
 * owns player movement or a scene reference.
 */
export class TouchJoystick {
  private baseX = 72;
  private baseY = 288;
  private pointer: Phaser.Input.Pointer | null = null;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;

  public constructor(private readonly scene: Phaser.Scene) {
    this.base = scene.add
      .circle(this.baseX, this.baseY, 34, 0x10233d, 0.58)
      .setScrollFactor(0)
      .setDepth(40);
    this.thumb = scene.add
      .circle(this.baseX, this.baseY, 14, 0x6ce5ff, 0.78)
      .setScrollFactor(0)
      .setDepth(41);

    scene.input.on("pointerdown", this.handlePointerDown, this);
    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.input.on("pointerupoutside", this.handlePointerUp, this);
  }

  public layout(width: number, height: number): void {
    this.baseX = Math.max(52, Math.min(72, width - 52));
    this.baseY = Math.max(52, height - 62);
    this.base.setPosition(this.baseX, this.baseY);
    this.resetThumb();
  }

  public getDirection(): MovementVector {
    if (!this.pointer || !this.pointer.isDown) {
      this.pointer = null;
      this.resetThumb();
      return EMPTY_DIRECTION;
    }

    const dx = this.pointer.x - this.baseX;
    const dy = this.pointer.y - this.baseY;
    const distance = Math.hypot(dx, dy);

    if (distance < 8) {
      this.resetThumb();
      return EMPTY_DIRECTION;
    }

    const cappedDistance = Math.min(distance, 30);
    const direction = normalizeMovementVector({ x: dx, y: dy });
    this.thumb.setPosition(
      this.baseX + direction.x * cappedDistance,
      this.baseY + direction.y * cappedDistance,
    );
    return direction;
  }

  public destroy(): void {
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.off("pointerup", this.handlePointerUp, this);
    this.scene.input.off("pointerupoutside", this.handlePointerUp, this);
    this.base.destroy();
    this.thumb.destroy();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch || this.pointer) {
      return;
    }

    if (Math.hypot(pointer.x - this.baseX, pointer.y - this.baseY) <= 52) {
      this.pointer = pointer;
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.pointer?.id === pointer.id) {
      this.pointer = null;
      this.resetThumb();
    }
  }

  private resetThumb(): void {
    this.thumb.setPosition(this.baseX, this.baseY);
  }
}
