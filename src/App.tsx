import "./App.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Gallery from "./screens/Gallery";
import Editor from "./screens/Editor";

function App() {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <header>
                <h1> Тут мог быть Ваш заголовок </h1>
            </header>

            <nav className="Navigation">
                <Link to="/" className="GalleryLink"> Галерея </Link>
            </nav>

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
