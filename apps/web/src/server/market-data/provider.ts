import type { MarketHistory, Resolution } from "@/lib/market-data";

export interface HistoryRequest {
  symbol: string;
  dataset?: string;
  resolution: Resolution;
  from: number;
  to: number;
  signal?: AbortSignal;
}

/** Adapters supply data only. Chart rendering and analytics do not depend on an adapter. */
export interface MarketDataProvider {
  id: string;
  name: string;
  environmentKey: string;
  history(request: HistoryRequest, apiKey: string): Promise<MarketHistory>;
  test(apiKey: string): Promise<void>;
}

/** Market-data failures carry a stable code so the UI can localize them. */
export class MarketDataError extends Error {
  readonly code: string;

  constructor(message: string, code = "marketDataInvalidInput") {
    super(message);
    this.name = "MarketDataError";
    this.code = code;
  }
}
