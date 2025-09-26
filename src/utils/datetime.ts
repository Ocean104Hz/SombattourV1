export const parseDate = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
};

export const toDateTime = (s?: string) => {
  if (!s) return { date: "-", time: "-" };
  const d = parseDate(s);
  if (!d) return { date: s, time: "-" };
  return {
    date: d.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" }),
    time: d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const fmt = (v: unknown, fallback="-") => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return v === 0 ? fallback : String(v);
  const s = String(v).trim();
  return s === "" || s === "0" ? fallback : s;
};
