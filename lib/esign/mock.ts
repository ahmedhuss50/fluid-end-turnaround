import type { EsignProvider, CreateRequestArgs, SignatureRequest } from "./types";

/**
 * Mock provider: signing happens inside this app via tokenized links.
 * This is the recommended path for the pilot/demo — it exercises the full
 * dual-signature workflow (routing, audit trail, certificate) with no
 * third-party account or network dependency.
 */
export class MockEsignProvider implements EsignProvider {
  readonly name = "mock";

  async createRequests(args: CreateRequestArgs): Promise<SignatureRequest[]> {
    return args.signers.map((s) => ({
      party: s.party,
      order: s.order,
      signUrl: `${args.appBaseUrl}/sign/${args.tokens[s.order]}`,
      providerRef: `mock-${args.jobNumber}-${s.order}`,
    }));
  }
}
