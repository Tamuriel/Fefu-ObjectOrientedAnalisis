import { Shape, type Bounds, type ShapeJSON } from './Shape';
import type { RasterRenderer, RGBA } from '../raster/RasterRenderer';

export class Rect extends Shape {
  constructor(public w: number, public h: number) {
    super('Rect');
  }

  getLocalBounds(): Bounds {
    return {
      minX: -this.w / 2,
      minY: -this.h / 2,
      maxX: this.w / 2,
      maxY: this.h / 2,
    };
  }

  getBounds(): Bounds {
    return this.transformBounds(this.getLocalBounds());
  }

  drawRaster(renderer: RasterRenderer) {
    const local = this.getLocalBounds();
    const points = [
      this.transformPointToDevice(local.minX, local.minY),
      this.transformPointToDevice(local.maxX, local.minY),
      this.transformPointToDevice(local.maxX, local.maxY),
      this.transformPointToDevice(local.minX, local.maxY),
    ];

    const fillColor = parseColor(this.fillStyle, this.fillOpacity);
    const strokeColor = parseColor(this.strokeStyle, this.strokeOpacity);

    if (this.fillOpacity > 0) {
      renderer.fillPolygon(points, fillColor);
    }
    if (this.strokeWidth > 0) {
      renderer.strokePolygon(points, strokeColor, this.strokeWidth);
    }
  }

  hitTest(px: number, py: number) {
    const point = this.transformPointToLocal(px, py);
    const halfW = this.w / 2;
    const halfH = this.h / 2;
    return point.x >= -halfW && point.x <= halfW && point.y >= -halfH && point.y <= halfH;
  }

  clone() {
    const copy = new Rect(this.w, this.h);
    this.applyBaseState(copy);
    return copy;
  }

  toJSON() {
    return {
      type: 'rect',
      w: this.w,
      h: this.h,
      ...this.serializeBaseState(),
    };
  }
}

export function rectFromJSON(data: ShapeJSON) {
  const rect = new Rect(Number(data.w) || 0, Number(data.h) || 0);
  rect.applySerializedBaseState(data);
  return rect;
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
