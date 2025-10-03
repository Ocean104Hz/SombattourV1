const API_BASE = (import.meta as any).env.VITE_API_BASE_URL as string;
const API_TOKEN = (import.meta as any).env.VITE_API_TOKEN as string | undefined;

export function buildURL(path: string, params?: Record<string, any>) {
  const url = new URL(`${API_BASE}/${path.replace(/^\/+/, "")}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
  }
  return url.toString();
}

export async function safeFetch<T>(path: string, params?: Record<string, any>): Promise<T> {
  const url = buildURL(path, params);
  const headers: Record<string, string> = {};
  if (API_TOKEN) headers["X-Token"] = API_TOKEN;

  const res = await fetch(url, { headers, credentials: "omit" });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}\n${text.slice(0, 200)}`);
  if (!(res.headers.get("content-type") || "").includes("application/json"))
    throw new Error(`Not JSON: ${text.slice(0, 200)}`);

  return JSON.parse(text) as T;
}
