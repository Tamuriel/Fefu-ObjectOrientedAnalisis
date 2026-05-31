import { Shape, type Bounds } from './Shape';
import type { RasterRenderer, RGBA } from '../raster/RasterRenderer';

export class Oval extends Shape {
  constructor(public rx: number, public ry: number) {
    super('Oval');
  }

  getLocalBounds(): Bounds {
    return {
      minX: -this.rx,
      minY: -this.ry,
      maxX: this.rx,
      maxY: this.ry,
    };
  }

  getBounds(): Bounds {
    const sampleCount = 64;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < sampleCount; i++) {
      const theta = (i / sampleCount) * Math.PI * 2;
      const x = this.rx * Math.cos(theta);
      const y = this.ry * Math.sin(theta);
      const point = this.transformPointToDevice(x, y);
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, minY, maxX, maxY };
  }

  drawRaster(renderer: RasterRenderer) {
    const steps = 48;
    const points = [];
    for (let i = 0; i < steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const localX = this.rx * Math.cos(theta);
      const localY = this.ry * Math.sin(theta);
      points.push(this.transformPointToDevice(localX, localY));
    }

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
    if (this.rx === 0 || this.ry === 0) {
      return false;
    }
    const normalized = (point.x / this.rx) ** 2 + (point.y / this.ry) ** 2;
    return normalized <= 1;
  }

  clone() {
    const copy = new Oval(this.rx, this.ry);
    this.applyBaseState(copy);
    return copy;
  }

  toJSON() {
    return {
      type: this.type,
      id: this.id,
      rx: this.rx,
      ry: this.ry,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      fillOpacity: this.fillOpacity,
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
