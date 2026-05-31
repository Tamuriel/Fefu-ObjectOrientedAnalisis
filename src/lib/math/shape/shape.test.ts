import { describe, expect, test } from 'vitest';
import { Rect, Line, Oval } from './index';

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
});
