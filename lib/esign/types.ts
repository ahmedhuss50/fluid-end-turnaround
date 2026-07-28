// E-signature provider abstraction.
// Phase 1 ships a "mock" provider (in-app signing, works offline) and a
// "boldsign" adapter. Swap via the ESIGN_PROVIDER env var — no app code changes.

export interface SignerInput {
  party: "PSI" | "PRO_PETRO";
  order: number;
  name: string;
  role?: string | null;
  email?: string | null;
}

export interface SignatureRequest {
  party: "PSI" | "PRO_PETRO";
  order: number;
  /** URL where this party signs. For the mock provider this is an in-app page. */
  signUrl: string;
  /** External provider reference (envelope/document id), if any. */
  providerRef?: string | null;
}

export interface CreateRequestArgs {
  jobId: string;
  jobNumber: string;
  signers: SignerInput[];
  /** Absolute base URL of this app, e.g. http://localhost:3000 */
  appBaseUrl: string;
  /** Opaque tokens the app generated per signer (used to build/verify sign URLs). */
  tokens: Record<number, string>; // keyed by signer.order
}

export interface EsignProvider {
  readonly name: string;
  /**
   * Create signature requests for a completed turnaround document.
   * Returns one entry per signer with the URL that party will use to sign.
   */
  createRequests(args: CreateRequestArgs): Promise<SignatureRequest[]>;
}
