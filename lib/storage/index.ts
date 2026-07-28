import type { CertStorage } from "./types";
import { LocalStorage } from "./local";
import { SupabaseStorage } from "./supabase";

export * from "./types";

let cached: CertStorage | null = null;

/** Returns the configured certificate storage driver (local by default). */
export function getStorage(): CertStorage {
  if (cached) return cached;
  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  cached = driver === "supabase" ? new SupabaseStorage() : new LocalStorage();
  return cached;
}
