import { useEffect, useState } from "react";
import { FiChevronDown, FiSearch, FiX } from "react-icons/fi";
import VehiclePickerModal from "@/components/vehicle/VehiclePickerModal";

export type DrawerFilters =
  | { mode: "custom"; from?: string; to?: string }
  | {  mode: "daily"; date?: string; technician?: string }
  | { mode: "pendingAll" }
  | { mode: "history"; carName?: string; plate?: string; vin?: string };

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function FilterDrawer({
  open, initial, onClose, onSubmit,
}: { open: boolean; initial: DrawerFilters; onClose: () => void; onSubmit: (f: DrawerFilters) => void; }) {
  const [active, setActive] = useState<DrawerFilters["mode"]>(initial.mode);

  const [from, setFrom] = useState(initial.mode === "custom" ? initial.from ?? "" : "");
  const [to, setTo] = useState(initial.mode === "custom" ? initial.to ?? "" : "");
  const [date, setDate] = useState(initial.mode === "daily" ? initial.date ?? todayStr() : todayStr());
  const [carName, setCarName] = useState(initial.mode === "history" ? initial.carName ?? "" : "");
  const [plate, setPlate] = useState(initial.mode === "history" ? initial.plate ?? "" : "");
  const [vin, setVin] = useState(initial.mode === "history" ? initial.vin ?? "" : "");
  const [technician, setTechnician] = useState(
    initial.mode === "daily" ? (initial as any).technician ?? "" : ""
  );

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);

  const [openSection, setOpenSection] = useState<Record<DrawerFilters["mode"], boolean>>({
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
    setDate(initial.mode === "daily" ? (initial as any).date ?? todayStr() : todayStr());
    setTechnician(initial.mode === "daily" ? (initial as any).technician ?? "" : "");
    setCarName(initial.mode === "history" ? (initial as any).carName ?? "" : "");
    setPlate(initial.mode === "history" ? (initial as any).plate ?? "" : "");
    setVin(initial.mode === "history" ? (initial as any).vin ?? "" : "");
  }, [open, initial]);

  const submit = () => {
    if (active === "custom") {
      const _from = from || to || todayStr();
      const _to   = to   || from || _from;
      return onSubmit({ mode: "custom", from: _from, to: _to });
    }
    if (active === "daily") {
      return onSubmit({ mode: "daily", date, technician }); // ✅ ส่งชื่อช่างไปด้วย
    }
    if (active === "pendingAll") return onSubmit({ mode: "pendingAll" });
    return onSubmit({ mode: "history", carName, plate, vin });
  };

  // ช่องแสดงผลแบบอ่านอย่างเดียว (คลิกเพื่อเปิดมอดอล)
  const ReadonlyBox = ({ value, onClick }: { value: string; onClick: () => void }) => (
    <div
      onClick={onClick}
      className="w-full px-3 py-2 rounded-lg bg-slate-100 cursor-pointer select-none"
      title="คลิกเพื่อเลือกจากรายการรถ"
    >
      {value?.trim() ? value : <span className="text-gray-400">คลิกเพื่อเลือก</span>}
    </div>
  );

  // รับค่าจากมอดอลรถ (ดับเบิลคลิกแถว)
  const handlePickVehicle = (v: { v_name?: string; v_plate?: string; v_chassis?: string }) => {
    setCarName(v.v_name ?? "");
    setPlate(v.v_plate ?? "");
    setVin(v.v_chassis ?? "");
    setVehicleModalOpen(false);
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 h-full w-[320px] sm:w-[360px] bg-white text-gray-900 shadow-2xl rounded-l-3xl transition-transform duration-300 z-[1200] ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="h-full overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-2xl font-extrabold">เมนู</h3>
            <button onClick={onClose} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><FiX /></button>
          </div>

          <Accordion title="กำหนดเอง" active={active === "custom"} open={openSection.custom}
            onClick={() => { setActive("custom"); setOpenSection(s => ({ ...s, custom: !s.custom })); }}>
            <Label>วันที่</Label>
            <input type="date" value={from} max={todayStr()} onChange={(e)=>setFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-100" />
            <Label className="mt-3">ถึงวันที่</Label>
            <input type="date" value={to} max={todayStr()} onChange={(e)=>setTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-100" />
            <p className="text-xs text-gray-500 mt-1">เลือก 1 หรือ 2 ช่องก็ได้ (เว้นว่างช่องใดช่องหนึ่ง ระบบจะใช้วันเดียวกัน)</p>
          </Accordion>

          <Accordion title="งานประจำวัน" active={active === "daily"} open={openSection.daily}
            onClick={() => { setActive("daily"); setOpenSection(s => ({ ...s, daily: !s.daily })); }}>
            <Label>วันที่ (ค.ศ.)</Label>
            <input type="date" value={date} max={todayStr()} onChange={(e)=>setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-100" />
            <Label className="mt-3">ช่างผู้รับผิดชอบ</Label>
            <input
              value={technician}
              onChange={(e)=>setTechnician(e.target.value)}
              placeholder="เช่น ช่างนุ้ย"
              className="w-full px-3 py-2 rounded-lg bg-slate-100"
            />
            <p className="text-xs text-gray-500 mt-1">ระบบจะกรองจาก “วันที่” และ “ชื่อช่าง” (ไม่ต้องพิมพ์เต็มคำก็ได้)</p>
          </Accordion>

          {/* <Accordion ระบบค้าหางานค้าง
            title="งานค้างทั้งหมด"
            active={active === "pendingAll"}
            open={openSection.pendingAll}
            onClick={() => {
              setActive("pendingAll");
              setOpenSection((s) => ({ ...s, pendingAll: !s.pendingAll }));
            }}
          >
            <div className="flex flex-col items-start gap-2">
              <button
                onClick={() => {
                  onSubmit({ mode: "pendingAll" });
                  onClose();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:opacity-90"
              >
                <FiSearch /> ค้นหางานค้างทั้งหมด
              </button>
            </div>
          </Accordion> */}

          {/* แก้ส่วนนี้ให้เลือกจากมอดอลรถ */}
          <Accordion
            title="ประวัติแจ้งซ่อมรายคัน"
            active={active === "history"}
            open={openSection.history}
            onClick={() => { setActive("history"); setOpenSection(s => ({ ...s, history: !s.history })); }}
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
                onClick={() => { setCarName(""); setPlate(""); setVin(""); }}
                className="text-sm text-gray-600 underline"
              >
                ล้างค่า
              </button>
            </div>
          </Accordion>

          <div className="pt-4">
            <button onClick={() => { submit(); onClose(); }}
              className="w-full py-2 rounded-xl text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:opacity-90 flex items-center justify-center gap-2">
              <FiSearch /> ค้นหา
            </button>
          </div>
        </div>
      </aside>

      {/* มอดอลเลือกรถ — ดับเบิลคลิกแถวเพื่อเลือก */}
      <VehiclePickerModal
        open={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        onPick={(v) => handlePickVehicle({
          v_name: (v as any).v_name,
          v_plate: (v as any).v_plate,
          v_chassis: (v as any).v_chassis,
        })}
      />
    </>
  );
}

function Accordion({
  title, children, open, active, onClick,
}: { title: string; children: React.ReactNode; open: boolean; active?: boolean; onClick: () => void; }) {
  return (
    <div className="py-3">
      <button onClick={onClick} className={`w-full flex items-center justify-between border-b pb-2 ${active ? "text-blue-700 border-blue-500" : "text-gray-800 border-gray-200"}`}>
        <span className={`font-semibold ${active ? "text-blue-700" : ""}`}>{title}</span>
        <FiChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid gap-2 pt-3 ${open ? "block" : "hidden"}`}>{children}</div>
    </div>
  );
}
function Label({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-sm mb-1 ${className}`}>{children}</label>;
}
