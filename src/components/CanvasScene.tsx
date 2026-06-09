import { useRef, useEffect } from 'react';
import { RasterRenderer } from '../lib/math/raster/RasterRenderer';
import type { LineAlg } from '../lib/math/raster/RasterRenderer';
import { Rect, Line, Oval, Triangle, QuadraticBezier, CubicBezier, PathBezier } from '../lib/math/shape';

interface CanvasSceneProps {
  lineAlg: LineAlg;
}

const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setLineAlgorithm(lineAlg);
    }
  }, [lineAlg]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderer = new RasterRenderer(canvas);
    renderer.setLineAlgorithm(lineAlg);
    rendererRef.current = renderer;

    const ro = new ResizeObserver(() => {
      renderer.resize();
    });

    if (containerRef.current) {
      ro.observe(containerRef.current);
    } else {
      ro.observe(canvas);
    }

    const rectShape = new Rect(220, 120);
    rectShape.transform.x = 260;
    rectShape.transform.y = 200;
    rectShape.transform.rotation = 0.28;
    rectShape.fillStyle = '#1e90ff';
    rectShape.fillOpacity = 200;
    rectShape.strokeStyle = '#003366';
    rectShape.strokeWidth = 4;

    const lineShape = new Line(500, 120, 760, 240);
    lineShape.strokeStyle = '#00aa55';
    lineShape.strokeWidth = 8;

    const ovalShape = new Oval(110, 70);
    ovalShape.transform.x = 520;
    ovalShape.transform.y = 520;
    ovalShape.transform.rotation = -0.22;
    ovalShape.fillStyle = '#ffb000';
    ovalShape.fillOpacity = 192;
    ovalShape.strokeStyle = '#8a4b00';
    ovalShape.strokeWidth = 4;

    // Треугольник
    const triangleShape = new Triangle(800, 100, 900, 300, 700, 300);
    triangleShape.fillStyle = '#ff6b9d';
    triangleShape.fillOpacity = 200;
    triangleShape.strokeStyle = '#c41e3a';
    triangleShape.strokeWidth = 3;

    // Квадратическая кривая Безье - 3 точки управления
    const quadBezier = new QuadraticBezier(150, 450, 250, 350, 350, 450);
    quadBezier.strokeStyle = '#00ff88';
    quadBezier.strokeWidth = 1;
    quadBezier.closed = true;

    // Кубическая кривая Безье - 4 точки управления (S-образная кривая)
    const cubicBezier = new CubicBezier(450, 400, 480, 500, 580, 300, 610, 400);
    cubicBezier.strokeStyle = '#ff00ff';
    cubicBezier.strokeWidth = 1;
    cubicBezier.closed = true;

    // PathBezier с режимом Catmull-Rom - произвольная замкнутая кривая
    const pathBezierClosed = new PathBezier([
      { x: 700, y: 520 },
      { x: 760, y: 360 },
      { x: 820, y: 580 },
      { x: 880, y: 380 },
      { x: 910, y: 500 }
    ]);
    pathBezierClosed.mode = 'catmull';
    pathBezierClosed.closed = true;
    pathBezierClosed.strokeStyle = '#00ccff';
    pathBezierClosed.strokeWidth = 1;

    let raf = 0;
    const frame = () => {
      const r = rendererRef.current;
      if (r) {
        r.beginFrame(true);

        // Нарисовать все фигуры
        rectShape.drawRaster(r);
        lineShape.drawRaster(r);
        ovalShape.drawRaster(r);
        triangleShape.drawRaster(r);
        quadBezier.drawRaster(r);
        cubicBezier.drawRaster(r);
        pathBezierClosed.drawRaster(r);

        const testPoint = { x: 420, y: 260 };

        const pointColor = { r: 255, g: 255, b: 255, a: 255 };
        r.fillCircle(testPoint.x, testPoint.y, 6, pointColor);
        r.strokeLine(testPoint.x - 8, testPoint.y, testPoint.x + 8, testPoint.y, pointColor, 2);
        r.strokeLine(testPoint.x, testPoint.y - 8, testPoint.x, testPoint.y + 8, pointColor, 2);

        const hitColor = { r: 0, g: 0, b: 0, a: 255 };
        if (rectShape.hitTest(testPoint.x, testPoint.y)) {
          r.strokeLine(testPoint.x - 10, testPoint.y - 10, testPoint.x + 10, testPoint.y + 10, hitColor, 1);
          r.strokeLine(testPoint.x + 10, testPoint.y - 10, testPoint.x - 10, testPoint.y + 10, hitColor, 1);
        }

        r.commit();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="overflow-auto bg-gray-50" style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className="block"
        style={{ width: 1400, height: 700 }}
      />
    </div>
  );
};

export default CanvasScene;
