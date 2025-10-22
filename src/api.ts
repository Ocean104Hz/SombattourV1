
const RAW = import.meta.env.VITE_API_BASE || "";
const API_BASE = RAW.replace(/\/+$/, "");

export async function fetchRepairs(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)));
  const url = `${API_BASE}/list_repair.php${qs.toString() ? `?${qs}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
