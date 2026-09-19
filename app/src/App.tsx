import React, { useEffect, useState } from "react";
import { useSession, useProfile, useLeaderboard } from "./hooks";
import { runGm, canGm } from "./lib/services/gm";
import { openFunding, FUNDING_LABEL } from "./lib/services/funding";
import { txUrl } from "./lib/services/explorer";
import { defaultChain } from "./lib/registry";
import Admin from "./pages/Admin";

type Screen = "home" | "leaderboard" | "profile" | "admin";
type GmState = "ready" | "pending" | "confirmed" | "done" | "failed";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function App() {
  const s = useSession();
  const [screen, setScreen] = useState<Screen>("home");
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(false);
  const chain = s.active;

  // wallet gate: disconnected shows the landing
  if (!s.isConnected) return <Landing onConnect={() => setModal(true)} modal={modal} setModal={setModal} />;

  return (
    <>
      <Nav screen={screen} setScreen={setScreen} address={s.address} chain={chain}
           menu={menu} setMenu={setMenu} onDisconnect={() => { s.disconnect(); setMenu(false); }} />
      {!s.onSupported && <WrongNetwork chain={chain} onSwitch={() => s.switchChain({ chainId: chain.chainId })} />}
      {screen === "home" && <Home s={s} />}
      {screen === "leaderboard" && <Leaderboard me={s.address} />}
      {screen === "profile" && <Profile address={s.address!} />}
      {screen === "admin" && <Admin chain={chain} />}
      {modal && <WalletModal s={s} onClose={() => setModal(false)} />}
    </>
  );
}

/* ---------------- landing (disconnected) ---------------- */
function Landing({ onConnect, modal, setModal }: any) {
  const s = useSession();
  return (
    <>
      <nav className="nav"><div className="wrap">
        <a className="wordmark"><span className="logo-img"></span>layeron</a>
        <div className="nav-r">
          <span className="net">arc mainnet<span className="status-dot"></span></span>
          <button className="btn btn-line btn-sm" onClick={onConnect}>connect wallet</button>
        </div>
      </div></nav>
      <section className="screen on"><div className="land"><div className="wrap anim">
        <div className="eyebrow"><span className="status-dot"></span>onchain participation · reputation</div>
        <h1>SHOW UP.<br /><span className="l2">BUILD REPUTATION.</span></h1>
        <p className="lead">a daily onchain ritual. show up, keep your streak, and build a reputation that lives onchain.</p>
        <div className="land-cta">
          <button className="btn btn-light" onClick={onConnect}>connect wallet
            <svg className="ico" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
          <span className="eyebrow">arc mainnet</span>
        </div>
      </div></div></section>
      {modal && <WalletModal s={s} onClose={() => setModal(false)} />}
    </>
  );
}

