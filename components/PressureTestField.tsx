"use client";

import { useEffect, useRef, useState, useReducer } from "react";

const HOLD_TO_PASS = 5; // seconds within variance to auto-pass (demo)

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const s = polar(cx, cy, r, a0), e = polar(cx, cy, r, a1);
  const large = Math.abs(a0 - a1) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}
function mmss(sec: number) {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Sim = { p: number; tAt: number; total: number; hist: { t: number; p: number }[]; status: string };

/**
 * Embeddable live pressure test. Runs a simulated (Demo) test and writes the
 * outcome into form fields named testPressurePsi, holdTimeMinutes, result — so
 * it submits with the surrounding work-order <form>. Fields stay editable.
 */
export default function PressureTestField() {
  const [target, setTarget] = useState(15000);
  const [variance, setVariance] = useState(250);
  const [holdMin, setHoldMin] = useState(0);
  const [result, setResult] = useState<"PASS" | "FAIL">("PASS");
  const [running, setRunning] = useState(false);
  const [, force] = useReducer((x) => x + 1, 0);

  const sim = useRef<Sim>({ p: 0, tAt: 0, total: 0, hist: [], status: "idle" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cfg = useRef({ target, variance, max: 30000 });

  const maxScale = Math.max(10000, Math.ceil(((Number(target) || 0) * 2) / 5000) * 5000);
  cfg.current = { target: Number(target) || 0, variance: Number(variance) || 0, max: maxScale };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = sim.current, c = cfg.current, dt = 0.1;
      const noise = (Math.random() - 0.5) * Math.max(c.variance * 0.9, 40);
      s.p = Math.max(0, s.p + (c.target - s.p) * 0.09 + noise);
      s.total += dt;
      if (Math.abs(s.p - c.target) <= c.variance) s.tAt += dt;
      s.hist.push({ t: s.total, p: s.p });
      if (s.hist.length > 1200) s.hist.shift();
      if (s.tAt >= HOLD_TO_PASS && s.status !== "pass") {
        s.status = "pass";
        setResult("PASS");
        setHoldMin(Math.max(1, Math.round(s.tAt / 60)) || 0);
      }
      force();
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const c = cfg.current, s = sim.current;
    const padL = 50, padR = 12, padT = 10, padB = 18;
    const plotW = w - padL - padR, plotH = h - padT - padB, max = c.max, win = 60;
    const tMin = Math.max(0, s.total - win);
    const yFor = (p: number) => padT + (1 - p / max) * plotH;
    const xFor = (t: number) => padL + ((t - tMin) / win) * plotW;
    ctx.font = "10px ui-sans-serif, system-ui"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const val = (max / 4) * i, y = yFor(val);
      ctx.strokeStyle = "#eee7db"; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = "#9a948a"; ctx.fillText(val.toLocaleString(), padL - 6, y);
    }
    if (c.target > 0) {
      const yTop = yFor(Math.min(max, c.target + c.variance)), yBot = yFor(Math.max(0, c.target - c.variance));
      ctx.fillStyle = "rgba(30,122,70,0.12)"; ctx.fillRect(padL, yTop, plotW, yBot - yTop);
      ctx.strokeStyle = "#1e7a46"; ctx.setLineDash([5, 4]); ctx.beginPath();
      ctx.moveTo(padL, yFor(c.target)); ctx.lineTo(w - padR, yFor(c.target)); ctx.stroke(); ctx.setLineDash([]);
    }
    if (s.hist.length > 1) {
      ctx.strokeStyle = "#2b5bb5"; ctx.lineWidth = 2; ctx.beginPath();
      s.hist.forEach((pt, i) => { const x = xFor(pt.t), y = yFor(pt.p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
  });

  const s = sim.current;
  const frac = Math.max(0, Math.min(1, s.p / maxScale));
  const targetFrac = Math.max(0, Math.min(1, target / maxScale));
  const needle = polar(130, 122, 96, 180 - 180 * frac);
  const withinBand = Math.abs(s.p - target) <= variance;

  function start() { sim.current = { p: 0, tAt: 0, total: 0, hist: [], status: "testing" }; setRunning(true); }
  function stop() {
    setRunning(false);
    const pass = sim.current.tAt >= HOLD_TO_PASS;
    sim.current.status = pass ? "pass" : "stopped";
    setResult(pass ? "PASS" : "FAIL");
    setHoldMin(Math.round(sim.current.tAt / 60));
    force();
  }
  function reset() { setRunning(false); sim.current = { p: 0, tAt: 0, total: 0, hist: [], status: "idle" }; force(); }

  const status = s.status;
  const badge =
    status === "pass" ? <span className="badge pass">Pass · held {HOLD_TO_PASS}s at target</span>
    : status === "testing" ? <span className="badge awaiting">{withinBand ? "At target" : "Testing…"}</span>
    : status === "stopped" ? <span className="badge fail">Stopped before hold</span>
    : <span className="badge draft">Idle</span>;

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "#fcfbf8", padding: 18, marginBottom: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20, alignItems: "center" }}>
        <div>
          <div className="grid-2">
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Target pressure (psi)</label>
              {/* name matches the server action field */}
              <input type="number" name="testPressurePsi" min={0} value={target} disabled={running}
                onChange={(e) => setTarget(Number(e.target.value))} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Variance (± psi)</label>
              <input type="number" min={0} value={variance} disabled={running}
                onChange={(e) => setVariance(Number(e.target.value))} />
            </div>
          </div>

          <div className="wrap-actions" style={{ marginBottom: 14 }}>
            {!running
              ? <button type="button" className="btn small" onClick={start}>▶ Start test</button>
              : <button type="button" className="btn small" style={{ background: "#6b6b70", borderColor: "#6b6b70" }} onClick={stop}>■ Stop</button>}
            <button type="button" className="btn secondary small" onClick={reset} disabled={running}>Reset</button>
            {badge}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 22px", marginBottom: 14 }}>
            <span className="small muted">Time at target</span>
            <span className="small muted">Total time</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 20, fontWeight: 700, color: withinBand && running ? "#1e7a46" : "var(--ink)" }}>{mmss(s.tAt)}</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 20, fontWeight: 700 }}>{mmss(s.total)}</span>
          </div>

          {/* Result fields that get saved with the work order (editable) */}
          <div className="grid-2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Hold time (min)</label>
              <input type="number" name="holdTimeMinutes" min={0} value={holdMin}
                onChange={(e) => setHoldMin(Number(e.target.value))} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Result</label>
              <select name="result" value={result} onChange={(e) => setResult(e.target.value as "PASS" | "FAIL")}>
                <option value="PASS">Pass</option>
                <option value="FAIL">Fail</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <svg viewBox="0 0 260 172" style={{ width: "100%", maxWidth: 260 }}>
            <path d={arc(130, 122, 96, 180, 0)} fill="none" stroke="#efece4" strokeWidth={18} strokeLinecap="round" />
            <path d={arc(130, 122, 96, 180, 180 - 180 * targetFrac)} fill="none" stroke="#f2c14e" strokeWidth={18} />
            <path d={arc(130, 122, 96, 180 - 180 * targetFrac, 0)} fill="none" stroke="#e06456" strokeWidth={18} />
            <path d={arc(130, 122, 96,
              180 - 180 * Math.min(1, (target + variance) / maxScale),
              180 - 180 * Math.max(0, (target - variance) / maxScale))}
              fill="none" stroke="#1e7a46" strokeWidth={18} strokeOpacity={0.9} />
            <line x1="130" y1="122" x2={needle.x} y2={needle.y} stroke="#1b1b1f" strokeWidth={2.8} strokeLinecap="round" />
            <circle cx="130" cy="122" r="6" fill="#1b1b1f" />
            <text x="130" y="162" textAnchor="middle" fontSize="24" fontWeight="750"
              fill={withinBand && running ? "#1e7a46" : "#1b1b1f"} fontFamily="ui-monospace, monospace">
              {Math.round(s.p).toLocaleString()} PSI
            </text>
          </svg>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ width: "100%", height: 150, display: "block", marginTop: 12 }} />
    </div>
  );
}
