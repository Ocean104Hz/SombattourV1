// src/components/common/LoadingOverlay.tsx
import logo from "@/assets/sombattourbg.png"; // << ใส่พาธรูปที่วางไว้

/** หน้าคลุมทั้งจอระหว่างโหลด */
export default function LoadingOverlay({
  show,
  label = "กำลังโหลดข้อมูล...",
}: {
  show: boolean;
  label?: string;
}) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-gray-900/85 backdrop-blur-sm text-white"
    >
      {/* โลโก้ */}
      <div className="relative mb-5">
        {/* วงแสงนุ่ม ๆ ด้านหลัง */}
        <div className="absolute -inset-6 rounded-full bg-cyan-400/10 blur-2xl" />
        <img
          src={logo}
          alt="สมบัติทัวร์ – มิตรแท้เพื่อนเดินทาง"
          className="relative h-16 md:h-20 object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,.25)]"
          draggable={false}
        />
      </div>

      {/* จุดกระดอน 3 จุด */}
      <div className="flex items-end gap-3 h-10" aria-hidden="true">
        <span className="w-3 h-3 rounded-full bg-white/90 animate-bounce [animation-delay:-0.2s]" />
        <span className="w-3 h-3 rounded-full bg-white/70 animate-bounce [animation-delay:-0.1s]" />
        <span className="w-3 h-3 rounded-full bg-white/50 animate-bounce" />
      </div>

      <p className="mt-3 text-sm text-white/85">{label}</p>

      {/* วงโคจรเบา ๆ ด้านหลัง */}
      <div className="pointer-events-none absolute">
        <div className="w-72 h-72 rounded-full border border-white/10 animate-spin-slow" />
      </div>

      {/* เพิ่ม keyframes */}
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0) } to { transform: rotate(360deg) } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
      `}</style>
    </div>
  );
}
