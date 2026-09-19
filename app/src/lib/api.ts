const BASE = (import.meta as any).env?.VITE_API_URL || "";
const safe = async (path: string) => {
  if (!BASE) return null;                 // indexer not deployed yet -> no-op
  try { const r = await fetch(BASE + path); return r.ok ? await r.json() : null; }
  catch { return null; }
};
export const api = {
  leaderboard: (range: "daily"|"monthly"|"alltime", limit=100) => safe(`/leaderboard?range=${range}&limit=${limit}`),
  profile: (a: string) => safe(`/profile/${a}`),
  overview: () => safe(`/overview`),
};