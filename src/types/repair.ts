// src/types/repair.ts

// แถวหลักจากตารางซ่อม
export type RepairRow = {
  r_id: string | number;
  r_job_num?: string;
  r_dt_rec?: string;          // วันที่รับงาน (ISO/string)
  r_v_plate?: string;         // ทะเบียนรถ
  r_close?: "0" | "1" | number; // 0=เปิดงาน, 1=ปิดงาน, หรือเลข
  r_repair_list?: string;     // รายการซ่อม (ข้อความยาว)
  r_recorder?: string;        // ผู้ออกบันทึก
  r_technician?: string;      // ช่างผู้รับผิดชอบ
  r_v_name?: string;          // ชื่อรถ/รุ่น
  r_mile?: string;            // ระยะไมล์
};

// อะไหล่ที่เบิกในงาน
export type PartRow = {
  id: string;
  createdAt: string;          // ISO/string
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
  createdAt: string;          // ISO/string
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
