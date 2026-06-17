import { useRef, useEffect, useLayoutEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { RasterRenderer, type LineAlg, type RGBA } from '../lib/math/raster/RasterRenderer';
import { mat3 } from '../lib/math/mat3';
import { Rect, Line, Oval, Triangle, PathBezier, Shape } from '../lib/math/shape';
import { shapeFromJSON } from '../lib/math/shape/shapeFromJSON';
import type { Bounds, ShapeJSON } from '../lib/math/shape/Shape';

export interface CanvasSceneHandle {
  addRectangle: () => void;
  addOval: () => void;
  addLine: () => void;
  addTriangle: () => void;
  addPath: () => void;
  loadShapes: (shapes: ShapeJSON[]) => void;
  exportShapes: () => ShapeJSON[];
  deleteSelectedShape: () => void;
  deleteSelectedControlPoint: () => void;
  moveLayer: (offset: number) => void;
  setInsertPointMode: (enabled: boolean) => void;
  setDeletePointMode: (enabled: boolean) => void;
  getInsertPointMode: () => boolean;
  getDeletePointMode: () => boolean;
  getLayers: () => Array<{ id: string; label: string }>;
  getSelectedId: () => string | null;
  getSelectedLabel: () => string | null;
  getSelectedPointIndex: () => number | null;
  getSelectedShapeType: () => string | null;
}

interface CanvasSceneProps {
  lineAlg: LineAlg;
  onUpdate?: () => void;
  hideUi?: boolean;
  hideInternalLayers?: boolean;
}

type InteractionMode = 'idle' | 'drag' | 'resize' | 'rotate' | 'edit-point';

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';

type HandleHit = {
  type: 'resize' | 'rotate' | 'point';
  handle?: ResizeHandle;
  pointIndex?: number;
};

const HANDLE_SIZE = 8;

const CanvasScene = forwardRef<CanvasSceneHandle, CanvasSceneProps>(
  ({ lineAlg, onUpdate, hideUi = false, hideInternalLayers = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);
  const shapesRef = useRef<Shape[]>([]);
  const interactionRef = useRef<{
    mode: InteractionMode;
    shapeId: string | null;
    pointerStart: { x: number; y: number } | null;
    startTransform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number } | null;
    startBounds: Bounds | null;
    resizeStartPointerLocal: { x: number; y: number } | null;
    resizeStartHandleLocal: { x: number; y: number } | null;
    resizeStartAnchorLocal: { x: number; y: number } | null;
    resizeStartAnchorDevice: { x: number; y: number } | null;
    handle?: ResizeHandle;
    startAngle: number;
    center: { x: number; y: number } | null;
    pointIndex: number | null;
    captured: boolean;
  }>({
    mode: 'idle',
    shapeId: null,
    pointerStart: null,
    startTransform: null,
    startBounds: null,
    resizeStartPointerLocal: null,
    resizeStartHandleLocal: null,
    resizeStartAnchorLocal: null,
    resizeStartAnchorDevice: null,
    startAngle: 0,
    center: null,
    pointIndex: null,
    captured: false,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [insertPointMode, setInsertPointModeState] = useState(false);
  const [deletePointMode, setDeletePointModeState] = useState(false);
  const [currentAlg, setCurrentAlg] = useState<LineAlg>(lineAlg);
  const [, setVersion] = useState(0);
  const [shapeVersion, setShapeVersion] = useState(0);
  const selectedIdRef = useRef<string | null>(null);

  const forceUpdate = useCallback(() => {
    setVersion((value) => value + 1);
    setShapeVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    onUpdate?.();
  }, [shapeVersion, selectedId, onUpdate]);

  useEffect(() => {
    setCurrentAlg(lineAlg);
  }, [lineAlg]);

  const selectedShape = selectedId
    ? shapesRef.current.find((shape) => shape.id === selectedId) ?? null
    : null;

  const createInitialShapes = useCallback(() => {
    Shape.resetCounters();
    shapesRef.current = [];
    setSelectedId(null);
    setSelectedPointIndex(null);
    setInsertPointModeState(false);
    setDeletePointModeState(false);
  }, []);

  const loadShapes = useCallback((shapeData: ShapeJSON[]) => {
    Shape.resetCounters();
    shapesRef.current = shapeData.map((item) => shapeFromJSON(item)).filter((shape): shape is Shape => shape !== null);
    setSelectedId(shapesRef.current[0]?.id ?? null);
    setSelectedPointIndex(null);
    updateSelection();
  }, []);

  const exportShapes = useCallback(() => {
    return shapesRef.current.map((shape) => shape.toJSON() as ShapeJSON);
  }, []);

  const getCanvasCoordinates = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * renderer.dpr;
    const y = (event.clientY - rect.top) * renderer.dpr;
    return { x, y };
  }, []);

  const getHandlePositions = useCallback((shape: Shape) => {
    const bounds = shape.getLocalBounds();
    const corners = [
      shape.transformPointToDevice(bounds.minX, bounds.minY),
      shape.transformPointToDevice(bounds.maxX, bounds.minY),
      shape.transformPointToDevice(bounds.maxX, bounds.maxY),
      shape.transformPointToDevice(bounds.minX, bounds.maxY),
    ];
    const topMidLocal = { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY };
    const rotateLocal = { x: topMidLocal.x, y: topMidLocal.y - 32 };
    return {
      resize: {
        nw: corners[0],
        ne: corners[1],
        se: corners[2],
        sw: corners[3],
      },
      rotate: shape.transformPointToDevice(rotateLocal.x, rotateLocal.y),
    };
  }, []);

  const getResizeCornerData = useCallback((handle: ResizeHandle, bounds: Bounds) => {
    switch (handle) {
      case 'nw':
        return {
          anchorLocal: { x: bounds.maxX, y: bounds.maxY },
          handleLocal: { x: bounds.minX, y: bounds.minY },
        };
      case 'ne':
        return {
          anchorLocal: { x: bounds.minX, y: bounds.maxY },
          handleLocal: { x: bounds.maxX, y: bounds.minY },
        };
      case 'se':
        return {
          anchorLocal: { x: bounds.minX, y: bounds.minY },
          handleLocal: { x: bounds.maxX, y: bounds.maxY },
        };
      case 'sw':
        return {
          anchorLocal: { x: bounds.maxX, y: bounds.minY },
          handleLocal: { x: bounds.minX, y: bounds.maxY },
        };
      default:
        return {
          anchorLocal: { x: bounds.minX, y: bounds.minY },
          handleLocal: { x: bounds.maxX, y: bounds.maxY },
        };
    }
  }, []);

  const pointInRadius = (x: number, y: number, cx: number, cy: number, radius: number) => {
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
  };

  const findHitHandle = useCallback((shape: Shape, x: number, y: number): HandleHit | null => {
    const handles = getHandlePositions(shape);
    for (const key of ['nw', 'ne', 'se', 'sw'] as ResizeHandle[]) {
      const handle = handles.resize[key];
      if (pointInRadius(x, y, handle.x, handle.y, HANDLE_SIZE * 2)) {
        return { type: 'resize', handle: key };
      }
    }
    const rotate = handles.rotate;
    if (pointInRadius(x, y, rotate.x, rotate.y, HANDLE_SIZE * 2)) {
      return { type: 'rotate' };
    }
    const controlPoints = shape.getControlPoints();
    for (let i = 0; i < controlPoints.length; i++) {
      const point = controlPoints[i];
      const devicePoint = shape.transformPointToDevice(point.x, point.y);
      if (pointInRadius(x, y, devicePoint.x, devicePoint.y, HANDLE_SIZE * 2)) {
        return { type: 'point', pointIndex: i };
      }
    }
    return null;
  }, [getHandlePositions]);

  const getPathInsertIndex = useCallback((shape: PathBezier, x: number, y: number): number | null => {
    const points = shape.anchors.map((point) => shape.transformPointToDevice(point.x, point.y));
    if (points.length < 2) {
      return points.length;
    }

    let bestIndex: number | null = null;
    let bestDistance = Infinity;
    const threshold = 16;
    const segmentCount = shape.closed ? points.length : points.length - 1;

    for (let i = 0; i < segmentCount; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSq = dx * dx + dy * dy;
      if (lengthSq === 0) continue;

      let t = ((x - a.x) * dx + (y - a.y) * dy) / lengthSq;
      t = Math.max(0, Math.min(1, t));
      const closestX = a.x + dx * t;
      const closestY = a.y + dy * t;
      const dist = Math.hypot(x - closestX, y - closestY);
      if (dist < bestDistance && dist < threshold) {
        bestDistance = dist;
        bestIndex = i + 1;
      }
    }

    if (bestIndex !== null && shape.closed && bestIndex > shape.anchors.length) {
      return shape.anchors.length;
    }

    return bestIndex;
  }, []);

  const topmostShapeAt = useCallback((x: number, y: number) => {
    const shapes = shapesRef.current;
    for (let i = shapes.length - 1; i >= 0; i -= 1) {
      if (shapes[i].hitTest(x, y)) {
        return shapes[i];
      }
    }
    return null;
  }, []);

  const selectShape = useCallback((shape: Shape | null) => {
    setSelectedPointIndex(null);
    setInsertPointModeState(false);
    setDeletePointModeState(false);
    setSelectedId(shape ? shape.id : null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPointIndex(null);
    setInsertPointModeState(false);
    setDeletePointModeState(false);
    setSelectedId(null);
  }, []);

  const updateSelection = useCallback(() => {
    forceUpdate();
  }, [forceUpdate]);

  const createShape = useCallback((shape: Shape) => {
    shapesRef.current.push(shape);
    selectShape(shape);
    updateSelection();
  }, [selectShape, updateSelection]);

  const deleteSelectedControlPoint = useCallback(() => {
    if (!selectedId) return;
    const shape = shapesRef.current.find((item) => item.id === selectedId);
    if (!(shape instanceof PathBezier)) return;
    if (selectedPointIndex === null) return;
    const controlPoints = shape.getControlPoints();
    if (controlPoints.length <= 2) return;
    shape.removePoint(selectedPointIndex);
    setSelectedPointIndex(null);
    updateSelection();
  }, [selectedId, selectedPointIndex, updateSelection]);

  const setInsertPointMode = useCallback((enabled: boolean) => {
    setInsertPointModeState(enabled);
    setDeletePointModeState(false);
    setSelectedPointIndex(null);
    forceUpdate();
  }, [forceUpdate]);

  const setDeletePointMode = useCallback((enabled: boolean) => {
    setDeletePointModeState(enabled);
    setInsertPointModeState(false);
    setSelectedPointIndex(null);
    forceUpdate();
  }, [forceUpdate]);

  useEffect(() => {
    if (deletePointMode && (!selectedShape || !(selectedShape instanceof PathBezier))) {
      setDeletePointMode(false);
    }
  }, [deletePointMode, selectedShape, setDeletePointMode]);

  const deleteSelectedShape = useCallback(() => {
    if (!selectedId) return;
    shapesRef.current = shapesRef.current.filter((shape) => shape.id !== selectedId);
    setSelectedId(null);
    setSelectedPointIndex(null);
    updateSelection();
  }, [selectedId, updateSelection]);

  const moveLayer = useCallback((offset: number) => {
    if (!selectedId) return;
    const shapes = shapesRef.current;
    const index = shapes.findIndex((shape) => shape.id === selectedId);
    if (index < 0) return;
    const target = index + offset;
    if (target < 0 || target >= shapes.length) return;
    const [moved] = shapes.splice(index, 1);
    shapes.splice(target, 0, moved);
    updateSelection();
  }, [selectedId, updateSelection]);

  const addRectangle = useCallback(() => {
    const rectShape = new Rect(140, 80);
    rectShape.transform.x = 200;
    rectShape.transform.y = 180;
    rectShape.fillStyle = '#60a5fa';
    rectShape.strokeStyle = '#1d4ed8';
    rectShape.strokeWidth = 3;
    createShape(rectShape);
  }, [createShape]);

  const addOval = useCallback(() => {
    const ovalShape = new Oval(100, 60);
    ovalShape.transform.x = 280;
    ovalShape.transform.y = 200;
    ovalShape.fillStyle = '#f97316';
    ovalShape.strokeStyle = '#b45309';
    ovalShape.strokeWidth = 3;
    createShape(ovalShape);
  }, [createShape]);

  const addLine = useCallback(() => {
    const lineShape = new Line(0, 0, 180, 0);
    lineShape.transform.x = 320;
    lineShape.transform.y = 140;
    lineShape.strokeStyle = '#22c55e';
    lineShape.strokeWidth = 4;
    createShape(lineShape);
  }, [createShape]);

  const addTriangle = useCallback(() => {
    const triangleShape = new Triangle(0, 0, 120, 0, 60, 90);
    triangleShape.transform.x = 350;
    triangleShape.transform.y = 280;
    triangleShape.fillStyle = '#ec4899';
    triangleShape.strokeStyle = '#be185d';
    triangleShape.strokeWidth = 3;
    createShape(triangleShape);
  }, [createShape]);

  const addPath = useCallback(() => {
    const path = new PathBezier([
      { x: 0, y: 0 },
      { x: 80, y: -60 },
      { x: 180, y: 40 },
      { x: 140, y: 130 },
      { x: 40, y: 160 },
      { x: -20, y: 80 },
    ]);
    path.transform.x = 500;
    path.transform.y = 400;
    path.mode = 'catmull';
    path.closed = true;
    path.strokeStyle = '#38bdf8';
    path.strokeWidth = 2;
    createShape(path);
  }, [createShape]);

  const setShapeRotation = useCallback((shape: Shape, rotation: number) => {
    const bounds = shape.getLocalBounds();
    const localCenter = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const currentCenter = shape.transformPointToDevice(localCenter.x, localCenter.y);
    shape.transform.rotation = rotation;
    const newCenter = shape.transformPointToDevice(localCenter.x, localCenter.y);
    shape.transform.x += currentCenter.x - newCenter.x;
    shape.transform.y += currentCenter.y - newCenter.y;
  }, []);

  const getLayerLabel = useCallback((shape: Shape) => {
    return shape.name;
  }, []);

  useImperativeHandle(ref, () => ({
    addRectangle,
    addOval,
    addLine,
    addTriangle,
    addPath,
    loadShapes,
    exportShapes,
    deleteSelectedShape,
    deleteSelectedControlPoint,
    moveLayer,
    setInsertPointMode,
    setDeletePointMode,
    getLayers: () => shapesRef.current.slice().reverse().map((shape) => ({ id: shape.id, label: getLayerLabel(shape) })),
    getSelectedId: () => selectedId,
    getSelectedLabel: () => (selectedShape ? selectedShape.name : null),
    getSelectedPointIndex: () => selectedPointIndex,
    getSelectedShapeType: () => (selectedShape ? selectedShape.type : null),
    getInsertPointMode: () => insertPointMode,
    getDeletePointMode: () => deletePointMode,
  }), [
    addLine,
    addOval,
    addPath,
    addRectangle,
    addTriangle,
    exportShapes,
    deleteSelectedShape,
    deleteSelectedControlPoint,
    moveLayer,
    loadShapes,
    selectedId,
    selectedShape,
    selectedPointIndex,
    getLayerLabel,
    setInsertPointMode,
    setDeletePointMode,
    insertPointMode,
    deletePointMode,
  ]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const { x, y } = getCanvasCoordinates(event);
    const currentShape = selectedShape;

    const hitShape = topmostShapeAt(x, y);
    if (deletePointMode && currentShape instanceof PathBezier) {
      const hitHandle = findHitHandle(currentShape, x, y);
      if (hitHandle?.type === 'point' && hitHandle.pointIndex !== undefined) {
        currentShape.removePoint(hitHandle.pointIndex);
        setSelectedPointIndex(null);
        updateSelection();
        return;
      }
    }

    if (insertPointMode && hitShape instanceof PathBezier) {
      setSelectedId(hitShape.id);
      setSelectedPointIndex(null);
      const insertIndex = getPathInsertIndex(hitShape, x, y);
      if (insertIndex !== null) {
        const local = hitShape.transformPointToLocal(x, y);
        hitShape.addPointLocal(local, insertIndex);
        setSelectedPointIndex(insertIndex);
        updateSelection();
        return;
      }
    }

    const hitHandle = currentShape ? findHitHandle(currentShape, x, y) : null;

    if (hitHandle && currentShape) {
      if (hitHandle.type === 'point') {
        setSelectedPointIndex(hitHandle.pointIndex ?? null);
      } else {
        setSelectedPointIndex(null);
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      interactionRef.current.captured = true;
      interactionRef.current.shapeId = currentShape.id;
      interactionRef.current.pointerStart = { x, y };
      interactionRef.current.startTransform = {
        x: currentShape.transform.x,
        y: currentShape.transform.y,
        rotation: currentShape.transform.rotation,
        scaleX: currentShape.transform.scaleX,
        scaleY: currentShape.transform.scaleY,
      };
      interactionRef.current.startBounds = currentShape.getBounds();
      interactionRef.current.center = currentShape.getCenter();
      if (hitHandle.type === 'resize' && hitHandle.handle) {
        const corners = getResizeCornerData(hitHandle.handle, currentShape.getLocalBounds());
        interactionRef.current.resizeStartAnchorLocal = corners.anchorLocal;
        interactionRef.current.resizeStartHandleLocal = corners.handleLocal;
        interactionRef.current.resizeStartAnchorDevice = currentShape.transformPointToDevice(corners.anchorLocal.x, corners.anchorLocal.y);
        interactionRef.current.resizeStartPointerLocal = null;
      } else {
        interactionRef.current.resizeStartPointerLocal = null;
        interactionRef.current.resizeStartHandleLocal = null;
        interactionRef.current.resizeStartAnchorLocal = null;
        interactionRef.current.resizeStartAnchorDevice = null;
      }
      interactionRef.current.pointIndex = hitHandle.type === 'point' ? hitHandle.pointIndex ?? null : null;
      interactionRef.current.handle = hitHandle.handle;
      interactionRef.current.startAngle = currentShape && interactionRef.current.center ? Math.atan2(y - interactionRef.current.center.y, x - interactionRef.current.center.x) : 0;
      interactionRef.current.mode = hitHandle.type === 'resize' ? 'resize' : hitHandle.type === 'rotate' ? 'rotate' : 'edit-point';
      return;
    }

    if (hitShape) {
      if (!currentShape || currentShape.id !== hitShape.id) {
        selectShape(hitShape);
      }
      setSelectedPointIndex(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      interactionRef.current.captured = true;
      interactionRef.current.shapeId = hitShape.id;
      interactionRef.current.pointerStart = { x, y };
      interactionRef.current.startTransform = {
        x: hitShape.transform.x,
        y: hitShape.transform.y,
        rotation: hitShape.transform.rotation,
        scaleX: hitShape.transform.scaleX,
        scaleY: hitShape.transform.scaleY,
      };
      interactionRef.current.mode = 'drag';
      return;
    }

    clearSelection();
  }, [getCanvasCoordinates, selectedShape, topmostShapeAt, findHitHandle, selectShape, clearSelection, insertPointMode, deletePointMode, getPathInsertIndex, updateSelection]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactionRef.current.captured || interactionRef.current.mode === 'idle') return;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !renderer) return;

    const shape = interactionRef.current.shapeId
      ? shapesRef.current.find((item) => item.id === interactionRef.current.shapeId)
      : null;
    if (!shape) return;

    const { x, y } = getCanvasCoordinates(event);
    const start = interactionRef.current.pointerStart;
    const startTransform = interactionRef.current.startTransform;
    if (!start || !startTransform) return;

    if (interactionRef.current.mode === 'drag') {
      const dx = x - start.x;
      const dy = y - start.y;
      shape.transform.x = startTransform.x + dx;
      shape.transform.y = startTransform.y + dy;
    } else if (
      interactionRef.current.mode === 'resize' &&
      interactionRef.current.handle &&
      interactionRef.current.startTransform &&
      interactionRef.current.resizeStartHandleLocal &&
      interactionRef.current.resizeStartAnchorLocal &&
      interactionRef.current.resizeStartAnchorDevice
    ) {
      const startMatrix = mat3.fromTransform(
        interactionRef.current.startTransform.x,
        interactionRef.current.startTransform.y,
        interactionRef.current.startTransform.rotation,
        interactionRef.current.startTransform.scaleX,
        interactionRef.current.startTransform.scaleY
      );
      const startInverseMatrix = mat3.invert(startMatrix);
      if (!startInverseMatrix) return;

      const currentPointerLocal = mat3.transformPoint(startInverseMatrix, x, y);

      const anchorLocal = interactionRef.current.resizeStartAnchorLocal;
      const startHandleLocal = interactionRef.current.resizeStartHandleLocal;
      const baseWidth = startHandleLocal.x - anchorLocal.x;
      const baseHeight = startHandleLocal.y - anchorLocal.y;

      shape.transform.rotation = startTransform.rotation;

      if (Math.abs(baseWidth) > 1e-6) {
        shape.transform.scaleX = startTransform.scaleX * ((currentPointerLocal.x - anchorLocal.x) / baseWidth);
      }
      if (Math.abs(baseHeight) > 1e-6) {
        shape.transform.scaleY = startTransform.scaleY * ((currentPointerLocal.y - anchorLocal.y) / baseHeight);
      }

      const baseMatrix = mat3.multiply(
        mat3.rotate(shape.transform.rotation),
        mat3.scale(shape.transform.scaleX, shape.transform.scaleY)
      );
      const anchorWithoutTranslation = mat3.transformPoint(baseMatrix, anchorLocal.x, anchorLocal.y);
      shape.transform.x = interactionRef.current.resizeStartAnchorDevice.x - anchorWithoutTranslation.x;
      shape.transform.y = interactionRef.current.resizeStartAnchorDevice.y - anchorWithoutTranslation.y;
    } else if (interactionRef.current.mode === 'rotate' && interactionRef.current.center) {
      const angle = Math.atan2(y - interactionRef.current.center.y, x - interactionRef.current.center.x);
      const delta = angle - interactionRef.current.startAngle;
      setShapeRotation(shape, startTransform.rotation + delta);
    } else if (interactionRef.current.mode === 'edit-point' && interactionRef.current.pointIndex !== null) {
      const local = shape.transformPointToLocal(x, y);
      shape.setControlPoint(interactionRef.current.pointIndex, { x: local.x, y: local.y });
    }

    updateSelection();
  }, [getCanvasCoordinates, setShapeRotation, updateSelection]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactionRef.current.captured) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    interactionRef.current.captured = false;
    interactionRef.current.mode = 'idle';
    interactionRef.current.shapeId = null;
    interactionRef.current.pointerStart = null;
    interactionRef.current.startTransform = null;
    interactionRef.current.startBounds = null;
    interactionRef.current.resizeStartPointerLocal = null;
    interactionRef.current.resizeStartHandleLocal = null;
    interactionRef.current.resizeStartAnchorLocal = null;
    interactionRef.current.resizeStartAnchorDevice = null;
    interactionRef.current.handle = undefined;
    interactionRef.current.pointIndex = null;
    interactionRef.current.center = null;
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedPointIndex !== null) {
        event.preventDefault();
        deleteSelectedControlPoint();
        return;
      }
      deleteSelectedShape();
    }
  }, [deleteSelectedControlPoint, deleteSelectedShape, selectedPointIndex]);

  useEffect(() => {
    createInitialShapes();
  }, [createInitialShapes]);

  const syncCanvasSize = useCallback(() => {
    rendererRef.current?.resize();
  }, []);

  const syncCanvasSizeIfNeeded = useCallback(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const expectedWidth = Math.max(1, Math.floor(rect.width * (window.devicePixelRatio || 1)));
    const expectedHeight = Math.max(1, Math.floor(rect.height * (window.devicePixelRatio || 1)));

    if (renderer.width !== expectedWidth || renderer.height !== expectedHeight || renderer.dpr !== (window.devicePixelRatio || 1)) {
      renderer.resize();
    }
  }, []);

  useLayoutEffect(() => {
    syncCanvasSize();
  }, [syncCanvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas) return;
    const renderer = new RasterRenderer(canvas);
    renderer.setLineAlgorithm(currentAlg);
    rendererRef.current = renderer;

    const ro = new ResizeObserver(() => {
      syncCanvasSize();
    });
    if (stage) {
      ro.observe(stage);
    }
    ro.observe(canvas);
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }

    window.addEventListener('keydown', handleKeyDown);

    let raf = 0;
    const frame = () => {
      syncCanvasSizeIfNeeded();
      const shapes = shapesRef.current;
      const current = rendererRef.current;
      if (current) {
        current.beginFrame(true);
        for (const shape of shapes) {
          shape.drawRaster(current);
        }
        const selected = selectedIdRef.current
          ? shapesRef.current.find((shape) => shape.id === selectedIdRef.current)
          : null;
        if (selected) {
          drawSelectionOverlay(current, selected);
        }
        current.commit();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      renderer.dispose();
    };
  }, [handleKeyDown, syncCanvasSize, syncCanvasSizeIfNeeded, currentAlg]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setLineAlgorithm(currentAlg);
    }
  }, [currentAlg]);

  const drawSelectionOverlay = (renderer: RasterRenderer, shape: Shape) => {
    const color: RGBA = { r: 0, g: 0, b: 0, a: 255 };
    const bounds = shape.getLocalBounds();
    const corners = [
      shape.transformPointToDevice(bounds.minX, bounds.minY),
      shape.transformPointToDevice(bounds.maxX, bounds.minY),
      shape.transformPointToDevice(bounds.maxX, bounds.maxY),
      shape.transformPointToDevice(bounds.minX, bounds.maxY),
    ];
    for (let i = 0; i < corners.length; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      renderer.strokeLine(a.x, a.y, b.x, b.y, color, 2);
    }

    const handles = getHandlePositions(shape);
    Object.values(handles.resize).forEach((handle) => {
      renderer.fillCircle(handle.x, handle.y, HANDLE_SIZE, color);
    });
    renderer.fillCircle(handles.rotate.x, handles.rotate.y, HANDLE_SIZE, color);

    const points = shape.getControlPoints();
    for (const point of points) {
      const devicePoint = shape.transformPointToDevice(point.x, point.y);
      renderer.fillCircle(devicePoint.x, devicePoint.y, HANDLE_SIZE - 2, color);
    }
  };

  const renderLayerItem = (shape: Shape) => {
    const isActive = shape.id === selectedId;
    return (
      <div
        key={shape.id}
        className={`p-2 rounded mb-2 cursor-pointer ${isActive ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-700'}`}
        onClick={() => selectShape(shape)}
      >
        <div className="text-sm text-white font-semibold">{shape.name}</div>
        <div className="text-xs text-slate-400">{shape.id}</div>
      </div>
    );
  };

  const selectedLabel = selectedShape ? `${selectedShape.name} (${selectedShape.id})` : 'Пусто';

  return (
    <div ref={containerRef} className="relative h-full w-full min-h-0 bg-slate-100">
      {!hideUi && (
        <div className="canvas-scene__tools absolute left-4 top-4 z-20 rounded-xl bg-slate-900/95 p-3 shadow-lg border border-slate-700 text-white w-96">
          <div className="font-semibold mb-3">Инструменты</div>
          <div className="grid gap-2">
            <button className="rounded bg-blue-600 px-3 py-2 text-sm" onClick={addRectangle}>Добавить прямоугольник</button>
            <button className="rounded bg-orange-500 px-3 py-2 text-sm" onClick={addOval}>Добавить овал</button>
            <button className="rounded bg-emerald-500 px-3 py-2 text-sm" onClick={addLine}>Добавить линию</button>
            <button className="rounded bg-pink-500 px-3 py-2 text-sm" onClick={addTriangle}>Добавить треугольник</button>
            <button className="rounded bg-sky-500 px-3 py-2 text-sm" onClick={addPath}>Добавить кривую</button>
          </div>
          <div className="mt-4">
            <label htmlFor="line-alg" className="text-slate-300 text-xs uppercase tracking-wide">Алгоритм линии</label>
            <select
              id="line-alg"
              value={currentAlg}
              onChange={(event) => setCurrentAlg(event.target.value as LineAlg)}
              className="mt-2 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-white"
            >
              <option value="bresenham">Bresenham</option>
              <option value="wu">Wu</option>
            </select>
          </div>
        </div>
      )}

      <div className={hideUi ? 'absolute inset-0 min-h-0' : 'absolute inset-0 m-3 flex gap-4 min-h-0'}>
        <div className={hideUi ? 'flex-1 min-h-0 bg-white overflow-hidden' : 'flex-1 min-h-0 bg-white border-4 border-black shadow-lg overflow-hidden'}>
          <div ref={stageRef} className="relative h-full w-full min-h-0">
            <canvas
              ref={canvasRef}
              className="block w-full h-full"
              style={{ width: '100%', height: '100%' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />

            {!hideUi && (
              <div className="canvas-scene__selection-panel absolute left-4 right-4 bottom-4 z-10 rounded-xl bg-slate-900/95 p-3 shadow-lg border border-slate-700 text-white">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Выбранный объект</div>
                    <div className="text-sm font-semibold">{selectedLabel}</div>
                    {selectedShape && (
                      <div className="mt-2 text-xs text-slate-300">
                        Тип: {selectedShape.type}
                        <br />
                        Размер: {Math.round(selectedShape.getBounds().maxX - selectedShape.getBounds().minX)}×{Math.round(selectedShape.getBounds().maxY - selectedShape.getBounds().minY)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className="rounded bg-red-600 px-4 py-2 text-sm" onClick={deleteSelectedShape}>Удалить</button>
                    <button className="rounded bg-slate-700 px-4 py-2 text-sm" onClick={() => moveLayer(1)}>Вверх</button>
                    <button className="rounded bg-slate-700 px-4 py-2 text-sm" onClick={() => moveLayer(-1)}>Вниз</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!hideInternalLayers && (
          <aside className="canvas-scene__layers w-80 flex-shrink-0 h-full rounded-xl border border-slate-700 bg-slate-900/95 overflow-hidden">
            <details className="h-full flex flex-col" open>
              <summary className="cursor-pointer px-4 py-3 border-b border-slate-700 bg-slate-800 text-sm font-semibold text-white">
                Слои ({shapesRef.current.length})
              </summary>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {shapesRef.current.length === 0 ? (
                  <div className="text-xs text-slate-400">Нет слоёв</div>
                ) : (
                  shapesRef.current.map((shape) => renderLayerItem(shape))
                )}
              </div>
            </details>
          </aside>
        )}
      </div>
    </div>
  );
});

export default CanvasScene;
