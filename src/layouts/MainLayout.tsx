// src/components/layouts/MainLayout.tsx
import { Outlet, Link } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="min-h-screen">
      <header className="p-4 border-b flex gap-4">
        <Link to="/">รายงาน</Link>
        <Link to="/openrepair">OpenRepair</Link>
        <Link to="/dataTable">DataTable</Link>
        <Link to="/testpage">Testpage</Link>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
