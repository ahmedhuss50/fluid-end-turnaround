import type { EsignProvider } from "./types";
import { MockEsignProvider } from "./mock";
import { BoldSignProvider } from "./boldsign";

export * from "./types";

let cached: EsignProvider | null = null;

/** Returns the configured e-signature provider (mock by default). */
export function getEsignProvider(): EsignProvider {
  if (cached) return cached;
  const choice = (process.env.ESIGN_PROVIDER || "mock").toLowerCase();
  cached = choice === "boldsign" ? new BoldSignProvider() : new MockEsignProvider();
  return cached;
}
