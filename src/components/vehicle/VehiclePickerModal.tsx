// src/components/vehicle/VehiclePickerModal.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { FiSearch, FiX } from "react-icons/fi";
import type { VehicleRow as VehicleRowBase } from "@/types/vehicle";

/** ===== Build endpoint from .env (แข็งแรง) ===== */
const VEHICLE_API_DIRECT =
  (((import.meta as any).env?.VITE_VEHICLE_API as string) || "").trim();

const RAW_BASE =
  (((import.meta as any).env?.VITE_API_BASE_URL as string) || "").trim();
const isPhpFile = /\.php(\?|$)/i.test(RAW_BASE);
const API_ROOT = isPhpFile
  ? RAW_BASE.replace(/\/[^/?#]+(\?.*)?$/, "")
  : RAW_BASE.replace(/\/+$/, "");

const VEHICLE_API =
  VEHICLE_API_DIRECT || (API_ROOT ? `${API_ROOT}/vehicle_search.php` : "");

/* ---------- ชนิดพร็อพและแถว ---------- */
type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (v: VehicleRowBase) => void;
};

type VehicleRowUI = VehicleRowBase & {
  v_route?: string;
  v_class?: string | number;
  v_engine?: string;
  v_inv_com?: string;
  /** ใช้สำหรับเรียงลำดับ */
  v_sort?: number;
};

/* ---------- utils ---------- */
function cls(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
function toNum(x: any, def = 0) {
  const n = parseInt(String(x ?? "").trim(), 10);
  return Number.isFinite(n) ? n : def;
}

// บีบ raw → array เสมอ
function coerceArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray((raw as any).rows)) return (raw as any).rows;
  if (raw && typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length && keys.every((k) => /^\d+$/.test(k))) {
      return keys.sort((a, b) => +a - +b).map((k) => (raw as any)[k]);
    }
  }
  return [];
}

/** map API -> VehicleRow (+ v_sort) */
function normalizeRows(raw: any): VehicleRowUI[] {
  const arr = coerceArray(raw).map((r: any) => ({
    v_id: r.v_id ?? r.id ?? r.ID ?? "",
    v_name: r.v_name ?? r.name ?? "",
    v_route: r.v_route ?? r.lane ?? "",
    v_class: r.v_class ?? r.std ?? "",
    v_metr: r.v_metr ?? r.length_m ?? r.v_len_m ?? "",
    v_plate: r.v_plate ?? r.plate ?? "",
    v_chassis: r.v_chassis ?? r.chassis ?? "",
    v_engine: r.v_engine ?? r.engine ?? "",
    v_brand: r.v_brand ?? r.brand ?? "",
    v_model: r.v_model ?? r.model ?? "",
    v_company: r.v_company ?? r.contractor ?? "",
    v_inv_com: r.v_inv_com ?? r.inv_company ?? r.billing_to ?? "",
    v_register: r.v_register ?? r.first_reg ?? r.register ?? "",
    v_note: r.v_note ?? "",
    // รับค่าเรียงลำดับจากหลายชื่อคอลัมน์
    v_sort: toNum(r.v_sort ?? r.sort_order ?? r.sort, 0),
  }));

  // ✅ เรียงลำดับตาม v_sort (น้อยก่อน) แล้ว fallback ตาม v_id (เลข)
  arr.sort((a, b) => {
    const s = toNum(a.v_sort) - toNum(b.v_sort);
    if (s !== 0) return s;
    return toNum(a.v_id) - toNum(b.v_id);
  });

  return arr;
}

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(hover: none), (pointer: coarse)");
    setIsTouch(!!mq && (mq as MediaQueryList).matches);
  }, []);
  return isTouch;
}

/* ---------- format helpers ---------- */
const ZERO = new Set(["", "0000-00-00", "0000-00-00 00:00:00", null as any, undefined as any]);
const fmt = (v: any) => (ZERO.has(v as any) ? "" : String(v));
const fmtLen = (v: any) => {
  const s = String(v ?? "").trim();
  return s || "";
};
const fmtDate = (v: any) => {
  const s = String(v ?? "").trim();
  if (!s || ZERO.has(s as any)) return "";
  return s.slice(0, 10);
};

