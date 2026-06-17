import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { loadProjectIndex } from "../lib/projectStorage";

interface Project {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    shapeCount: number;
}

const Gallery = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        void loadProjectIndex().then(setProjects);
    }, []);

    const addProject = async () => {
        const latestProjects = await loadProjectIndex();
        const nextNumber = latestProjects.reduce((highest, project) => {
            const match = project.name.match(/Проект\s+(\d+)/);
            if (!match) {
                return highest;
            }
            return Math.max(highest, Number(match[1]) || 0);
        }, 0) + 1;

        const id = `${nextNumber}`;
        navigate(`/editor/${id}`);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="gallery-shell"
        >
            <div className="gallery-shell__content">
                <button
                    onClick={addProject}
                    className="gallery-create-button"
                >
                    +Новый проект
                </button>

                {projects.length === 0 ? (
                    <p className="gallery-empty-state">Проектов пока нет. Создайте первый!</p>
                ) : (
                    <div className="gallery-project-grid">
                        {projects.map((project) => (
                            <Link key={project.id} to={`/editor/${project.id}`} className="gallery-project-link">
                                <motion.div
                                    whileHover={{ y: -5 }}
                                    className="gallery-project-card"
                                >
                                    <h3 className="gallery-project-card__title">{project.name}</h3>
                                    <p className="gallery-project-card__meta">Создан: {new Date(project.createdAt).toLocaleDateString()}</p>
                                    <p className="gallery-project-card__meta">Изменён: {new Date(project.updatedAt).toLocaleDateString()}</p>
                                    <p className="gallery-project-card__meta">Фигур: {project.shapeCount}</p>
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default Gallery;