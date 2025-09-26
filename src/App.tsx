// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ReportPage from "./pages/ReportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* หน้าเดียวคือ ReportPage */}
        <Route path="/" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}
