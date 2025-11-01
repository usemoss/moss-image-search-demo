import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ImageSearchPage from "./pages/ItemsPage";
import ImageDetailPage from "./pages/ItemDetailPage";
import "./App.css";
import { initializeSearchIndex } from "./utils/searchUtils";
import Favicon from "./components/Favicon";

function App() {
  useEffect(() => {
    // Initialize search index directly without worker
    initializeSearchIndex().catch((error) => {
      console.error("Failed to load search index:", error);
    });
  }, []);

  return (
    <Router>
      <div className="app-container">
        <Favicon />
        <main>
          <Routes>
            <Route path="/" element={<ImageSearchPage />} />
            <Route path="/image/:id" element={<ImageDetailPage />} />
          </Routes>
        </main>
        <footer>
          <p>© 2025 MOSS Image Search Demo</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
