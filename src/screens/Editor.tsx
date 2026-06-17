import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import CanvasScene, { type CanvasSceneHandle } from '../components/CanvasScene';
import type { LineAlg } from '../lib/math/raster/RasterRenderer';
import { loadProject, notifyProjectSaved, saveProject, type ProjectData } from '../lib/projectStorage';

const Editor = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const canvasRef = useRef<CanvasSceneHandle | null>(null);
    const [lineAlg, setLineAlg] = useState<LineAlg>('bresenham');
    const [project, setProject] = useState<ProjectData | null>(null);
    const [, setUpdateKey] = useState(0);

    const handleCanvasUpdate = useCallback(() => {
        setUpdateKey((value) => value + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!id) {
                return;
            }

            const loaded = await loadProject(id);
            if (cancelled) {
                return;
            }

            if (loaded) {
                setProject(loaded);
                setLineAlg((loaded.lineAlg as LineAlg) ?? 'bresenham');
                canvasRef.current?.loadShapes(loaded.shapes);
                return;
            }

            const emptyProject: ProjectData = {
                id,
                name: `Проект ${id}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lineAlg: 'bresenham',
                shapes: [],
            };
            setProject(emptyProject);
            setLineAlg('bresenham');
            canvasRef.current?.loadShapes([]);
            await saveProject(emptyProject);
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [id]);

    const handleSave = useCallback(async () => {
        if (!id) {
            return;
        }

        try {
            const shapes = canvasRef.current?.exportShapes() ?? [];
            const now = new Date().toISOString();
            const saved = await saveProject({
                id,
                name: project?.name ?? `Проект ${id}`,
                createdAt: project?.createdAt ?? now,
                lineAlg,
                shapes,
                updatedAt: now,
            });

            setProject(saved);

            try {
                await notifyProjectSaved(saved.name);
            } catch (error) {
                console.error('Project saved, but notification failed:', error);
            }
        } catch (error) {
            console.error('Failed to save project:', error);
        }
    }, [id, lineAlg, project]);

    const layerItems = canvasRef.current?.getLayers() ?? [];
    const selectedLabel = canvasRef.current?.getSelectedLabel() ?? 'Пусто';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="editor-screen"
        >
            <header className="editor-topbar">
                <h1 className="editor-topbar__title">Редактирование {project?.name ?? `проекта №${id}`}</h1>
                <div className="editor-topbar__actions">
                    <Link to="/" className="editor-button editor-button--secondary">
                        Галерея
                    </Link>
                    <button type="button" onClick={() => navigate(-1)} className="editor-button editor-button--secondary">
                        Назад
                    </button>
                </div>
            </header>

            <div className="editor-layout">
                <section className="editor-controls" aria-label="Панель управления холстом">
                    <div className="editor-controls__top">
                    <div className="editor-controls__block editor-controls__block--left">
                        <button type="button" className="editor-button editor-button--primary editor-button--save" onClick={handleSave}>
                            Сохранить
                        </button>
                        <label className="editor-select-label editor-select-label--block">
                            Алг. линий
                            <select
                                className="editor-select"
                                value={lineAlg}
                                onChange={(event) => setLineAlg(event.target.value as LineAlg)}
                            >
                                <option value="bresenham">Bresenham</option>
                                <option value="wu">Wu</option>
                            </select>
                        </label>
                    </div>

                    <div className="editor-controls__block editor-controls__block--middle">
                        <button type="button" className="editor-button" onClick={() => canvasRef.current?.addRectangle()}>
                            Прямоуг.
                        </button>
                        <button type="button" className="editor-button" onClick={() => canvasRef.current?.addOval()}>
                            Овал
                        </button>
                        <button type="button" className="editor-button" onClick={() => canvasRef.current?.addLine()}>
                            Линия
                        </button>
                        <button type="button" className="editor-button" onClick={() => canvasRef.current?.addTriangle()}>
                            Треуг.
                        </button>
                        <button type="button" className="editor-button" onClick={() => canvasRef.current?.addPath()}>
                            Кривая
                        </button>
                    </div>

                    <div className="editor-controls__block editor-controls__block--right">
                        <div className="editor-panel__title">Выбранный объект</div>
                        <div className="editor-panel__hint">{selectedLabel}</div>
                        <div className="editor-panel__actions">
                            <button type="button" className="editor-button editor-button--small" onClick={() => canvasRef.current?.deleteSelectedShape()}>
                                Удалить
                            </button>
                            <button type="button" className="editor-button editor-button--small" onClick={() => canvasRef.current?.moveLayer(1)}>
                                Вверх
                            </button>
                            <button type="button" className="editor-button editor-button--small" onClick={() => canvasRef.current?.moveLayer(-1)}>
                                Вниз
                            </button>
                            {canvasRef.current?.getSelectedShapeType() === 'PathBezier' && (
                              <>
                                <button
                                    type="button"
                                    className="editor-button editor-button--small"
                                    style={canvasRef.current?.getInsertPointMode() ? { background: '#10b981', color: '#ffffff', borderColor: '#059669' } : undefined}
                                    onClick={() => canvasRef.current?.setInsertPointMode(!(canvasRef.current?.getInsertPointMode() ?? false))}
                                >
                                    Вставить точку
                                </button>
                                <button
                                    type="button"
                                    className="editor-button editor-button--small"
                                    style={canvasRef.current?.getDeletePointMode()
                                        ? { background: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' }
                                        : { background: '#ffffff', color: '#111827', borderColor: '#d1d5db' }}
                                    onClick={() => canvasRef.current?.setDeletePointMode(!(canvasRef.current?.getDeletePointMode() ?? false))}
                                >
                                    Удалить точку
                                </button>
                              </>
                            )}
                        </div>
                    </div>
                </div>
                </section>

                <section className="editor-canvas">
                    <div className="editor-canvas__frame">
                        <CanvasScene
                            ref={canvasRef}
                            lineAlg={lineAlg}
                            onUpdate={handleCanvasUpdate}
                            hideUi
                            hideInternalLayers
                        />
                    </div>
                </section>

                <aside className="editor-layers" aria-label="Список слоёв">
                    <div className="editor-layers__header">Слои</div>
                    <ul className="editor-layers__list">
                        {layerItems.length === 0 ? (
                            <li className="layer-item">Нет слоёв</li>
                        ) : (
                            layerItems.map((layer) => (
                                <li key={layer.id} className="layer-item">
                                    {layer.label}
                                </li>
                            ))
                        )}
                    </ul>
                </aside>
            </div>
        </motion.div>
    );
};

export default Editor;