import { db, accounts } from "@/db";
import { rebuildAccount } from "@/server/rebuild";
import { handler, ok, requireValue } from "@/server/api";
import {
  getMultipliers,
  getTimeZone,
  getImportTimeZone,
  aiKeyEnvironment,
  aiModelSetting,
  getAiProvider,
  getAiSettings,
  getSetting,
  setAiKey,
  setSetting,
} from "@/server/settings";
import { AI_PROVIDERS, AI_PROVIDER_NAMES, isAiProvider, type AiProvider } from "@/lib/ai-settings";
import { isTimeZone } from "@/lib/timezone";
import { isLocale, localeCookie, type Locale } from "@/i18n/config";

export const GET = handler(() =>
  ok({
    locale: isLocale(getSetting("locale")) ? getSetting("locale") : "zh-CN",
    timeZone: getTimeZone(),
    importTimeZone: getImportTimeZone(),
    multipliers: getMultipliers(),
    ...getAiSettings(),
  }),
);

interface SettingsBody {
  locale?: Locale;
  timeZone?: string;
  importTimeZone?: string;
  multipliers?: Record<string, number>;
  anthropicKey?: string | null;
  openaiKey?: string | null;
  aiProvider?: AiProvider;
  aiModel?: string;
}

export const PATCH = handler(async (request: Request) => {
  const body = (await request.json()) as SettingsBody;
  requireValue(
    body && typeof body === "object" && !Array.isArray(body),
    "Enter valid settings.",
    "invalidSettings",
  );
  if (body.locale !== undefined)
    requireValue(isLocale(body.locale), "Choose a supported language.", "unsupportedLocale");
  if (body.aiProvider !== undefined)
    requireValue(isAiProvider(body.aiProvider), "Choose Anthropic or OpenAI.", "invalidAiProvider");
  const provider = body.aiProvider ?? getAiProvider();
  if (body.aiModel !== undefined)
    requireValue(
      typeof body.aiModel === "string" &&
        /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(body.aiModel.trim()),
      "Enter a valid model ID.",
      "invalidModelId",
    );
  for (const id of AI_PROVIDERS) {
    const key = body[`${id}Key`];
    if (key === undefined) continue;
    requireValue(
      key === null ||
        (typeof key === "string" &&
          key.trim().length > 0 &&
          key.length <= 4096 &&
          !/\s/.test(key.trim())),
      `Enter a valid ${AI_PROVIDER_NAMES[id]} API key.`,
      "invalidApiKey",
    );
    requireValue(
      !aiKeyEnvironment(id),
      `${AI_PROVIDER_NAMES[id]} uses an environment key. Update or remove it on the server.`,
      "envApiKeySet",
    );
  }
  for (const key of ["timeZone", "importTimeZone"] as const)
    if (body[key] !== undefined)
      requireValue(
        isTimeZone(body[key]),
        `Enter a valid IANA ${key === "timeZone" ? "display" : "import"} timezone.`,
        "invalidTimeZone",
      );
  if (body.multipliers !== undefined)
    requireValue(
      body.multipliers &&
        typeof body.multipliers === "object" &&
        Object.values(body.multipliers).every(
          (n) => typeof n === "number" && Number.isFinite(n) && n > 0,
        ),
      "Contract multipliers must be positive numbers.",
      "invalidMultipliers",
    );
  db.transaction(() => {
    if (body.locale !== undefined) setSetting("locale", body.locale);
    if (body.timeZone !== undefined || body.importTimeZone !== undefined)
      setSetting("importTimeZone", body.importTimeZone ?? getImportTimeZone());
    if (body.timeZone !== undefined) setSetting("timeZone", body.timeZone);
  });
  if (body.multipliers !== undefined)
    db.transaction(() => {
      setSetting("multipliers", JSON.stringify(body.multipliers));
      for (const account of db.select({ id: accounts.id }).from(accounts).all())
        rebuildAccount(account.id);
    });
  db.transaction(() => {
    for (const id of AI_PROVIDERS) {
      const key = body[`${id}Key`];
      if (key !== undefined) setAiKey(id, key);
    }
    if (body.aiProvider !== undefined) setSetting("aiProvider", body.aiProvider);
    if (body.aiModel !== undefined) setSetting(aiModelSetting(provider), body.aiModel.trim());
  });
  const response = ok({ saved: true });
  // The locale is stored server-side and mirrored in a cookie so the very next
  // request renders in the chosen language without a second round trip.
  if (body.locale !== undefined)
    response.cookies.set(localeCookie, body.locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  return response;
});
