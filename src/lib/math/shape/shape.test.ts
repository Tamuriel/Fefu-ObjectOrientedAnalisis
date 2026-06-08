import { describe, expect, test } from 'vitest';
import { Rect, Line, Oval, Triangle, QuadraticBezier, CubicBezier, PathBezier } from './index';

describe('Shape system', () => {
  test('Rect hit test and bounds', () => {
    const rect = new Rect(100, 50);
    rect.transform.x = 200;
    rect.transform.y = 100;
    rect.transform.rotation = Math.PI / 4;
    rect.fillStyle = '#00ff00';
    rect.strokeStyle = '#000000';
    rect.strokeWidth = 3;

    expect(rect.getLocalBounds()).toEqual({ minX: -50, minY: -25, maxX: 50, maxY: 25 });
    expect(rect.hitTest(200, 100)).toBe(true);
    expect(rect.hitTest(260, 100)).toBe(false);

    const bounds = rect.getBounds();
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
  });

  test('Line hitTest and clone', () => {
    const line = new Line(0, 0, 100, 0);
    line.strokeWidth = 4;
    line.transform.rotation = 0;

    expect(line.getLocalBounds()).toEqual({ minX: -50, minY: 0, maxX: 50, maxY: 0 });
    expect(line.hitTest(50, 0)).toBe(true);
    expect(line.hitTest(50, 10)).toBe(false);

    const clone = line.clone();
    expect(clone.type).toBe('Line');
    expect(clone.hitTest(50, 0)).toBe(true);
  });

  test('Oval hitTest and bounds', () => {
    const oval = new Oval(50, 30);
    oval.transform.x = 120;
    oval.transform.y = 80;
    oval.transform.rotation = Math.PI / 6;

    expect(oval.getLocalBounds()).toEqual({ minX: -50, minY: -30, maxX: 50, maxY: 30 });
    expect(oval.hitTest(120, 80)).toBe(true);
    expect(oval.hitTest(180, 80)).toBe(false);

    const bounds = oval.getBounds();
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
  });

  test('Shape setBounds updates transform', () => {
    const rect = new Rect(80, 40);
    rect.transform.x = 100;
    rect.transform.y = 100;

    rect.setBounds(200, 200, 300, 260);
    const changedCenter = rect.getCenter();
    expect(changedCenter.x).toBeCloseTo(250);
    expect(changedCenter.y).toBeCloseTo(230);
    expect(rect.transform.scaleX).not.toBe(1);
    expect(rect.transform.scaleY).not.toBe(1);
    expect(rect.hitTest(250, 230)).toBe(true);
  });

  // Тесты Triangle
  test('Triangle creation and bounds', () => {
    const tri = new Triangle(0, 0, 100, 0, 50, 86.6);
    expect(tri.type).toBe('Triangle');
    expect(tri.getControlPoints()).toHaveLength(3);
    
    const bounds = tri.getLocalBounds();
    expect(bounds.minX).toBeLessThan(bounds.maxX);
    expect(bounds.minY).toBeLessThan(bounds.maxY);
  });

  test('Triangle hit test - inside', () => {
    const tri = new Triangle(0, 0, 100, 0, 50, 86.6);
    const center = { x: (0 + 100 + 50) / 3, y: (0 + 0 + 86.6) / 3 };
    expect(tri.hitTest(center.x, center.y)).toBe(true);
  });

  test('Triangle hit test - outside', () => {
    const tri = new Triangle(0, 0, 100, 0, 50, 86.6);
    expect(tri.hitTest(-100, -100)).toBe(false);
    expect(tri.hitTest(500, 500)).toBe(false);
  });

  test('Triangle control points editing', () => {
    const tri = new Triangle(0, 0, 100, 0, 50, 86.6);
    const points = tri.getControlPoints();
    tri.setControlPoint(0, { x: 10, y: 10 });
    const updated = tri.getControlPoints();
    expect(updated[0].x).toBe(10);
    expect(updated[0].y).toBe(10);
  });

  test('Triangle serialization', () => {
    const tri = new Triangle(0, 0, 100, 0, 50, 86.6);
    tri.fillStyle = '#ff0000';
    const json = tri.toJSON();
    expect(json.type).toBe('Triangle');
    expect(json.p0).toBeDefined();
    expect(json.p1).toBeDefined();
    expect(json.p2).toBeDefined();
    expect(json.fillStyle).toBe('#ff0000');
  });

  // Тесты QuadraticBezier
  test('QuadraticBezier evaluation', () => {
    const curve = new QuadraticBezier(0, 0, 50, 100, 100, 0);
    
    // При t=0 должна быть в p0
    const p0 = curve.evalLocal(0);
    expect(p0.x).toBeCloseTo(0);
    expect(p0.y).toBeCloseTo(0);
    
    // При t=1 должна быть в p2
    const p1 = curve.evalLocal(1);
    expect(p1.x).toBeCloseTo(100);
    expect(p1.y).toBeCloseTo(0);
    
    // При t=0.5 должна быть под влиянием управляющей точки
    // B(0.5) = 0.25*p0 + 0.5*p1 + 0.25*p2 = 0.25*(0,0) + 0.5*(50,100) + 0.25*(100,0) = (50, 50)
    const p05 = curve.evalLocal(0.5);
    expect(p05.x).toBeCloseTo(50);
    expect(p05.y).toBeCloseTo(50);
  });

  test('QuadraticBezier bounds', () => {
    const curve = new QuadraticBezier(0, 0, 50, 100, 100, 0);
    const bounds = curve.getLocalBounds();
    
    expect(bounds.minX).toBeLessThanOrEqual(0);
    expect(bounds.maxX).toBeGreaterThanOrEqual(100);
    expect(bounds.maxY).toBeGreaterThanOrEqual(50); // Пик должен быть выше 0
  });

  test('QuadraticBezier flatten', () => {
    const curve = new QuadraticBezier(0, 0, 50, 100, 100, 0);
    const points = curve.flattenDevicePoints();
    
    expect(points.length).toBeGreaterThan(1);
    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].y).toBeCloseTo(0);
  });

  test('QuadraticBezier hit test', () => {
    const curve = new QuadraticBezier(0, 0, 50, 100, 100, 0);
    curve.strokeWidth = 5;
    
    // Проверка попадания рядом с кривой
    const points = curve.flattenDevicePoints();
    expect(curve.hitTest(points[1].x, points[1].y)).toBe(true);
  });

  test('QuadraticBezier control points', () => {
    const curve = new QuadraticBezier(0, 0, 50, 100, 100, 0);
    const points = curve.getControlPoints();
    expect(points).toHaveLength(3);
    
    curve.setControlPoint(1, { x: 60, y: 120 });
    const updated = curve.getControlPoints();
    expect(updated[1].x).toBe(60);
    expect(updated[1].y).toBe(120);
  });

  test('QuadraticBezier serialization', () => {
    const curve = new QuadraticBezier(0, 0, 50, 100, 100, 0);
    curve.strokeStyle = '#0000ff';
    const json = curve.toJSON();
    
    expect(json.type).toBe('QuadraticBezier');
    expect(json.p0).toBeDefined();
    expect(json.p1).toBeDefined();
    expect(json.p2).toBeDefined();
    expect(json.strokeStyle).toBe('#0000ff');
  });

  // Тесты CubicBezier
  test('CubicBezier evaluation', () => {
    const curve = new CubicBezier(0, 0, 30, 100, 70, -100, 100, 0);
    
    // При t=0 должна быть в p0
    const p0 = curve.evalLocal(0);
    expect(p0.x).toBeCloseTo(0);
    expect(p0.y).toBeCloseTo(0);
    
    // При t=1 должна быть в p3
    const p1 = curve.evalLocal(1);
    expect(p1.x).toBeCloseTo(100);
    expect(p1.y).toBeCloseTo(0);
  });

  test('CubicBezier bounds with extrema', () => {
    const curve = new CubicBezier(0, 0, 30, 100, 70, -100, 100, 0);
    const bounds = curve.getLocalBounds();
    
    // Кривая должна выходить за пределы лишь конечных точек
    expect(bounds.maxX).toBeGreaterThanOrEqual(100);
    expect(bounds.minY).toBeLessThan(0); // Спускается ниже линии
    expect(bounds.maxY).toBeGreaterThan(0); // Попинается над линией
  });

  test('CubicBezier flatten', () => {
    const curve = new CubicBezier(0, 0, 30, 100, 70, -100, 100, 0);
    const points = curve.flattenDevicePoints();
    
    expect(points.length).toBeGreaterThan(1);
    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].y).toBeCloseTo(0);
  });

  test('CubicBezier control points', () => {
    const curve = new CubicBezier(0, 0, 30, 100, 70, -100, 100, 0);
    const points = curve.getControlPoints();
    expect(points).toHaveLength(4);
    
    curve.setControlPoint(2, { x: 80, y: -120 });
    const updated = curve.getControlPoints();
    expect(updated[2].x).toBe(80);
    expect(updated[2].y).toBe(-120);
  });

  test('CubicBezier serialization', () => {
    const curve = new CubicBezier(0, 0, 30, 100, 70, -100, 100, 0);
    const json = curve.toJSON();
    
    expect(json.type).toBe('CubicBezier');
    expect(json.p0).toBeDefined();
    expect(json.p1).toBeDefined();
    expect(json.p2).toBeDefined();
    expect(json.p3).toBeDefined();
  });

  // Тесты PathBezier
  test('PathBezier polyline mode', () => {
    const path = new PathBezier([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
    path.mode = 'polyline';
    
    const points = path.flattenDevicePoints();
    expect(points.length).toBe(3);
    expect(points[0].x).toBeCloseTo(0);
    expect(points[1].x).toBeCloseTo(50);
  });

  test('PathBezier add point', () => {
    const path = new PathBezier([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    
    expect(path.getControlPoints()).toHaveLength(2);
    path.addPointLocal({ x: 50, y: 50 });
    expect(path.getControlPoints()).toHaveLength(3);
  });

  test('PathBezier remove point', () => {
    const path = new PathBezier([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
    
    expect(path.getControlPoints()).toHaveLength(3);
    path.removePoint(1);
    expect(path.getControlPoints()).toHaveLength(2);
  });

  test('PathBezier closed path', () => {
    const path = new PathBezier([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);
    path.closed = true;
    path.mode = 'polyline';
    
    const points = path.flattenDevicePoints();
    // Замкнутый путь должен вернуться к началу
    expect(points[points.length - 1].x).toBeCloseTo(points[0].x);
    expect(points[points.length - 1].y).toBeCloseTo(points[0].y);
  });

  test('PathBezier catmull mode', () => {
    const path = new PathBezier([
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
      { x: 150, y: 100 },
    ]);
    path.mode = 'catmull';
    
    const points = path.flattenDevicePoints();
    expect(points.length).toBeGreaterThan(4);
    
    // Первая и последняя точки должны совпадать с опорными
    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].y).toBeCloseTo(0);
  });

  test('PathBezier serialization', () => {
    const path = new PathBezier([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
    path.mode = 'catmull';
    path.closed = true;
    
    const json = path.toJSON();
    expect(json.type).toBe('PathBezier');
    expect(json.anchors).toHaveLength(3);
    expect(json.mode).toBe('catmull');
    expect(json.closed).toBe(true);
  });

  test('PathBezier hit test', () => {
    const path = new PathBezier([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    path.mode = 'polyline';
    path.strokeWidth = 5;
    
    const points = path.flattenDevicePoints();
    expect(path.hitTest(points[0].x, points[0].y)).toBe(true);
  });
});
