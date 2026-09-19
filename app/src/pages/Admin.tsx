import React, { useEffect, useState } from "react";
import { adminActions, readCfg, ROLE } from "../lib/adminActions";
import { useOverview, useSession } from "../hooks";

/**
 * Real admin dashboard. Reads live values from LayeronConfig + the indexer overview.
 * Every change is a signed onchain tx (confirm -> signature -> tx -> receipt -> re-read).
 * Immutable / hardcoded values are shown read-only. No frontend-only settings.
 */
export default function Admin({ chain }: { chain: any }) {
  const cfg = chain.contracts.layeronConfig as `0x${string}`;
  const s = useSession();
  const ov = useOverview();
  const [v, setV] = useState<any>({});
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState("");

  async function refresh() {
    if (!cfg) return;
    const [fee, dev, rew, dBps, rBps, xp, maxXp, minFee, maxFee, usdc, paused, admin, pending] = await Promise.all([
      readCfg(cfg, "gmFee"), readCfg(cfg, "devWallet"), readCfg(cfg, "rewardWallet"),
      readCfg(cfg, "devBps"), readCfg(cfg, "rewardBps"), readCfg(cfg, "xpPerGm"),
      readCfg(cfg, "MAX_XP_PER_GM"), readCfg(cfg, "MIN_FEE"), readCfg(cfg, "MAX_FEE"),
      readCfg(cfg, "usdc"), readCfg(cfg, "gmPaused"), readCfg(cfg, "defaultAdmin"), readCfg(cfg, "pendingDefaultAdmin"),
    ]);
    setV({ fee, dev, rew, dBps, rBps, xp, maxXp, minFee, maxFee, usdc, paused, admin, pending });
    setF((p: any) => ({ ...p, fee: String(fee), dev, rew, dBps: String(dBps), rBps: String(rBps), xp: String(xp) }));
  }
  useEffect(() => { refresh().catch(() => {}); }, [cfg]);

  const run = async (name: string, fn: () => Promise<any>) => {
    if (!confirm(`Confirm onchain change: ${name}? A wallet signature will be requested.`)) return;
    setBusy(name); try { await fn(); await refresh(); } finally { setBusy(""); }
  };

  const bpsSum = Number(f.dBps || 0) + Number(f.rBps || 0);
  const H = { margin: "34px 0 8px", fontFamily: "var(--disp)" } as const;
  const row = { display: "flex", gap: 12, alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap" as const };
  const inp = { background: "var(--s2)", border: "1px solid var(--line-2)", borderRadius: 8, color: "var(--ink)", padding: "8px 10px", fontFamily: "var(--mono)" } as const;
  const ro = { fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-2)" } as const;
  const tag = { fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase" as const, letterSpacing: ".1em" };

  return (
    <section className="screen on"><div className="wrap" style={{ paddingBottom: 120 }}>
      <div className="page-top"><div><h1>Admin</h1><div className="sub">every change is a signed onchain transaction</div></div></div>

      <h3 style={{ ...H, marginTop: 18 }}>overview</h3>
      <div className="stats" style={{ marginTop: 8, gap: 40 }}>
        <div className="stat"><span className="k">total users</span><span className="v">{ov.data?.totalUsers ?? "—"}</span></div>
        <div className="stat"><span className="k">total gms</span><span className="v">{ov.data?.totalGms ?? "—"}</span></div>
        <div className="stat"><span className="k">xp issued</span><span className="v">{ov.data?.totalXp ?? "—"}</span></div>
        <div className="stat"><span className="k">usdc collected</span><span className="v">{ov.data ? (Number(ov.data.usdcCollected) / 1e6).toFixed(2) : "—"}</span></div>
      </div>

      <h3 style={H}>protocol · configurable (CONFIG_ROLE)</h3>
      <div style={row}><span className="k" style={{ width: 180 }}>gm fee (6dec)</span>
        <input style={{ ...inp, width: 320 }} value={f.fee || ""} onChange={(e) => setF({ ...f, fee: e.target.value })} />
        <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("setGmFee", () => adminActions.setGmFee(cfg, BigInt(f.fee)))}>update</button>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>min {String(v.minFee)} · max {String(v.maxFee)}</span></div>
      <div style={row}><span className="k" style={{ width: 180 }}>fee allocation (bps)</span>
        <input style={{ ...inp, width: 110 }} value={f.dBps || ""} onChange={(e) => setF({ ...f, dBps: e.target.value.replace(/\D/g, "") })} placeholder="dev" />
        <input style={{ ...inp, width: 110 }} value={f.rBps || ""} onChange={(e) => setF({ ...f, rBps: e.target.value.replace(/\D/g, "") })} placeholder="reward" />
        <button className="btn btn-line btn-sm" disabled={!!busy || bpsSum !== 10000} onClick={() => run("setAllocation", () => adminActions.setAllocation(cfg, Number(f.dBps), Number(f.rBps)))}>update</button>
        <span style={{ fontSize: 12, color: bpsSum === 10000 ? "var(--ink-3)" : "var(--err)" }}>must sum to 10000 · {bpsSum}</span></div>
      <div style={row}><span className="k" style={{ width: 180 }}>xp per gm</span>
        <input style={{ ...inp, width: 110 }} value={f.xp || ""} onChange={(e) => setF({ ...f, xp: e.target.value.replace(/\D/g, "") })} />
        <button className="btn btn-line btn-sm" disabled={!!busy || Number(f.xp) > Number(v.maxXp)} onClick={() => run("setXpPerGm", () => adminActions.setXpPerGm(cfg, BigInt(f.xp)))}>update</button>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>max {String(v.maxXp)} (read-only cap)</span></div>
      <div style={row}><span className="k" style={{ width: 180 }}>dev wallet</span>
        <input style={{ ...inp, width: 380 }} value={f.dev || ""} onChange={(e) => setF({ ...f, dev: e.target.value })} />
        <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("setDevWallet", () => adminActions.setDevWallet(cfg, f.dev))}>update</button></div>
      <div style={row}><span className="k" style={{ width: 180 }}>reward wallet</span>
        <input style={{ ...inp, width: 380 }} value={f.rew || ""} onChange={(e) => setF({ ...f, rew: e.target.value })} />
        <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("setRewardWallet", () => adminActions.setRewardWallet(cfg, f.rew))}>update</button></div>

      <h3 style={H}>immutable · read-only</h3>
      <div style={row}><span className="k" style={{ width: 180 }}>USDC (settlement)</span><span style={ro}>{v.usdc}</span><span style={tag}>fixed at deploy · no setter</span></div>
      <div style={row}><span className="k" style={{ width: 180 }}>MIN_FEE / MAX_FEE</span><span style={ro}>{String(v.minFee)} / {String(v.maxFee)}</span><span style={tag}>constant · upgrade only</span></div>
      <div style={row}><span className="k" style={{ width: 180 }}>MAX_XP_PER_GM</span><span style={ro}>{String(v.maxXp)}</span><span style={tag}>constant · upgrade only</span></div>
      <div style={row}><span className="k" style={{ width: 180 }}>UTC day / one-per-day / XP-once</span><span style={ro}>hardcoded</span><span style={tag}>protocol invariant · upgrade only</span></div>

      <h3 style={H}>security · roles</h3>
      <div style={row}><span className="k" style={{ width: 180 }}>DEFAULT_ADMIN_ROLE</span><span style={ro}>{v.admin}</span>
        <span style={tag}>two-step, {String((v.pending && v.pending[0] !== "0x0000000000000000000000000000000000000000") ? "TRANSFER PENDING" : "no pending")}</span></div>
      {v.pending && v.pending[0] !== "0x0000000000000000000000000000000000000000" &&
        <div style={row}><span className="k" style={{ width: 180 }}>pending admin</span><span style={ro}>{v.pending[0]}</span>
          <span style={tag}>accept at unix {String(v.pending[1])}</span>
          <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("acceptDefaultAdminTransfer", () => adminActions.acceptDefaultAdminTransfer(cfg))}>accept</button>
          <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("cancelDefaultAdminTransfer", () => adminActions.cancelDefaultAdminTransfer(cfg))}>cancel</button></div>}
      <div style={row}><span className="k" style={{ width: 180 }}>UPGRADER_ROLE</span><span style={ro}>LayeronTimelock ({chain.contracts.layeronConfig ? "" : ""}see deployment)</span><span style={tag}>upgrades only · timelock delay</span></div>
      <div style={row}><span className="k" style={{ width: 180 }}>begin admin transfer</span>
        <input style={{ ...inp, width: 380 }} value={f.newAdmin || ""} onChange={(e) => setF({ ...f, newAdmin: e.target.value })} placeholder="new EOA or Gnosis Safe" />
        <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("beginDefaultAdminTransfer", () => adminActions.beginDefaultAdminTransfer(cfg, f.newAdmin))}>begin</button></div>
      <div style={row}><span className="k" style={{ width: 180 }}>grant / revoke role</span>
        <select style={{ ...inp, width: 130 }} value={f.role || "CONFIG"} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="CONFIG">CONFIG</option><option value="PAUSER">PAUSER</option><option value="UPGRADER">UPGRADER</option></select>
        <input style={{ ...inp, width: 300 }} value={f.roleWho || ""} onChange={(e) => setF({ ...f, roleWho: e.target.value })} placeholder="address" />
        <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("grantRole", () => adminActions.grantRole(cfg, (ROLE as any)[f.role || "CONFIG"], f.roleWho))}>grant</button>
        <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("revokeRole", () => adminActions.revokeRole(cfg, (ROLE as any)[f.role || "CONFIG"], f.roleWho))}>revoke</button></div>

      <h3 style={H}>emergency (PAUSER_ROLE)</h3>
      <div style={row}><span className="k" style={{ width: 180 }}>GM status</span><span style={ro}>{v.paused ? "PAUSED" : "active"}</span>
        <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("pauseGm", () => adminActions.pause(cfg))}>pause</button>
        <button className="btn btn-line btn-sm" disabled={!!busy} onClick={() => run("unpauseGm", () => adminActions.unpause(cfg))}>resume</button></div>

      {busy && <div style={{ marginTop: 20, color: "var(--ink-2)" }}>submitting {busy}… confirm in your wallet.</div>}
    </div></section>
  );
}
