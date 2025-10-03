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

/* ============ Endpoint (.env อาจเป็น '.../api' หรือ '.../api/export_all.php') ============ */
const RAW = (((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || "").trim();
const API_TOKEN = (import.meta as any).env?.VITE_API_TOKEN as string | undefined;

// ถ้า VITE_API_BASE_URL เป็นไฟล์ .php ใช้ตรง ๆ; ถ้าเป็นโฟลเดอร์ ให้ต่อ /export_all.php ให้อัตโนมัติ
const isPhpFile = /\.[a-zA-Z0-9]+$/.test(RAW);
const API_ROOT = isPhpFile ? RAW.replace(/\/[^/]+$/, "") : RAW.replace(/\/+$/, "");
const EXPORT_ALL_API = isPhpFile ? RAW : `${API_ROOT}/export_all.php`;

/* ================= Settings ================= */
const DEFAULT_PAGE_SIZE = 5000; // จำนวนแถวต่อหนึ่งตารางต่อการดึง
const TABLES = ["repair", "used_parts", "other_cost"] as const; // ตารางที่ใช้

/* ================= Safe fetch JSON ================= */
async function fetchJSON(url: string) {
  const headers: Record<string, string> = {};
  if (API_TOKEN) headers["X-Token"] = API_TOKEN;

  const res = await fetch(url, { credentials: "omit", headers });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}\n${text.slice(0, 200)}`);
  if (!ct.includes("application/json")) throw new Error(`Not JSON from ${url}\nPreview: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON parse error from ${url}\nPreview: ${text.slice(0, 200)}`);
  }
}

/* ================= Helpers ================= */
function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function clean(v: any) {
  return String(v ?? "").trim();
}

// ป้องกัน backend ส่งทรงเพี้ยน ๆ
function coerceRows(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.rows)) return raw.rows;
  if (raw && typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length && keys.every(k => /^\d+$/.test(k))) {
      return keys.sort((a, b) => +a - +b).map(k => (raw as any)[k]);
    }
  }
  return [];
}
function getTableRows(json: any, table: string): any[] {
  // รองรับทั้ง {tables:{repair:{rows:[]}}} หรือ {repair:[...]} หรือ {tables:{repair:[...]}}
  if (json?.tables?.[table]?.rows) return coerceRows(json.tables[table].rows);
  if (json?.tables?.[table]) return coerceRows(json.tables[table]);
  if (json?.[table]) return coerceRows(json[table]);
  return [];
}

/* ================= Pending helpers ================= */
const ZERO_DATES = new Set(["", "0000-00-00", "0000-00-00 00:00:00"]);
function isPending(row: any) {
  const rawClose = String(row.r_dt_close ?? row.r_close_dt ?? "").trim();
  const notClosedByDate = ZERO_DATES.has(rawClose);
  const notClosedByFlag = String(row.r_close ?? "").trim() === "0";
  return notClosedByDate || notClosedByFlag;
}

/* ================= Mappers (DB -> UI modal) ================= */
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

/* ========================================================= */

export default function ReportPage() {
  const [items, setItems] = useState<RepairRow[]>([]);
  const [allParts, setAllParts] = useState<any[]>([]);
  const [allExps, setAllExps] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<DrawerFilters>({ mode: "pendingAll" });

  const [q, setQ] = useState("");

  // แสดงหัวข้อช่วง/โหมด
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);

  // สำหรับโมดอลรายละเอียด
  const [selected, setSelected] = useState<RepairRow | null>(null);

  /* ---------- โหลดครั้งเดียว: ดึงทุกตารางทีเดียว ---------- */
  async function loadAllOnce() {
    if (!EXPORT_ALL_API) {
      setErr("ไม่ได้ตั้งค่า VITE_API_BASE_URL");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const query = new URLSearchParams();
      query.set("tables", TABLES.join(","));
      query.set("pageSize", String(DEFAULT_PAGE_SIZE));
      // order ให้ repair/parts/cost ใหม่สุดอยู่บนเพื่อกรองเร็ว
      query.set(
        "order",
        JSON.stringify({ repair: "desc", used_parts: "desc", other_cost: "desc" })
      );

      const url = `${EXPORT_ALL_API}?${query.toString()}`;
      const json = await fetchJSON(url);

      const rep = getTableRows(json, "repair") as RepairRow[];
      const ups = getTableRows(json, "used_parts");
      const ocs = getTableRows(json, "other_cost");

      setItems(rep);
      setAllParts(ups);
      setAllExps(ocs);

      setRangeLabel("รวมข้อมูลทั้งหมด (ดึงครั้งเดียว)");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- กรองฝั่ง client ทั้งหมด ---------- */
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

      // โหมดต่าง ๆ
      if (filters.mode === "pendingAll") {
        return isPending(row);
      }

      if (filters.mode === "daily") {
        if (filters.date) {
          const d = parseDate(row.r_dt_rec);
          const target = new Date(`${filters.date}T00:00:00`);
          if (!d || !isSameDay(d, target)) return false;
        }
        if (filters.technician?.trim()) {
          const t = filters.technician.trim().toLowerCase();
          const techSrc = String(row.r_technician || "").toLowerCase();
          if (!techSrc.includes(t)) return false;
        }
        return true;
      }

      if (filters.mode === "history") {
        const car = (filters.carName ?? "").trim().toLowerCase();
        const plate = (filters.plate ?? "").trim().toLowerCase();
        const vin = (filters.vin ?? "").trim().toLowerCase();

        const nameSrc = String(row.r_v_name || "").toLowerCase();
        const plateSrc = String(row.r_v_plate || "").toLowerCase();
        const vinSrc = String(row.r_v_chassis || row.r_job_num || "").toLowerCase();

        if (car && !nameSrc.includes(car)) return false;
        if (plate && !plateSrc.includes(plate)) return false;
        if (vin && !vinSrc.includes(vin)) return false;

        return true;
      }

      if (filters.mode === "custom") {
        // กรองช่วงวัน
        const from = (filters as any).from || (filters as any).to;
        const to = (filters as any).to || (filters as any).from;
        if (from && to) {
          const d = parseDate(row.r_dt_rec);
          const s = new Date(`${from}T00:00:00`);
          const e = new Date(`${to}T23:59:59`);
          if (!d || d < s || d > e) return false;
        }
        // ถ้ามี technician ใน custom ด้วย ใช้ in-guard ปลอดภัย
        if ("technician" in (filters as any)) {
          const val = (filters as any).technician;
          if (typeof val === "string" && val.trim()) {
            const t = val.trim().toLowerCase();
            const techSrc = String(row.r_technician || "").toLowerCase();
            if (!techSrc.includes(t)) return false;
          }
        }
        return true;
      }

      // default
      return true;
    });
  }, [items, q, filters]);

  /* ---------- Title/date on navbar ---------- */
  const titleDate = useMemo(() => {
    if (rangeLabel) return rangeLabel;
    return `รวมทั้งหมด (${filtered.length} รายการ)`;
  }, [rangeLabel, filtered.length]);

  /* ---------- Modal rows ---------- */
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

  /* ---------- Handler แยก (กัน TS อินเฟอร์ never) ---------- */
  const handleFilterSubmit = async (f: DrawerFilters) => {
    setErr(null);
    setFilters(f);

    if (f.mode === "custom") {
      const from = f.from || f.to || fmtDate(new Date());
      const to = f.to || f.from || from;
      setRangeLabel(
        `${new Date(`${from}T00:00:00`).toLocaleDateString("th-TH")} – ${new Date(
          `${to}T00:00:00`
        ).toLocaleDateString("th-TH")}`
      );
      return;
    }

    if (f.mode === "daily" && f.date) {
      setRangeLabel(
        `งานประจำวันที่ ${new Date(`${f.date}T00:00:00`).toLocaleDateString("th-TH")}`
      );
      return;
    }

    if (f.mode === "pendingAll") {
      setRangeLabel("งานค้างทั้งหมด (กรองจากข้อมูลรวม))");
      return;
    }

    if (f.mode === "history") {
      const label =
        (f.plate && `ป้ายทะเบียน ${f.plate}`) ||
        (f.carName && `หมายเลขรถ ${f.carName}`) ||
        (f.vin && `เลขตัวถัง ${f.vin}`) ||
        "รถคันที่เลือก";
      setRangeLabel(`ประวัติแจ้งซ่อม • ${label}`);
      return;
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      <NavBar onOpenMenu={() => setDrawerOpen(true)} subtitle={<>{titleDate}</>} />

      <FilterDrawer
        open={drawerOpen}
        initial={filters}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleFilterSubmit as (f: unknown) => void}
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

      <LoadingOverlay show={loading} label="กำลังโหลดข้อมูลรวม..." />
    </div>
  );
}
