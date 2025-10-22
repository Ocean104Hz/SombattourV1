
// แถวหลักจากตารางซ่อม
export type RepairRow = {
  r_id: string | number;
  r_job_num?: string;

  // วัน-เวลาเปิด/ปิดงาน
  r_dt_rec?: string;            
  r_dt_close?: string;          
  r_close_dt?: string;

  // รถ/ทะเบียน/ตัวถัง ฯลฯ
  r_v_plate?: string;           
  r_v_province?: string;        
  r_v_chassis?: string;         
  r_v_name?: string;            


  r_v_brand?: string;           
  r_v_model?: string;           
  r_v_series?: string;          
  r_v_note?: string;            
  r_v_metr?: string | number;   
  r_v_len_m?: string | number;  

  // ข้อมูลงาน/ผู้เกี่ยวข้อง
  r_repair_list?: string;       
  r_recorder?: string;          
  r_technician?: string;        

  // ฝั่งธุรการ
  r_v_company?: string;         
  r_inv_com?: string;           
  r_inv_com_id?: string;        
  r_contractor?: string;        
  r_billing_to?: string;        

  // รายงานปฏิบัติงาน (ถ้ามีเก็บไว้ใน DB)
  r_work_report?: string;

  r_perform_rep?: string;

  // สถานะปิดงาน
  r_close?: "0" | "1" | number; 

  // อื่น ๆ
  r_mile?: string | number;     
};

// อะไหล่ที่เบิกในงาน
export type PartRow = {
  id: string;
  createdAt: string;           
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
  createdAt: string;           
  name: string;
  qty: number;
  unit: string;
};

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

export const vehicleLengthText = (row: Partial<RepairRow>) => {
  const raw = (row.r_v_metr ?? row.r_v_len_m ?? "") as string | number;
  const s = String(raw ?? "").trim();
  return s ? `${s} เมตร` : "";
};
