import React from "react";
import { FiMenu, FiHome  } from "react-icons/fi";
import logo from "@/assets/sombattourbg.png";

export default function NavBar({
  onOpenMenu,
  rightSlot,
  subtitle,
}: {
  onOpenMenu: () => void;
  rightSlot?: React.ReactNode;   // ปุ่ม/คอนโทรลเพิ่มเติมฝั่งขวา (ไม่บังคับ)
  subtitle?: React.ReactNode;    // บรรทัดย่อยใต้หัวเรื่อง (เช่น วันที่)
}) {
  return (
    <header className="sticky top-0 z-[1000] bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-gray-900/60 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="h-14 flex items-center justify-between">
          {/* left */}
          <div className="flex items-center gap-3 min-w-0">
            <img src={logo} alt="สมบัติทัวร์" className="h-8 w-auto object-contain" />
            <div className="leading-tight truncate">
              <div className="font-semibold text-white truncate">รายการเปิดงาน</div>
              {subtitle && (
                <div className="text-xs text-white/70 truncate">{subtitle}</div>
              )}
            </div>
          </div>

          {/* right */}
          <div className="flex items-center gap-2">
            {rightSlot}
            <a href="https://www.425store.com/" className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white cursor-pointer">
                <button
                className=""
                title="กลับหน้าหลัก"
                >
                <FiHome  />
                <span className="hidden sm:inline">หน้าหลัก</span>
                </button>
            </a>
            <button
              onClick={onOpenMenu}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white cursor-pointer"
              title="เมนูตัวกรอง"
            >
              <FiMenu />
              <span className="hidden sm:inline">เมนู</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