/* ---------------- nav + wallet menu ---------------- */
function Nav({ screen, setScreen, address, chain, menu, setMenu, onDisconnect }: any) {
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".wallet-wrap")) setMenu(false); };
    document.addEventListener("click", close); return () => document.removeEventListener("click", close);
  }, []);
  return (
    <nav className="nav"><div className="wrap">
      <a className="wordmark" onClick={() => setScreen("home")}><span className="logo-img"></span>layeron</a>
      <div className="nav-r">
        <button className="nav-lnk hide-sm" onClick={() => setScreen("leaderboard")}>Leaderboard</button>
        <a className="nav-lnk hide-sm" onClick={() => openFunding(chain)}>{FUNDING_LABEL}</a>
        <span className="net">arc mainnet<span className="status-dot"></span></span>
        <div className="wallet-wrap">
          <button className="wid" onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}>
            <span className="logo-img mk"></span><span className="mono">{short(address)}</span>
            <svg className="ico" style={{ width: 14, height: 14, color: "var(--ink-3)" }} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {menu && (
            <div className="wallet-menu">
              <button className="wm-item" onClick={() => { navigator.clipboard?.writeText(address); setMenu(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>copy address</button>
              <button className="wm-item" onClick={() => { setScreen("profile"); setMenu(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>profile</button>
              <div className="wm-sep"></div>
              <button className="wm-item danger" onClick={onDisconnect}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>disconnect wallet</button>
            </div>
          )}
        </div>
      </div>
    </div></nav>
  );
}

function WrongNetwork({ chain, onSwitch }: any) {
  return (
    <div className="wrap" style={{ paddingTop: 20 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", padding: 16, border: "1px solid var(--acc-line)", borderRadius: 12, background: "var(--grad-soft)" }}>
        <span style={{ color: "var(--ink)" }}>you are connected to an unsupported network.</span>
        <button className="btn btn-line btn-sm" onClick={onSwitch}>switch to {chain.displayName.toLowerCase()}</button>
      </div>
    </div>
  );
}

/* ---------------- GM home (the ritual) ---------------- */
function Home({ s }: any) {
  const chain = s.active;
  const [gm, setGm] = useState<GmState>("ready");
  const [tx, setTx] = useState<string | null>(null);
  const [xp, setXp] = useState<bigint>(0n);
  const [cd, setCd] = useState("00:00:00");
  const prof = useProfile(s.address);
  const p = prof.data || {};
  const streak = Number(p.streak ?? 0), xpTotal = Number(p.xp ?? 0), gms = Number(p.total_gms ?? 0), rank = p.rank ?? "—";

  useEffect(() => {
    if (!s.address || !chain.contracts.layeronGM) return;
    canGm(chain, s.address as `0x${string}`).then((ok) => { if (!ok) setGm("done"); }).catch(() => {});
  }, [s.address]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date(); const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) / 1000;
      let sec = Math.floor(end - Date.now() / 1000);
      setCd(`${String(sec/3600|0).padStart(2,"0")}:${String(sec%3600/60|0).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`);
    }, 1000); return () => clearInterval(t);
  }, []);

  async function doGm() {
    if (gm !== "ready" && gm !== "failed") return;
    if (!s.onSupported) { try { await s.switchChainAsync({ chainId: chain.chainId }); } catch { setGm("failed"); return; } }
    setGm("pending");
    try {
      const r = await runGm(chain, s.address as `0x${string}`);
      if (!r.ok) { setGm("failed"); openFunding(chain); return; }  // insufficient usdc -> jumper
      setTx(r.hash); setXp(r.xpAwarded); setGm("confirmed");
      setTimeout(() => setGm("done"), 3000);
      prof.refetch();
    } catch { setGm("failed"); }
  }

  return (
    <section className="screen on"><div className="stage">
      <div className="streak-top"><span className="n">{streak}</span><span className="l">day streak</span></div>
      <div className={`gm-core ${gm}`}>
        <button className="gm-word" onClick={doGm}>gm</button>
        <svg className="gm-mark" viewBox="0 0 132 150" aria-hidden="true">
          <path className="ch c1" d="M18 34 L66 66 L114 34"/><path className="ch c2" d="M18 72 L66 104 L114 72"/><path className="ch c3" d="M18 110 L66 142 L114 110"/>
        </svg>
        <div className="gm-complete">gm complete</div>
        {gm === "confirmed" && (
          <div className="gm-reward" style={{ display: "flex" }}>
            <span className="rx grad-text">+{xp.toString()} XP</span>
            <span className="rs">{tx && <a href={txUrl(chain, tx)} target="_blank" rel="noreferrer" style={{ color: "var(--ink-2)" }}>view on explorer ↗</a>}</span>
          </div>
        )}
        <div className="gm-sub">{gm === "pending" ? "confirming onchain…" : gm === "failed" ? "" : "tap to gm"}</div>
        {gm === "failed" && <div className="gm-fail" style={{ display: "block" }}>
          transaction failed or insufficient usdc. <a onClick={() => openFunding(chain)} style={{ color: "var(--ink)", cursor: "pointer" }}>{FUNDING_LABEL}</a></div>}
        {gm === "done" && <div className="gm-cd" style={{ display: "flex" }}>
          <div className="lbl">next gm in</div><div className="val">{cd}</div><div className="utc">00:00 utc reset</div></div>}
      </div>
      <div className="stats">
        <div className="stat"><span className="k">rank</span><span className="v">#{rank}</span></div>
        <div className="stat"><span className="k">xp</span><span className="v">{xpTotal.toLocaleString()}</span></div>
        <div className="stat"><span className="k">gms</span><span className="v">{gms.toLocaleString()}</span></div>
      </div>
      <div className="corner">
        <a onClick={() => {}}><svg className="ico" viewBox="0 0 24 24"><path d="M18 4 6 20M6 4l12 16" strokeWidth={2}/></svg>share on x</a>
        <a href="https://x.com/layeronapp" target="_blank" rel="noreferrer">follow @layeronapp</a>
        <a href={chain.explorerUrl || "#"} target="_blank" rel="noreferrer"><svg className="ico" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>explorer</a>
      </div>
    </div></section>
  );
}

/* ---------------- leaderboard ---------------- */
function Leaderboard({ me }: { me?: string }) {
  const [range, setRange] = useState<"daily"|"monthly"|"alltime">("alltime");
  const lb = useLeaderboard(range);
  const rows = lb.data?.rows || [];
  return (
    <section className="screen on"><div className="wrap" style={{ paddingBottom: 120 }}>
      <div className="page-top"><div><h1>Leaderboard</h1><div className="sub">reputation on arc mainnet</div></div>
        <div className="seg">
          {(["daily","monthly","alltime"] as const).map((r) =>
            <button key={r} className={range===r?"on":""} onClick={() => setRange(r)}>{r === "alltime" ? "all time" : r}</button>)}
        </div>
      </div>
      <div className="lb-list">
        {rows.length === 0 && <div style={{ padding: 40, color: "var(--ink-3)" }}>no activity yet.</div>}
        {rows.map((r: any, i: number) => (
          <div key={r.address} className={`lb-item ${i<3?"top3":""} ${me && r.address?.toLowerCase()===me.toLowerCase()?"you":""}`}>
            <div className="rk">{String(i+1).padStart(2,"0")}</div>
            <div className="lb-w"><div><div className="mono">{short(r.address)}</div></div></div>
            <div className="streak">{r.streak ?? ""}{r.streak?<span className="u"> day streak</span>:""}</div>
            <div className="xp">{Number(r.xp).toLocaleString()} XP</div>
          </div>
        ))}
      </div>
    </div></section>
  );
}

/* ---------------- profile ---------------- */
function Profile({ address }: { address: string }) {
  const prof = useProfile(address); const p = prof.data || {};
  return (
    <section className="screen on"><div className="wrap" style={{ paddingBottom: 120 }}>
      <div className="rep">
        <div>
          <div className="rep-label"><span className="gd"></span>layeron reputation</div>
          <div className="rep-tier">GENESIS<br /><span className="grad-text">BUILDER</span></div>
          <div className="rep-addr"><span className="mono">{short(address)}</span></div>
          <div className="rep-metrics">
            <div className="rep-row"><span className="k">current streak</span><span className="v acc">{Number(p.streak ?? 0)} days</span></div>
            <div className="rep-row"><span className="k">longest streak</span><span className="v">{Number(p.longest_streak ?? 0)} days</span></div>
            <div className="rep-row"><span className="k">xp</span><span className="v">{Number(p.xp ?? 0).toLocaleString()}</span></div>
            <div className="rep-row"><span className="k">total gms</span><span className="v">{Number(p.total_gms ?? 0).toLocaleString()}</span></div>
            <div className="rep-row"><span className="k">rank</span><span className="v">#{p.rank ?? "—"}</span></div>
          </div>
        </div>
        <div className="rep-card">
          <span className="logo-img mk"></span>
          <div className="rc-name">layeron</div><div className="rc-sub">{short(address)}</div>
          <div className="rc-line"></div>
          <div className="rc-streak"><div className="n">{Number(p.streak ?? 0)}</div><div className="l">day streak</div></div>
          <div className="rc-badge"><span className="gt">◆ genesis builder</span></div>
        </div>
      </div>
    </div></section>
  );
}

/* wallet modal — real connectors, preserved design + logos */
function WalletModal({ s, onClose }: any) {
  const order = ["rabby", "metamask", "coinbase"];
  const label: any = { rabby: "Rabby", metamask: "MetaMask", coinbase: "Coinbase Wallet" };
  const pick = (key: string) => {
    const c = s.connectors.find((x: any) =>
      key === "coinbase" ? x.id.toLowerCase().includes("coinbase") : x.name.toLowerCase().includes(key) || x.id.toLowerCase().includes(key)) || s.connectors[0];
    s.connect({ connector: c }); onClose();
  };
  return (
    <div className="modal-ov" onClick={(e) => { if ((e.target as HTMLElement).className === "modal-ov") onClose(); }}>
      <div className="modal">
        <button className="modal-x" onClick={onClose}>×</button>
        <h2>connect wallet</h2><div className="msub">choose a wallet to continue.</div>
        <div className="wallet-list">
          {order.map((k) => (
            <button key={k} className="wallet-row" onClick={() => pick(k)}>
              <span className="wic"><svg><use href={`#w-${k}`} /></svg></span>
              <span className="wn">{label[k]}</span>
              <svg className="wch" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
