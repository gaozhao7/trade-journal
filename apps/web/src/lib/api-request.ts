import { ApiError } from "./api-error";

interface PendingRequest {
  controller: AbortController;
  promise: Promise<unknown>;
  users: number;
}

const pending = new Map<string, PendingRequest>();

/** Share only in-flight GETs. Completed financial data is never retained in a global cache. */
export function acquireJson<T>(url: string): { promise: Promise<T>; release: () => void } {
  let request = pending.get(url);
  if (!request) {
    const controller = new AbortController();
    const next: PendingRequest = { controller, users: 0, promise: Promise.resolve() };
    next.promise = fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await readBody(response);
        if (!response.ok) {
          throw new ApiError(
            typeof body?.error === "string" ? body.error : "",
            typeof body?.code === "string" ? body.code : "requestFailed",
            response.status,
            { status: response.status },
          );
        }
        return body;
      })
      .catch((cause: unknown) => {
        // Keep aborts and API errors intact; only classify transport failures.
        if (cause instanceof ApiError) throw cause;
        if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
        throw new ApiError("", "network", null);
      })
      .finally(() => {
        if (pending.get(url) === next) pending.delete(url);
      });
    request = next;
    pending.set(url, request);
  }
  const shared = request;
  shared.users++;
  let released = false;
  return {
    promise: shared.promise as Promise<T>,
    release: () => {
      if (released) return;
      released = true;
      shared.users--;
      // React Strict Mode can immediately reattach the same subscriber.
      queueMicrotask(() => {
        if (shared.users === 0 && pending.get(url) === shared) {
          pending.delete(url);
          shared.controller.abort();
        }
      });
    },
  };
}

interface ErrorBody {
  error?: string;
  code?: string;
}

const readBody = async (response: Response): Promise<ErrorBody & Record<string, unknown>> => {
  try {
    return (await response.json()) as ErrorBody & Record<string, unknown>;
  } catch {
    return {};
  }
};
