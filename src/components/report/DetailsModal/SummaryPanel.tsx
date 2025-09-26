// src/components/report/DetailsModal/SummaryPanel.tsx
import type { RepairRow } from "@/types/repair";
import { fmt, toDateTime } from "@/utils/datetime";

export default function SummaryPanel({ row }: { row: RepairRow }) {
  const created = toDateTime(row.r_dt_rec);
  return (
    <>
      <h2 className="text-2xl font-extrabold mb-4">สรุปงาน</h2>
      <div className="space-y-2 text-sm md:text-base">
        <p><span className="font-semibold">เลขที่ใบงาน :</span> {fmt(row.r_job_num)}</p>
        <p><span className="font-semibold">วันเวลาที่บันทึก :</span> {created.date} {created.time}</p>
        <p><span className="font-semibold">หมายเลขรถ / ทะเบียน :</span> {fmt(row.r_v_name ?? row.r_v_plate)}</p>
        <p className="break-words"><span className="font-semibold">รายการซ่อม :</span> {fmt(row.r_repair_list)}</p>
        <p><span className="font-semibold">ไมล์ :</span> {fmt(row.r_mile)}</p>
        <p><span className="font-semibold">ผู้ซ่อม :</span> {fmt(row.r_technician)}</p>
        <p><span className="font-semibold">ผู้บันทึก :</span> {fmt(row.r_recorder)}</p>
      </div>
      <div className="mt-6">
        <p className="font-semibold mb-2">รายงานการปฏิบัติงาน</p>
        <textarea className="w-full h-48 rounded-xl bg-blue-50/60 outline-none p-4" placeholder="พิมพ์รายงานการปฏิบัติงาน..." />
      </div>
      <div className="mt-4 flex gap-3">
        <button className="ml-auto px-5 py-2 rounded-xl text-white bg-gradient-to-r from-sky-500 to-blue-500 hover:opacity-90">ออก</button>
      </div>
    </>
  );
}
