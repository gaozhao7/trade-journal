import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, RetryError, generateText } from "ai";
import { getAiKey, getAiModel, getAiProvider } from "./settings";
import { RequestError } from "./api";
import { AI_PROVIDER_NAMES } from "@/lib/ai-settings";
import type { AiFailureCode } from "@/lib/ai-feedback";
import { defaultLocale, type Locale } from "@/i18n/config";

/** AI failures carry a stable code so the client never matches English text. */
export class AiError extends RequestError {
  constructor(message: string, code: AiFailureCode) {
    super(message, code);
    this.name = "AiError";
  }
}

/**
 * BYO-key AI. Self-hosted means YOUR key on YOUR box: the key is read from the
 * encrypted settings store (or the selected provider's environment variable).
 * Requests go straight from this server to the selected provider.
 */
export const aiConfigured = (): boolean => getAiKey(getAiProvider()) !== null;

const SYSTEM = `You are the reflection layer of a trader's journal.
You see only the trader's own recorded data — trades, stats, and notes. Ground every
statement in those numbers; never invent trades, prices, or market context you weren't given.
Be direct and specific like a good trading coach: name the behavior, cite the numbers,
say what to keep and what to fix. No platitudes, no disclaimers about trading being risky —
the trader knows. Keep it tight.`;

/** Map the app locale to the natural language the model should answer in. */
const LOCALE_LANGUAGE: Record<Locale, string> = {
  "zh-CN": "Simplified Chinese",
  "en-US": "English",
};

export const runAi = async (
  prompt: string,
  maxOutputTokens = 1200,
  locale?: string,
): Promise<string> => {
  const provider = getAiProvider();
  const apiKey = getAiKey(provider);
  if (!apiKey) {
    throw new AiError(
      `AI is not configured — add your ${AI_PROVIDER_NAMES[provider]} API key in Settings.`,
      "aiNotConfigured",
    );
  }
  const model = getAiModel(provider);
  const language =
    locale && locale in LOCALE_LANGUAGE
      ? LOCALE_LANGUAGE[locale as Locale]
      : LOCALE_LANGUAGE[defaultLocale];
  const system = `${SYSTEM}\n\nRespond in ${language}.`;
  try {
    const result = await generateText({
      model:
        provider === "openai"
          ? createOpenAI({ apiKey }).responses(model)
          : createAnthropic({ apiKey })(model),
      ...(provider === "openai" ? { providerOptions: { openai: { store: false } } } : {}),
      system,
      prompt,
      maxOutputTokens,
    });
    if (!result.text.trim())
      throw new AiError("AI returned no text. Check the model or try again.", "aiEmptyResponse");
    return result.text;
  } catch (error) {
    if (RetryError.isInstance(error)) error = error.lastError;
    // Provider error messages can contain key fragments or request data. Never relay them.
    if (APICallError.isInstance(error)) {
      if (error.statusCode === 401 || error.statusCode === 403)
        throw new AiError(
          "AI authentication_error: check your provider key and permissions in Settings.",
          "aiAuthError",
        );
      if (
        /credit balance|billing|insufficient_quota|exceeded your current quota/i.test(error.message)
      )
        throw new AiError(
          "AI billing: check your provider account's credits and quota.",
          "aiBilling",
        );
      if (error.statusCode === 429 || error.statusCode === 529)
        throw new AiError("AI rate limit: please try again shortly.", "aiRateLimit");
      if (
        error.statusCode === 404 ||
        /model.*(?:not found|does not exist|access)/i.test(error.message)
      )
        throw new AiError(
          "AI model unavailable: check the model ID and your provider access in Settings.",
          "aiModelUnavailable",
        );
    }
    throw new AiError(
      "AI request failed. Check your provider settings or try again shortly.",
      "aiRequestFailed",
    );
  }
};
