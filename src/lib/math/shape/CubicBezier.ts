import { Shape, type Bounds, type ShapeJSON } from './Shape';
import type { RasterRenderer, RGBA } from '../raster/RasterRenderer';

export class CubicBezier extends Shape {
  // Управляющие точки хранятся в локальных координатах
  public p0: { x: number; y: number };
  public p1: { x: number; y: number };
  public p2: { x: number; y: number };
  public p3: { x: number; y: number };

  private _closed = false;
  public get closed() {
    return this._closed;
  }
  public set closed(value: boolean) {
    if (this._closed !== value) {
      this._closed = value;
      this.cachedPoints = null;
    }
  }

  // Кэшированное приближение
  private cachedPoints: { x: number; y: number }[] | null = null;
  private cachedPointsFlatness: number | null = null;

  constructor(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number
  ) {
    super('CubicBezier');
    this.p0 = { x: x0, y: y0 };
    this.p1 = { x: x1, y: y1 };
    this.p2 = { x: x2, y: y2 };
    this.p3 = { x: x3, y: y3 };
  }

  /**
   * Вычисление кубической кривой Безье в параметре t
   * B(t) = (1-t)^3 * p0 + 3(1-t)^2*t * p1 + 3(1-t)*t^2 * p2 + t^3 * p3
   */
  evalLocal(t: number): { x: number; y: number } {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const a = mt3;
    const b = 3 * mt2 * t;
    const c = 3 * mt * t2;
    const d = t3;

    return {
      x: a * this.p0.x + b * this.p1.x + c * this.p2.x + d * this.p3.x,
      y: a * this.p0.y + b * this.p1.y + c * this.p2.y + d * this.p3.y,
    };
  }

  /**
   * Получить уплощенные (аппроксимированные) точки в координатах устройства
   */
  flattenDevicePoints(flatness: number = 0.5): { x: number; y: number }[] {
    const key = flatness;
    if (this.cachedPoints && this.cachedPointsFlatness === key) {
      return this.cachedPoints.map(p => this.transformPointToDevice(p.x, p.y));
    }

    const points: { x: number; y: number }[] = [];
    const segments = Math.max(
      8,
      Math.ceil(Math.sqrt(this.estimateCurvature() / flatness))
    );

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      points.push(this.evalLocal(t));
    }

    if (this.closed && points.length > 1) {
      const first = points[0];
      const last = points[points.length - 1];
      if (first.x !== last.x || first.y !== last.y) {
        points.push({ ...first });
      }
    }

    this.cachedPoints = points;
    this.cachedPointsFlatness = key;

