"use client";

import Link from "next/link";
import { dayKeyOf } from "@luxalgo/journal-core";
import { Suspense, useEffect, useMemo, useState } from "react";
import { NotebookPen } from "lucide-react";
import type { DayStats } from "@luxalgo/journal-core";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { Pnl } from "@/components/pnl";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Loading from "@/app/loading";
import { useApi } from "@/lib/use-api";
import { useTranslations, useLocale } from "next-intl";
import { useErrorText } from "@/lib/i18n-error";
import { useFormat } from "@/lib/use-format";

interface JournalDay {
  date: string;
  stats: DayStats | null;
  hasNote: boolean;
  notePreview: string;
}

const PAGE_SIZE = 50;

export default function JournalPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Journal />
    </Suspense>
  );
}

function Journal() {
  const t = useTranslations("Journal");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const errorText = useErrorText();
  const format = useFormat();
  const { query, timeZone } = useFilters();
  const { data, error, errorCode, refresh } = useApi<{ days: JournalDay[] }>(
    `/api/journal?${query}`,
  );
  // Reset the visible window immediately when filters change. Keep every day
  // available without mounting years of cards on the first render.
  const [visibleWindow, setVisibleWindow] = useState({ query, limit: PAGE_SIZE });
  const limit = visibleWindow.query === query ? visibleWindow.limit : PAGE_SIZE;
  useEffect(() => setVisibleWindow({ query, limit: PAGE_SIZE }), [query]);

  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }),
    [locale],
  );

  return (
    <div>
      <FilterBar
        title={t("title")}
        actions={
          <Link
            href={`/journal/${dayKeyOf(new Date().toISOString(), timeZone)}?${query}`}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("viewMyDay")}
          </Link>
        }
      />
      <div className="space-y-2 p-4">
        {error ? (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{errorText(error, errorCode)}</p>
            <Button variant="outline" onClick={refresh}>
              {tc("retry")}
            </Button>
          </div>
        ) : !data ? (
          <div role="status" aria-label={t("loadingAria")}>
            <Skeleton className="h-48" />
          </div>
        ) : null}
        {data?.days.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("emptyTitle")}</p>
        )}
        {data?.days.slice(0, limit).map((day) => (
          <Link key={day.date} href={`/journal/${day.date}?${query}`} className="block">
            <Card className="transition-colors hover:border-ring">
              <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
                <div className="w-full shrink-0 sm:w-28">
                  <div className="text-sm font-medium">
                    {format.date(`${day.date}T00:00:00Z`, undefined, "UTC")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {weekdayFormatter.format(new Date(`${day.date}T00:00:00Z`))}
                  </div>
                </div>
                {day.stats ? (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <Pnl value={day.stats.netPnl} className="w-24 font-semibold" />
                    <span className="text-muted-foreground">
                      {t("tradeCount", { count: day.stats.trades })}
                    </span>
                    <span className="text-muted-foreground">
                      {day.stats.trades > 0
                        ? `${format.percent(day.stats.wins / day.stats.trades, 0)} ${t("win")}`
                        : t("winLoss")}
                    </span>
                    <span className="text-muted-foreground">
                      {t("winLossCount", { wins: day.stats.wins, losses: day.stats.losses })}
                    </span>
                  </div>
                ) : (
                  <div className="flex-1 text-sm text-muted-foreground">
                    {t("tradeCount", { count: 0 })}
                  </div>
                )}
                {day.hasNote && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <NotebookPen className="h-3.5 w-3.5" />
                    {t("hasNote")}
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
        {data && data.days.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs text-muted-foreground">
            <span role="status">
              {t("showingDays", {
                shown: Math.min(limit, data.days.length),
                total: data.days.length,
              })}
            </span>
            {limit < data.days.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleWindow({ query, limit: limit + PAGE_SIZE })}
              >
                {t("showOlderDays")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
