"use client";

import { useTranslations } from "next-intl";

/**
 * Immediate feedback while Next loads a destination route.
 *
 * `loading.tsx` ships in the client bundle (Next uses it as the Suspense fallback
 * during navigations), so it must be a Client Component using `useTranslations` —
 * `getTranslations` from `next-intl/server` throws here. It renders inside the
 * root layout's `NextIntlClientProvider`.
 */
export default function Loading() {
  const t = useTranslations("Loading");
  return (
    <div role="status" className="space-y-4 p-4" aria-label={t("ariaLabel")}>
      <span className="sr-only">{t("text")}</span>
      <div aria-hidden="true" className="h-6 w-32 rounded-md bg-muted" />
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-32 rounded-xl border bg-card" />
        ))}
      </div>
    </div>
  );
}
