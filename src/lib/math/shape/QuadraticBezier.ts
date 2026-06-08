import { Shape, type Bounds } from './Shape';
import type { RasterRenderer, RGBA } from '../raster/RasterRenderer';

export class QuadraticBezier extends Shape {
  // Управляющие точки хранятся в локальных координатах
  public p0: { x: number; y: number };
  public p1: { x: number; y: number };
  public p2: { x: number; y: number };

  // Кэшированное приближение
  private cachedPoints: { x: number; y: number }[] | null = null;
  private cachedPointsFlatness: number | null = null;

  constructor(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) {
    super('QuadraticBezier');
    this.p0 = { x: x0, y: y0 };
    this.p1 = { x: x1, y: y1 };
    this.p2 = { x: x2, y: y2 };
  }

  /**
   * Вычисление квадратической кривой Безье в параметре t
   * B(t) = (1-t)^2 * p0 + 2(1-t)t * p1 + t^2 * p2
   */
  evalLocal(t: number): { x: number; y: number } {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const a = mt2;
    const b = 2 * mt * t;
    const c = t2;

    return {
      x: a * this.p0.x + b * this.p1.x + c * this.p2.x,
      y: a * this.p0.y + b * this.p1.y + c * this.p2.y,
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
      5,
      Math.ceil(Math.sqrt(this.estimateCurvature() / flatness))
    );

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      points.push(this.evalLocal(t));
    }

    this.cachedPoints = points;
    this.cachedPointsFlatness = key;

    return points.map(p => this.transformPointToDevice(p.x, p.y));
  }

  /**
   * Оценить кривизну для определения необходимого количества сегментов
   */
  private estimateCurvature(): number {
    const p0 = this.p0;
    const p1 = this.p1;
    const p2 = this.p2;

    // Вычислить отклонение управляющей точки от линии между конечными точками
    const dx = p2.x - p0.x;
    const dy = p2.y - p0.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1e-6) return 0;

    const perpDist = Math.abs((p1.y - p0.y) * dx - (p1.x - p0.x) * dy) / dist;
    return perpDist * perpDist;
  }

  getLocalBounds(): Bounds {
    const points = [this.p0, this.p1, this.p2];

    // Проверить экстремумы в x и y
    const xs = [this.p0.x, this.p2.x];
    const ys = [this.p0.y, this.p2.y];

    // Поиск экстремумов проверкой производной
    // Для квадратической: B'(t) = 2(1-t)(p1-p0) + 2t(p2-p1)
    // Установка на 0: t = (p0 - p1) / (p0 - 2*p1 + p2)

    const denom = this.p0.x - 2 * this.p1.x + this.p2.x;
    if (Math.abs(denom) > 1e-6) {
      const t = (this.p0.x - this.p1.x) / denom;
      if (t >= 0 && t <= 1) {
        xs.push(this.evalLocal(t).x);
      }
    }

    const denomY = this.p0.y - 2 * this.p1.y + this.p2.y;
    if (Math.abs(denomY) > 1e-6) {
      const t = (this.p0.y - this.p1.y) / denomY;
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
    return [{ ...this.p0 }, { ...this.p1 }, { ...this.p2 }];
  }

  setControlPoint(index: number, point: { x: number; y: number }) {
    if (index === 0) this.p0 = { ...point };
    else if (index === 1) this.p1 = { ...point };
    else if (index === 2) this.p2 = { ...point };
    this.cachedPoints = null; // Инвалидировать кэш
  }

  clone(): QuadraticBezier {
    const copy = new QuadraticBezier(
      this.p0.x,
      this.p0.y,
      this.p1.x,
      this.p1.y,
      this.p2.x,
      this.p2.y
    );
    this.applyBaseState(copy);
    return copy;
  }

  toJSON() {
    return {
      type: this.type,
      id: this.id,
      p0: { ...this.p0 },
      p1: { ...this.p1 },
      p2: { ...this.p2 },
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      fillOpacity: this.fillOpacity,
      strokeOpacity: this.strokeOpacity,
      strokeWidth: this.strokeWidth,
    };
  }
}

/**
 * Вычислить расстояние от точки до отрезка линии
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
