import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, passwordConfigured, verifySession } from "./auth";

export class RequestError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "RequestError";
    this.code = code;
  }
}

/**
 * Guard a request value. Pass a stable `code` so clients can localize the
 * message; `message` stays as an English fallback for API consumers.
 */
export function requireValue(
  condition: unknown,
  message: string,
  code: string | null = null,
): asserts condition {
  if (!condition) throw new RequestError(message, code);
}

export const ok = (data: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(data, { ...init, headers });
};

export const bad = (message: string, status = 400, code?: string) =>
  NextResponse.json(code ? { error: message, code } : { error: message }, { status });

/** Route-handler wrapper: uniform error JSON instead of HTML 500 pages. */
export const handler =
  <A extends unknown[]>(
    fn: (...args: A) => Promise<Response> | Response,
    options: { public?: boolean } = {},
  ) =>
  async (...args: A): Promise<Response> => {
    try {
      if (!options.public && passwordConfigured()) {
        const token = (await cookies()).get(AUTH_COOKIE)?.value;
        if (!verifySession(token)) return bad("Unauthorized", 401, "unauthorized");
      }
      return await fn(...args);
    } catch (error) {
      if (error instanceof RequestError) {
        return NextResponse.json(
          error.code ? { error: error.message, code: error.code } : { error: error.message },
          { status: 400 },
        );
      }
      const message = error instanceof Error ? error.message : "Internal error";
      return NextResponse.json({ error: message, code: "internalError" }, { status: 500 });
    }
  };
