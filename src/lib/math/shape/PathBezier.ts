import { Shape, type Bounds, type ShapeJSON } from './Shape';
import type { RasterRenderer, RGBA } from '../raster/RasterRenderer';
import { CubicBezier } from './CubicBezier';

type PathMode = 'polyline' | 'bezier' | 'catmull';

export class PathBezier extends Shape {
  // Опорные точки хранятся в локальных координатах
  public anchors: { x: number; y: number }[] = [];
  public mode: PathMode = 'polyline';
  public closed: boolean = false;

  // Кэшированное приближение
  private cachedPoints: { x: number; y: number }[] | null = null;
  private cachedMode: PathMode | null = null;
  private cachedClosed: boolean | null = null;
  private cachedPointsFlatness: number | null = null;

  constructor(points: { x: number; y: number }[] = []) {
    super('PathBezier');
    this.anchors = points.map(p => ({ ...p }));
  }

  /**
   * Получить уплощенные (аппроксимированные) точки в координатах устройства
   */
  private flattenLocalPoints(flatness: number = 0.5): { x: number; y: number }[] {
    if (this.mode === 'polyline') {
      return this.flattenPolyline();
    }
    if (this.mode === 'bezier') {
      return this.flattenBezierMode(flatness);
    }
    if (this.mode === 'catmull') {
      return this.flattenCatmullMode(flatness);
    }
    return this.flattenPolyline();
  }

  flattenDevicePoints(flatness: number = 0.5): { x: number; y: number }[] {
    if (
      this.cachedPoints &&
      this.cachedMode === this.mode &&
      this.cachedClosed === this.closed &&
      this.cachedPointsFlatness === flatness
    ) {
      return this.cachedPoints.map(p => this.transformPointToDevice(p.x, p.y));
    }

    const localPoints = this.flattenLocalPoints(flatness);
    this.cachedPoints = localPoints;
    this.cachedMode = this.mode;
    this.cachedClosed = this.closed;
    this.cachedPointsFlatness = flatness;

    return localPoints.map(p => this.transformPointToDevice(p.x, p.y));
  }

  /**
   * Режим ломаной: простые прямые линии между точками
   */
  private flattenPolyline(): { x: number; y: number }[] {
    const result = this.anchors.map(p => ({ ...p }));
    
    if (this.closed && result.length > 1) {
      const start = result[0];
      const end = result[result.length - 1];
      if (start.x !== end.x || start.y !== end.y) {
        result.push({ ...start });
      }
    }
    
    return result;
  }

