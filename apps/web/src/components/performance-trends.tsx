"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MIN_TREND_POINTS, type PerformanceTrendsResponse } from "@/lib/performance-trends";
import { useApi } from "@/lib/use-api";
import { useErrorText } from "@/lib/i18n-error";
import { useFormat } from "@/lib/use-format";
import { Pnl } from "./pnl";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

function TrendChartLoading() {
  const t = useTranslations("Reports");
  return (
    <div role="status" aria-label={t("loadingTrends")}>
      <Skeleton className="h-60" />
    </div>
  );
}
const RollingTradeChart = dynamic(
  () => import("./charts/rolling-trade-chart").then((module) => module.RollingTradeChart),
  { loading: () => <TrendChartLoading /> },
);
const tradeHref = (key: string) => `/trades/${encodeURIComponent(key)}`;

export function PerformanceTrendsReport({ query }: { query: string }) {
  const t = useTranslations("Reports");
  const tf = useTranslations("Filter");
  const format = useFormat();
  const errorText = useErrorText();
  const { data, loading, error, errorCode, refresh } = useApi<PerformanceTrendsResponse>(
    `/api/performance-trends?${query}`,
  );
  const [tableOpen, setTableOpen] = useState(false);
  const directionLabel = (value: string) =>
    value === "long"
      ? tf("options.direction.long")
      : value === "short"
        ? tf("options.direction.short")
        : value;
  if (loading)
    return (
      <div role="status" aria-label={t("loadingTrends")} className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  if (error || !data)
    return (
      <div role="alert" className="rounded-xl border p-5">
        <p className="text-sm text-destructive">
          {error ? errorText(error, errorCode) : t("loadError")}
        </p>
        <Button onClick={refresh} variant="outline" size="sm" className="mt-3">
          {t("tryAgain")}
        </Button>
      </div>
    );
  const { trends, timeZone, currencies } = data;
  const currency = currencies[0] ?? "USD";
  const monetary = currencies.length <= 1;
  const latest = trends.points.at(-1);
  const chartReady = trends.points.length >= MIN_TREND_POINTS;
  return (
    <section
      className="space-y-4"
      aria-labelledby="performance-trends-title"
      data-performance-trends
    >
      <div>
        <h2 id="performance-trends-title" className="text-lg font-semibold">
          {t("modes.trends")}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("trendsSubtitle", {
            count: trends.count,
            timeZone,
            suffix: monetary && trends.count > 0 ? ` · ${currency}` : "",
          })}
        </p>
      </div>
      {trends.count === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <h3 className="font-medium">{t("emptyTitle")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("emptyDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {!monetary && (
            <p
              role="note"
              className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"
            >
              {t("mixedCurrencies", { currencies: currencies.join(", ") })}
            </p>
          )}
          <div className={`grid items-start gap-3 ${monetary ? "lg:grid-cols-2" : ""}`}>
            {(["winRate", ...(monetary ? ["avgNetPnl" as const] : [])] as const).map((metric) => {
              const rate = metric === "winRate";
              const reference = rate ? trends.overallWinRate! : trends.overallAvgNetPnl!;
              return (
                <Card key={metric} className="min-w-0 overflow-hidden">
                  <CardHeader>
                    <CardTitle>{rate ? t("winRateTrend") : t("avgPnlTrend")}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t("windowSubtitle", {
                        notes: rate ? t("breakevensIncluded") : t("afterFees"),
                      })}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("latestWindow")}</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                          {latest ? (
                            rate ? (
                              format.percent(latest.winRate, 1)
                            ) : (
                              <Pnl value={latest.avgNetPnl} currency={currency} />
                            )
                          ) : (
                            "—"
                          )}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{rate ? t("selectedWinRate") : t("selectedAverage")}</p>
                        <p className="mt-1 text-sm tabular-nums">
                          {rate ? (
                            format.percent(reference, 1)
                          ) : (
                            <Pnl value={reference} currency={currency} />
                          )}
                        </p>
                      </div>
                    </div>
                    {chartReady ? (
                      <>
                        <RollingTradeChart
                          data={trends.points}
                          metric={metric}
                          reference={reference}
                          currency={currency}
                          timeZone={timeZone}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("chartNote", {
                            metric: rate ? t("metricWinRate") : t("metricAverage"),
                          })}
                        </p>
                      </>
                    ) : (
                      <div className="rounded-lg bg-muted/30 px-4 py-6 text-sm leading-relaxed text-muted-foreground">
                        {!latest
                          ? t("needMoreTrades", { remaining: 20 - trends.count })
                          : t("windowAvailable")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {monetary && (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>{t("largestWinLose")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("largestSubtitle")}</p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["largestWinner", trends.largestWin],
                    ["largestLoser", trends.largestLoss],
                  ] as const
                ).map(([key, trade]) => (
                  <div key={key} className="min-w-0 rounded-lg border p-4">
                    <h3 className="text-xs text-muted-foreground">{t(key)}</h3>
                    {trade ? (
                      <>
                        <p className="mt-2 text-xl font-semibold">
                          <Pnl value={trade.netPnl} currency={currency} />
                        </p>
                        <Link
                          href={tradeHref(trade.key)}
                          className="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded text-sm underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-current"
                        >
                          <span className="break-all font-medium">
                            {trade.symbol} · {directionLabel(trade.direction)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format.dateTime(new Date(trade.closedAt), undefined, timeZone)} ↗
                          </span>
                        </Link>
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {t("noTradesSelection", {
                          kind: key === "largestWinner" ? t("winning") : t("losing"),
                        })}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {latest && (
            <details
              className="rounded-xl border bg-card"
              onToggle={(event) => setTableOpen(event.currentTarget.open)}
            >
              <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium">
                {t("exploreWindows")}
              </summary>
              {tableOpen && (
                <div className="max-h-72 overflow-auto px-4 pb-4">
                  <table className="w-full text-left text-xs">
                    <caption className="pb-3 text-left text-muted-foreground">
                      {t("windowsCaption", { timeZone })}
                    </caption>
                    <thead>
                      <tr className="border-b">
                        <th scope="col" className="py-2 pr-3">
                          {t("windowHeader")}
                        </th>
                        <th scope="col" className="px-2 text-right">
                          {t("winRateColumn")}
                        </th>
                        {monetary && (
                          <th scope="col" className="pl-2 text-right">
                            {t("avgNetPnl")}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {trends.points.map((point) => (
                        <tr key={point.key} className="border-b last:border-0">
                          <th scope="row" className="py-3 pr-3 font-normal">
                            <Link
                              className="rounded underline underline-offset-4"
                              href={tradeHref(point.key)}
                            >
                              #{point.sequence - 19}–{point.sequence}
                              <span className="mt-1 block text-muted-foreground">
                                {format.dateTime(new Date(point.closedAt), undefined, timeZone)}
                              </span>
                            </Link>
                          </th>
                          <td className="px-2 text-right tabular-nums">
                            {format.percent(point.winRate, 1)}
                          </td>
                          {monetary && (
                            <td className="pl-2 text-right">
                              <Pnl value={point.avgNetPnl} currency={currency} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">{t("trendsNote")}</p>
        </>
      )}
    </section>
  );
}
