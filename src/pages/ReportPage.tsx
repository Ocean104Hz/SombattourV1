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

/* ================== Endpoints (แบบ B: URL เต็มจาก .env) ================== */
const EXPORT_ALL_API = (
  ((import.meta as any).env?.VITE_EXPORT_ALL as string) || ""
).trim();
// (หน้าอื่น ๆ ถ้าจะใช้ก็อ่านตรง ๆ ได้ เช่น)
// const PARTS_DAY_API    = (((import.meta as any).env?.VITE_PARTS_DAY as string) || "").trim();
// const EXPENSES_DAY_API = (((import.meta as any).env?.VITE_EXPENSES_DAY as string) || "").trim();

/* ================== Settings ================== */
const DEFAULT_PAGE_SIZE = 5000;
const TABLES = ["repair", "used_parts", "other_cost"] as const;

/* ================== Safe fetch JSON (ไม่มี token) ================== */
async function fetchJSON(url: string) {
  const res = await fetch(url, { credentials: "omit" });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok)
    throw new Error(`HTTP ${res.status} @ ${url}\n${text.slice(0, 200)}`);
  if (!ct.includes("application/json")) {
    throw new Error(`Not JSON from ${url}\nPreview: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `JSON parse error from ${url}\nPreview: ${text.slice(0, 200)}`
    );
  }
}

/* ================== Helpers ================== */
function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function clean(v: any) {
  return String(v ?? "").trim();
}

// รองรับรูป response ที่ต่างกัน
function coerceRows(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.rows)) return raw.rows;
  if (raw && typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length && keys.every((k) => /^\d+$/.test(k))) {
      return keys.sort((a, b) => +a - +b).map((k) => (raw as any)[k]);
    }
  }
  return [];
}
function getTableRows(json: any, table: string): any[] {
  if (json?.tables?.[table]?.rows) return coerceRows(json.tables[table].rows);
  if (json?.tables?.[table]) return coerceRows(json.tables[table]);
  if (json?.[table]) return coerceRows(json[table]);
  return [];
}

/* ================== DrawerFilters แบบหลวม (เพื่ออ่าน date/technician ฯลฯ) ================== */
type FiltersLoose = DrawerFilters & {
  date?: string;
  technician?: string;
  from?: string;
  to?: string;
  carName?: string;
  plate?: string;
  vin?: string;
};
const asLoose = (f: DrawerFilters) => f as FiltersLoose;

/* ================== Pending helpers ================== */
const ZERO_DATES = new Set(["", "0000-00-00", "0000-00-00 00:00:00"]);
function isPending(row: any) {
  const rawClose = String(row.r_dt_close ?? row.r_close_dt ?? "").trim();
  const notClosedByDate = ZERO_DATES.has(rawClose);
  const notClosedByFlag = String(row.r_close ?? "").trim() === "0";
  return notClosedByDate || notClosedByFlag;
}

/* ================== Mappers (DB -> UI modal) ================== */
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

/* ====================================================================== */

export default function ReportPage() {
  const todayStr = fmtDate(new Date());

  const [items, setItems] = useState<RepairRow[]>([]);
  const [allParts, setAllParts] = useState<any[]>([]);
  const [allExps, setAllExps] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // ✅ เริ่มต้นเป็น "รายวัน" + วันนี้
  const [filters, setFilters] = useState<DrawerFilters>(
    asLoose({ mode: "daily", date: todayStr })
  );

  const [q, setQ] = useState("");

  // ใช้เฉพาะโหมดที่ไม่ใช่ daily
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);

  // โมดอลรายละเอียด
  const [selected, setSelected] = useState<RepairRow | null>(null);

  /* ---------- ดึงทุกตารางทีเดียว ---------- */
  async function loadAllOnce() {
    if (!EXPORT_ALL_API) {
      setErr("ไม่ได้ตั้งค่า VITE_EXPORT_ALL");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const query = new URLSearchParams();
      query.set("tables", TABLES.join(","));
      query.set("pageSize", String(DEFAULT_PAGE_SIZE));
      query.set(
        "order",
        JSON.stringify({
          repair: "desc",
          used_parts: "desc",
          other_cost: "desc",
        })
      );

      const url = `${EXPORT_ALL_API}?${query.toString()}`;
      const json = await fetchJSON(url);

      setItems(getTableRows(json, "repair") as RepairRow[]);
      setAllParts(getTableRows(json, "used_parts"));
      setAllExps(getTableRows(json, "other_cost"));

      setRangeLabel(null); // โหมดรายวันเป็นค่าเริ่มต้น
    } catch (e: any) {
      setItems([]);
      setAllParts([]);
      setAllExps([]);
      setRangeLabel(null);
      setErr(e?.message || "โหลดข้อมูลรวมล้มเหลว");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllOnce();
  }, []);

  /* ---------- กรองฝั่ง client ---------- */
  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();

    return items.filter((row) => {
      // keyword
      if (key) {
        const hay = [
          row.r_job_num,
          row.r_v_plate,
          row.r_v_name,
          row.r_v_chassis,
          row.r_repair_list,
          row.r_technician,
          row.r_recorder,
          String(row.r_id),
        ]
          .map((v) => (v ? String(v).toLowerCase() : ""))
          .join(" ");
        if (!hay.includes(key)) return false;
      }

      // รายวัน
      if (filters.mode === "daily") {
        const dStr = asLoose(filters).date;
        if (dStr) {
          const d = parseDate(row.r_dt_rec);
          const target = new Date(`${dStr}T00:00:00`);
          if (!d || !isSameDay(d, target)) return false;
        }
        const tech = asLoose(filters).technician?.trim();
        if (tech) {
          const t = tech.toLowerCase();
          const techSrc = String(row.r_technician || "").toLowerCase();
          if (!techSrc.includes(t)) return false;
        }
        return true;
      }

      // งานค้าง
      if (filters.mode === "pendingAll") return isPending(row);

      // ประวัติรถ
      if (filters.mode === "history") {
        const car = (asLoose(filters).carName ?? "").trim().toLowerCase();
        const plate = (asLoose(filters).plate ?? "").trim().toLowerCase();
        const vin = (asLoose(filters).vin ?? "").trim().toLowerCase();

        const nameSrc = String(row.r_v_name || "").toLowerCase();
        const plateSrc = String(row.r_v_plate || "").toLowerCase();
        const vinSrc = String(
          row.r_v_chassis || row.r_job_num || ""
        ).toLowerCase();

        if (car && !nameSrc.includes(car)) return false;
        if (plate && !plateSrc.includes(plate)) return false;
        if (vin && !vinSrc.includes(vin)) return false;
        return true;
      }

      // ช่วงวันที่กำหนดเอง
      if (filters.mode === "custom") {
        const from = asLoose(filters).from || asLoose(filters).to;
        const to = asLoose(filters).to || asLoose(filters).from;
        if (from && to) {
          const d = parseDate(row.r_dt_rec);
          const s = new Date(`${from}T00:00:00`);
          const e = new Date(`${to}T23:59:59`);
          if (!d || d < s || d > e) return false;
        }
        const tech = asLoose(filters).technician;
        if (typeof tech === "string" && tech.trim()) {
          const t = tech.trim().toLowerCase();
          const techSrc = String(row.r_technician || "").toLowerCase();
          if (!techSrc.includes(t)) return false;
        }
        return true;
      }

      return true;
    });
  }, [items, q, filters]);

  /* ---------- Title (รายวันเป็นหลัก) ---------- */
  const dateLoose = asLoose(filters).date;
  const titleDate = useMemo(() => {
    if (filters.mode === "daily" && dateLoose) {
      const d = new Date(`${dateLoose}T00:00:00`);
      return `งานประจำวันที่ ${d.toLocaleDateString("th-TH")} • ${
        filtered.length
      } รายการ`;
    }
    if (rangeLabel) return rangeLabel;
    return `รวมทั้งหมด (${filtered.length} รายการ)`;
  }, [filters.mode, dateLoose, filtered.length, rangeLabel]);

  /* ---------- Rows ในโมดอล ---------- */
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
      .filter(
        (x) =>
          clean(x.oc_job_id) === id ||
          clean(x.oc_ref_id) === id ||
          clean(x.oc_job_num) === num
      )
      .map(mapExpenseFromDB);
  }, [selected, allExps]);

  /* ---------- Handler ของ FilterDrawer ---------- */
  const handleFilterSubmit = async (f: DrawerFilters) => {
    setErr(null);
    setFilters(f);

    if (f.mode === "custom") {
      const from = asLoose(f).from || asLoose(f).to || fmtDate(new Date());
      const to = asLoose(f).to || asLoose(f).from || from;
      setRangeLabel(
        `${new Date(`${from}T00:00:00`).toLocaleDateString(
          "th-TH"
        )} – ${new Date(`${to}T00:00:00`).toLocaleDateString("th-TH")}`
      );
      return;
    }

    if (f.mode === "daily" && asLoose(f).date) {
      setRangeLabel(null);
      return;
    }
    if (f.mode === "pendingAll") {
      setRangeLabel("งานค้างทั้งหมด (กรองจากข้อมูลรวม)");
      return;
    }

    if (f.mode === "history") {
      const label =
        (asLoose(f).plate && `ป้ายทะเบียน ${asLoose(f).plate}`) ||
        (asLoose(f).carName && `หมายเลขรถ ${asLoose(f).carName}`) ||
        (asLoose(f).vin && `เลขตัวถัง ${asLoose(f).vin}`) ||
        "รถคันที่เลือก";
      setRangeLabel(`ประวัติแจ้งซ่อม • ${label}`);
      return;
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      <NavBar
        onOpenMenu={() => setDrawerOpen(true)}
        subtitle={<>{titleDate}</>}
      />

      <FilterDrawer
        open={drawerOpen}
        initial={filters}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleFilterSubmit as (f: unknown) => void}
      />

      {err && <p className="text-red-300 text-center mt-3">{err}</p>}

      <div className="px-4 mt-3">
        <SearchBar
          value={q}
          onChange={setQ}
          count={filtered.length}
          loading={loading}
        />
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
                onOpen={() => {
                  setSelected(item);
                }}
              />
            ))
          )}
        </div>
      )}

      <DetailsModal
        open={!!selected}
        row={selected}
        parts={partsForSelected}
        expenses={expsForSelected}
        onClose={() => {
          setSelected(null);
        }}
      />

      <LoadingOverlay show={loading} label="กำลังโหลดข้อมูล..." />
    </div>
  );
}
