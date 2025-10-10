// src/pages/ReportPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { RepairRow, PartRow, ExpenseRow } from "@/types/repair";
import { parseDate, toDateTime, isSameDay } from "@/utils/datetime";
import SearchBar from "@/components/report/SearchBar";
import type { DrawerFilters } from "@/components/report/FilterDrawer"; // ✅ ใช้ชื่อ DrawerFilters ตรงๆ
import FilterDrawer from "@/components/report/FilterDrawer";
import RepairCard from "@/components/report/RepairCard";
import DetailsModal from "@/components/report/DetailsModal/DetailsModal";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import SkeletonCards from "@/components/report/SkeletonCards";
import NavBar from "@/layouts/NavBar";

/* ================== Endpoints ================== */
const EXPORT_ALL_API = (
  ((import.meta as any).env?.VITE_EXPORT_ALL as string) || ""
).trim();

/* ================== Settings ================== */
const DEFAULT_PAGE_SIZE = 5000 as const;
const TABLES = ["repair", "used_parts", "other_cost"] as const;

/* ================== Safe fetch JSON (รองรับ external AbortSignal) ================== */
async function fetchJSON(url: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);

  const extSignal = init.signal;
  if (extSignal) {
    if (extSignal.aborted) ctrl.abort();
    else extSignal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }

  try {
    const res = await fetch(url, { credentials: "omit", ...init, signal: ctrl.signal });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();

    if (!res.ok) {
      try {
        const j = JSON.parse(text);
        const msg = j?.message || j?.error || JSON.stringify(j).slice(0, 200);
        throw new Error(`HTTP ${res.status} @ ${url}\n${msg}`);
      } catch {
        throw new Error(`HTTP ${res.status} @ ${url}\n${text.slice(0, 300)}`);
      }
    }

    try {
      return JSON.parse(text);
    } catch {
      if (/\bjson\b/i.test(ct)) {
        throw new Error(`JSON parse error from ${url}\nPreview: ${text.slice(0, 300)}`);
      }
      throw new Error(`Not JSON from ${url}\nContent-Type: ${ct}\nPreview: ${text.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timer);
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

/* ================== DrawerFilters แบบหลวม ================== */
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

/* ================== Pending helpers (robust) ================== */
const ZERO_DATES = new Set(["", "0000-00-00", "0000-00-00 00:00:00"]);
type MaybeCloseRow = Partial<{
  r_dt_close: string | null;
  r_close_dt: string | null;
  r_close: string | number | null;
}> & Record<string, unknown>;

function isZeroLikeDate(s?: unknown) {
  const v = String(s ?? "").trim();
  return !v || ZERO_DATES.has(v);
}
function isPending(row: MaybeCloseRow) {
  const rawClose = (row.r_dt_close ?? row.r_close_dt ?? "") as string | null | undefined;
  const notClosedByDate = isZeroLikeDate(rawClose);
  const closeFlag = String(row.r_close ?? "").trim();
  const notClosedByFlag = closeFlag === "" || closeFlag === "0" || closeFlag === "false";
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

/* ================== ตัวช่วยโหลดแบบหลายหน้า (รองรับ AbortSignal) ================== */
async function fetchRepairAllPages(params: {
  baseUrl: string;
  from?: string | null;
  to?: string | null;
  pageSize?: number;
  orderBy?: string;
  order?: "asc" | "desc";
  signal?: AbortSignal;
}) {
  const {
    baseUrl,
    from = null,
    to = null,
    pageSize = DEFAULT_PAGE_SIZE,
    orderBy,
    order = "desc",
    signal,
  } = params;

  const all: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const query = new URLSearchParams();
    query.set("tables", "repair");
    query.set("pageSize", String(pageSize));
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (orderBy || order) {
      query.set("orderBy", JSON.stringify({ repair: orderBy || "r_id" }));
      query.set("order", JSON.stringify({ repair: order }));
    }
    query.set("page", JSON.stringify({ repair: page }));

    const url = `${baseUrl}?${query.toString()}`;
    const json = await fetchJSON(url, { signal });
    const box = json?.tables?.repair;
    const rows = coerceRows(box?.rows);
    const meta = box?.meta || {};
    const tp = Number(meta?.totalPages || 1);

    all.push(...rows);
    totalPages = isFinite(tp) && tp >= 1 ? tp : 1;
    page += 1;

    if (page > 2000) break; // safety cap
  }

  return all as RepairRow[];
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

  // เริ่มต้น "รายวัน" + วันนี้
  const [filters, setFilters] = useState<DrawerFilters>(
    asLoose({ mode: "daily", date: todayStr })
  );

  // คำค้นหา (debounce)
  const [q, setQ] = useState("");
  const [qRaw, setQRaw] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(qRaw), 250);
    return () => clearTimeout(t);
  }, [qRaw]);

  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [selected, setSelected] = useState<RepairRow | null>(null);

  // ควบคุมคำขอ, แคช และป้องกันกดซ้ำ
  const reqCtlRef = useRef<AbortController | null>(null);
  const lastKeyRef = useRef<string>("");
  const cacheRef = useRef<
    Map<
      string,
      { items: RepairRow[]; parts: any[]; exps: any[]; rangeLabel: string | null }
    >
  >(new Map());

  function keyOf(f: FiltersLoose) {
    const norm = JSON.stringify({
      ...f,
      date: f.date ?? null,
      from: f.from ?? null,
      to: f.to ?? null,
      technician: f.technician ?? null,
      carName: f.carName ?? null,
      plate: f.plate ?? null,
      vin: f.vin ?? null,
    });
    return `${f.mode}:${norm}`;
  }

  /* ---------- โหลดเริ่มต้น (รายวัน) ---------- */
  useEffect(() => {
    void loadByFilters(asLoose({ mode: "daily", date: todayStr }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- โหลดตามตัวกรอง (ยกเลิกคำขอเก่า + แคช + กันกดซ้ำ) ---------- */
  async function loadByFilters(f: FiltersLoose, { useCache = true }: { useCache?: boolean } = {}) {
    if (!EXPORT_ALL_API) {
      setErr("ไม่ได้ตั้งค่า VITE_EXPORT_ALL");
      return;
    }

    const key = keyOf(f);

    if (loading && key === lastKeyRef.current) {
      return; // กันกดซ้ำ key เดิมระหว่างโหลด
    }

    setErr(null);
    setLoading(true);

    // คายจากแคชทันทีเพื่อความไว (ถ้ามี)
    if (useCache && cacheRef.current.has(key)) {
      const c = cacheRef.current.get(key)!;
      setItems(c.items);
      setAllParts(c.parts);
      setAllExps(c.exps);
      setRangeLabel(c.rangeLabel);
    }

    // ยกเลิกคำขอเก่า แล้วตั้งคำขอใหม่
    reqCtlRef.current?.abort();
    const ctl = new AbortController();
    reqCtlRef.current = ctl;
    lastKeyRef.current = key;

    try {
      if (f.mode === "daily") {
        const d = f.date || todayStr;
        const query = new URLSearchParams();
        query.set("tables", TABLES.join(","));
        query.set("pageSize", String(DEFAULT_PAGE_SIZE));
        query.set("from", d);
        query.set("to", d);
        query.set("order", JSON.stringify({ repair: "desc", used_parts: "desc", other_cost: "desc" }));

        const url = `${EXPORT_ALL_API}?${query.toString()}`;
        const json = await fetchJSON(url, { signal: ctl.signal });

        const items = getTableRows(json, "repair") as RepairRow[];
        const parts = getTableRows(json, "used_parts");
        const exps = getTableRows(json, "other_cost");
        setItems(items);
        setAllParts(parts);
        setAllExps(exps);
        setRangeLabel(null);

        cacheRef.current.set(key, { items, parts, exps, rangeLabel: null });
        return;
      }

      if (f.mode === "custom") {
        const from = f.from || f.to || todayStr;
        const to = f.to || f.from || from;

        const repairRows = await fetchRepairAllPages({
          baseUrl: EXPORT_ALL_API,
          from,
          to,
          pageSize: DEFAULT_PAGE_SIZE,
          orderBy: "r_id",
          order: "desc",
          signal: ctl.signal,
        });

        const label = `${new Date(`${from}T00:00:00`).toLocaleDateString("th-TH")} – ${new Date(`${to}T00:00:00`).toLocaleDateString("th-TH")}`;

        setItems(repairRows);
        setAllParts([]);
        setAllExps([]);
        setRangeLabel(label);

        cacheRef.current.set(key, { items: repairRows, parts: [], exps: [], rangeLabel: label });
        return;
      }

      if (f.mode === "history") {
        const repairRows = await fetchRepairAllPages({
          baseUrl: EXPORT_ALL_API,
          pageSize: DEFAULT_PAGE_SIZE,
          orderBy: "r_id",
          order: "desc",
          signal: ctl.signal,
        });

        const label =
          (f.plate && `ประวัติแจ้งซ่อม • ป้ายทะเบียน ${f.plate}`) ||
          (f.carName && `ประวัติแจ้งซ่อม • หมายเลขรถ ${f.carName}`) ||
          (f.vin && `ประวัติแจ้งซ่อม • เลขตัวถัง ${f.vin}`) ||
          "ประวัติแจ้งซ่อม • รถคันที่เลือก";

        setItems(repairRows);
        setAllParts([]);
        setAllExps([]);
        setRangeLabel(label);

        cacheRef.current.set(key, { items: repairRows, parts: [], exps: [], rangeLabel: label });
        return;
      }

      if (f.mode === "pendingAll") {
        const repairRows = await fetchRepairAllPages({
          baseUrl: EXPORT_ALL_API,
          pageSize: DEFAULT_PAGE_SIZE,
          orderBy: "r_id",
          order: "desc",
          signal: ctl.signal,
        });
        const label = "งานค้างทั้งหมด (กรองจากข้อมูลรวม)";

        setItems(repairRows);
        setAllParts([]);
        setAllExps([]);
        setRangeLabel(label);

        cacheRef.current.set(key, { items: repairRows, parts: [], exps: [], rangeLabel: label });
        return;
      }

      // fallback
      const query = new URLSearchParams();
      query.set("tables", TABLES.join(","));
      query.set("pageSize", String(DEFAULT_PAGE_SIZE));
      query.set("order", JSON.stringify({ repair: "desc", used_parts: "desc", other_cost: "desc" }));
      const url = `${EXPORT_ALL_API}?${query.toString()}`;
      const json = await fetchJSON(url, { signal: ctl.signal });

      const items = getTableRows(json, "repair") as RepairRow[];
      const parts = getTableRows(json, "used_parts");
      const exps = getTableRows(json, "other_cost");
      setItems(items);
      setAllParts(parts);
      setAllExps(exps);
      setRangeLabel(null);
      cacheRef.current.set(key, { items, parts, exps, rangeLabel: null });

    } catch (e: any) {
      if (e?.name === "AbortError") return; // ถูกยกเลิก
      setItems([]);
      setAllParts([]);
      setAllExps([]);
      setErr(e?.message || "โหลดข้อมูลล้มเหลว");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- กรองฝั่ง client (หลังดึงครบแล้ว) ---------- */
  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();

    return items.filter((row) => {
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

      if (filters.mode === "pendingAll") return isPending(row);

      if (filters.mode === "history") {
        const car = (asLoose(filters).carName ?? "").trim().toLowerCase();
        const plate = (asLoose(filters).plate ?? "").trim().toLowerCase();
        const vin = (asLoose(filters).vin ?? "").trim().toLowerCase();

        const nameSrc = String(row.r_v_name || "").toLowerCase();
        const plateSrc = String(row.r_v_plate || "").toLowerCase();
        const vinSrc = String(row.r_v_chassis || row.r_job_num || "").toLowerCase();

        if (car && !nameSrc.includes(car)) return false;
        if (plate && !plateSrc.includes(plate)) return false;
        if (vin && !vinSrc.includes(vin)) return false;
        return true;
      }

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

  /* ---------- Title ---------- */
  const dateLoose = asLoose(filters).date;
  const titleDate = useMemo(() => {
    if (filters.mode === "daily" && dateLoose) {
      const d = new Date(`${dateLoose}T00:00:00`);
      const th = isNaN(d.getTime()) ? dateLoose : d.toLocaleDateString("th-TH");
      return `งานประจำวันที่ ${th} • ${filtered.length} รายการ`;
    }
    if (rangeLabel) return `${rangeLabel} • ${filtered.length} รายการ`;
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
    await loadByFilters(asLoose(f));
  };

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      <NavBar onOpenMenu={() => setDrawerOpen(true)} subtitle={<>{titleDate}</>} />

      <FilterDrawer
        open={drawerOpen}
        initial={filters}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleFilterSubmit}
        loading={loading}
      />

      {err && <p className="text-red-300 text-center mt-3">{err}</p>}

      <div className="px-4 mt-3">
        <SearchBar value={qRaw} onChange={setQRaw} count={filtered.length} loading={loading} />
      </div>

      {loading && !cacheRef.current.has(keyOf(asLoose(filters))) ? (
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
        parts={partsForSelected}
        expenses={expsForSelected}
        reportFallback={selected?.r_perform_rep ?? ""}
        onClose={() => setSelected(null)}
      />

      <LoadingOverlay show={loading} label="กำลังโหลดข้อมูล..." />
    </div>
  );
}
