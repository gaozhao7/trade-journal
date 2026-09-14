"use client";

import type { AnalysisFilters, BucketStats } from "@luxalgo/journal-core";
import { useTranslations } from "next-intl";
import { TimeHeatmap } from "./charts/time-heatmap";
import { ReviewExport } from "./review-export";
import { MonetaryValue, usePrivacy } from "./privacy";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useApi } from "@/lib/use-api";
import { useErrorText } from "@/lib/i18n-error";
import { useFormat } from "@/lib/use-format";
import { pnlClass } from "@/lib/utils";
import { describeFilters } from "@/lib/filter-description";

interface OverviewData {
  buckets: Record<
    "symbol" | "tag" | "mistake" | "playbook" | "weekday" | "hour" | "duration" | "direction",
    BucketStats[]
  >;
  currencies: string[];
  timeZone: string;
  accounts: { id: string; name: string }[];
  playbooks: { id: string; name: string }[];
}

// Keep the original overview's aggregations and ordering alongside the advanced reports.
const SECTIONS = [
  "symbol",
  "direction",
  "weekday",
  "duration",
  "tag",
  "mistake",
  "playbook",
] as const;

export function ReportOverview({ query, filters }: { query: string; filters: AnalysisFilters }) {
  const t = useTranslations("Reports");
  const tf = useTranslations("Filter");
  const format = useFormat();
  const errorText = useErrorText();
  const privateMode = usePrivacy();
  const { data, error, errorCode, loading } = useApi<OverviewData>(`/api/stats?${query}`);
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorText(error, errorCode)}
      </p>
    );
  if (loading || !data) return <Skeleton className="h-72" />;
  if (data.currencies.length > 1)
    return (
      <p className="rounded-lg border p-4 text-sm">
        {t("overviewMultiCurrency", { currencies: data.currencies.join(", ") })}
      </p>
    );
  const currency = data.currencies[0] ?? "USD";
  const label = (dimension: string, key: string) =>
    dimension === "playbook" ? (data.playbooks.find((book) => book.id === key)?.name ?? key) : key;
  const filterLine = describeFilters(filters, {
    translate: (key) => tf(`description.${key}`),
    option: (group, value) => tf(`options.${group}.${value}`),
    accounts: data.accounts,
    playbooks: data.playbooks,
    privateMode,
    weekday: format.weekdayShort,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("overviewHeader", { timeZone: data.timeZone, currency })}
        </p>
        <ReviewExport
          containsFinancialData
          document={{
            title: t("overviewTitle"),
            subtitle: `${data.timeZone} · ${currency}`,
            lines: [
              t("filtersLine", { value: filterLine }),
              "",
              t("tradeTimePerformance"),
              ...data.buckets.hour.map((b) =>
                t("hourLine", {
                  hour: b.key,
                  trades: format.number(b.trades, 0),
                  pnl: format.money(b.netPnl, currency),
                }),
              ),
              ...SECTIONS.flatMap((key) => [
                "",
                t(`sections.${key}`),
                ...data.buckets[key].map((b) =>
                  t("bucketLine", {
                    label: label(key, b.key),
                    trades: format.number(b.trades, 0),
                    winRate: format.percent(b.winRate, 0),
                    pnl: format.money(b.netPnl, currency),
                  }),
                ),
              ]),
            ],
          }}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("tradeTimePerformance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeHeatmap hours={data.buckets.hour} currency={currency} />
          </CardContent>
        </Card>
        {SECTIONS.map((section) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle>{t(`sections.${section}`)}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.buckets[section].length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {section === "tag" || section === "mistake" || section === "playbook"
                    ? t("overviewEmptyAnnotate")
                    : t("overviewEmptyNoData")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t(`dimensions.${section}`)}</TableHead>
                      <TableHead className="text-right">{t("overviewTableTrades")}</TableHead>
                      <TableHead className="text-right">{t("overviewTableWinPct")}</TableHead>
                      <TableHead className="text-right">{t("overviewTableNetPnl")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.buckets[section].map((bucket) => (
                      <TableRow key={bucket.key}>
                        <TableCell className="font-medium">{label(section, bucket.key)}</TableCell>
                        <TableCell className="tnum text-right text-muted-foreground">
                          {format.number(bucket.trades, 0)}
                        </TableCell>
                        <TableCell className="tnum text-right">
                          {format.percent(bucket.winRate, 0)}
                        </TableCell>
                        <TableCell className={`tnum text-right ${pnlClass(bucket.netPnl)}`}>
                          <MonetaryValue>{format.money(bucket.netPnl, currency)}</MonetaryValue>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("overviewNotes")}</p>
    </div>
  );
}
