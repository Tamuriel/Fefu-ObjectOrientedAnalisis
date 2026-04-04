import { useParams, Link } from 'react-router-dom';
import { FaMousePointer, FaSquare, FaCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';

const Editor = () => {
    const { id } = useParams<{ id: string }>();

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
            <div className="flex flex-1">
                <aside className="w-16 border-r border-slate-700 bg-slate-800 flex flex-col items-center py-4 space-y-4">
                    <FaMousePointer className="text-white cursor-pointer hover:text-blue-400" />
                    <FaSquare className="text-white cursor-pointer hover:text-blue-400" />
                    <FaCircle className="text-white cursor-pointer hover:text-blue-400" />
                </aside>
                <main className="flex-1 bg-slate-100 flex items-center justify-center">
                    <div className="w-full h-full max-w-4xl max-h-4xl bg-white shadow-lg rounded">
                        {/* Холст */}
                    </div>
                </main>
                <aside className="w-64 border-l border-slate-700 bg-slate-800 p-4">
                    <h2 className="text-white mb-4">Свойства</h2>
                    {/* Здесь будут настройки */}
                </aside>
            </div>
        </motion.div>
    );
};

export default Editor;