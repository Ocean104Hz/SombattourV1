// src/components/report/RepairCard.tsx
import { FiTool } from "react-icons/fi";
import type { RepairRow } from "@/types/repair";
import { fmt } from "@/utils/datetime";

type Props = {
  order: number;
  row: RepairRow;
  toDateTime: (s?: string) => { date: string; time: string };
  onOpen: () => void;
};

export default function RepairCard({ order, row, toDateTime, onOpen }: Props) {
  const dt = toDateTime(row.r_dt_rec);

  // โชว์ทะเบียนก่อน ถ้าไม่มีค่อย fallback เป็นชื่อรถ
  const vehicle =
    String(row.r_v_plate ?? "").trim() ||
    String(row.r_v_name ?? "").trim() ||
    "-";

  return (
    <div className="bg-white text-gray-900 rounded-xl shadow w-auto max-w-4xl">
      <div className="bg-sky-300 text-gray-800 rounded-t-xl px-4">
        <p className="whitespace-nowrap">
          <span className="">ลำดับ: </span>{order}
        </p>
      </div>

      <div className="px-4 py-2">
        <p className="text-md break-words">
          <span>เลขที่ใบงาน : </span>{fmt(row.r_job_num)}
        </p>
        <p className="text-md break-words">
          <span>วันเวลาที่บันทึก : </span>{dt.date} {dt.time}
        </p>
        <p className="text-md break-words">
          <span className="">หมายเลขรถ : </span><span className="text-2xl">{vehicle}</span>
        </p>
        <p className="text-md break-words ">
          <span className="">รายการซ่อม : </span><span className="text-blue-600">{fmt(row.r_repair_list)}</span>
        </p>
        <p className="text-md break-words">
          <span>ไมล์ : </span>{fmt(row.r_mile)}
        </p>
        <p className="text-md break-words">
          <span>ผู้ซ่อม : </span>{fmt(row.r_technician)}
        </p>
      </div>

      <div className="flex justify-end mb-2 mx-2">
        <button
          className="text-white p-2 rounded-lg cursor-pointer bg-gradient-to-r from-sky-500 to-blue-500 hover:opacity-90"
          onClick={onOpen}
          title="ดูรายละเอียด"
        >
          <FiTool size={20} />
        </button>
      </div>
    </div>
  );
}
