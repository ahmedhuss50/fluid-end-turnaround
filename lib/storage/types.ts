// Certificate storage abstraction.
// "local" writes to disk (dev). "supabase" uploads to a Supabase Storage bucket
// (production/Vercel, where the filesystem is read-only).

export type CertResult =
  | { kind: "buffer"; data: Uint8Array }
  | { kind: "redirect"; url: string }
  | null;

export interface CertStorage {
  readonly name: string;
  /** Store (or overwrite) a certificate PDF for a job. */
  put(jobNumber: string, bytes: Uint8Array): Promise<void>;
  /** Retrieve a certificate: either raw bytes, or a URL to redirect to. */
  get(jobNumber: string): Promise<CertResult>;
  /** Store an arbitrary object at a key (e.g. "nameplates/job-abc.jpg"). */
  putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Retrieve an arbitrary object by key. */
  getObject(key: string): Promise<CertResult>;
}
