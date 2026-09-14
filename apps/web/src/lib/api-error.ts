export interface ApiFailurePayload {
  error?: string;
  code?: string;
  params?: Record<string, string | number>;
}

/** Error carrying a stable, localizable code alongside the human-readable message. */
export class ApiError extends Error {
  readonly code: string | null;
  readonly status: number | null;
  readonly params: Record<string, string | number> | undefined;

  constructor(
    message: string,
    code: string | null = null,
    status: number | null = null,
    params?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.params = params;
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;

export const messageFrom = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "";

export const codeFrom = (cause: unknown): string | null =>
  cause instanceof ApiError ? cause.code : null;

export const paramsFrom = (cause: unknown): Record<string, string | number> | undefined =>
  cause instanceof ApiError ? cause.params : undefined;
