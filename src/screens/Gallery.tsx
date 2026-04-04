import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface Project {
    id: string;
    name: string;
    date: string;
}

const Gallery = () => {
    const [projects, setProjects] = useState<Project[]>([]);

    const addProject = () => {
        const newProject: Project = {
            id: `${projects.length + 1}`,
            name: `Проект ${projects.length + 1}`,
            date: new Date().toLocaleDateString(),
        };
        setProjects([...projects, newProject]);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4"
        >
            <button
                onClick={addProject}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-4"
            >
                + Новый проект
            </button>

            {projects.length === 0 ? (
                <p>Проектов пока нет. Создайте первый!</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {projects.map((project) => (
                        <Link key={project.id} to={`/editor/${project.id}`}>
                            <motion.div
                                whileHover={{ y: -5 }}
                                className="bg-slate-800 p-4 rounded shadow hover:shadow-lg transition-shadow"
                            >
                                <h3 className="text-white">{project.name}</h3>
                                <p className="text-gray-400">Создан: {project.date}</p>
                            </motion.div>
                        </Link>
                    ))}
                </div>
            )}
        </motion.div>
    );
};

export default Gallery;