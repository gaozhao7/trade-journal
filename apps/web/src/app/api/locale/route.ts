import { NextResponse } from "next/server";
import { handler, ok, requireValue } from "@/server/api";
import { isLocale, localeCookie, type Locale } from "@/i18n/config";
import { getSetting, setSetting } from "@/server/settings";

export const PATCH = handler(async (request: Request) => {
  const body = (await request.json()) as { locale?: Locale };
  requireValue(isLocale(body?.locale), "Choose a supported language.", "unsupportedLocale");
  setSetting("locale", body.locale);
  const response = NextResponse.json({ locale: body.locale });
  response.cookies.set(localeCookie, body.locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  return response;
});

export const GET = handler(() => ok({ locale: getSetting("locale") ?? "zh-CN" }));
