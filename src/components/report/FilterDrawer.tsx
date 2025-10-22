import { useEffect, useState, useMemo } from "react";
import { FiChevronDown, FiSearch, FiX } from "react-icons/fi";
import VehiclePickerModal from "@/components/vehicle/VehiclePickerModal";

export type DrawerFilters =
  | { mode: "custom"; from?: string; to?: string }
  | { mode: "daily"; date?: string; technician?: string }
  | { mode: "pendingAll" }
  | { mode: "history"; carName?: string; plate?: string; vin?: string };

/** ===== Technician API (ยืดหยุ่น) ===== */
const TECH_DIRECT = (
  ((import.meta as any).env?.VITE_TECHNICIAN_API as string) || ""
).trim();
const RAW_BASE_URL = (
  ((import.meta as any).env?.VITE_API_BASE_URL as string) || ""
).trim();
const RAW_BASE = (
  ((import.meta as any).env?.VITE_API_BASE as string) || ""
).trim();
const deriveRoot = (s: string) => {
  if (!s) return "";
  const isPhp = /\.php(\?|$)/i.test(s);
  return isPhp ? s.replace(/\/[^/?#]+(\?.*)?$/, "") : s.replace(/\/+$/, "");
};
const API_ROOT = deriveRoot(RAW_BASE_URL) || deriveRoot(RAW_BASE);
const TECHNICIAN_API =
  TECH_DIRECT || (API_ROOT ? `${API_ROOT}/technician_list.php` : "");

/** ===== utils ===== */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const coerceArray = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.rows)) return raw.rows;
  if (raw && typeof raw === "object") {
    const ks = Object.keys(raw);
    if (ks.length && ks.every((k) => /^\d+$/.test(k))) {
      return ks.sort((a, b) => +a - +b).map((k) => (raw as any)[k]);
    }
  }
  return [];
};

