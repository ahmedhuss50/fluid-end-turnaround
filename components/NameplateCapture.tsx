"use client";

import { useRef, useState } from "react";

// Load Tesseract.js from CDN on demand (client-side OCR).
let tPromise: Promise<any> | null = null;
function loadTesseract(): Promise<any> {
  if (typeof window !== "undefined" && (window as any).Tesseract) return Promise.resolve((window as any).Tesseract);
  if (tPromise) return tPromise;
  tPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    s.onload = () => resolve((window as any).Tesseract);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return tPromise;
}

const KNOWN = ["Gardner Denver", "SPM", "Weir", "Halliburton", "NOV", "Kerr", "ForumEnergy", "Forum"];

function parseText(text: string): { serial?: string; manufacturer?: string } {
  const out: { serial?: string; manufacturer?: string } = {};
  for (const k of KNOWN) {
    if (new RegExp(k.replace(/\s+/g, "\\s*"), "i").test(text)) { out.manufacturer = k; break; }
  }
  if (!out.manufacturer && /\bGD\b/.test(text)) out.manufacturer = "Gardner Denver";
  // serial: prefer a line labelled S/N or SERIAL
  for (const ln of text.split(/\n/)) {
    const m = ln.match(/(?:s\/?n|serial(?:\s*(?:no|number|#))?)\s*[:.#-]*\s*([A-Z0-9][A-Z0-9-]{3,})/i);
    if (m) { out.serial = m[1].toUpperCase(); break; }
  }
  if (!out.serial) {
    const toks = (text.match(/[A-Z0-9][A-Z0-9-]{4,}/gi) || []).filter((t) => /\d/.test(t) && /[A-Z]/i.test(t));
    toks.sort((a, b) => b.length - a.length);
    if (toks[0]) out.serial = toks[0].toUpperCase();
  }
  return out;
}

// Downscale to a JPEG blob (smaller upload + faster OCR).
function downscale(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function NameplateCapture() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  function setField(name: string, value?: string) {
    if (!value) return;
    const form = rootRef.current?.closest("form");
    const el = form?.elements.namedItem(name) as HTMLInputElement | null;
    if (el) { el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus("Processing photo…");
    try {
      // The original file submits with the form; OCR runs on a downscaled copy.
      const blob = await downscale(file).catch(() => file);
      setPreview(URL.createObjectURL(blob));

      setStatus("Reading nameplate…");
      const T = await loadTesseract();
      const { data } = await T.recognize(blob, "eng");
      const { serial, manufacturer } = parseText(data.text || "");
      setField("serialNumber", serial);
      setField("manufacturer", manufacturer);
      setStatus(
        serial || manufacturer
          ? `Read from photo${serial ? ` · serial ${serial}` : ""}${manufacturer ? ` · ${manufacturer}` : ""} — please review.`
          : "Couldn't read it clearly — type the values in. The photo is saved to the record."
      );
    } catch {
      setStatus("Couldn't read the photo automatically — type the values in. The photo is saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="field" style={{ marginBottom: 18 }}>
      <div className="flex" style={{ gap: 12, flexWrap: "wrap" }}>
        <label className="btn secondary small" style={{ cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Scanning…" : "📷 Scan nameplate"}
          <input ref={inputRef} type="file" name="nameplatePhoto" accept="image/*" capture="environment"
            style={{ display: "none" }} onChange={onFile} />
        </label>
        {status && <span className="hint" style={{ margin: 0 }}>{status}</span>}
      </div>
      {preview && (
        <img src={preview} alt="Nameplate" style={{ marginTop: 10, maxHeight: 120, borderRadius: 8, border: "1px solid var(--line)" }} />
      )}
      <div className="hint" style={{ marginTop: 6 }}>
        Snap the unit&apos;s nameplate — the serial number and manufacturer fill in automatically (review before saving).
      </div>
    </div>
  );
}