  /**
   * Режим Безье: интерпретировать опорные точки как сегменты кубической кривой Безье
   * Каждый сегмент использует 4 точки: начало, cp1, cp2, конец
   */
  private flattenBezierMode(flatness: number): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];

    if (this.anchors.length < 2) {
      return this.anchors.map(p => ({ ...p }));
    }

    // Для режима Безье нам нужно минимум 4 точки для сегмента
    // Обработать точки группами по 4, или обработать оставшиеся точки как ломаную
    let i = 0;
    while (i < this.anchors.length) {
      if (i === 0) {
        result.push({ ...this.anchors[i] });
      }

      if (i + 3 < this.anchors.length) {
        // У нас есть полный сегмент кубической кривой Безье
        const curve = new CubicBezier(
          this.anchors[i].x,
          this.anchors[i].y,
          this.anchors[i + 1].x,
          this.anchors[i + 1].y,
          this.anchors[i + 2].x,
          this.anchors[i + 2].y,
          this.anchors[i + 3].x,
          this.anchors[i + 3].y
        );

        // Получить аппроксимированные точки, пропустить первую (уже добавлена)
        const segments = Math.max(
          8,
          Math.ceil(Math.sqrt(this.estimateBezierCurvature(i) / flatness))
        );
        for (let j = 1; j <= segments; j++) {
          const t = j / segments;
          result.push(curve.evalLocal(t));
        }

        i += 3; // Перейти к следующему сегменту (примечание: +3 потому что конец этого сегмента - начало следующего)
      } else {
        // Недостаточно точек для сегмента, добавить оставшиеся как ломаную
        for (let j = i + 1; j < this.anchors.length; j++) {
          result.push({ ...this.anchors[j] });
        }
        break;
      }
    }

    if (this.closed && result.length > 1) {
      // Убедиться в замкнутом пути
      const start = result[0];
      const end = result[result.length - 1];
      if (start.x !== end.x || start.y !== end.y) {
        result.push({ ...start });
      }
    }

    return result;
  }

  /**
   * Режим Catmull-Rom: преобразовать опорные точки в сегменты кубической кривой Безье
   */
  private flattenCatmullMode(flatness: number): { x: number; y: number }[] {
    if (this.anchors.length < 2) {
      return this.anchors.map(p => ({ ...p }));
    }

    const beziers = this.catmullToBeziers();
    const result: { x: number; y: number }[] = [];

    for (let i = 0; i < beziers.length; i++) {
      const curve = beziers[i];

      if (i === 0) {
        result.push({ ...curve.p0 });
      }

      const segments = Math.max(
        8,
        Math.ceil(Math.sqrt(this.estimateBezierCurvature(i) / flatness))
      );
      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        result.push(curve.evalLocal(t));
      }
    }

    return result;
  }

  /**
   * Преобразовать управляющие точки Catmull-Rom в сегменты кубической кривой Безье
   */
  catmullToBeziers(): CubicBezier[] {
    const beziers: CubicBezier[] = [];

    if (this.anchors.length < 2) {
      return beziers;
    }

    const points = this.anchors;
    const end = this.anchors.length;

    // Если не закрыт, мы не можем создать сегмент до первой точки или после последней
    if (!this.closed) {
      // Для открытого пути нам нужно минимум 2 точки
      if (points.length < 2) return beziers;
    }

    // Обработать каждый сегмент
    const limit = this.closed ? end : end - 1;
    for (let i = 0; i < limit; i++) {
      // Получить четыре точки, необходимые для Catmull-Rom
      let p0: { x: number; y: number };
      let p1: { x: number; y: number };
      let p2: { x: number; y: number };
      let p3: { x: number; y: number };

      p1 = points[i];
      p2 = points[(i + 1) % end];

      if (this.closed) {
        p0 = points[(i - 1 + end) % end];
        p3 = points[(i + 2) % end];
      } else {
        // Для открытых путей отразить конечные точки
        if (i === 0) {
          p0 = { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
        } else {
          p0 = points[i - 1];
        }

        if (i === end - 2) {
          p3 = { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
        } else {
          p3 = points[i + 2];
        }
      }

      // Преобразовать Catmull-Rom в кубическую кривую Безье
      // Управляющие точки для кривой Безье:
      // cp1 = p1 + (p2 - p0) / 6
      // cp2 = p2 - (p3 - p1) / 6
      const cp1 = {
        x: p1.x + (p2.x - p0.x) / 6,
        y: p1.y + (p2.y - p0.y) / 6,
      };

      const cp2 = {
        x: p2.x - (p3.x - p1.x) / 6,
        y: p2.y - (p3.y - p1.y) / 6,
      };

      const bezier = new CubicBezier(
        p1.x,
        p1.y,
        cp1.x,
        cp1.y,
        cp2.x,
        cp2.y,
        p2.x,
        p2.y
      );

      beziers.push(bezier);
    }

    return beziers;
  }

  private estimateBezierCurvature(_segmentIndex: number): number {
    // Простая оценка на основе отклонения управляющей точки
    return 1.0;
  }

  getLocalBounds(): Bounds {
    if (this.anchors.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const points = this.flattenLocalPoints();
    let result: Bounds = {
      minX: points[0].x,
      minY: points[0].y,
      maxX: points[0].x,
      maxY: points[0].y,
    };

    for (const p of points) {
      result.minX = Math.min(result.minX, p.x);
      result.minY = Math.min(result.minY, p.y);
      result.maxX = Math.max(result.maxX, p.x);
      result.maxY = Math.max(result.maxY, p.y);
    }

    return result;
  }

  getBounds(): Bounds {
    return this.transformBounds(this.getLocalBounds());
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
    return this.anchors.map(p => ({ ...p }));
  }

  setControlPoint(index: number, point: { x: number; y: number }) {
    if (index >= 0 && index < this.anchors.length) {
      this.anchors[index] = { ...point };
      this.cachedPoints = null; // Инвалидировать кэш
    }
  }

  addPointLocal(point: { x: number; y: number }, insertAtIndex?: number) {
    if (insertAtIndex !== undefined) {
      this.anchors.splice(insertAtIndex, 0, { ...point });
    } else {
      this.anchors.push({ ...point });
    }
    this.cachedPoints = null; // Инвалидировать кэш
  }

  removePoint(index: number) {
    if (index >= 0 && index < this.anchors.length) {
      this.anchors.splice(index, 1);
      this.cachedPoints = null; // Инвалидировать кэш
    }
  }

  clone(): PathBezier {
    const copy = new PathBezier(this.anchors);
    copy.mode = this.mode;
    copy.closed = this.closed;
    this.applyBaseState(copy);
    return copy;
  }

  toJSON() {
    return {
      type: 'path',
      anchors: this.anchors.map(p => ({ ...p })),
      mode: this.mode,
      closed: this.closed,
      ...this.serializeBaseState(),
    };
  }
}

export function pathBezierFromJSON(data: ShapeJSON) {
  const anchors = Array.isArray(data.anchors) ? (data.anchors as Array<{ x: number; y: number }>).map((point) => ({ x: point.x, y: point.y })) : [];
  const path = new PathBezier(anchors);
  const mode = data.mode;
  if (mode === 'polyline' || mode === 'bezier' || mode === 'catmull') {
    path.mode = mode;
  }
  path.closed = Boolean(data.closed);
  path.applySerializedBaseState(data);
  return path;
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
