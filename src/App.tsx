import "./App.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Gallery from "./screens/Gallery";
import Editor from "./screens/Editor";

function App() {
    const location = useLocation();

    const isEditorRoute = location.pathname.startsWith('/editor');

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {!isEditorRoute && (
                <>
                    <header>
                        <h1> Векторный редактор </h1>
                    </header>

                    <nav className="Navigation">
                        <Link to="/" className="GalleryLink"> Галерея </Link>
                    </nav>
                </>
            )}

            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    <Route path="/" element={<Gallery />} />
                    <Route path="/editor/:id" element={<Editor />} />
                </Routes>
            </AnimatePresence>
        </div>
    );
}

function AppWrapper() {
    return (
        <BrowserRouter>
            <App />
        </BrowserRouter>
    );
}

export default AppWrapper;
