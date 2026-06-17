import { Shape, type Bounds, type ShapeJSON } from './Shape';
import type { RasterRenderer, RGBA } from '../raster/RasterRenderer';

export class Triangle extends Shape {
  // Вершины хранятся в локальных координатах относительно центра треугольника
  public p0: { x: number; y: number };
  public p1: { x: number; y: number };
  public p2: { x: number; y: number };

  constructor(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) {
    super('Triangle');

    // Вычислить центр треугольника
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;

    // Сохранить вершины относительно центра
    this.p0 = { x: x0 - cx, y: y0 - cy };
    this.p1 = { x: x1 - cx, y: y1 - cy };
    this.p2 = { x: x2 - cx, y: y2 - cy };

    // Установить преобразование для размещения треугольника в центре
    this.transform.x = cx;
    this.transform.y = cy;
  }

  getLocalBounds(): Bounds {
    const xs = [this.p0.x, this.p1.x, this.p2.x];
    const ys = [this.p0.y, this.p1.y, this.p2.y];

    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  getBounds(): Bounds {
    const points = [this.p0, this.p1, this.p2];
    let result: Bounds | null = null;

    for (const p of points) {
      const transformed = this.transformPointToDevice(p.x, p.y);
      if (!result) {
        result = {
          minX: transformed.x,
          minY: transformed.y,
          maxX: transformed.x,
          maxY: transformed.y,
        };
      } else {
        result.minX = Math.min(result.minX, transformed.x);
        result.minY = Math.min(result.minY, transformed.y);
        result.maxX = Math.max(result.maxX, transformed.x);
        result.maxY = Math.max(result.maxY, transformed.y);
      }
    }

    return result || { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  drawRaster(renderer: RasterRenderer) {
    const points = [
      this.transformPointToDevice(this.p0.x, this.p0.y),
      this.transformPointToDevice(this.p1.x, this.p1.y),
      this.transformPointToDevice(this.p2.x, this.p2.y),
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

  /**
   * Проверить находится ли точка внутри треугольника, используя метод кросс-произведения
   * Точка находится внутри, если она имеет одинаковую ориентацию относительно всех трех сторон
   */
  hitTest(px: number, py: number): boolean {
    const point = this.transformPointToLocal(px, py);

    // Вспомогательная функция для вычисления знака кросс-произведения
    const sign = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
      return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    };

    const d1 = sign(point.x, point.y, this.p0.x, this.p0.y, this.p1.x, this.p1.y);
    const d2 = sign(point.x, point.y, this.p1.x, this.p1.y, this.p2.x, this.p2.y);
    const d3 = sign(point.x, point.y, this.p2.x, this.p2.y, this.p0.x, this.p0.y);

    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

    return !(hasNeg && hasPos);
  }

  getControlPoints() {
    return [
      { ...this.p0 },
      { ...this.p1 },
      { ...this.p2 },
    ];
  }

  setControlPoint(index: number, point: { x: number; y: number }) {
    if (index === 0) this.p0 = { ...point };
    else if (index === 1) this.p1 = { ...point };
    else if (index === 2) this.p2 = { ...point };
  }

  clone(): Triangle {
    const copy = new Triangle(
      this.p0.x + this.transform.x,
      this.p0.y + this.transform.y,
      this.p1.x + this.transform.x,
      this.p1.y + this.transform.y,
      this.p2.x + this.transform.x,
      this.p2.y + this.transform.y
    );
    this.applyBaseState(copy);
    return copy;
  }

  toJSON() {
    return {
      type: 'triangle',
      p0: { ...this.p0 },
      p1: { ...this.p1 },
      p2: { ...this.p2 },
      ...this.serializeBaseState(),
    };
  }
}

export function triangleFromJSON(data: ShapeJSON) {
  const p0 = data.p0 as { x: number; y: number } | undefined;
  const p1 = data.p1 as { x: number; y: number } | undefined;
  const p2 = data.p2 as { x: number; y: number } | undefined;
  const triangle = new Triangle(
    p0?.x ?? 0,
    p0?.y ?? 0,
    p1?.x ?? 0,
    p1?.y ?? 0,
    p2?.x ?? 0,
    p2?.y ?? 0
  );
  triangle.applySerializedBaseState(data);
  return triangle;
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
