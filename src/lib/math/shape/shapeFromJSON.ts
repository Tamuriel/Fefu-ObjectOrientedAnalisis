import { cubicBezierFromJSON } from './CubicBezier';
import { lineFromJSON } from './Line';
import { ovalFromJSON } from './Oval';
import { pathBezierFromJSON } from './PathBezier';
import { quadraticBezierFromJSON } from './QuadraticBezier';
import { rectFromJSON } from './Rect';
import { triangleFromJSON } from './Triangle';
import type { Shape, ShapeJSON } from './Shape';

export function shapeFromJSON(data: ShapeJSON): Shape | null {
  switch (data.type) {
    case 'rect':
    case 'Rect':
      return rectFromJSON(data);
    case 'line':
    case 'Line':
      return lineFromJSON(data);
    case 'oval':
    case 'Oval':
      return ovalFromJSON(data);
    case 'triangle':
    case 'Triangle':
      return triangleFromJSON(data);
    case 'quad':
    case 'quadratic':
    case 'QuadraticBezier':
      return quadraticBezierFromJSON(data);
    case 'cubic':
    case 'CubicBezier':
      return cubicBezierFromJSON(data);
    case 'path':
    case 'PathBezier':
      return pathBezierFromJSON(data);
    default:
      return null;
  }
}