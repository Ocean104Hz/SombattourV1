import { useEffect } from "react";
// import SummaryPanel from "./SummaryPanel";
import PartsTable from "./PartsTable";
import ExpensesTable from "./ExpensesTable";
import type { RepairRow, PartRow, ExpenseRow } from "@/types/repair";
import WorkReportPanel from "./WorkReportPanel";
type PerformItem = {
  id: string;
  createdAt?: string;
  content: string;
  technician?: string;
};

export default function DetailsModal({
  open, row, parts, expenses, onClose, performReports, reportFallback,
}: {
  open: boolean;
  row: RepairRow | null;
  parts: PartRow[];
  expenses: ExpenseRow[];
  onClose: () => void;
  performReports?: PerformItem[];
  reportFallback?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center mt-10">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white text-gray-900 w-[92vw] max-w-6xl h-[88vh] rounded-3xl shadow-2xl grid grid-cols-1 md:grid-cols-1 overflow-hidden">
        <button
          className="absolute right-3 top-3 rounded-full px-3 py-1 text-sm bg-gray-800 text-white/90 hover:bg-black cursor-pointer"
          onClick={onClose}
        >
          ปิด
        </button>

        <div className="p-6 md:p-8 overflow-auto">
          {/* <SummaryPanel row={row} /> */}
          <WorkReportPanel items={performReports || []} report={reportFallback} />
          <PartsTable rows={parts} />
          <div className="h-6" />
          <ExpensesTable rows={expenses} />
        </div>
      </div>
    </div>
  );
}
