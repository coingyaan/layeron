import "dotenv/config";
import express from "express";
import { getAddress } from "viem";
import { daily, monthly, allTime, profile } from "../src/leaderboard.js";
import { q } from "../src/db.js";
const app = express();
app.get("/leaderboard", async (req, res) => {
  const range = String(req.query.range || "alltime");
  const limit = Math.min(Number(req.query.limit || 100), 500);
  try {
    const rows = range === "daily" ? await daily(limit) : range === "monthly" ? await monthly(limit) : await allTime(limit);
    res.json({ range, rows });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});
app.get("/profile/:address", async (req, res) => {
  try { res.json(await profile(getAddress(req.params.address))); }
  catch { res.status(400).json({ error: "bad address" }); }
});
app.get("/overview", async (_req, res) => {
  const users = (await q("SELECT COUNT(*)::int c FROM users")).rows[0].c;
  const gms = (await q("SELECT COUNT(*)::int c FROM gms")).rows[0].c;
  const xp = (await q("SELECT COALESCE(SUM(xp),0)::bigint s FROM users")).rows[0].s;
  const usdc = (await q("SELECT COALESCE(SUM(fee),0)::bigint s FROM gms")).rows[0].s;
  res.json({ totalUsers: users, totalGms: gms, totalXp: xp, usdcCollected: usdc });
});
app.listen(Number(process.env.API_PORT || 8787), () => console.log("api on", process.env.API_PORT || 8787));
