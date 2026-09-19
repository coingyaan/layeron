import { q } from "./db.js";
// UTC day / month are computed in SQL from the event timestamp — never browser time.
const UTC_DAY = "floor(extract(epoch from now())/86400)::int";
export async function daily(limit = 100) {
  return (await q(
    `SELECT address, SUM(xp_awarded)::bigint AS xp, MAX(utc_day) AS utc_day
     FROM gms WHERE utc_day = ${UTC_DAY} GROUP BY address
     ORDER BY xp DESC LIMIT $1`, [limit])).rows;
}
export async function monthly(limit = 100) {
  return (await q(
    `SELECT address, SUM(xp_awarded)::bigint AS xp
     FROM gms WHERE to_char(ts,'YYYY-MM') = to_char(now() AT TIME ZONE 'UTC','YYYY-MM')
     GROUP BY address ORDER BY xp DESC LIMIT $1`, [limit])).rows;
}
export async function allTime(limit = 100) {
  return (await q(
    `SELECT address, xp, streak, longest_streak, total_gms FROM users ORDER BY xp DESC LIMIT $1`, [limit])).rows;
}
export async function profile(address: string) {
  const u = (await q("SELECT * FROM users WHERE address = $1", [address])).rows[0] || null;
  const rank = u ? (await q("SELECT COUNT(*)+1 AS rank FROM users WHERE xp > $1", [u.xp])).rows[0].rank : null;
  return { ...u, rank };
}
