import { Suspense } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import "./globals.css";
import { Shell } from "@/components/shell";
import { PrivacyProvider } from "@/components/privacy";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme";
import { DEFAULT_THEME_ID, THEME_INIT_SCRIPT, themeHtmlAttributes } from "@/lib/theme";
import { resolveLocale } from "@/i18n/request";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocale();
  const messages = (await import(`@/i18n/messages/${locale}.json`)).default;

  // The server cannot read localStorage, so it renders the product default; the
  // inline script below replaces it before the first paint.
  const themeAttributes = themeHtmlAttributes(DEFAULT_THEME_ID);

  return (
    <html lang={locale} {...themeAttributes} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <TooltipProvider delayDuration={350} skipDelayDuration={150}>
          <Suspense>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <ThemeProvider>
                <PrivacyProvider>
                  <Shell>{children}</Shell>
                </PrivacyProvider>
              </ThemeProvider>
            </NextIntlClientProvider>
          </Suspense>
        </TooltipProvider>
      </body>
    </html>
  );
}