    return points.map(p => this.transformPointToDevice(p.x, p.y));
  }

  /**
   * Оценить кривизну для определения необходимого количества сегментов
   */
  private estimateCurvature(): number {
    // Выборка кривой и оценка кривизны
    const p0 = this.evalLocal(0);
    const p05 = this.evalLocal(0.5);
    const p1 = this.evalLocal(1);

    const dx1 = p05.x - p0.x;
    const dy1 = p05.y - p0.y;
    const dx2 = p1.x - p05.x;
    const dy2 = p1.y - p05.y;

    const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
    return cross * cross;
  }

  getLocalBounds(): Bounds {
    const xs = [this.p0.x, this.p3.x];
    const ys = [this.p0.y, this.p3.y];

    // Поиск экстремумов проверкой производной
    // Для кубической: B'(t) = 3(1-t)^2(p1-p0) + 6(1-t)t(p2-p1) + 3t^2(p3-p2)
    // Это квадратное уравнение, решить для t

    // Коэффициенты для dB/dx = 0
    const a = 3 * (this.p3.x - 3 * this.p2.x + 3 * this.p1.x - this.p0.x);
    const b = 6 * (this.p0.x - 2 * this.p1.x + this.p2.x);
    const c = 3 * (this.p1.x - this.p0.x);

    const rootsX = solveQuadratic(a, b, c);
    for (const t of rootsX) {
      if (t >= 0 && t <= 1) {
        xs.push(this.evalLocal(t).x);
      }
    }

    // Коэффициенты для dB/dy = 0
    const ay = 3 * (this.p3.y - 3 * this.p2.y + 3 * this.p1.y - this.p0.y);
    const by = 6 * (this.p0.y - 2 * this.p1.y + this.p2.y);
    const cy = 3 * (this.p1.y - this.p0.y);

    const rootsY = solveQuadratic(ay, by, cy);
    for (const t of rootsY) {
      if (t >= 0 && t <= 1) {
        ys.push(this.evalLocal(t).y);
      }
    }

    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  getBounds(): Bounds {
    const local = this.getLocalBounds();
    return this.transformBounds(local);
  }

  drawRaster(renderer: RasterRenderer): void {
    const points = this.flattenDevicePoints();

    if (points.length < 2) return;

    const strokeColor = parseColor(this.strokeStyle, this.strokeOpacity);

    if (this.strokeWidth > 1) {
      // Нарисовать толстые линии
      for (let i = 0; i < points.length - 1; i++) {
        renderer.strokeLine(
          points[i].x,
          points[i].y,
          points[i + 1].x,
          points[i + 1].y,
          strokeColor,
          this.strokeWidth
        );
      }
    } else {
      // Нарисовать тонкие линии алгоритмом
      for (let i = 0; i < points.length - 1; i++) {
        renderer.drawLine(
          Math.round(points[i].x),
          Math.round(points[i].y),
          Math.round(points[i + 1].x),
          Math.round(points[i + 1].y),
          strokeColor
        );
      }
    }
  }

  /**
   * Проверка попадания с использованием расстояния от точки до аппроксимированной ломаной
   */
  hitTest(px: number, py: number): boolean {
    const points = this.flattenDevicePoints();
    const threshold = Math.max(this.strokeWidth, 5);

    for (let i = 0; i < points.length - 1; i++) {
      const dist = pointToLineDistance(
        px,
        py,
        points[i].x,
        points[i].y,
        points[i + 1].x,
        points[i + 1].y
      );

      if (dist < threshold) {
        return true;
      }
    }

    return false;
  }

  getControlPoints() {
    return [
      { ...this.p0 },
      { ...this.p1 },
      { ...this.p2 },
      { ...this.p3 },
    ];
  }

  setControlPoint(index: number, point: { x: number; y: number }) {
    if (index === 0) this.p0 = { ...point };
    else if (index === 1) this.p1 = { ...point };
    else if (index === 2) this.p2 = { ...point };
    else if (index === 3) this.p3 = { ...point };
    this.cachedPoints = null; // Инвалидировать кэш
  }

  clone(): CubicBezier {
    const copy = new CubicBezier(
      this.p0.x,
      this.p0.y,
      this.p1.x,
      this.p1.y,
      this.p2.x,
      this.p2.y,
      this.p3.x,
      this.p3.y
    );
    copy.closed = this.closed;
    this.applyBaseState(copy);
    return copy;
  }

  toJSON() {
    return {
      type: 'cubic',
      p0: { ...this.p0 },
      p1: { ...this.p1 },
      p2: { ...this.p2 },
      p3: { ...this.p3 },
      closed: this.closed,
      ...this.serializeBaseState(),
    };
  }
}

export function cubicBezierFromJSON(data: ShapeJSON) {
  const p0 = data.p0 as { x: number; y: number } | undefined;
  const p1 = data.p1 as { x: number; y: number } | undefined;
  const p2 = data.p2 as { x: number; y: number } | undefined;
  const p3 = data.p3 as { x: number; y: number } | undefined;
  const curve = new CubicBezier(
    p0?.x ?? 0,
    p0?.y ?? 0,
    p1?.x ?? 0,
    p1?.y ?? 0,
    p2?.x ?? 0,
    p2?.y ?? 0,
    p3?.x ?? 0,
    p3?.y ?? 0
  );
  curve.closed = Boolean(data.closed);
  curve.applySerializedBaseState(data);
  return curve;
}

/**
 * Solve quadratic equation ax^2 + bx + c = 0
 */
function solveQuadratic(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-6) {
      return [];
    }
    return [-c / b];
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return [];
  }

  const sqrtDisc = Math.sqrt(discriminant);
  return [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)];
}

/**
 * Calculate distance from a point to a line segment
 */
function pointToLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  const distX = px - closestX;
  const distY = py - closestY;

  return Math.sqrt(distX * distX + distY * distY);
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
