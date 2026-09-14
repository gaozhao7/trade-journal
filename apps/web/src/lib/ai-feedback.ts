export type AiFeedbackCode =
  | "notConfigured"
  | "authError"
  | "billing"
  | "modelUnavailable"
  | "rateLimit"
  | "journalEmpty"
  | "noTradesToRecap"
  | "unauthorized"
  | "network"
  | "generic";

/**
 * Stable codes thrown by the AI layer (`server/ai.ts`) and the AI routes, so the
 * UI never has to classify failures by matching English provider text.
 */
export type AiFailureCode =
  | "aiNotConfigured"
  | "aiAuthError"
  | "aiBilling"
  | "aiRateLimit"
  | "aiModelUnavailable"
  | "aiEmptyResponse"
  | "aiRequestFailed"
  | "aiJournalEmpty"
  | "aiNoTradesToRecap";

/** Every code the AI layer may emit. Kept in sync with `server/ai.ts` throws. */
export const AI_FAILURE_CODES: readonly AiFailureCode[] = [
  "aiNotConfigured",
  "aiAuthError",
  "aiBilling",
  "aiRateLimit",
  "aiModelUnavailable",
  "aiEmptyResponse",
  "aiRequestFailed",
  "aiJournalEmpty",
  "aiNoTradesToRecap",
];

export interface AiFeedback {
  /** Stable identifier so the UI can translate copy without depending on English text. */
  code: AiFeedbackCode;
  title: string;
  description: string;
  tone: "info" | "error";
  action?: { label: string; href: string };
  retry?: boolean;
}

type Copy = Omit<AiFeedback, "code">;

const COPY: Record<AiFeedbackCode, Copy> = {
  notConfigured: {
    title: "Set up AI to continue",
    description:
      "Connect an Anthropic or OpenAI API key in Settings to ask questions, generate recaps, and review trades.",
    tone: "info",
    action: { label: "Set up AI", href: "/settings#ai-settings" },
  },
  authError: {
    title: "Check your AI connection",
    description:
      "Your AI provider couldn’t verify your key or permissions. Review them in Settings, then try again.",
    tone: "error",
    action: { label: "Review AI settings", href: "/settings#ai-settings" },
  },
  billing: {
    title: "Your AI account needs attention",
    description:
      "Check the billing, credit balance, or quota on your AI provider account, then try again.",
    tone: "info",
  },
  modelUnavailable: {
    title: "Check your AI model",
    description: "Check the model ID and your provider account’s access in Settings.",
    tone: "error",
    action: { label: "Review AI settings", href: "/settings#ai-settings" },
  },
  rateLimit: {
    title: "AI is temporarily busy",
    description: "Please wait a moment before trying again. Your journal data hasn’t changed.",
    tone: "info",
    retry: true,
  },
  journalEmpty: {
    title: "Add trades to get started",
    description:
      "AI insights use your journal history. Import your trades, then ask your question again.",
    tone: "info",
    action: { label: "Import trades", href: "/import" },
  },
  noTradesToRecap: {
    title: "No trades to recap yet",
    description:
      "A recap needs at least one closed trade on this day. You can still write your own day note.",
    tone: "info",
  },
  unauthorized: {
    title: "Please sign in again",
    description: "Your session may have expired. Sign in to continue using your journal.",
    tone: "info",
    action: { label: "Sign in", href: "/login" },
  },
  network: {
    title: "Couldn’t connect to AI",
    description: "Check your connection and try again. Your journal data hasn’t changed.",
    tone: "error",
    retry: true,
  },
  generic: {
    title: "Couldn’t complete the AI request",
    description: "Please try again in a moment. If this continues, check your AI settings.",
    tone: "error",
    retry: true,
  },
};

/** AI/proxy error codes → the copy to show. */
const CODE_MAP: Record<string, AiFeedbackCode> = {
  aiNotConfigured: "notConfigured",
  aiAuthError: "authError",
  aiBilling: "billing",
  aiRateLimit: "rateLimit",
  aiModelUnavailable: "modelUnavailable",
  aiEmptyResponse: "generic",
  aiRequestFailed: "generic",
  aiJournalEmpty: "journalEmpty",
  aiNoTradesToRecap: "noTradesToRecap",
  unauthorized: "unauthorized",
  network: "network",
  requestFailed: "generic",
  unexpected: "generic",
};

/** Last resort for provider payloads that only exist as text. */
const classifyByMessage = (message: string): AiFeedbackCode => {
  if (/AI is not configured/i.test(message)) return "notConfigured";
  if (
    /invalid.*(?:api.?key|x-api-key)|incorrect api key|authentication_error|invalid_api_key/i.test(
      message,
    )
  )
    return "authError";
  if (
    /credit balance|billing|insufficient.*(?:credit|quota)|exceeded your current quota/i.test(
      message,
    )
  )
    return "billing";
  if (/model unavailable|model_not_found/i.test(message)) return "modelUnavailable";
  if (/rate.limit|too many requests|overloaded/i.test(message)) return "rateLimit";
  if (/journal is empty/i.test(message)) return "journalEmpty";
  if (/No closed trades on this day/i.test(message)) return "noTradesToRecap";
  if (/Unauthorized/i.test(message)) return "unauthorized";
  if (/failed to fetch|network|timeout|timed out|connection/i.test(message)) return "network";
  return "generic";
};

/**
 * Friendly, bounded copy: never echo provider payloads or credentials into the UI.
 * A stable `code` wins; the message is only inspected when no code is available.
 */
export function aiFeedback(message: string, code?: string | null): AiFeedback {
  const mapped = code ? CODE_MAP[code] : undefined;
  const resolved = mapped ?? classifyByMessage(message);
  return { code: resolved, ...COPY[resolved] };
}
