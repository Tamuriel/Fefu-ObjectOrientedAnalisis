import { mat3 } from '../mat3';
import type { RasterRenderer } from '../raster/RasterRenderer';

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ShapeStyle {
  fillStyle: string;
  strokeStyle: string;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
}

export type ShapeJSON = Record<string, unknown> & {
  type: string;
  id?: string;
  name?: string;
  transform?: Partial<Transform>;
  fillStyle?: string;
  strokeStyle?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeWidth?: number;
};

const DEFAULT_STYLE: ShapeStyle = {
  fillStyle: '#000000',
  strokeStyle: '#000000',
  fillOpacity: 255,
  strokeOpacity: 255,
  strokeWidth: 1,
};

let shapeIdCounter = 1;
const typeCounters: Record<string, number> = {};

export abstract class Shape {
  readonly id: string;
  readonly name: string;
  transform: Transform;
  fillStyle = DEFAULT_STYLE.fillStyle;
  strokeStyle = DEFAULT_STYLE.strokeStyle;
  fillOpacity = DEFAULT_STYLE.fillOpacity;
  strokeOpacity = DEFAULT_STYLE.strokeOpacity;
  strokeWidth = DEFAULT_STYLE.strokeWidth;

  constructor(
    public readonly type: string,
    x = 0,
    y = 0,
    rotation = 0,
    scaleX = 1,
    scaleY = 1
  ) {
    const count = Shape.incrementTypeCount(type);
    this.id = `${type}-${shapeIdCounter++}`;
    this.name = `${Shape.getTypeLabel(type)} ${count}`;
    this.transform = { x, y, rotation, scaleX, scaleY };
  }

  private static incrementTypeCount(type: string) {
    typeCounters[type] = (typeCounters[type] ?? 0) + 1;
    return typeCounters[type];
  }

  private static getTypeLabel(type: string) {
    switch (type) {
      case 'Rect':
        return 'Прямоугольник';
      case 'Line':
        return 'Линия';
      case 'Oval':
        return 'Овал';
      case 'Triangle':
        return 'Треугольник';
      case 'QuadraticBezier':
        return 'Квадратичная кривая';
      case 'CubicBezier':
        return 'Кубическая кривая';
      case 'PathBezier':
        return 'Кривая';
      default:
        return type;
    }
  }

  static resetCounters() {
    shapeIdCounter = 1;
    Object.keys(typeCounters).forEach((key) => {
      delete typeCounters[key];
    });
  }

  getLocalToDeviceMatrix() {
    return mat3.fromTransform(
      this.transform.x,
      this.transform.y,
      this.transform.rotation,
      this.transform.scaleX,
      this.transform.scaleY
    );
  }

  getDeviceToLocalMatrix() {
    const inv = mat3.invert(this.getLocalToDeviceMatrix());
    if (!inv) {
      throw new Error('Cannot invert transform matrix');
    }
    return inv;
  }

  transformPointToDevice(px: number, py: number) {
    return mat3.transformPoint(this.getLocalToDeviceMatrix(), px, py);
  }

  transformPointToLocal(px: number, py: number) {
    return mat3.transformPoint(this.getDeviceToLocalMatrix(), px, py);
  }

  getCenter() {
    const bounds = this.getBounds();
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
  }

  resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number) {
    const current = this.getBounds();
    const currentWidth = current.maxX - current.minX;
    const currentHeight = current.maxY - current.minY;
    const targetWidth = maxX - minX;
    const targetHeight = maxY - minY;

    if (currentWidth <= 0 || currentHeight <= 0) {
      return;
    }

    const scaleX = targetWidth / currentWidth;
    const scaleY = targetHeight / currentHeight;

    this.transform.scaleX *= scaleX;
    this.transform.scaleY *= scaleY;

    const currentCenter = this.getCenter();
    const nextCenterX = (minX + maxX) / 2;
    const nextCenterY = (minY + maxY) / 2;

    this.transform.x += nextCenterX - currentCenter.x;
    this.transform.y += nextCenterY - currentCenter.y;
  }

  setBounds(minX: number, minY: number, maxX: number, maxY: number) {
    this.resizeFromDeviceAABB(minX, minY, maxX, maxY);
  }

  protected transformBounds(bounds: Bounds) {
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.minX, y: bounds.maxY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
    ];
    let result: Bounds | null = null;
    for (const corner of corners) {
      const transformed = this.transformPointToDevice(corner.x, corner.y);
      if (!result) {
        result = { minX: transformed.x, minY: transformed.y, maxX: transformed.x, maxY: transformed.y };
      } else {
        result.minX = Math.min(result.minX, transformed.x);
        result.minY = Math.min(result.minY, transformed.y);
        result.maxX = Math.max(result.maxX, transformed.x);
        result.maxY = Math.max(result.maxY, transformed.y);
      }
    }
    return result ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  protected applyBaseState(target: Shape) {
    target.transform = { ...this.transform };
    target.fillStyle = this.fillStyle;
    target.strokeStyle = this.strokeStyle;
    target.fillOpacity = this.fillOpacity;
    target.strokeOpacity = this.strokeOpacity;
    target.strokeWidth = this.strokeWidth;
  }

  getControlPoints(): { x: number; y: number }[] {
    return [];
  }

  setControlPoint(_index: number, _point: { x: number; y: number }): void {
    // Override in shapes with editable control points
  }

  abstract clone(): Shape;
  abstract drawRaster(renderer: RasterRenderer): void;
  abstract hitTest(px: number, py: number): boolean;
  abstract getBounds(): Bounds;
  abstract getLocalBounds(): Bounds;

  serializeBaseState() {
    return {
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      fillOpacity: this.fillOpacity,
      strokeOpacity: this.strokeOpacity,
      strokeWidth: this.strokeWidth,
    };
  }

  applySerializedBaseState(data: ShapeJSON) {
    if (data.transform) {
      this.transform = {
        x: data.transform.x ?? this.transform.x,
        y: data.transform.y ?? this.transform.y,
        rotation: data.transform.rotation ?? this.transform.rotation,
        scaleX: data.transform.scaleX ?? this.transform.scaleX,
        scaleY: data.transform.scaleY ?? this.transform.scaleY,
      };
    }

    if (typeof data.fillStyle === 'string') this.fillStyle = data.fillStyle;
    if (typeof data.strokeStyle === 'string') this.strokeStyle = data.strokeStyle;
    if (typeof data.fillOpacity === 'number') this.fillOpacity = data.fillOpacity;
    if (typeof data.strokeOpacity === 'number') this.strokeOpacity = data.strokeOpacity;
    if (typeof data.strokeWidth === 'number') this.strokeWidth = data.strokeWidth;
  }

  abstract toJSON(): ShapeJSON;
}
