"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  clockLabel,
  plotTradePoints,
  type PlottedTrade,
  type TradeExplorerResponse,
  type TradeXAxis,
  type TradeYAxis,
} from "@/lib/trade-explorer";
import { useApi } from "@/lib/use-api";
import { useErrorText } from "@/lib/i18n-error";
import { useFormat } from "@/lib/use-format";
import { ReportMarketEstimates } from "./report-market-estimates";
import { MonetaryValue } from "./privacy";
import { Pnl } from "./pnl";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { OptionSelect } from "./ui/option-select";
import { Skeleton } from "./ui/skeleton";

function ScatterLoading() {
  const t = useTranslations("Reports");
  return (
    <div role="status" aria-label={t("loadingScatter")}>
      <Skeleton className="h-80" />
    </div>
  );
}
const TradeScatter = dynamic(
  () => import("./charts/trade-scatter").then((module) => module.TradeScatter),
  { loading: () => <ScatterLoading /> },
);
const PAGE_SIZE = 25;
const detailHref = (key: string) => `/trades/${encodeURIComponent(key)}`;

export function TradeExplorer({ query }: { query: string }) {
  const t = useTranslations("Reports");
  const tf = useTranslations("Filter");
  const format = useFormat();
  const errorText = useErrorText();
  const { data, error, errorCode, loading, refresh } = useApi<TradeExplorerResponse>(
    `/api/trade-explorer?${query}`,
  );
  const [x, setX] = useState<TradeXAxis>("durationMinutes");
  const [y, setY] = useState<TradeYAxis>("netPnl");
  const [selected, setSelected] = useState<PlottedTrade | null>(null);
  const [page, setPage] = useState(0);
  const [tableOpen, setTableOpen] = useState(false);
  const points = useMemo(() => plotTradePoints(data?.points ?? [], x, y), [data, x, y]);
  const directionLabel = (value: string) =>
    value === "long"
      ? tf("options.direction.long")
      : value === "short"
        ? tf("options.direction.short")
        : value;
  if (loading && !data)
    return (
      <div role="status" aria-label={t("loadingExplorer")}>
        <Skeleton className="h-96" />
      </div>
    );
  if (error || !data)
    return (
      <div role="alert" className="rounded-xl border p-5">
        <p className="text-sm text-destructive">
          {error ? errorText(error, errorCode) : t("explorerLoadError")}
        </p>
        <Button onClick={refresh} variant="outline" size="sm" className="mt-3">
          {t("tryAgain")}
        </Button>
      </div>
    );
  const currency = data.currencies[0] ?? "USD";
  const excursion = x === "mae" || x === "mfe" || y === "mae" || y === "mfe";
  const blocked = (y !== "realizedR" || excursion) && data.currencies.length > 1;
  const axisOption = (axis: TradeXAxis | TradeYAxis) =>
    axis === "durationMinutes"
      ? t("axisDurationMinutes")
      : axis === "entryMinute"
        ? t("axisEntryTimeShort")
        : axis === "netPnl"
          ? t("axisNetPnlShort")
          : axis === "realizedR"
            ? t("axisRealizedR")
            : axis === "mae"
              ? t("axisMae")
              : t("axisMfe");
  const xTitle =
    x === "durationMinutes"
      ? t("axisDurationMinutes")
      : x === "entryMinute"
        ? t("axisEntryTime", { timeZone: data.timeZone })
        : t("axisEstimatedCurrency", { axis: x === "mae" ? "MAE" : "MFE", currency });
  const yTitle =
    y === "netPnl"
      ? t("axisNetPnl", { currency })
      : y === "realizedR"
        ? t("axisRealizedR")
        : t("axisEstimatedCurrency", { axis: y === "mae" ? "MAE" : "MFE", currency });
  const value = (point: PlottedTrade) =>
    y === "mae" || y === "mfe" ? (
      <MonetaryValue>{format.money(point.y, currency)}</MonetaryValue>
    ) : y === "netPnl" ? (
      <Pnl value={point.y} currency={currency} />
    ) : (
      <span className="tabular-nums">
        {point.y > 0 ? "+" : ""}
        {format.number(point.y, 2)}R
      </span>
    );
  const xValue = (point: PlottedTrade) =>
    x === "mae" || x === "mfe" ? (
      <MonetaryValue>{format.money(point.x, currency)}</MonetaryValue>
    ) : x === "entryMinute" ? (
      clockLabel(point.x)
    ) : (
      t("minutesValue", { value: format.number(point.x, 2) })
    );
  const pages = Math.ceil(points.length / PAGE_SIZE);
  const shownPage = Math.min(page, Math.max(0, pages - 1));
  const table = (
    <div className="space-y-3 px-4 pb-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="pb-3 text-left text-muted-foreground">
            {t("tableCaption", { count: points.length })}
          </caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-3">
                {t("tradeClosed")}
              </th>
              <th scope="col" className="px-2 text-right">
                {xTitle}
              </th>
              <th scope="col" className="pl-2 text-right">
                {yTitle}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE).map((point) => (
              <tr key={point.key} className="border-b last:border-0">
                <th scope="row" className="py-3 pr-3 font-normal">
                  <Link
                    href={detailHref(point.key)}
                    className="rounded underline underline-offset-4"
                  >
                    <span className="break-all font-medium">
                      {point.symbol} · {directionLabel(point.direction)}
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      {format.dateTime(new Date(point.closedAt), undefined, data.timeZone)}
                    </span>
                  </Link>
                </th>
                <td className="px-2 text-right tabular-nums">{xValue(point)}</td>
                <td className="pl-2 text-right">{value(point)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={shownPage === 0}
            onClick={() => setPage(shownPage - 1)}
          >
            {t("previous")}
          </Button>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {t("pageOf", { page: format.number(shownPage + 1, 0), total: format.number(pages, 0) })}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={shownPage === pages - 1}
            onClick={() => setPage(shownPage + 1)}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </div>
  );
  return (
    <section className="space-y-4" aria-labelledby="trade-explorer-title" data-trade-explorer>
      <div>
        <h2 id="trade-explorer-title" className="text-lg font-semibold">
          {t("explorerTitle")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("explorerSubtitle", { timeZone: data.timeZone })}
        </p>
      </div>
      <ReportMarketEstimates
        points={data.points}
        currencies={data.currencies}
        onComplete={refresh}
      />
      <div className="flex flex-wrap gap-2" aria-label={t("presetsAria")}>
        {(
          [
            ["durationMinutes", "netPnl", t("presetHolding")],
            ["mae", "netPnl", t("presetMaePnl")],
            ["mfe", "netPnl", t("presetMfePnl")],
            ["mae", "mfe", t("presetMaeMfe")],
          ] as const
        ).map(([nextX, nextY, label]) => (
          <Button
            key={label}
            size="sm"
            variant={x === nextX && y === nextY ? "secondary" : "outline"}
            onClick={() => {
              setX(nextX);
              setY(nextY);
              setSelected(null);
              setPage(0);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle>
                {excursion
                  ? `${xTitle} vs ${yTitle}`
                  : t("outcomesBy", {
                      axis: x === "durationMinutes" ? t("presetHolding") : t("axisEntryTimeShort"),
                    })}
              </CardTitle>
              <p className="mt-2 text-xs text-muted-foreground">
                {blocked
                  ? t("closedTradesCount", { count: data.points.length })
                  : t("comparableOf", {
                      comparable: points.length,
                      total: data.points.length,
                    })}{" "}
                · {t("onePointPerTrade")} ·{" "}
                {excursion ? t("grossExcursionNote") : t("afterFeesNote")}
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-44">
                <label
                  htmlFor="trade-x-axis"
                  className="mb-1.5 block text-xs text-muted-foreground"
                >
                  {t("xAxis")}
                </label>
                <OptionSelect
                  id="trade-x-axis"
                  value={x}
                  onValueChange={(value) => {
                    setX(value as TradeXAxis);
                    setSelected(null);
                    setPage(0);
                  }}
                >
                  <option value="durationMinutes">{axisOption("durationMinutes")}</option>
                  <option value="entryMinute">{axisOption("entryMinute")}</option>
                  <option value="mae">{axisOption("mae")}</option>
                  <option value="mfe">{axisOption("mfe")}</option>
                </OptionSelect>
              </div>
              <div className="min-w-0 flex-1 sm:w-44">
                <label
                  htmlFor="trade-y-axis"
                  className="mb-1.5 block text-xs text-muted-foreground"
                >
                  {t("yAxis")}
                </label>
                <OptionSelect
                  id="trade-y-axis"
                  value={y}
                  onValueChange={(value) => {
                    setY(value as TradeYAxis);
                    setSelected(null);
                    setPage(0);
                  }}
                >
                  <option value="netPnl">{axisOption("netPnl")}</option>
                  <option value="realizedR">{axisOption("realizedR")}</option>
                  <option value="mae">{axisOption("mae")}</option>
                  <option value="mfe">{axisOption("mfe")}</option>
                </OptionSelect>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.points.length === 0 ? (
            <div className="py-10 text-center">
              <h3 className="font-medium">{t("emptyTitle")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("emptyDescription")}</p>
            </div>
          ) : blocked ? (
            <p role="note" className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
              {t("blockedNote", { currencies: data.currencies.join(", ") })}
            </p>
          ) : (
            <>
              {points.length < data.points.length && (
                <p role="note" className="text-xs leading-relaxed text-muted-foreground">
                  {t("excludedPrefix", { count: data.points.length - points.length })}
                  {y === "realizedR" ? t("excludedRealizedR") : ""}
                  {excursion ? t("excludedMaeMfe") : ""}
                  {t("excludedBoth")}
                </p>
              )}
              {y === "realizedR" && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("realizedRNote")}
                </p>
              )}
              {points.length >= (excursion ? 1 : 8) ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{yTitle}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        <span aria-hidden="true" className="text-[var(--profit)]">
                          ●
                        </span>{" "}
                        {t("legendPositive")}
                      </span>
                      <span>
                        <span aria-hidden="true" className="text-[var(--loss)]">
                          ●
                        </span>{" "}
                        {t("legendNegative")}
                      </span>
                      <span>
                        <span aria-hidden="true">●</span> {t("legendZero")}
                      </span>
                    </span>
                  </div>
                  <TradeScatter
                    points={points}
                    x={x}
                    y={y}
                    currency={currency}
                    timeZone={data.timeZone}
                    onSelect={setSelected}
                  />
                  <p className="text-center text-xs text-muted-foreground">{xTitle}</p>
                  <p className="text-xs text-muted-foreground">{t("selectPointNote")}</p>
                  <div aria-live="polite">
                    {selected && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
                        <div>
                          <p className="text-sm font-medium break-all">
                            {selected.symbol} · {directionLabel(selected.direction)} ·{" "}
                            {value(selected)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {xValue(selected)} ·{" "}
                            {t("closedAt", {
                              date: format.dateTime(
                                new Date(selected.closedAt),
                                undefined,
                                data.timeZone,
                              ),
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Link
                            href={detailHref(selected.key)}
                            className="rounded text-sm underline underline-offset-4"
                          >
                            {t("openTrade")} ↗
                          </Link>
                          <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                            {t("dismiss")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-lg bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                  {points.length === 0 ? t("noDataAxes") : t("fewTrades")}
                </p>
              )}
              {points.length > 0 && points.length < 20 && (
                <p className="text-xs text-muted-foreground">{t("smallSample")}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {!blocked &&
        points.length > 0 &&
        (points.length < 8 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("comparableTrades")}</CardTitle>
            </CardHeader>
            {table}
          </Card>
        ) : (
          <details
            className="rounded-xl border bg-card"
            onToggle={(event) => setTableOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium">
              {t("exploreAll", { count: points.length })}
            </summary>
            {tableOpen && table}
          </details>
        ))}
      <p className="text-xs leading-relaxed text-muted-foreground">{t("explorerNote")}</p>
    </section>
  );
}
