import { useEffect, useMemo, useState } from "react";
import type { RepairRow, PartRow, ExpenseRow } from "@/types/repair";
import { parseDate, toDateTime, isSameDay } from "@/utils/datetime";
import SearchBar from "@/components/report/SearchBar";
import type { DrawerFilters } from "@/components/report/FilterDrawer";
import FilterDrawer from "@/components/report/FilterDrawer";
import RepairCard from "@/components/report/RepairCard";
import DetailsModal from "@/components/report/DetailsModal/DetailsModal";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import SkeletonCards from "@/components/report/SkeletonCards";
import NavBar from "@/layouts/NavBar";

const API_URL =
  (import.meta as any).env?.VITE_REPAIR_API ||
  "https://425store.com/api/list_repair.php";

/* ---------- helpers ---------- */
function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function enumerateDates(from: string, to: string) {
  const out: string[] = [];
  const s = new Date(from + "T00:00:00");
  const e = new Date(to + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return out;
  const first = s <= e ? s : e;
  const last = s <= e ? e : s;
  const cur = new Date(first);
  while (cur <= last) {
    out.push(fmtDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export default function ReportPage() {
  const [items, setItems] = useState<RepairRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<DrawerFilters>({ mode: "pendingAll" });
  const [q, setQ] = useState("");

  // โหมดวันเดียว
  const [dateStr, setDateStr] = useState<string>("today");
  const [serverDate, setServerDate] = useState<string | null>(null);

  // โหมดช่วงวัน
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);

  // modal
  const [selected, setSelected] = useState<RepairRow | null>(null);
  const [parts] = useState<PartRow[]>([]);
  const [expenses] = useState<ExpenseRow[]>([]);

  /** โหลดวันเดียวจาก API */
  async function loadOneDay(dayStr: string) {
    const url = `${API_URL}?date=${encodeURIComponent(dayStr)}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rows = (json.rows ?? json.data ?? []) as RepairRow[];
    return { rows, normalizedDate: json?.date as string | undefined };
  }

  /** โหลดช่วงวันแบบขนานทีละก้อน (เร็วขึ้น) */
  async function loadRange(from: string, to: string) {
    const days = enumerateDates(from, to);
    if (!days.length) {
      setItems([]); setServerDate(null); setRangeLabel(null);
      return;
    }
    if (days.length > 31) throw new Error("ช่วงวันยาวเกิน 31 วัน กรุณาแบ่งค้นหา");

    setLoading(true); setErr(null);
    try {
      const all: RepairRow[] = [];
      const chunk = 5; // ยิงพร้อมกันครั้งละ 5 วัน
      for (let i = 0; i < days.length; i += chunk) {
        const slice = days.slice(i, i + chunk);
        const results = await Promise.all(slice.map(d => loadOneDay(d)));
        results.forEach(r => all.push(...r.rows));
      }
      setItems(all);
      setServerDate(null);
      setRangeLabel(
        `${new Date(days[0] + "T00:00:00").toLocaleDateString("th-TH")} – ${new Date(
          days.at(-1)! + "T00:00:00"
        ).toLocaleDateString("th-TH")}`
      );
    } catch (e: any) {
      setItems([]); setRangeLabel(null);
      setErr(e?.message || "โหลดช่วงวันล้มเหลว");
    } finally {
      setLoading(false);
    }
  }

  // โหลดวันเดียว (หยุดทำงานเมื่ออยู่ในโหมดช่วงวัน)
  useEffect(() => {
    let alive = true;
    if (rangeLabel) return;

    (async () => {
      try {
        setLoading(true); setErr(null);
        const { rows, normalizedDate } = await loadOneDay(dateStr);
        if (!alive) return;
        setItems(rows);
        if (normalizedDate) {
          setServerDate(normalizedDate);
          if (dateStr === "today" || dateStr === "latest") setDateStr(normalizedDate);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "โหลดข้อมูลล้มเหลว");
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [dateStr, rangeLabel]);

  // กรองฝั่ง client
  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return items.filter((row) => {
      if (key) {
        const hay = [
          row.r_job_num, row.r_v_plate, row.r_v_name,
          row.r_repair_list, row.r_technician, row.r_recorder,
          String(row.r_id),
        ].map(v => (v ? String(v).toLowerCase() : "")).join(" ");
        if (!hay.includes(key)) return false;
      }
      if (filters.mode === "custom") {
        return true; // โหลดรวมช่วงวันมาแล้ว
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
    if (rangeLabel) return rangeLabel;
    const dStr = serverDate || items[0]?.r_dt_rec || fmtDate(new Date());
    const d =
      /^\d{4}-\d{2}-\d{2}$/.test(String(dStr))
        ? new Date(`${dStr}T00:00:00`)
        : parseDate(String(dStr)) ?? new Date();
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
  }, [items, serverDate, rangeLabel]);

  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      {/* Navbar (แทนหัวข้อเดิม + ปุ่มเมนู) */}
      <NavBar
        onOpenMenu={() => setDrawerOpen(true)}
        subtitle={<>{rangeLabel ? "ช่วงวันที่ " : "งานประจำวันที่ "} {titleDate}</>}
        
      />

      {/* Drawer ฟิลเตอร์ */}
      <FilterDrawer
        open={drawerOpen}
        initial={filters}
        onClose={() => setDrawerOpen(false)}
        onSubmit={async (f) => {
          setFilters(f);
          setErr(null);
          if (f.mode === "custom") {
            const from = f.from || f.to || fmtDate(new Date());
            const to   = f.to   || f.from || from;
            setRangeLabel(null);
            await loadRange(from, to);
            return;
          }
          setRangeLabel(null);
          if (f.mode === "daily" && f.date) return setDateStr(f.date);
          if (f.mode === "pendingAll")      return setDateStr("today");
          // history = กรองในหน้า
        }}
      />

      {err && <p className="text-red-300 text-center mt-3">{err}</p>}

      {/* แถบควบคุมวัน (เฉพาะโหมดวันเดียว) */}

      <div className="px-4 mt-3">
        <SearchBar value={q} onChange={setQ} count={filtered.length} loading={loading} />
      </div>

      {/* รายการ / สเกเลตัน */}
      {loading ? (
        <SkeletonCards count={9} />
      ) : (
        <div className="mt-4 px-4 pb-20 flex flex-wrap gap-2">
          {filtered.length === 0 ? (
            <div className="text-center w-full text-gray-300">ไม่พบข้อมูล</div>
          ) : (
            filtered.map((item, idx) => (
              <RepairCard
                key={String(item.r_id) + "-" + idx}
                order={idx + 1}
                row={item}
                toDateTime={toDateTime}
                onOpen={() => setSelected(item)}
              />
            ))
          )}
        </div>
      )}

      <DetailsModal
        open={!!selected}
        row={selected}
        parts={parts}
        expenses={expenses}
        onClose={() => setSelected(null)}
      />

      {/* คลุมทั้งหน้าระหว่างโหลด */}
      <LoadingOverlay
        show={loading}
        label={rangeLabel ? "กำลังรวมข้อมูลช่วงวันที่..." : "กำลังโหลดข้อมูล..."}
      />
    </div>
  );
}