export default function FilterDrawer({
  open,
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  initial: DrawerFilters;
  onClose: () => void;
  onSubmit: (f: DrawerFilters) => Promise<void> | void;
  loading?: boolean;
}) {
  const [active, setActive] = useState<DrawerFilters["mode"]>(initial.mode);

  const [from, setFrom] = useState(
    initial.mode === "custom" ? initial.from ?? "" : ""
  );
  const [to, setTo] = useState(
    initial.mode === "custom" ? initial.to ?? "" : ""
  );
  const [date, setDate] = useState(
    initial.mode === "daily" ? initial.date ?? todayStr() : todayStr()
  );
  const [carName, setCarName] = useState(
    initial.mode === "history" ? initial.carName ?? "" : ""
  );
  const [plate, setPlate] = useState(
    initial.mode === "history" ? initial.plate ?? "" : ""
  );
  const [vin, setVin] = useState(
    initial.mode === "history" ? initial.vin ?? "" : ""
  );
  const [technician, setTechnician] = useState(
    initial.mode === "daily" ? (initial as any).technician ?? "" : ""
  );

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);

  const [openSection, setOpenSection] = useState<
    Record<DrawerFilters["mode"], boolean>
  >({
    custom: active === "custom",
    daily: active === "daily",
    pendingAll: active === "pendingAll",
    history: active === "history",
  });

  useEffect(() => {
    setOpenSection({
      custom: active === "custom",
      daily: active === "daily",
      pendingAll: active === "pendingAll",
      history: active === "history",
    });
  }, [active]);

  // ซิงก์เมื่อ Drawer เปิดใหม่
  useEffect(() => {
    if (!open) return;
    setActive(initial.mode);
    setFrom(initial.mode === "custom" ? (initial as any).from ?? "" : "");
    setTo(initial.mode === "custom" ? (initial as any).to ?? "" : "");
    setDate(
      initial.mode === "daily"
        ? (initial as any).date ?? todayStr()
        : todayStr()
    );
    setTechnician(
      initial.mode === "daily" ? (initial as any).technician ?? "" : ""
    );
    setCarName(
      initial.mode === "history" ? (initial as any).carName ?? "" : ""
    );
    setPlate(initial.mode === "history" ? (initial as any).plate ?? "" : "");
    setVin(initial.mode === "history" ? (initial as any).vin ?? "" : "");
  }, [open, initial]);

  /** ===== โหลดรายชื่อช่าง ===== */
  const [techOpen, setTechOpen] = useState(false);
  const [techLoading, setTechLoading] = useState(false);
  const [techErr, setTechErr] = useState<string | null>(null);
  const [techList, setTechList] = useState<string[]>([]);
  const [techKeyword, setTechKeyword] = useState("");

  const openTechModal = () => {
    setTechKeyword("");
    setTechOpen(true);
  };

  useEffect(() => {
    if (!TECHNICIAN_API) return;
    let cancelled = false;
    (async () => {
      try {
        setTechErr(null);
        setTechLoading(true);

        const url = `${TECHNICIAN_API}?_=${Date.now()}`;
        const res = await fetch(url);
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
        const json = JSON.parse(text);

        const rows = coerceArray((json as any).rows ?? (json as any).data ?? json);

        rows.sort((a: any, b: any) => {
          const av = parseInt(a.v_sort || a.sort_order || a.sort || "0", 10);
          const bv = parseInt(b.v_sort || b.sort_order || b.sort || "0", 10);
          if (av !== bv) return av - bv;
          const an = String(
            a.name ?? a.t_name ?? a.tech_name ?? a.technician ?? ""
          );
          const bn = String(
            b.name ?? b.t_name ?? b.tech_name ?? b.technician ?? ""
          );
          return an.localeCompare(bn, "th");
        });

        const names = rows
          .map(
            (r: any) => r.name ?? r.t_name ?? r.tech_name ?? r.technician ?? ""
          )
          .map((s: any) => String(s || "").trim())
          .filter(Boolean);

        const uniq = Array.from(new Set(names));

        if (!cancelled) setTechList(uniq);
      } catch (e: any) {
        if (!cancelled) setTechErr(e?.message || "โหลดรายชื่อช่างล้มเหลว");
      } finally {
        if (!cancelled) setTechLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTech = useMemo(() => {
    const k = techKeyword.trim().toLowerCase();
    if (!k) return techList;
    return techList.filter((n) => n.toLowerCase().includes(k));
  }, [techKeyword, techList]);

  const submit = async () => {
    if (active === "custom") {
      const _from = from || to || todayStr();
      const _to = to || from || _from;
      return onSubmit({ mode: "custom", from: _from, to: _to });
    }
    if (active === "daily") {
      return onSubmit({ mode: "daily", date, technician });
    }
    if (active === "pendingAll") return onSubmit({ mode: "pendingAll" });
    return onSubmit({ mode: "history", carName, plate, vin });
  };

  const ReadonlyBox = ({
    value,
    onClick,
  }: {
    value: string;
    onClick: () => void;
  }) => (
    <div
      onClick={onClick}
      className="w-full px-3 py-2 rounded-lg bg-slate-100 cursor-pointer select-none"
      title="คลิกเพื่อเลือกจากรายการรถ"
    >
      {value?.trim() ? value : <span className="text-gray-400">คลิกเพื่อเลือก</span>}
    </div>
  );

  const handlePickVehicle = (v: {
    v_name?: string;
    v_plate?: string;
    v_chassis?: string;
  }) => {
    setCarName(v.v_name ?? "");
    setPlate(v.v_plate ?? "");
    setVin(v.v_chassis ?? "");
    setVehicleModalOpen(false);
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 h-full w-[320px] sm:w-[360px] bg-white text-gray-900 shadow-2xl rounded-l-3xl transition-transform duration-300 z-[1200] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-2xl font-extrabold">เมนู</h3>
            <button onClick={onClose} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
              <FiX />
            </button>
          </div>

          <Accordion
            title="กำหนดเอง"
            active={active === "custom"}
            open={openSection.custom}
            onClick={() => {
              setActive("custom");
              setOpenSection((s) => ({ ...s, custom: !s.custom }));
            }}
          >
            <Label>วันที่</Label>
            <input
              type="date"
              value={from}
              max={todayStr()}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-100"
            />
            <Label className="mt-3">ถึงวันที่</Label>
            <input
              type="date"
              value={to}
              max={todayStr()}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              เลือก 1 หรือ 2 ช่องก็ได้ (เว้นว่างช่องใดช่องหนึ่ง ระบบจะใช้วันเดียวกัน)
            </p>
          </Accordion>

          <Accordion
            title="งานประจำวัน"
            active={active === "daily"}
            open={openSection.daily}
            onClick={() => {
              setActive("daily");
              setOpenSection((s) => ({ ...s, daily: !s.daily }));
            }}
          >
            <Label>วันที่ (ค.ศ.)</Label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-100"
            />

            <Label className="mt-3">ช่างผู้รับผิดชอบ</Label>
            <input
              readOnly
              onClick={openTechModal}
              onFocus={openTechModal}
              value={technician}
              placeholder="คลิกเพื่อเลือกชื่อช่าง…"
              className="w-full px-3 py-2 rounded-lg bg-slate-100 cursor-pointer"
              title="คลิกเพื่อเลือกจากรายชื่อช่าง"
            />
            <div className="mt-2">
              <button
                type="button"
                className="text-xs text-gray-600 underline"
                onClick={() => setTechnician("")}
                title="ล้างค่า"
              >
                ล้างค่า
              </button>
            </div>
          </Accordion>

          <Accordion
            title="ประวัติแจ้งซ่อมรายคัน"
            active={active === "history"}
            open={openSection.history}
            onClick={() => {
              setActive("history");
              setOpenSection((s) => ({ ...s, history: !s.history }));
            }}
          >
            <Label>หมายเลขรถ / ชื่อรถ</Label>
            <ReadonlyBox value={carName} onClick={() => setVehicleModalOpen(true)} />

            <Label className="mt-3">เลขทะเบียน</Label>
            <ReadonlyBox value={plate} onClick={() => setVehicleModalOpen(true)} />

            <Label className="mt-3">เลขตัวถัง</Label>
            <ReadonlyBox value={vin} onClick={() => setVehicleModalOpen(true)} />

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setCarName("");
                  setPlate("");
                  setVin("");
                }}
                className="text-sm text-gray-600 underline"
              >
                ล้างค่า
              </button>
            </div>
          </Accordion>

          <div className="pt-4">
            <button
              disabled={!!loading}
              onClick={async () => {
                if (loading) return;
                await submit();
                onClose();
              }}
              className={`w-full py-2 rounded-xl text-white flex items-center justify-center gap-2 ${
                loading
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-sky-500 to-blue-600 hover:opacity-90"
              }`}
              title={loading ? "กำลังค้นหา…" : "ค้นหา"}
            >
              <FiSearch /> {loading ? "กำลังค้นหา…" : "ค้นหา"}
            </button>
          </div>
        </div>
      </aside>

      {/* มอดอลเลือกรถ — ดับเบิลคลิกแถวเพื่อเลือก */}
      <VehiclePickerModal
        open={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        onPick={(v) =>
          handlePickVehicle({
            v_name: (v as any).v_name,
            v_plate: (v as any).v_plate,
            v_chassis: (v as any).v_chassis,
          })
        }
      />

      {/* มอดอลรายชื่อช่าง */}
      {techOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[1300]" onClick={() => setTechOpen(false)} />
          <div className="fixed inset-0 z-[1310] flex items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-gray-800 text-white rounded-2xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-lg">ผู้ซ่อม</div>
                <button className="p-2 rounded-xl bg-red-700 hover:bg-red-60" onClick={() => setTechOpen(false)}>
                  <FiX size={18} />
                </button>
              </div>

              <div className="mb-3">
                <input
                  value={techKeyword}
                  onChange={(e) => setTechKeyword(e.target.value)}
                  placeholder="ค้นหาชื่อช่าง..."
                  className="w-full px-3 py-2 rounded-lg bg-gray-200 placeholder:text-slate-400"
                />
              </div>

              {techErr && <div className="text-red-500 text-sm mb-2">{techErr}</div>}

              {techLoading ? (
                <div className="text-slate-300">กำลังโหลดรายชื่อช่าง…</div>
              ) : (
                <div className="flex-1 overflow-auto">
                  {filteredTech.map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setTechnician(name);
                        setTechOpen(false);
                      }}
                      className="px-3 py-1 mx-1 my-1 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-sm font-semibold"
                    >
                      {name}
                    </button>
                  ))}
                  {filteredTech.length === 0 && <div className="text-slate-400">ไม่พบรายการ</div>}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Accordion({
  title,
  children,
  open,
  active,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  open: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="py-3">
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-between border-b pb-2 ${
          active ? "text-blue-700 border-blue-500" : "text-gray-800 border-gray-200"
        }`}
      >
        <span className={`font-semibold ${active ? "text-blue-700" : ""}`}>{title}</span>
        <FiChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid gap-2 pt-3 ${open ? "block" : "hidden"}`}>{children}</div>
    </div>
  );
}
function Label({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <label className={`block text-sm mb-1 ${className}`}>{children}</label>;
}
