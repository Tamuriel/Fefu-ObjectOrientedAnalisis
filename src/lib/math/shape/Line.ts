import { Shape, type Bounds } from './Shape';
import type { RasterRenderer, RGBA } from '../raster/RasterRenderer';

interface Point2D {
  x: number;
  y: number;
}

export class Line extends Shape {
  p1: Point2D;
  p2: Point2D;

  constructor(x0: number, y0: number, x1: number, y1: number) {
    const centerX = (x0 + x1) / 2;
    const centerY = (y0 + y1) / 2;
    super('Line', centerX, centerY);
    this.p1 = { x: x0 - centerX, y: y0 - centerY };
    this.p2 = { x: x1 - centerX, y: y1 - centerY };
  }

  getLocalBounds(): Bounds {
    return {
      minX: Math.min(this.p1.x, this.p2.x),
      minY: Math.min(this.p1.y, this.p2.y),
      maxX: Math.max(this.p1.x, this.p2.x),
      maxY: Math.max(this.p1.y, this.p2.y),
    };
  }

  getBounds(): Bounds {
    const a = this.transformPointToDevice(this.p1.x, this.p1.y);
    const b = this.transformPointToDevice(this.p2.x, this.p2.y);
    return {
      minX: Math.min(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxX: Math.max(a.x, b.x),
      maxY: Math.max(a.y, b.y),
    };
  }

  drawRaster(renderer: RasterRenderer) {
    const a = this.transformPointToDevice(this.p1.x, this.p1.y);
    const b = this.transformPointToDevice(this.p2.x, this.p2.y);
    const strokeColor = parseColor(this.strokeStyle, this.strokeOpacity);
    if (this.strokeWidth > 1) {
      renderer.strokeLine(a.x, a.y, b.x, b.y, strokeColor, this.strokeWidth);
    } else {
      renderer.drawLine(Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y), strokeColor);
    }
  }

  hitTest(px: number, py: number) {
    const point = this.transformPointToLocal(px, py);
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const dist = Math.hypot(point.x - this.p1.x, point.y - this.p1.y);
      return dist <= Math.max(1, this.strokeWidth / 2);
    }

    const t = ((point.x - this.p1.x) * dx + (point.y - this.p1.y) * dy) / lenSq;
    const clamped = Math.max(0, Math.min(1, t));
    const nearestX = this.p1.x + dx * clamped;
    const nearestY = this.p1.y + dy * clamped;
    const distance = Math.hypot(point.x - nearestX, point.y - nearestY);
    return distance <= Math.max(1, this.strokeWidth / 2);
  }

  clone() {
    const copy = new Line(this.p1.x + this.transform.x, this.p1.y + this.transform.y, this.p2.x + this.transform.x, this.p2.y + this.transform.y);
    this.applyBaseState(copy);
    return copy;
  }

  toJSON() {
    return {
      type: this.type,
      id: this.id,
      p1: { ...this.p1 },
      p2: { ...this.p2 },
      transform: { ...this.transform },
      strokeStyle: this.strokeStyle,
      strokeOpacity: this.strokeOpacity,
      strokeWidth: this.strokeWidth,
    };
  }
}

function parseColor(cssColor: string, alpha: number): RGBA {
  if (cssColor.startsWith('#')) {
    const hex = cssColor.substring(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b, a: alpha };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return { r, g, b, a: alpha };
    }
  }
  return { r: 0, g: 0, b: 0, a: alpha };
}
