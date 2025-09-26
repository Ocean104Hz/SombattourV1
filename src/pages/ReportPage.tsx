// src/pages/ReportPage.tsx
import { useEffect, useMemo, useState } from "react";
import type { RepairRow, PartRow, ExpenseRow } from "@/types/repair";
import { parseDate, toDateTime, isSameDay } from "@/utils/datetime";
import SearchBar from "@/components/report/SearchBar";
import type { DrawerFilters } from "@/components/report/FilterDrawer";
import FilterDrawer from "@/components/report/FilterDrawer";  
import RepairCard from "@/components/report/RepairCard";
import DetailsModal from "@/components/report/DetailsModal/DetailsModal";

const API_URL = (import.meta as any).env?.VITE_REPAIR_API || "https://425store.com/api/list_repair.php";

export default function ReportPage() {
  const [items, setItems] = useState<RepairRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<DrawerFilters>({ mode: "pendingAll" });
  const [q, setQ] = useState("");

  // modal
  const [selected, setSelected] = useState<RepairRow | null>(null);
  const [parts] = useState<PartRow[]>([]);     // TODO: ต่อ API จริงแล้ว set ตาม r_id
  const [expenses] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list = json.rows ?? json.data ?? [];
        setItems(Array.isArray(list) ? list : []);
      } catch (e:any) {
        setErr(e.message || "โหลดข้อมูลล้มเหลว");
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return items.filter((row) => {
      if (key) {
        const hay = [row.r_job_num, row.r_v_plate, row.r_v_name, row.r_repair_list, row.r_technician, row.r_recorder, String(row.r_id)]
          .map(v => (v ? String(v).toLowerCase() : ""))
          .join(" ");
        if (!hay.includes(key)) return false;
      }
      if (filters.mode === "custom") {
        const d = parseDate(row.r_dt_rec); if (!d) return false;
        if (filters.from && d < new Date(`${filters.from}T00:00:00`)) return false;
        if (filters.to && d > new Date(`${filters.to}T23:59:59`)) return false;
      } else if (filters.mode === "daily" && filters.date) {
        const d = parseDate(row.r_dt_rec); if (!d) return false;
        if (!isSameDay(d, new Date(`${filters.date}T00:00:00`))) return false;
      } else if (filters.mode === "history") {
        const ok1 = filters.carName ? (row.r_v_name || row.r_v_plate || "").toLowerCase().includes(filters.carName.toLowerCase()) : true;
        const ok2 = filters.plate ? (row.r_v_plate || "").toLowerCase().includes(filters.plate.toLowerCase()) : true;
        const ok3 = filters.vin ? String(row.r_job_num || "").toLowerCase().includes(filters.vin.toLowerCase()) : true;
        if (!(ok1 && ok2 && ok3)) return false;
      }
      return true;
    });
  }, [items, q, filters]);

  const titleDate = useMemo(() => {
    const head = items[0]?.r_dt_rec;
    const d = head ? parseDate(head) ?? new Date() : new Date();
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
  }, [items]);

  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      <FilterDrawer
        open={drawerOpen}
        initial={filters}
        onClose={() => setDrawerOpen(false)}
        onSubmit={(f) => setFilters(f)}
      />

      <button
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-5 right-5 z-[1000] w-12 h-12 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 shadow-lg flex items-center justify-center hover:opacity-90"
        title="เมนู"
      >
        {/* ไอคอนมีใน FilterDrawer อยู่แล้ว */}
        <span className="text-xl">≡</span>
      </button>

      <div className="pt-6 text-center">
        <h2 className="text-2xl font-bold">
          รายการเปิดงาน <br /> งานประจำวันที่ {titleDate}
        </h2>
      </div>

      {err && <p className="text-red-300 text-center mt-2">Error: {err}</p>}

      <div className="px-4 mt-4">
        <SearchBar value={q} onChange={setQ} count={filtered.length} loading={loading} />
      </div>

      <div className="mt-4 px-4 pb-20 flex flex-wrap gap-2">
        {filtered.length === 0 && !loading ? (
          <div className="text-center w-full text-gray-300">ไม่พบข้อมูล</div>
        ) : (
          filtered.map((item, idx) => (
            <RepairCard
              key={String(item.r_id)}
              order={idx + 1}
              row={item}
              toDateTime={toDateTime}
              onOpen={() => setSelected(item)}
            />
          ))
        )}
      </div>

      <DetailsModal
        open={!!selected}
        row={selected}
        parts={parts}
        expenses={expenses}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
