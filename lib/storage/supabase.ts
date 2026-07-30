import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { CertStorage, CertResult } from "./types";

// Supabase Storage for production. Uploads to a private bucket and serves via
// short-lived signed URLs. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
export class SupabaseStorage implements CertStorage {
  readonly name = "supabase";
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    this.bucket = process.env.SUPABASE_CERT_BUCKET || "certificates";
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  private path(jobNumber: string) {
    return `${jobNumber}.pdf`;
  }

  async put(jobNumber: string, bytes: Uint8Array): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(this.path(jobNumber), bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  }

  async get(jobNumber: string): Promise<CertResult> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(this.path(jobNumber), 60);
    if (error || !data) return null;
    return { kind: "redirect", url: data.signedUrl };
  }

  async putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, bytes, { contentType, upsert: true });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  }

  async getObject(key: string): Promise<CertResult> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, 120);
    if (error || !data) return null;
    return { kind: "redirect", url: data.signedUrl };
  }
}
