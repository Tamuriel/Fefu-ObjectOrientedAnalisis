import { useRef, useEffect } from 'react';
import { RasterRenderer } from '../lib/math/raster/RasterRenderer';
import type { LineAlg } from '../lib/math/raster/RasterRenderer';

interface CanvasSceneProps {
  lineAlg: LineAlg;
}

const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // React to lineAlg changes
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

    let raf = 0;
    const frame = () => {
      const r = rendererRef.current;
      if (r) {
        r.beginFrame(true); // очистить буфер

        // Демонстрация: красный полигон с черной обводкой
        const pts = [
          { x: 100, y: 100 },
          { x: 420, y: 120 },
          { x: 140, y: 380 },
        ];
        const red = { r: 255, g: 0, b: 0, a: 255 };
        const black = { r: 0, g: 0, b: 0, a: 255 };

        r.fillPolygon(pts, red);
        r.strokePolygon(pts, black, 4);

        // Демонстрация: синий квадрат и полупрозрачный красный круг для проверки прозрачности
        const blueSquare = [
          { x: 520, y: 120 },
          { x: 760, y: 120 },
          { x: 760, y: 360 },
          { x: 520, y: 360 },
        ];
        const blue = { r: 0, g: 0, b: 255, a: 255 };
        r.fillPolygon(blueSquare, blue);

        const semiTransparentRed = { r: 255, g: 0, b: 0, a: 128 };
        r.fillCircle(640, 240, 80, semiTransparentRed);

        // Демонстрация: толстая ломаная линия
        const linePoints = [
          { x: 260, y: 440 },
          { x: 420, y: 500 },
          { x: 520, y: 440 },
          { x: 620, y: 520 },
        ];
        const green = { r: 0, g: 255, b: 0, a: 255 };
        r.strokePolygon(linePoints, green, 10);

        // Демонстрация зависимости от алгоритма линий
        const algoLineColor = { r: 0, g: 0, b: 0, a: 255 };
        r.drawLine(40, 40, 260, 90, algoLineColor);

        r.commit(); // вывести на экран
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
    <div ref={containerRef} className="overflow-hidden bg-gray-50" style={{ width: 1400, height: 700 }}>
      <canvas
        ref={canvasRef}
        className="block"
        style={{ width: 1400, height: 700 }}
      />
    </div>
  );
};

export default CanvasScene;
