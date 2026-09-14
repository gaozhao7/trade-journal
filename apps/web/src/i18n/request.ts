import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getSetting } from "@/server/settings";
import { defaultLocale, isLocale, localeCookie, type Locale } from "./config";

export const resolveLocale = async (): Promise<Locale> => {
  const saved = getSetting("locale");
  if (isLocale(saved)) return saved;
  const cookieLocale = (await cookies()).get(localeCookie)?.value;
  return isLocale(cookieLocale) ? cookieLocale : defaultLocale;
};

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
