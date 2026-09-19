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

  // Live USB (Web Serial) state
  const [baud, setBaud] = useState(9600);
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialErr, setSerialErr] = useState("");
  const [rawLines, setRawLines] = useState<string[]>([]);
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef(false);
  const supportsSerial = typeof window !== "undefined" && "serial" in (navigator as any);

  const sim = useRef<Sim>({ p: 0, tAt: 0, total: 0, hist: [], status: "idle" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const maxScale = useMemo(
    () => Math.max(10000, Math.ceil(((Number(target) || 0) * 2) / 5000) * 5000),
    [target]
  );

  // config mirror for the loop
  const cfg = useRef({ target, variance, manual, maxScale, mode });
  cfg.current = { target: Number(target) || 0, variance: Number(variance) || 0, manual, maxScale, mode };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = sim.current;
      const c = cfg.current;
      const dt = 0.1;
      // In demo mode we simulate the transducer; in live mode the reading comes
      // from the USB device (readLoop writes sim.current.p), so we only advance
      // the timers and record history here.
      if (c.mode === "demo" && !c.manual) {
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

  // ------- Live USB (Web Serial) -------
  function parseReading(line: string): number | null {
    // Grab the first number in the line, e.g. "P=14987.2 PSI" -> 14987.2
    const m = line.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  async function readLoop(port: any) {
    keepReadingRef.current = true;
    let reader: any;
    try {
      const decoder: any = new (window as any).TextDecoderStream();
      port.readable.pipeTo(decoder.writable).catch(() => {});
      reader = decoder.readable.getReader();
      readerRef.current = reader;
      let buf = "";
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        buf += value;
        let idx;
        while ((idx = buf.search(/[\r\n]/)) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          setRawLines((prev) => [...prev.slice(-13), line]);
          const val = parseReading(line);
          if (val != null && !isNaN(val)) sim.current.p = val;
        }
      }
    } catch (e: any) {
      if (keepReadingRef.current) setSerialErr(e?.message || "Lost connection to the device.");
    } finally {
      try { reader?.releaseLock(); } catch { /* ignore */ }
    }
  }

  async function connectSerial() {
    setSerialErr("");
    const nav = navigator as any;
    if (!nav.serial) {
      setSerialErr("This browser can't read USB devices. Use Google Chrome or Microsoft Edge on a computer (not a tablet or Safari).");
      return;
    }
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: Number(baud) || 9600 });
      portRef.current = port;
      setRawLines([]);
      sim.current = { p: 0, tAt: 0, total: 0, hist: [], status: "testing" };
      setSerialConnected(true);
      setRunning(true); // start the timer/chart loop; readings come from USB
      readLoop(port);
    } catch (e: any) {
      // User cancelled the port picker, or the port failed to open.
      if (e?.name !== "NotFoundError") setSerialErr(e?.message || "Could not open the device.");
    }
  }

  async function disconnectSerial() {
    keepReadingRef.current = false;
    try { await readerRef.current?.cancel(); } catch { /* ignore */ }
    try { await portRef.current?.close(); } catch { /* ignore */ }
    readerRef.current = null;
    portRef.current = null;
    setSerialConnected(false);
    setRunning(false);
    sim.current.status = sim.current.tAt >= HOLD_TO_PASS ? "pass" : "stopped";
    force();
  }

  // Clean up the serial connection if the component unmounts.
  useEffect(() => {
    return () => {
      keepReadingRef.current = false;
      try { readerRef.current?.cancel(); } catch { /* ignore */ }
      try { portRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);

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
    : status === "testing" ? <span className="badge awaiting">{withinBand ? "At target" : (mode === "live" ? "Reading…" : "Testing…")}</span>
    : status === "stopped" ? <span className="badge fail">Stopped before hold</span>
    : <span className="badge draft">Idle</span>;

  return (
    <div ref={wrapRef} style={{ background: "var(--paper)" }}>
      <div className="page-head">
        <div>
          <p className="crumb">Operations / Pressure Test</p>
          <h1>Pressure Test</h1>
          <p>Ramp to target and hold within variance. Demo simulates the transducer; Live reads a USB pressure transducer.</p>
        </div>
        <div className="flex">
          <div className="lang" style={{ borderRadius: 10 }}>
            <span className={mode === "demo" ? "on" : ""} onClick={() => setMode("demo")} style={{ cursor: "pointer" }}>Demo</span>
            <span className={mode === "live" ? "on" : ""} onClick={() => setMode("live")} style={{ cursor: "pointer" }} title="Read a USB pressure transducer">Live (USB)</span>
          </div>
        </div>
      </div>

      {mode === "live" && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-head"><h2>USB transducer</h2>{serialConnected ? <span className="badge pass">Connected</span> : <span className="badge draft">Not connected</span>}</div>
          <div className="card-body">
            {!supportsSerial && (
              <div className="callout amber" style={{ marginBottom: 14 }}>
                <span>This browser can&apos;t read USB devices. Open the portal in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on a computer (Safari, iPhone and iPad are not supported).</span>
              </div>
            )}
            <div className="flex" style={{ gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="field" style={{ marginBottom: 0, maxWidth: 180 }}>
                <label>Baud rate</label>
                <select value={baud} disabled={serialConnected} onChange={(e) => setBaud(Number(e.target.value))}>
                  {[9600, 19200, 38400, 57600, 115200].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {!serialConnected
                ? <button className="btn" disabled={!supportsSerial} onClick={connectSerial}>🔌 Connect via USB</button>
                : <button className="btn" style={{ background: "#6b6b70", borderColor: "#6b6b70" }} onClick={disconnectSerial}>Disconnect</button>}
            </div>
            {serialErr && <div className="callout amber" style={{ marginTop: 14 }}><span>{serialErr}</span></div>}
            <div style={{ marginTop: 14 }}>
              <div className="small muted" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Raw data from device</div>
              <pre style={{ background: "#1b1b1f", color: "#d7f0dd", borderRadius: 10, padding: 12, fontSize: 12.5, lineHeight: 1.5, minHeight: 90, maxHeight: 180, overflow: "auto", margin: 0, whiteSpace: "pre-wrap" }}>
                {rawLines.length ? rawLines.join("\n") : (serialConnected ? "Waiting for data…" : "Connect a device to see what it sends.")}
              </pre>
              <div className="hint" style={{ marginTop: 6 }}>We read the first number on each line as the pressure. If the readings look wrong, send me a few of these lines and I&apos;ll adjust the parsing to match your transducer.</div>
            </div>
          </div>
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

              {mode === "demo" && (
                <div className="flex" style={{ gap: 20, marginBottom: 18 }}>
                  <label className="flex" style={{ gap: 8, fontSize: 14, fontWeight: 500, color: "var(--ink-2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={manual} disabled={running} onChange={(e) => setManual(e.target.checked)} /> Manual test
                  </label>
                  <label className="flex" style={{ gap: 8, fontSize: 14, fontWeight: 500, color: "var(--ink-2)", cursor: "pointer" }}>
                    <input type="checkbox" onChange={(e) => toggleFull(e.target.checked)} /> Full screen
                  </label>
                </div>
              )}

              {mode === "demo" && (
                <div className="wrap-actions" style={{ marginBottom: 18 }}>
                  {!running ? (
                    <button className="btn" onClick={start}>▶ Start test</button>
                  ) : (
                    <button className="btn" style={{ background: "#6b6b70", borderColor: "#6b6b70" }} onClick={stop}>■ Stop</button>
                  )}
                  <button className="btn secondary" onClick={reset} disabled={running}>Reset</button>
                  {statusBadge}
                </div>
              )}

              {mode === "live" && (
                <div className="wrap-actions" style={{ marginBottom: 18 }}>
                  {statusBadge}
                </div>
              )}

              {mode === "demo" && manual && running && (
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
                <path d={arc(160, 150, 118, 180, 0)} fill="none" stroke="#efece4" strokeWidth={22} strokeLinecap="round" />
                <path d={arc(160, 150, 118, 180, 180 - 180 * targetFrac)} fill="none" stroke="#f2c14e" strokeWidth={22} />
                <path d={arc(160, 150, 118, 180 - 180 * targetFrac, 0)} fill="none" stroke="#e06456" strokeWidth={22} />
                <path
                  d={arc(160, 150, 118,
                    180 - 180 * Math.min(1, (target + variance) / maxScale),
                    180 - 180 * Math.max(0, (target - variance) / maxScale))}
                  fill="none" stroke="#1e7a46" strokeWidth={22} strokeOpacity={0.9} />
                <text x="42" y="168" fontSize="11" fill="#9a948a">0</text>
                <text x="150" y="34" fontSize="11" fill="#9a948a" textAnchor="middle">{Math.round(maxScale / 2).toLocaleString()}</text>
                <text x="286" y="168" fontSize="11" fill="#9a948a" textAnchor="end">{maxScale.toLocaleString()}</text>
                <line x1="160" y1="150" x2={needle.x} y2={needle.y} stroke="#1b1b1f" strokeWidth={3.2} strokeLinecap="round" />
                <circle cx="160" cy="150" r="7" fill="#1b1b1f" />
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
