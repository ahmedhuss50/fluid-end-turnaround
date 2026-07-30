import fs from "node:fs/promises";
import path from "node:path";
import type { CertStorage, CertResult } from "./types";

// Local-disk storage for development. Files live under storage/certificates.
export class LocalStorage implements CertStorage {
  readonly name = "local";
  private dir = path.join(process.cwd(), "storage", "certificates");

  private file(jobNumber: string) {
    return path.join(this.dir, `${path.basename(jobNumber)}.pdf`);
  }

  async put(jobNumber: string, bytes: Uint8Array): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.file(jobNumber), bytes);
  }

  async get(jobNumber: string): Promise<CertResult> {
    try {
      const buf = await fs.readFile(this.file(jobNumber));
      return { kind: "buffer", data: new Uint8Array(buf) };
    } catch {
      return null;
    }
  }

  private safe(key: string) {
    // prevent path traversal; keep subdirs
    return key.split("/").map((s) => path.basename(s)).join("/");
  }

  async putObject(key: string, bytes: Uint8Array): Promise<void> {
    const f = path.join(process.cwd(), "storage", this.safe(key));
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, bytes);
  }

  async getObject(key: string): Promise<CertResult> {
    try {
      const buf = await fs.readFile(path.join(process.cwd(), "storage", this.safe(key)));
      return { kind: "buffer", data: new Uint8Array(buf) };
    } catch {
      return null;
    }
  }
}
