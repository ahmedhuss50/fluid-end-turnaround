import type { EsignProvider, CreateRequestArgs, SignatureRequest } from "./types";

/**
 * BoldSign adapter (production path).
 *
 * This is wired to BoldSign's embedded-signing REST API but requires a
 * BOLDSIGN_API_KEY. Until keys are configured, keep ESIGN_PROVIDER="mock".
 *
 * Notes for going live:
 *  - Create a document from the turnaround certificate PDF (or a template).
 *  - Add two signers in order (PSI first, Pro Petro second).
 *  - Request embedded signing links so signing stays inside this app.
 *  - Configure a webhook to mark signatures SIGNED when BoldSign notifies us.
 *
 * See: https://developers.boldsign.com/
 */
export class BoldSignProvider implements EsignProvider {
  readonly name = "boldsign";
  private apiKey: string;
  private apiBase: string;

  constructor() {
    this.apiKey = process.env.BOLDSIGN_API_KEY || "";
    this.apiBase = process.env.BOLDSIGN_API_BASE || "https://api.boldsign.com";
    if (!this.apiKey) {
      throw new Error(
        "ESIGN_PROVIDER=boldsign but BOLDSIGN_API_KEY is not set. " +
          "Set it in .env, or use ESIGN_PROVIDER=mock for now."
      );
    }
  }

  async createRequests(args: CreateRequestArgs): Promise<SignatureRequest[]> {
    // Minimal illustrative call shape. Real usage sends the certificate PDF as
    // a multipart file and maps embedded signing links back per signer.
    const body = {
      title: `Fluid End Turnaround ${args.jobNumber}`,
      signers: args.signers.map((s) => ({
        name: s.name,
        emailAddress: s.email || undefined,
        signerOrder: s.order,
        signerType: "Signer",
      })),
      enableSigningOrder: true,
    };

    const res = await fetch(`${this.apiBase}/v1/document/send`, {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`BoldSign send failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as { documentId?: string };
    const documentId = data.documentId ?? null;

    // For embedded signing you would then call the embedded-sign-link endpoint
    // per signer. Here we return app-side URLs plus the provider reference so
    // the workflow still functions while integration is finalized.
    return args.signers.map((s) => ({
      party: s.party,
      order: s.order,
      signUrl: `${args.appBaseUrl}/sign/${args.tokens[s.order]}`,
      providerRef: documentId ? `${documentId}:${s.order}` : null,
    }));
  }
}
