// src/pages/ReportPage.tsx
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

/* ========== Endpoints ========== */
const REPAIR_API =
  (import.meta as any).env?.VITE_REPAIR_API ||
  "https://425store.com/api/list_repair.php";
const PARTS_DAY_API =
  (import.meta as any).env?.VITE_PARTS_DAY ||
  "https://425store.com/api/parts_day.php";
const EXPENSES_DAY_API =
  (import.meta as any).env?.VITE_EXPENSES_DAY ||
  "https://425store.com/api/expenses_day.php";

/* ========== Settings ========== */
const PENDING_LOOKBACK_DAYS = 365; // ย้อนหลังสูงสุดกี่วันสำหรับ “งานค้างทั้งหมด”
const PARALLEL_CHUNK = 5;          // ยิงโหลดพร้อมกันครั้งละกี่วัน

/* ========== Safe fetch JSON ========== */
async function fetchJSON(url: string) {
  const res = await fetch(url, { credentials: "omit" });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}\n${text.slice(0, 200)}`);
  if (!ct.includes("application/json")) {
    throw new Error(`Not JSON from ${url}\nPreview: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON parse error from ${url}\nPreview: ${text.slice(0, 200)}`);
  }
}

/* ========== Helpers ========== */
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
function clean(v: any) {
  return String(v ?? "").trim();
}

/* ========== Pending helpers (ย้ายออกมานอกคอมโพเนนต์) ========== */
const ZERO_DATES = new Set(["", "0000-00-00", "0000-00-00 00:00:00"]);
function isPending(row: any) {
  // ใช้ชื่อหลัก r_dt_close; ถ้าบาง record มากับชื่อเก่า เผื่อไว้ด้วย
  const rawClose = String(row.r_dt_close ?? row.r_close_dt ?? "").trim();
  const notClosedByDate = ZERO_DATES.has(rawClose);
  const notClosedByFlag = String(row.r_close ?? "").trim() === "0";
  return notClosedByDate || notClosedByFlag;
}

/* ========== Mappers for modal tables ========== */
function mapPartFromDB(p: any): PartRow {
  return {
    id: String(p.up_id),
    createdAt: p.up_dt_rec,
    partId: String(p.up_parts_id ?? ""),
    partCode: String(p.up_parts_num ?? ""),
    partName: String(p.up_parts_name ?? ""),
    lotId: String(p.up_lot_id ?? ""),
    qty: Number(p.up_quantity ?? 0),
    unit: String(p.up_unit ?? ""),
  };
}
function mapExpenseFromDB(x: any): ExpenseRow {
  return {
    id: String(x.oc_id),
    createdAt: x.oc_dt_rec,
    name: String(x.oc_listname ?? ""),
    qty: Number(x.oc_quantity ?? 0),
    unit: String(x.oc_unit ?? ""),
  };
}

export default function ReportPage() {
  const [items, setItems] = useState<RepairRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<DrawerFilters>({ mode: "pendingAll" });
  const [q, setQ] = useState("");

  // วันเดียว / วันที่จากเซิร์ฟเวอร์
  const [dateStr, setDateStr] = useState<string>("today");
  const [serverDate, setServerDate] = useState<string | null>(null);

  // โหมดช่วงวัน (ถ้าตั้งค่า แสดงเป็นหัวข้อช่วงและหยุด useEffect วันเดียว)
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);

  // ใบงานที่ถูกเลือก
  const [selected, setSelected] = useState<RepairRow | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);

  // เก็บอะไหล่/ค่าใช้จ่ายของวัน/ช่วง แล้วค่อยกรองเมื่อต้องการ
  const [allParts, setAllParts] = useState<any[]>([]);
  const [allExps, setAllExps] = useState<any[]>([]);

  /* ---------- loaders (one day) ---------- */
  async function loadOneDay(dayStr: string) {
    const url = `${REPAIR_API}?date=${encodeURIComponent(dayStr)}&limit=1000`;
    const json = await fetchJSON(url);
    const rows = (json.rows ?? json.data ?? []) as RepairRow[];
    return { rows, normalizedDate: json?.date as string | undefined };
  }
  async function loadPartsOneDay(dayStr: string) {
    const url = `${PARTS_DAY_API}?date=${encodeURIComponent(dayStr)}&limit=10000`;
    const json = await fetchJSON(url);
    return (json.rows ?? []) as any[];
  }
  async function loadExpsOneDay(dayStr: string) {
    const url = `${EXPENSES_DAY_API}?date=${encodeURIComponent(dayStr)}&limit=10000`;
    const json = await fetchJSON(url);
    return (json.rows ?? []) as any[];
  }

  /* ---------- loaders (range) ---------- */
  async function loadRange(from: string, to: string) {
    const days = enumerateDates(from, to);
    if (!days.length) {
      setItems([]); setServerDate(null); setRangeLabel(null);
      setAllParts([]); setAllExps([]);
      return;
    }
    if (days.length > 31) throw new Error("ช่วงวันยาวเกิน 31 วัน กรุณาแบ่งค้นหา");

    setLoading(true); setErr(null);
    try {
      const all: RepairRow[] = [];
      const pAll: any[] = [];
      const eAll: any[] = [];

      for (let i = 0; i < days.length; i += PARALLEL_CHUNK) {
        const slice = days.slice(i, i + PARALLEL_CHUNK);
        const [repairResList, partsList, expsList] = await Promise.all([
          Promise.all(slice.map(d => loadOneDay(d))),
          Promise.all(slice.map(d => loadPartsOneDay(d))),
          Promise.all(slice.map(d => loadExpsOneDay(d))),
        ]);
        repairResList.forEach(r => all.push(...r.rows));
        partsList.forEach(arr => pAll.push(...arr));
        expsList.forEach(arr => eAll.push(...arr));
      }

      setItems(all);
      setAllParts(pAll);
      setAllExps(eAll);
      setServerDate(null);
      setRangeLabel(
        `${new Date(days[0] + "T00:00:00").toLocaleDateString("th-TH")} – ${new Date(
          days.at(-1)! + "T00:00:00"
        ).toLocaleDateString("th-TH")}`
      );
    } catch (e: any) {
      setItems([]); setRangeLabel(null);
      setAllParts([]); setAllExps([]);
      setErr(e?.message || "โหลดช่วงวันล้มเหลว");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- loader (pending all over long range) ---------- */
  async function loadPendingAll(lookbackDays = PENDING_LOOKBACK_DAYS) {
    const today = new Date();
    const from = new Date(); from.setDate(today.getDate() - (lookbackDays - 1));
    const fromStr = fmtDate(from);
    const toStr   = fmtDate(today);

    const days = enumerateDates(fromStr, toStr);
    setLoading(true); setErr(null);
    setRangeLabel(null);

    try {
      const all: RepairRow[] = [];
      const pAll: any[] = [];
      const eAll: any[] = [];

      for (let i = 0; i < days.length; i += PARALLEL_CHUNK) {
        const slice = days.slice(i, i + PARALLEL_CHUNK);
        const [repairResList, partsList, expsList] = await Promise.all([
          Promise.all(slice.map(d => loadOneDay(d))),
          Promise.all(slice.map(d => loadPartsOneDay(d))),
          Promise.all(slice.map(d => loadExpsOneDay(d))),
        ]);
        // รวมก่อน แล้วกรองใน useMemo ด้วย isPending()
        repairResList.forEach(r => all.push(...r.rows));
        partsList.forEach(arr => pAll.push(...arr));
        expsList.forEach(arr => eAll.push(...arr));
      }

      setItems(all);
      setAllParts(pAll);
      setAllExps(eAll);
      setServerDate(null);
      setRangeLabel(
        `งานค้างทั้งหมด • ${new Date(fromStr + "T00:00:00").toLocaleDateString("th-TH")} – ${new Date(
          toStr + "T00:00:00"
        ).toLocaleDateString("th-TH")}`
      );
    } catch (e: any) {
      setItems([]); setAllParts([]); setAllExps([]);
      setRangeLabel(null);
      setErr(e?.message || "โหลดงานค้างทั้งหมดล้มเหลว");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Effect: load single day (disabled when rangeLabel exists) ---------- */
  useEffect(() => {
    let alive = true;
    if (rangeLabel) return;

    (async () => {
      try {
        setLoading(true); setErr(null);
        const [repairRes, partsRes, expsRes] = await Promise.all([
          loadOneDay(dateStr),
          loadPartsOneDay(dateStr),
          loadExpsOneDay(dateStr),
        ]);
        if (!alive) return;
        setItems(repairRes.rows);
        setAllParts(partsRes);
        setAllExps(expsRes);
        if (repairRes.normalizedDate) {
          setServerDate(repairRes.normalizedDate);
          if (dateStr === "today" || dateStr === "latest") setDateStr(repairRes.normalizedDate);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "โหลดข้อมูลล้มเหลว");
        setItems([]); setAllParts([]); setAllExps([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [dateStr, rangeLabel]);

  /* ---------- Client filter ---------- */
  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    return items.filter((row) => {
      // คีย์เวิร์ด
      if (key) {
        const hay = [
          row.r_job_num, row.r_v_plate, row.r_v_name,
          row.r_repair_list, row.r_technician, row.r_recorder,
          String(row.r_id),
        ].map(v => (v ? String(v).toLowerCase() : "")).join(" ");
        if (!hay.includes(key)) return false;
      }

      // โหมดฟิลเตอร์
      if (filters.mode === "pendingAll") {
        return isPending(row);             // ✅ โชว์เฉพาะงานค้าง
      }
      if (filters.mode === "custom") {
        return true;                       // โหลดช่วงวันแล้ว ค่อยกรองด้วยคีย์เวิร์ด
      }
      if (filters.mode === "daily" && filters.date) {
        const d = parseDate(row.r_dt_rec); if (!d) return false;
        return isSameDay(d, new Date(`${filters.date}T00:00:00`));
      }
      if (filters.mode === "history") {
        const ok1 = filters.carName ? (row.r_v_name || row.r_v_plate || "")
          .toLowerCase().includes(filters.carName.toLowerCase()) : true;
        const ok2 = filters.plate ? (row.r_v_plate || "")
          .toLowerCase().includes(filters.plate.toLowerCase()) : true;
        const ok3 = filters.vin ? String(row.r_v_chassis || row.r_job_num || "")
          .toLowerCase().includes(filters.vin.toLowerCase()) : true;
        return ok1 && ok2 && ok3;
      }
      return true;
    });
  }, [items, q, filters]);

  /* ---------- Title date ---------- */
  const titleDate = useMemo(() => {
    if (rangeLabel) return rangeLabel;
    const dStr = serverDate || items[0]?.r_dt_rec || fmtDate(new Date());
    const d =
      /^\d{4}-\d{2}-\d{2}$/.test(String(dStr))
        ? new Date(`${dStr}T00:00:00`)
        : parseDate(String(dStr)) ?? new Date();
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
  }, [items, serverDate, rangeLabel]);

  /* ---------- Rows in modal ---------- */
  const partsForSelected = useMemo<PartRow[]>(() => {
    if (!selected) return [];
    const id = clean(selected.r_id);
    const num = clean(selected.r_job_num);
    return allParts
      .filter((p) => clean(p.up_job_id) === id || clean(p.up_job_num) === num)
      .map(mapPartFromDB);
  }, [selected, allParts]);

  const expsForSelected = useMemo<ExpenseRow[]>(() => {
    if (!selected) return [];
    const id = clean(selected.r_id);
    const num = clean(selected.r_job_num);
    return allExps
      .filter((x) =>
        clean(x.oc_job_id) === id ||
        clean(x.oc_ref_id) === id ||
        clean(x.oc_job_num) === num
      )
      .map(mapExpenseFromDB);
  }, [selected, allExps]);

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      <NavBar
        onOpenMenu={() => setDrawerOpen(true)}
        subtitle={<>{rangeLabel ? "ช่วงวันที่ " : "งานประจำวันที่ "} {titleDate}</>}
      />

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

          if (f.mode === "daily" && f.date) {
            setDateStr(f.date);
            return;
          }

          if (f.mode === "pendingAll") {
            await loadPendingAll(); // ← โหลดย้อนหลังทั้งช่วง แล้วกรองใน filtered
            return;
          }

          // history = กรองในหน้า
        }}
      />

      {err && <p className="text-red-300 text-center mt-3">{err}</p>}

      <div className="px-4 mt-3">
        <SearchBar value={q} onChange={setQ} count={filtered.length} loading={loading} />
      </div>

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
                onOpen={() => { setSelected(item); setSelectedOrder(idx + 1); }}
              />
            ))
          )}
        </div>
      )}

      <DetailsModal
        open={!!selected}
        row={selected}
        // order={selectedOrder ?? undefined}
        parts={partsForSelected}
        expenses={expsForSelected}
        onClose={() => { setSelected(null); setSelectedOrder(null); }}
      />

      <LoadingOverlay
        show={loading}
        label={rangeLabel ? "กำลังรวมข้อมูลช่วงวันที่..." : "กำลังโหลดข้อมูล..."}
      />
    </div>
  );
}
