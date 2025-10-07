// src/components/report/DetailsModal/WorkReportPanel.tsx
import { useMemo } from "react";

export type PerformItem = {
  id: string;
  createdAt?: string;
  content: string;
  technician?: string;
};

type Props = {
  items?: PerformItem[];  // จากตาราง r_perform_rep (ถ้ามี)
  report?: string;        // ฟอลแบ็กจาก repair.r_perform_rep
};

function fmtDateTime(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const date = d.toLocaleDateString("th-TH");
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export default function WorkReportPanel({ items = [], report }: Props) {
  const textFallback = (report ?? "").trim();

  // จัดเรียงรายการ (มี createdAt ให้เรียงใหม่สุดอยู่บน, ถ้าไม่มีใช้ id)
  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (bt !== at) return bt - at;
      // tie-breaker: id desc แบบตัวเลขถ้าได้
      const ai = Number(a.id), bi = Number(b.id);
      if (!isNaN(ai) && !isNaN(bi)) return bi - ai;
      return String(b.id).localeCompare(String(a.id));
    });
    return arr;
  }, [items]);

  const hasItems = sorted.length > 0;

  return (
    <div className="mt-6">
      <p className="font-semibold text-lg mb-3">1. รายงานการปฏิบัติงาน</p>

      {hasItems ? (
        <div className="space-y-3">
          {sorted.map((it) => (
            <div
              key={it.id}
              className="rounded-xl border border-slate-200 bg-blue-50/60 p-3"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600 mb-1">
                {it.technician && (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-sky-600/90 text-white">
                    {it.technician}
                  </span>
                )}
                {it.createdAt && <span>{fmtDateTime(it.createdAt)}</span>}
              </div>
              <div className="text-[14px] text-sky-700 font-semibold whitespace-pre-wrap break-words">
                {it.content?.trim() || ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full min-h-[10rem] rounded-xl bg-blue-100/60 text-sky-600 font-bold p-4 text-[14px] whitespace-pre-wrap break-words">
          {textFallback || "-"}
        </div>
      )}
    </div>
  );
}
