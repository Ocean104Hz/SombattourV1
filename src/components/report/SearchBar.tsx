import { FiSearch, FiX } from "react-icons/fi";

export default function SearchBar({
  value, onChange, count, loading,
}: { value: string; onChange: (v: string)=>void; count: number; loading?: boolean; }) {
  return (
    <>
      <div className="max-w-xl mx-auto flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 ring-1 ring-white/10 focus-within:ring-sky-400">
        <FiSearch className="opacity-70" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ค้นหาเร็วๆ (เลขใบงาน/รถ/รายการ/ผู้ซ่อม/ผู้บันทึก)"
          className="bg-transparent outline-none w-full placeholder:text-white/50"
        />
        {value && (
          <button onClick={() => onChange("")} className="p-1 rounded hover:bg-white/10">
            <FiX />
          </button>
        )}
      </div>
      <div className="text-right text-sm opacity-80 mt-1">
        แสดง {count} รายการ{loading ? " (กำลังโหลด…)" : ""}
      </div>
    </>
  );
}
