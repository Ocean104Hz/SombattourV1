// src/types/repair.ts

// แถวหลักจากตารางซ่อม
export type RepairRow = {
  r_id: string | number;
  r_job_num?: string;

  // วัน-เวลาเปิด/ปิดงาน
  r_dt_rec?: string;            // เวลาเปิด/บันทึกงาน (ISO/string)
  r_dt_close?: string;          // เวลา "ปิดงาน" (ถ้ามี)
  r_close_dt?: string;

  // รถ/ทะเบียน/ตัวถัง ฯลฯ
  r_v_plate?: string;           // ทะเบียนรถ (เช่น 14-1854กทม)
  r_v_province?: string;        // จังหวัดทะเบียน (ถ้ามี)
  r_v_chassis?: string;         // เลขตัวถัง / VIN
  r_v_name?: string;            // ชื่อเรียกรถ (บางฐานใช้ฟิลด์นี้เป็นชื่อรถ)

  // ยี่ห้อ/รุ่น/ซีรีส์/หมายเหตุ และความยาวรถ (เมตร)
  r_v_brand?: string;           // ยี่ห้อ (เช่น SCANIA)
  r_v_model?: string;           // รุ่น (เช่น K-Series)
  r_v_series?: string;          // รุ่นย่อย/ซีรีส์ (ถ้ามี)
  r_v_note?: string;            // โน้ตสั้น ๆ (เช่น "no clutch")
  r_v_metr?: string | number;   // ความยาวรถ (เมตร) — alias ที่บางฐานใช้
  r_v_len_m?: string | number;  // ความยาวรถ (เมตร) — บางฐานใช้ชื่อนี้

  // ข้อมูลงาน/ผู้เกี่ยวข้อง
  r_repair_list?: string;       // รายการซ่อม (ข้อความยาว)
  r_recorder?: string;          // ผู้ออกบันทึก
  r_technician?: string;        // ช่างผู้รับผิดชอบ

  // ฝั่งธุรการ
  r_v_company?: string;         // ผู้ประกอบการ
  r_inv_com?: string;           // ชื่อบริษัทวางบิล (ถ้ามาเป็นชื่อ)
  r_inv_com_id?: string;        // ไอดีบริษัทวางบิล (ถ้ามาเป็นเลข)
  r_contractor?: string;        // ผู้ประกอบการ (เผื่อฐานเก่า)
  r_billing_to?: string;        // วางบิลให้ใคร (เผื่อฐานเก่า)

  // รายงานปฏิบัติงาน (ถ้ามีเก็บไว้ใน DB)
  r_work_report?: string;

  r_perform_rep?: string;

  // สถานะปิดงาน
  r_close?: "0" | "1" | number; // 0 = เปิดงาน, 1 = ปิดงาน (บางฐานเป็นตัวเลข/สตริง)

  // อื่น ๆ
  r_mile?: string | number;     // ระยะไมล์ (บางฐานเป็นตัวเลข)
};

// อะไหล่ที่เบิกในงาน
export type PartRow = {
  id: string;
  createdAt: string;           // ISO/string
  partId: string;
  partCode: string;
  partName: string;
  lotId: string;
  qty: number;
  unit: string;
};

// ค่าใช้จ่ายอื่น ๆ ในงาน
export type ExpenseRow = {
  id: string;
  createdAt: string;           // ISO/string
  name: string;
  qty: number;
  unit: string;
};

// รูปแบบข้อมูลที่ UI ใช้รวม (ถ้าต้องการ)
export type RepairItem = RepairRow & {
  parts?: PartRow[];
  expenses?: ExpenseRow[];
};

// ฟังก์ชันช่วย: แปลง r_close → boolean
export const isClosed = (row: Pick<RepairRow, "r_close"> | undefined) => {
  if (!row) return false;
  const v = row.r_close;
  if (typeof v === "number") return v === 1;
  return v === "1";
};

/**
 * ช่วยอ่าน "ความยาวรถ (เมตร)" จากทั้ง r_v_metr / r_v_len_m
 * คืนค่าเป็นสตริงที่พร้อมแสดง เช่น "12 เมตร" หรือ ""
 */
export const vehicleLengthText = (row: Partial<RepairRow>) => {
  const raw = (row.r_v_metr ?? row.r_v_len_m ?? "") as string | number;
  const s = String(raw ?? "").trim();
  return s ? `${s} เมตร` : "";
};
