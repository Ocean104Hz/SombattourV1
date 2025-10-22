
import type { RepairRow } from "@/types/repair";

const NOT_FINISHED_RE = /^(|0000-00-00(?: 00:00:00)?|working\.\.\.|-)\s*$/i;

export function normalize(v?: string | number | null) {
  return String(v ?? "").trim();
}

export function isClosedByCloseDt(row: RepairRow) {
  const raw = normalize((row as any).r_close_dt);
  if (!raw || NOT_FINISHED_RE.test(raw)) return false; 
  const d = new Date(raw);
  return !isNaN(d.getTime());                           
}

export function closeTextTH(row: RepairRow) {
  const raw = normalize((row as any).r_close_dt);
  if (!raw || NOT_FINISHED_RE.test(raw)) return "Working...";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return `${d.toLocaleDateString("th-TH")} ${d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

export function cleanZeroLike(v?: string | number | null) {
  const s = normalize(v);
  return /^(|0000-00-00(?: 00:00:00)?)$/.test(s) ? "" : s;
}
