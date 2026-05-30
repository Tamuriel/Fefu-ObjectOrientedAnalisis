import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaMousePointer, FaSquare, FaCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';
import CanvasScene from '../components/CanvasScene';
import type { LineAlg } from '../lib/math/raster/RasterRenderer';

const Editor = () => {
    const { id } = useParams<{ id: string }>();
    const [lineAlg, setLineAlg] = useState<LineAlg>('bresenham');

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen flex flex-col bg-slate-900 text-white"
        >
            <header className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-800">
                <Link to="/" className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">
                    Назад
                </Link>
                <h1>Редактирование проекта №{id}</h1>
                <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                    Сохранить
                </button>
            </header>
            <div className="flex flex-1 gap-4 p-4">
                <aside className="flex-shrink-0">
                    <div className="w-16 border border-slate-700 bg-slate-800 rounded flex flex-col items-center py-4 space-y-4">
                        <FaMousePointer className="text-white cursor-pointer hover:text-blue-400" />
                        <FaSquare className="text-white cursor-pointer hover:text-blue-400" />
                        <FaCircle className="text-white cursor-pointer hover:text-blue-400" />
                    </div>
                </aside>
                <main className="flex-1 flex flex-col gap-4 min-w-0">
                    <div className="flex-1 bg-white shadow-lg rounded overflow-hidden border border-slate-300 min-h-[520px] min-w-[760px]">
                        <CanvasScene lineAlg={lineAlg} />
                    </div>
                </main>
                <aside className="w-56 border border-slate-700 bg-slate-800 p-4 rounded h-fit">
                    <h2 className="text-white mb-3 font-semibold">Свойства</h2>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="text-white text-xs font-semibold block mb-2">
                                Алгоритм линии
                            </label>
                            <div className="space-y-1">
                                <button
                                    onClick={() => setLineAlg('bresenham')}
                                    className={`w-full py-1.5 px-2 rounded text-sm transition ${
                                        lineAlg === 'bresenham'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    }`}
                                >
                                    Брезенхем
                                </button>
                                <button
                                    onClick={() => setLineAlg('wu')}
                                    className={`w-full py-1.5 px-2 rounded text-sm transition ${
                                        lineAlg === 'wu'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    }`}
                                >
                                    Сяолиня Ву
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </motion.div>
    );
};

export default Editor;