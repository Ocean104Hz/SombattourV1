
import type { RepairRow } from "@/types/repair";
import { fmt } from "@/utils/datetime";
import { cleanZeroLike, closeTextTH } from "@/utils/repair";

type Props = { row: RepairRow; order?: number };

/* ---------- helpers ---------- */
function thDateTime(iso?: string) {
  const raw = cleanZeroLike(iso);
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return fmt(raw);
  const date = d.toLocaleDateString("th-TH");
  const time = d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} ${time}`;
}

/** สร้างข้อความแบบมี “ช่อง” คงที่ n ช่อง (ถ้าว่างเว้นช่อง) */
function fixedSlots(slots: Array<string | undefined | null>, n: number) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const v = (slots[i] ?? "").toString().trim();
    out.push(v ? v : " ");
  }
  return out.join("  ");
}

/* ---------- UI ---------- */
export default function SummaryPanel({ row, order }: Props) {
  /* 1) รายการที่ : <ลำดับ>  <เลขใบงาน / เลขใบงาน> */
  const orderStr = order ? String(order) : " ";
  const job = fmt(row.r_job_num);
  const lineOrder = fixedSlots([orderStr, job ? `${job} / ${job}` : " "], 2);

  /* 2) เปิด-ปิดงาน : <วันเวลาเปิด> - <วันเวลาปิด|Working...>  (ใช้ r_close_dt) */
  const openStr = thDateTime(row.r_dt_rec) || " ";
  const closeStr = closeTextTH(row); 
  const lineOpenClose = `${openStr} - ${closeStr}`;

  /* 3) ยานพาหนะ : <ชื่อรถ>  <ทะเบียน>  <เลขตัวถัง> */
  const lineVehicle = fixedSlots(
    [fmt(cleanZeroLike(row.r_v_name)), fmt(row.r_v_plate), fmt(row.r_v_chassis)],
    3
  );

  /* 4) ยี่ห้อ : <ยี่ห้อ>  <รุ่น>  <ซีรีส์/หมายเหตุ>  <ความยาว เมตร> */
  const lenRaw = (row.r_v_metr ?? row.r_v_len_m ?? "") as string | number;
  const lenText = String(lenRaw ?? "").trim() ? `${String(lenRaw).trim()} เมตร` : "";
  const lineBrand = fixedSlots(
    [fmt(row.r_v_brand), fmt(row.r_v_model), fmt((row as any).r_v_series || row.r_v_note), lenText],
    4
  );

  /* 5) ผู้ประกอบการ : <ผู้ประกอบการ> / วางบิล : <ชื่อผู้วางบิล(ไม่ใช้ตัวเลขล้วน)> */
  const contr = fmt(row.r_v_company || row.r_contractor) || " ";
  const billRaw =
    fmt((row as any).r_inv_com) ||
    fmt((row as any).r_inv_com_name) ||
    fmt(row.r_billing_to) ||
    "";
  const bill = billRaw && !/^[0-9]+$/.test(billRaw) ? billRaw : "";
  const lineContractor = bill ? `${contr}  /  วางบิล : ${bill}` : contr;

  /* 6) รายการซ่อม : */
  const lineRepair = fmt(row.r_repair_list) || " ";

  return (
    <>
      <h2 className="text-2xl font-extrabold mb-4">สรุปงาน</h2>

      {/* ฟอนต์เลขแบบ tabular เพื่อให้เว้นช่องคงที่, ทุก value เป็นบรรทัดเดียว */}
      <div className="text-[15px] leading-7 font-[450] [font-variant-numeric:tabular-nums]">
        <Row label="รายการที่" value={lineOrder} />
        <Row label="เปิด-ปิดงาน" value={lineOpenClose} />
        <Row label="ยานพาหนะ" value={lineVehicle} />
        <Row label="ยี่ห้อ" value={lineBrand} />
        <Row label="ผู้ประกอบการ" value={lineContractor} />
        <Row label="รายการซ่อม" value={lineRepair} multiline />
      </div>
    </>
  );
}

/* 1 บรรทัด: label : value (บังคับไม่ตัดบรรทัด ยกเว้น multiline) */
function Row({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] sm:grid-cols-[110px_1fr] lg:grid-cols-[120px_1fr] gap-2 items-start">
      <div className="font-semibold text-gray-800 whitespace-nowrap">{label} :</div>
      <div
        className={
          multiline
            ? "whitespace-pre-wrap break-words"
            : "whitespace-normal break-words lg:whitespace-nowrap lg:overflow-hidden lg:text-ellipsis"
        }
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