/* ================= Component ================= */
export default function VehiclePickerModal({ open, onClose, onPick }: Props) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<VehicleRowUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isTouch = useIsTouchDevice();

  const howToPick = useMemo(
    () =>
      isTouch ? "แตะปุ่ม “เลือก” หรือแตะแถว 1 ครั้ง" : "ดับเบิลคลิกแถว หรือกดปุ่ม “เลือก”",
    [isTouch]
  );

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!VEHICLE_API) {
      setErr("ไม่ได้ตั้งค่า VITE_API_BASE_URL / VITE_VEHICLE_API");
      setRows([]);
      return;
    }

    const t = setTimeout(async () => {
      setErr(null);
      try {
        setLoading(true);

        const qs = new URLSearchParams();
        if (q) qs.set("q", q);
        qs.set("limit", "2000");
        qs.set("_", String(Date.now())); // cache buster

        const url = `${VEHICLE_API}?${qs.toString()}`;
        const res = await fetch(url, { credentials: "omit" });
        const text = await res.text();

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);

        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          const isHtml = /^\s*</.test(text);
          throw new Error(
            (isHtml
              ? "HTML response (URL ผิดหรือโดน rewrite): "
              : "Invalid JSON: ") + text.slice(0, 200)
          );
        }

        const candidate = json?.rows ?? json?.data ?? json?.result ?? json;
        const rowsRaw = Array.isArray(candidate?.rows) ? candidate.rows : candidate;

        // ✅ normalize แล้วจะถูก sort ตาม v_sort ภายในฟังก์ชัน
        setRows(normalizeRows(rowsRaw));
      } catch (e: any) {
        console.error("Vehicle fetch error:", e);
        setErr(e?.message || "โหลดข้อมูลรถล้มเหลว");
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const pick = (row: VehicleRowUI) => { onPick(row); onClose(); };
  const rowClick = (row: VehicleRowUI) => { if (isTouch) pick(row); };
  const rowDbl  = (row: VehicleRowUI) => pick(row);
  const rowKey  = (e: React.KeyboardEvent<HTMLTableRowElement>, row: VehicleRowUI) => {
    if (e.key === "Enter") pick(row);
  };

  return (
    <>
      <div
        className={cls(
          "fixed inset-0 bg-black/50 transition-opacity z-[1400]",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      <div
        className={cls(
          "fixed inset-4 sm:inset-10 bg-white text-gray-900 rounded-3xl shadow-2xl z-[1410] flex flex-col",
          open ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none",
          "transition-all"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="vehicle-modal-title" className="text-2xl font-extrabold">รถทั้งหมด</h2>
          <button className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200" onClick={onClose} aria-label="ปิด">
            <FiX className="text-gray-700" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative w-full">
            <FiSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหา… (หมายเลขรถ / ทะเบียน / เลขตัวถัง)"
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-100 text-gray-900 placeholder:text-gray-500 outline-none border border-slate-200 focus:border-sky-400"
              aria-label="ค้นหารถ"
            />
          </div>
          <div className="mt-2 text-xs text-gray-600">{howToPick}</div>
          {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
        </div>

        <div className="px-4 pb-4 overflow-auto">
          <div className="w-full overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-[1400px] w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-800">
                  {[
                    "ลำดับ","ไอดี","หมายเลขรถ","เส้นทาง","มาตรฐาน","ความยาว",
                    "เลขทะเบียน","เลขคัสซี","เลขเครื่องยนต์","ยี่ห้อรถ","รุ่น",
                    "ผู้ประกอบการ","วางบิล","จดทะเบียนครั้งแรก",""
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-gray-900">
                {loading ? (
                  <tr><td colSpan={15} className="px-3 py-6 text-center text-gray-500">กำลังโหลด…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={15} className="px-3 py-6 text-center text-gray-500">ไม่มีข้อมูล</td></tr>
                ) : (
                  rows.map((r, i) => (
                    <tr
                      key={String(r.v_id) + "-" + i}
                      className="border-t border-gray-300 hover:bg-blue-100 focus:bg-blue-100 cursor-pointer"
                      onClick={() => rowClick(r)}
                      onDoubleClick={() => rowDbl(r)}
                      onKeyDown={(e) => rowKey(e, r)}
                      role="button"
                      tabIndex={0}
                      title={howToPick}
                    >
                      <td className="px-3 py-3">{i + 1}</td>
                      <td className="px-3 py-3">{r.v_id}</td>
                      <td className="px-3 py-3">{fmt(r.v_name)}</td>
                      <td className="px-3 py-3">{fmt(r.v_route)}</td>
                      <td className="px-3 py-3">{fmt(r.v_class)}</td>
                      <td className="px-3 py-3">{fmtLen(r.v_metr)}</td>
                      <td className="px-3 py-3">{fmt(r.v_plate)}</td>
                      <td className="px-3 py-3">{fmt(r.v_chassis)}</td>
                      <td className="px-3 py-3">{fmt(r.v_engine)}</td>
                      <td className="px-3 py-3">{fmt(r.v_brand)}</td>
                      <td className="px-3 py-3">{fmt(r.v_model)}</td>
                      <td className="px-3 py-3">{fmt(r.v_company)}</td>
                      <td className="px-3 py-3">{fmt(r.v_inv_com)}</td>
                      <td className="px-3 py-3">{fmtDate(r.v_register)}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); onPick(r); onClose(); }}
                          className="px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          aria-label={`เลือก ${r.v_name || r.v_plate || r.v_id}`}
                          title="เลือก"
                        >
                          เลือก
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-between text-xs text-gray-600">
          <span>{howToPick}</span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200">
            ไม่ต้องการเลือก
          </button>
        </div>
      </div>
    </>
  );
}
