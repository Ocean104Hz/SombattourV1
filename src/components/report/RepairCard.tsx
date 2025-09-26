import { FiTool } from "react-icons/fi";
import type { RepairRow } from "@/types/repair";
import { fmt } from "@/utils/datetime";

export default function RepairCard({
  order, row, toDateTime, onOpen,
}: {
  order: number;
  row: RepairRow;
  toDateTime: (s?: string) => { date: string; time: string };
  onOpen: () => void;
}) {
  const dt = toDateTime(row.r_dt_rec);
  return (
    <div className="bg-white text-gray-900 rounded-xl shadow w-auto max-w-4xl">
      <div className="bg-sky-300 text-gray-800 rounded-t-xl px-4">
        <p className="text-2xl font-bold whitespace-nowrap">
          <span className="font-bold">ลำดับ: </span>{order}
        </p>
      </div>
      <div className="px-4 py-2">
        <p className="text-md break-words"><span>เลขที่ใบงาน : </span> {fmt(row.r_job_num)}</p>
        <p className="text-md break-words"><span>วันเวลาที่บันทึก : </span> {dt.date} {dt.time}</p>
        <p className="text-md break-words font-bold"><span className="font-bold">หมายเลขรถ : </span> {fmt(row.r_v_name ?? row.r_v_plate)}</p>
        <p className="text-md break-words font-bold"><span className="font-bold">รายการซ่อม : </span> {fmt(row.r_repair_list)}</p>
        <p className="text-md break-words"><span>ไมล์ : </span> {fmt(row.r_mile)}</p>
        <p className="text-md break-words"><span>ผู้ซ่อม : </span> {fmt(row.r_technician)}</p>
      </div>
      <div className="flex justify-end mb-2 mx-2">
        <button
          className="text-gray-100 p-2 rounded-lg cursor-pointer bg-gradient-to-r from-sky-500 to-blue-500 hover:opacity-90"
          onClick={onOpen} title="ดูรายละเอียด"
        ><FiTool size={20} /></button>
      </div>
    </div>
  );
}
