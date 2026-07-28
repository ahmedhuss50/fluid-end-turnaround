"use client";

import { useEffect, useMemo, useRef, useState, useReducer } from "react";

const HOLD_TO_PASS = 5; // seconds within variance to pass

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const s = polar(cx, cy, r, a0);
  const e = polar(cx, cy, r, a1);
  const large = Math.abs(a0 - a1) > 180 ? 1 : 0;
  // a0 > a1 (left->right over the top), sweep clockwise in screen coords
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}
function mmss(sec: number) {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Sim = { p: number; tAt: number; total: number; hist: { t: number; p: number }[]; status: string };

export default function PressureTest() {
  const [target, setTarget] = useState(15000);
  const [variance, setVariance] = useState(250);
  const [manual, setManual] = useState(false);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [running, setRunning] = useState(false);
  const [, force] = useReducer((x) => x + 1, 0);

  const sim = useRef<Sim>({ p: 0, tAt: 0, total: 0, hist: [], status: "idle" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const maxScale = useMemo(
    () => Math.max(10000, Math.ceil(((Number(target) || 0) * 2) / 5000) * 5000),
    [target]
  );

  // config mirror for the loop
  const cfg = useRef({ target, variance, manual, maxScale });
  cfg.current = { target: Number(target) || 0, variance: Number(variance) || 0, manual, maxScale };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = sim.current;
      const c = cfg.current;
      const dt = 0.1;
      if (!c.manual) {
        const noise = (Math.random() - 0.5) * Math.max(c.variance * 0.9, 40);
        s.p = Math.max(0, s.p + (c.target - s.p) * 0.09 + noise);
      }
      s.total += dt;
      if (Math.abs(s.p - c.target) <= c.variance) s.tAt += dt;
      s.hist.push({ t: s.total, p: s.p });
      if (s.hist.length > 1200) s.hist.shift();
      if (s.tAt >= HOLD_TO_PASS) s.status = "pass";
      force();
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  // draw chart
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const c = cfg.current;
    const s = sim.current;
    const padL = 54, padR = 14, padT = 14, padB = 24;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const max = c.maxScale;
    const win = 60;
    const total = s.total;
    const tMin = Math.max(0, total - win);
    const yFor = (p: number) => padT + (1 - p / max) * plotH;
    const xFor = (t: number) => padL + ((t - tMin) / win) * plotW;

    // grid + y labels
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i++) {
      const val = (max / 5) * i;
      const y = yFor(val);
      ctx.strokeStyle = "#eee7db";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = "#9a948a";
      ctx.fillText(val.toLocaleString(), padL - 8, y);
    }

    // variance band + target line
    if (c.target > 0) {
      const yTop = yFor(Math.min(max, c.target + c.variance));
      const yBot = yFor(Math.max(0, c.target - c.variance));
      ctx.fillStyle = "rgba(30,122,70,0.12)";
      ctx.fillRect(padL, yTop, plotW, yBot - yTop);
      ctx.strokeStyle = "#1e7a46";
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, yFor(c.target));
      ctx.lineTo(w - padR, yFor(c.target));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // trace
    if (s.hist.length > 1) {
      ctx.strokeStyle = "#2b5bb5";
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.hist.forEach((pt, i) => {
        const x = xFor(pt.t), y = yFor(pt.p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // head dot
      const last = s.hist[s.hist.length - 1];
      ctx.fillStyle = "#2b5bb5";
      ctx.beginPath();
      ctx.arc(xFor(last.t), yFor(last.p), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const s = sim.current;
  const frac = Math.max(0, Math.min(1, s.p / maxScale));
  const targetFrac = Math.max(0, Math.min(1, target / maxScale));
  const needle = polar(160, 150, 118, 180 - 180 * frac);
  const withinBand = Math.abs(s.p - target) <= variance;

  function start() {
    sim.current = { p: 0, tAt: 0, total: 0, hist: [], status: "testing" };
    setRunning(true);
  }
  function stop() {
    setRunning(false);
    sim.current.status = sim.current.tAt >= HOLD_TO_PASS ? "pass" : "stopped";
    force();
  }
  function reset() {
    setRunning(false);
    sim.current = { p: 0, tAt: 0, total: 0, hist: [], status: "idle" };
    force();
  }
  function toggleFull(on: boolean) {
    const el = wrapRef.current;
    if (!el) return;
    if (on && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  const status = s.status;
  const statusBadge =
    status === "pass" ? <span className="badge pass">Pass · held {HOLD_TO_PASS}s at target</span>
    : status === "testing" ? <span className="badge awaiting">{withinBand ? "At target" : "Testing…"}</span>
    : status === "stopped" ? <span className="badge fail">Stopped before hold</span>
    : <span className="badge draft">Idle</span>;

  return (
    <div ref={wrapRef} style={{ background: "var(--paper)" }}>
      <div className="page-head">
        <div>
          <p className="crumb">Operations / Pressure Test</p>
          <h1>Pressure Test</h1>
          <p>Ramp to target and hold within variance. Demo mode simulates the transducer.</p>
        </div>
        <div className="flex">
          <div className="lang" style={{ borderRadius: 10 }}>
            <span className={mode === "demo" ? "on" : ""} onClick={() => setMode("demo")} style={{ cursor: "pointer" }}>Demo</span>
            <span className={mode === "live" ? "on" : ""} onClick={() => setMode("live")} style={{ cursor: "pointer" }} title="Connect a GP:50 transducer">Live (GP:50)</span>
          </div>
        </div>
      </div>

      {mode === "live" && (
        <div className="callout amber" style={{ marginBottom: 18 }}>
          <span><strong>Live mode</strong> connects to a GP:50 pressure transducer, which isn&apos;t wired up yet. Use <strong>Demo</strong> to simulate a test.</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 24, alignItems: "center" }}>
            {/* Left: controls + timers */}
            <div>
              <div className="grid-2">
                <div className="field">
                  <label>Target Pressure (PSI)</label>
                  <input type="number" value={target} min={0} disabled={running}
                    onChange={(e) => setTarget(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>Variance (± PSI)</label>
                  <input type="number" value={variance} min={0} disabled={running}
                    onChange={(e) => setVariance(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex" style={{ gap: 20, marginBottom: 18 }}>
                <label className="flex" style={{ gap: 8, fontSize: 14, fontWeight: 500, color: "var(--ink-2)", cursor: "pointer" }}>
                  <input type="checkbox" checked={manual} disabled={running} onChange={(e) => setManual(e.target.checked)} /> Manual test
                </label>
                <label className="flex" style={{ gap: 8, fontSize: 14, fontWeight: 500, color: "var(--ink-2)", cursor: "pointer" }}>
                  <input type="checkbox" onChange={(e) => toggleFull(e.target.checked)} /> Full screen
                </label>
              </div>

              <div className="wrap-actions" style={{ marginBottom: 18 }}>
                {!running ? (
                  <button className="btn" onClick={start}>▶ Start test</button>
                ) : (
                  <button className="btn" style={{ background: "#6b6b70", borderColor: "#6b6b70" }} onClick={stop}>■ Stop</button>
                )}
                <button className="btn secondary" onClick={reset} disabled={running}>Reset</button>
                {statusBadge}
              </div>

              {manual && running && (
                <div className="field">
                  <label>Manual pressure — {Math.round(s.p).toLocaleString()} PSI</label>
                  <input type="range" min={0} max={maxScale} step={10} value={Math.round(s.p)}
                    style={{ width: "100%" }}
                    onChange={(e) => { sim.current.p = Number(e.target.value); force(); }} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 4 }}>
                <Metric label="Time at Target" value={mmss(s.tAt)} accent={withinBand && running} />
                <Metric label="Total Time" value={mmss(s.total)} />
                <Metric label="Assets" value="1" />
              </div>
            </div>

            {/* Right: gauge */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <svg viewBox="0 0 320 210" style={{ width: "100%", maxWidth: 380 }}>
                {/* track */}
                <path d={arc(160, 150, 118, 180, 0)} fill="none" stroke="#efece4" strokeWidth={22} strokeLinecap="round" />
                {/* yellow 0..target */}
                <path d={arc(160, 150, 118, 180, 180 - 180 * targetFrac)} fill="none" stroke="#f2c14e" strokeWidth={22} />
                {/* red target..max */}
                <path d={arc(160, 150, 118, 180 - 180 * targetFrac, 0)} fill="none" stroke="#e06456" strokeWidth={22} />
                {/* green acceptance window */}
                <path
                  d={arc(160, 150, 118,
                    180 - 180 * Math.min(1, (target + variance) / maxScale),
                    180 - 180 * Math.max(0, (target - variance) / maxScale))}
                  fill="none" stroke="#1e7a46" strokeWidth={22} strokeOpacity={0.9} />
                {/* ticks/labels */}
                <text x="42" y="168" fontSize="11" fill="#9a948a">0</text>
                <text x="150" y="34" fontSize="11" fill="#9a948a" textAnchor="middle">{Math.round(maxScale / 2).toLocaleString()}</text>
                <text x="286" y="168" fontSize="11" fill="#9a948a" textAnchor="end">{maxScale.toLocaleString()}</text>
                {/* needle */}
                <line x1="160" y1="150" x2={needle.x} y2={needle.y} stroke="#1b1b1f" strokeWidth={3.2} strokeLinecap="round" />
                <circle cx="160" cy="150" r="7" fill="#1b1b1f" />
                {/* readout */}
                <text x="160" y="196" textAnchor="middle" fontSize="30" fontWeight="750"
                  fill={withinBand && running ? "#1e7a46" : "#1b1b1f"} fontFamily="ui-monospace, monospace">
                  {Math.round(s.p).toLocaleString()} PSI
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Live pressure trace</h2><span className="small muted">last 60 s · target band shaded</span></div>
        <div className="card-body">
          <canvas ref={canvasRef} style={{ width: "100%", height: 300, display: "block" }} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 26, fontWeight: 750, letterSpacing: "-0.02em", color: accent ? "#1e7a46" : "var(--ink)" }}>{value}</div>
    </div>
  );
}
