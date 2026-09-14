import { describe, expect, it } from "vitest";
import enUS from "../src/i18n/messages/en-US.json";
import zhCN from "../src/i18n/messages/zh-CN.json";
import { AI_FAILURE_CODES, aiFeedback, type AiFeedbackCode } from "../src/lib/ai-feedback";

const dictionaries = { "en-US": enUS, "zh-CN": zhCN } as const;
const errorsOf = (locale: keyof typeof dictionaries) =>
  (dictionaries[locale] as { Errors: Record<string, string> }).Errors;

describe("AI failure codes", () => {
  const expected: Record<string, AiFeedbackCode> = {
    aiNotConfigured: "notConfigured",
    aiAuthError: "authError",
    aiBilling: "billing",
    aiRateLimit: "rateLimit",
    aiModelUnavailable: "modelUnavailable",
    aiJournalEmpty: "journalEmpty",
    aiNoTradesToRecap: "noTradesToRecap",
    aiEmptyResponse: "generic",
    aiRequestFailed: "generic",
  };

  it("classifies every emitted code without reading the English message", () => {
    for (const code of AI_FAILURE_CODES) {
      // The message is deliberately unrelated: classification must come from the code.
      expect(aiFeedback("nothing to see here", code).code).toBe(expected[code]);
    }
  });

  it("still falls back to message classification when no code is available", () => {
    expect(aiFeedback("AI is not configured — add your key").code).toBe("notConfigured");
    expect(aiFeedback("rate_limit_error").code).toBe("rateLimit");
    expect(aiFeedback("some unknown provider payload").code).toBe("generic");
  });

  it("maps the proxy codes the AI routes return", () => {
    expect(aiFeedback("", "unauthorized").code).toBe("unauthorized");
    expect(aiFeedback("", "network").code).toBe("network");
    expect(aiFeedback("", "requestFailed").code).toBe("generic");
  });
});

describe("server validation codes have localized copy", () => {
  // Codes emitted by lib/ and the API routes. A missing entry would make the UI
  // fall back to generic copy instead of saying what actually went wrong.
  const emitted = [
    "unsupportedLocale",
    "unauthorized",
    "internalError",
    "requestFailed",
    "unexpected",
    "invalidSettings",
    "invalidAiProvider",
    "invalidModelId",
    "invalidApiKey",
    "envApiKeySet",
    "invalidTimeZone",
    "invalidMultipliers",
    "marketDataKeyMissing",
    "marketDataKeyUnlockFailed",
    "marketDataInvalidInput",
    "invalidCsvFile",
    "invalidCsvSymbol",
    "invalidCsvResolution",
    "invalidCsvCurrency",
    "invalidCsvPriceBasis",
    "defaultsNotObject",
    "defaultsUnknownFields",
    "invalidBreakeven",
    "tooManyDefaults",
    "defaultNotObject",
    "defaultUnknownFields",
    "invalidAccountOrSymbol",
    "invalidFee",
    "invalidDistance",
    "exportFontUnsupported",
    "exportFontLoadFailed",
    "exportImageUnavailable",
    "exportFailed",
  ];

  it("exists in both locales and both locales stay in sync", () => {
    for (const locale of ["en-US", "zh-CN"] as const) {
      const errors = errorsOf(locale);
      for (const code of emitted)
        expect(errors, `${locale} is missing Errors.${code}`).toHaveProperty(code);
    }
    expect(Object.keys(errorsOf("en-US")).sort()).toEqual(Object.keys(errorsOf("zh-CN")).sort());
  });
});
