"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { Card, CardContent } from "./ui/card";
import { useVizTokens, tooltipStyle } from "./charts/tokens";
import { useFormat } from "@/lib/use-format";
import { cashSummary, currencyDigits } from "@/lib/prop-firms";

type Summary = ReturnType<typeof cashSummary>;
export function PropCashSummary({
  summary,
  currency,
  privacy,
}: {
  summary: Summary;
  currency: string;
  privacy: boolean;
}) {
  const t = useTranslations("PropFirms");
  const format = useFormat();
  const money = (value: number) =>
    privacy
      ? "••••"
      : currency
        ? format.money(value / 10 ** currencyDigits(currency), currency)
        : "—";
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-[var(--loss)]" />
            {t("summary.moneySpent")}
          </p>
          <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums">
            {money(summary.spent)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">{t("summary.spentNote")}</p>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs">
            <span className="text-muted-foreground">
              {t("summary.refunded")}{" "}
              <span className="text-foreground">{money(summary.refunds)}</span>
            </span>
            <span className="text-muted-foreground">
              {t("summary.netCost")}{" "}
              <span className="text-foreground">{money(summary.netSpend)}</span>
            </span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
            {t("summary.payoutsReceived")}
          </p>
          <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums">
            {money(summary.received)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">{t("summary.receivedNote")}</p>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            {t("summary.pendingNote")}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-muted/30">
        <CardContent className="p-5 sm:p-6">
          <p className="text-sm font-medium">{t("summary.netAfterCosts")}</p>
          <p
            className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums"
            style={{
              color:
                privacy || !currency
                  ? undefined
                  : summary.net < 0
                    ? "var(--loss)"
                    : summary.net > 0
                      ? "var(--profit)"
                      : undefined,
            }}
          >
            {money(summary.net)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">{t("summary.netNote")}</p>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            {t("summary.roiLabel")}{" "}
            <span className="text-foreground">
              {privacy
                ? "••••"
                : !currency || summary.roi === null
                  ? "—"
                  : format.percent(summary.roi)}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
export function PropCashComparison({
  months,
  currency,
  privacy,
}: {
  months: (Summary & { month: string })[];
  currency: string;
  privacy: boolean;
}) {
  const t = useTranslations("PropFirms");
  const format = useFormat();
  const tokens = useVizTokens();
  const divisor = currency ? 10 ** currencyDigits(currency) : 1;
  const rows = [...months]
    .reverse()
    .map((row) => ({ ...row, spent: row.spent / divisor, received: row.received / divisor }));
  const compact = (value: number) =>
    new Intl.NumberFormat(format.locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{t("comparison.title")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("comparison.subtitle")}
              {currency ? ` · ${currency}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--loss)]" />
              {t("comparison.spentSeries")}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--brand)]" />
              {t("comparison.receivedSeries")}
            </span>
          </div>
        </div>
        {privacy || !currency || !rows.length ? (
          <p className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">
            {privacy
              ? t("comparison.hiddenPrivacy")
              : !currency
                ? t("comparison.chooseCurrency")
                : t("comparison.recordToStart")}
          </p>
        ) : (
          <div className="h-64 min-w-0 sm:h-72">
            {tokens && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  accessibilityLayer
                  data={rows}
                  margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid vertical={false} stroke={tokens.gridline} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                    tick={{ fill: tokens.inkMuted, fontSize: 11 }}
                    tickFormatter={(v) =>
                      format.date(`${v}-01T12:00:00Z`, {
                        month: "short",
                        year: "2-digit",
                        timeZone: "UTC",
                      })
                    }
                  />
                  <YAxis
                    width={65}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: tokens.inkMuted, fontSize: 11 }}
                    tickFormatter={(v) => compact(Number(v))}
                  />
                  <ReferenceLine y={0} stroke={tokens.baseline} />
                  <Tooltip
                    cursor={{ fill: tokens.gridline, opacity: 0.35 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div style={tooltipStyle(tokens)}>
                          <p className="mb-1 font-medium">
                            {format.date(`${String(label)}-01T12:00:00Z`, {
                              month: "short",
                              year: "numeric",
                              timeZone: "UTC",
                            })}
                          </p>
                          {payload.map((item) => (
                            <p key={String(item.dataKey)}>
                              {item.name}: {format.money(Number(item.value), currency)}
                            </p>
                          ))}
                          <p>
                            {t("comparison.refunds")}:{" "}
                            {format.money(payload[0]!.payload.refunds / divisor, currency)}
                          </p>
                          <p className="mt-1 border-t pt-1">
                            {t("comparison.netAfterCosts")}:{" "}
                            {format.money(payload[0]!.payload.net / divisor, currency)}
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    name={t("comparison.spentSeries")}
                    dataKey="spent"
                    fill={tokens.loss}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                  <Bar
                    name={t("comparison.receivedSeries")}
                    dataKey="received"
                    fill={tokens.brand}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">{t("comparison.refundsNote")}</p>
      </CardContent>
    </Card>
  );
}
