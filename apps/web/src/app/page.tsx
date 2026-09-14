"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import type {
  CalendarMonth,
  DayStats,
  EdgeScore,
  EquityPoint,
  TradeMetrics,
} from "@luxalgo/journal-core";
import { dayKeyOf, relativeDrawdownCurve } from "@luxalgo/journal-core";
import { CalendarPnl } from "@/components/calendar-pnl";
import { DailyBars } from "@/components/charts/daily-bars";
import { EdgeRadar } from "@/components/charts/edge-radar";
import { EquityArea } from "@/components/charts/equity-area";
import { Gauge } from "@/components/charts/gauge";
import { RelativeDrawdownBars } from "@/components/charts/relative-drawdown-bars";
import { TimeHeatmap } from "@/components/charts/time-heatmap";
import {
  Activity,
  ArrowUpDown,
  CalendarCheck,
  CalendarCheck2,
  CalendarDays,
  ChartColumn,
  ChartLine,
  CircleDollarSign,
  Clock3,
  Flame,
  Gauge as GaugeIcon,
  Percent,
  Scale,
  Sigma,
  Target,
  Timer,
  TrendingDown,
  Trophy,
  Wallet,
} from "lucide-react";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { AddTradeDialog } from "@/components/add-trade-dialog";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MonetaryValue } from "@/components/privacy";
import { Pnl } from "@/components/pnl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpHint, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { postJson, useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/use-format";
import { useTranslations } from "next-intl";

interface Bucket {
  key: string;
  trades: number;
  netPnl: number;
  winRate: number | null;
}

interface StatsPayload {
  timeZone: string;
  metrics: TradeMetrics;
  initialBalance: number;
  edgeScore: EdgeScore;
  days: DayStats[];
  dailyCumulative: EquityPoint[];
  calendar: CalendarMonth;
  buckets: Record<"symbol" | "weekday" | "hour" | "duration" | "direction", Bucket[]>;
  openPositions: {
    key: string;
    symbol: string;
    direction: string;
    openedAt: string;
    quantity: number;
    avgEntry: number;
  }[];
  recentTrades: { key: string; symbol: string; closedAt: string; netPnl: number; status: string }[];
}

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const t = useTranslations("Dashboard");
  const { query } = useFilters();
  const { data, loading, error, refresh } = useApi<StatsPayload>(`/api/stats?${query}`);

  return (
    <>
      <FilterBar title={t("title")} actions={<AddTradeDialog onSaved={refresh} />} />
      <DashboardContent
        data={data}
        loading={loading}
        error={error}
        refresh={refresh}
        query={query}
      />
    </>
  );
}

function DashboardContent({
  data,
  loading,
  error,
  refresh,
  query,
}: {
  data: StatsPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  query: string;
}) {
  const t = useTranslations("Dashboard");
  const tf = useTranslations("Filter");
  const tn = useTranslations("Navigation");
  const format = useFormat();
  const statusLabel = (value: string) =>
    value === "win"
      ? tf("options.status.win")
      : value === "loss"
        ? tf("options.status.loss")
        : value === "breakeven"
          ? tf("options.status.breakeven")
          : value;
  const directionLabel = (value: string) =>
    value === "long"
      ? tf("options.direction.long")
      : value === "short"
        ? tf("options.direction.short")
        : value;
  if (loading && !data) return <DashboardSkeleton />;
  if (!data)
    return (
      <div>
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {error ?? t("loadError")}
          </p>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            onClick={refresh}
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    );
  const { metrics: m, edgeScore } = data;

  if (m.totalTrades === 0)
    return query ? (
      <div>
        <p className="p-12 text-center text-sm text-muted-foreground">{t("noMatch")}</p>
      </div>
    ) : (
      <EmptyState />
    );

  // Momentum: net P&L of the last 7 calendar days vs the 7 before them.
  // Hidden when either window has no trading days (e.g. the 7D range).
  const weekDelta = (() => {
    const now = Date.now();
    let last = 0;
    let prior = 0;
    let lastDays = 0;
    let priorDays = 0;
    for (const day of data.days) {
      const ageDays = (now - Date.parse(`${day.date}T00:00:00Z`)) / 86_400_000;
      if (ageDays <= 7) {
        last += day.netPnl;
        lastDays++;
      } else if (ageDays <= 14) {
        prior += day.netPnl;
        priorDays++;
      }
    }
    return lastDays > 0 && priorDays > 0 ? last - prior : null;
  })();
  const bestDay = data.days.length
    ? data.days.reduce((a, b) => (b.netPnl > a.netPnl ? b : a))
    : null;
  const worstDay = data.days.length
    ? data.days.reduce((a, b) => (b.netPnl < a.netPnl ? b : a))
    : null;

  return (
    <>
      <DashboardLayout
        widgets={[
          {
            id: "widget-0",
            label: t("stat.netPnl"),
            icon: Wallet,
            size: "small",
            layoutGroup: "summary",
            content: (
              <Card className="h-full">
                <StatHeader
                  title={t("stat.netPnl")}
                  icon={CircleDollarSign}
                  hint={t("stat.netPnlHint")}
                />
                <CardContent>
                  <Pnl value={m.netPnl} className="text-3xl font-semibold tracking-tight" />
                  {weekDelta !== null && (
                    <div
                      className={cn(
                        "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        weekDelta >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss",
                      )}
                    >
                      {weekDelta >= 0 ? "▲" : "▼"}{" "}
                      <MonetaryValue>{format.money(Math.abs(weekDelta))}</MonetaryValue>{" "}
                      {t("stat.vsPrior7d")}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("stat.closedTrades", { count: m.closedTrades })} ·{" "}
                    <MonetaryValue>{format.money(m.fees)}</MonetaryValue> {t("stat.fees")}
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-1",
            label: t("stat.winRate"),
            icon: Percent,
            size: "small",
            layoutGroup: "summary",
            content: (
              <Card className="h-full">
                <StatHeader title={t("stat.winRate")} icon={Target} hint={t("stat.winRateHint")} />
                <CardContent className="flex items-center justify-between gap-2">
                  <Gauge value={m.winRate} label={t("stat.gaugeWinRate")} />
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <div>{format.number(m.wins, 0)} W</div>
                    <div>{format.number(m.breakevens, 0)} BE</div>
                    <div>{format.number(m.losses, 0)} L</div>
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-2",
            label: t("stat.profitFactor"),
            icon: Scale,
            size: "small",
            layoutGroup: "summary",
            content: (
              <Card className="h-full">
                <StatHeader
                  title={t("stat.profitFactor")}
                  icon={Scale}
                  hint={t("stat.profitFactorHint")}
                />
                <CardContent>
                  <div className="text-3xl font-semibold tracking-tight tnum">
                    {m.profitFactorIsInfinite
                      ? "∞"
                      : m.profitFactor === null
                        ? "–"
                        : format.number(m.profitFactor)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("stat.grossProfitDivLoss")}
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-3",
            label: t("stat.dayWinRate"),
            icon: CalendarCheck,
            size: "small",
            layoutGroup: "summary",
            content: (
              <Card className="h-full">
                <StatHeader
                  title={t("stat.dayWinRate")}
                  icon={CalendarCheck2}
                  hint={t("stat.dayWinRateHint")}
                />
                <CardContent className="flex items-center justify-between gap-2">
                  <Gauge value={m.dayWinRate} label={t("stat.gaugeDayWinRate")} />
                  <div className="text-xs text-muted-foreground">
                    {t("stat.tradingDays", { count: m.tradingDays })}
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-4",
            label: t("stat.avgWinLoss"),
            icon: ArrowUpDown,
            size: "small",
            layoutGroup: "summary",
            content: (
              <Card className="h-full">
                <StatHeader
                  title={t("stat.avgWinLoss")}
                  icon={ArrowUpDown}
                  hint={t("stat.avgWinLossHint")}
                />
                <CardContent>
                  <div className="text-3xl font-semibold tracking-tight tnum">
                    {m.avgWinLossRatio === null ? "–" : format.number(m.avgWinLossRatio)}
                  </div>
                  {m.avgWin !== null && m.avgLoss !== null && m.avgWin + m.avgLoss > 0 && (
                    <div
                      className="journal-progress-visual mt-2 flex h-1.5 gap-0.5"
                      role="img"
                      aria-label={t("stat.avgWinLossImgAria")}
                    >
                      <span
                        className="rounded-full bg-profit"
                        style={{
                          width: `${Math.round((m.avgWin / (m.avgWin + m.avgLoss)) * 1000) / 10}%`,
                        }}
                      />
                      <span className="flex-1 rounded-full bg-loss" />
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span className="text-profit">
                      {m.avgWin === null ? (
                        "–"
                      ) : (
                        <MonetaryValue>{format.money(m.avgWin)}</MonetaryValue>
                      )}
                    </span>{" "}
                    {t("stat.avgWin")} ·{" "}
                    <span className="text-loss">
                      {m.avgLoss === null ? (
                        "–"
                      ) : (
                        <MonetaryValue>{format.money(-m.avgLoss)}</MonetaryValue>
                      )}
                    </span>{" "}
                    {t("stat.avgLoss")}
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-5",
            label: t("stat.edgeScore"),
            icon: GaugeIcon,
            size: "medium",
            layoutGroup: "visuals",
            content: (
              <Card className="dashboard-visual-card h-full">
                <CardHeader className="flex-row items-center justify-between">
                  <div className="flex min-w-0 items-center gap-1">
                    <CardTitle>{t("stat.edgeScore")}</CardTitle>
                    <HelpHint heading={t("stat.edgeScore")}>{t("stat.edgeScoreHint")}</HelpHint>
                  </div>
                  <span className="text-2xl font-semibold tracking-tight tnum">
                    {edgeScore.score === null ? (
                      "–"
                    ) : (
                      <span className="text-brand">{format.number(edgeScore.score, 0)}</span>
                    )}
                    <span className="text-xs text-muted-foreground"> /100</span>
                  </span>
                </CardHeader>
                <CardContent className="dashboard-visual-card-content">
                  {edgeScore.score === null ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t.rich("stat.edgeScoreEmpty", {
                        readIt: (chunks) => (
                          <a
                            className="underline"
                            href="https://github.com/LuxAlgo/trade-journal/blob/main/docs/edge-score.md"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {chunks}
                          </a>
                        ),
                      })}
                    </p>
                  ) : (
                    <EdgeRadar components={edgeScore.components} height="100%" />
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-6",
            label: t("stat.cumulativePnl"),
            icon: ChartLine,
            size: "medium",
            layoutGroup: "visuals",
            content: (
              <Card className="dashboard-visual-card h-full">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>{t("stat.cumulativePnl")}</CardTitle>
                  <HelpHint heading={t("stat.cumulativePnl")}>
                    {t("stat.cumulativePnlHint")}
                  </HelpHint>
                </CardHeader>
                <CardContent>
                  <EquityArea
                    data={data.dailyCumulative.map((p) => ({ t: p.t, cumNetPnl: p.cumNetPnl }))}
                  />
                  <RelativeDrawdownBars
                    data={relativeDrawdownCurve(data.dailyCumulative, data.initialBalance)}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-7",
            label: t("stat.dailyPnl"),
            icon: ChartColumn,
            size: "medium",
            layoutGroup: "visuals",
            content: (
              <Card className="dashboard-visual-card h-full">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>{t("stat.dailyPnl")}</CardTitle>
                  <HelpHint heading={t("stat.dailyPnl")}>{t("stat.dailyPnlHint")}</HelpHint>
                </CardHeader>
                <CardContent className="dashboard-visual-card-content">
                  <DailyBars
                    data={data.days.map((d) => ({ date: d.date, netPnl: d.netPnl }))}
                    height="100%"
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-8",
            label: tn("calendar"),
            icon: CalendarDays,
            size: "wide",
            layoutGroup: "detail",
            content: (
              <Card className="h-full">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>
                    {format.date(
                      new Date(Date.UTC(data.calendar.year, data.calendar.month - 1, 1)),
                      { month: "long", year: "numeric" },
                      "UTC",
                    )}
                  </CardTitle>
                  <Link
                    href={`/calendar?${query}`}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {t("stat.fullCalendar")}
                  </Link>
                </CardHeader>
                <CardContent>
                  <CalendarPnl calendar={data.calendar} />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-9",
            label: t("stat.activity"),
            icon: Activity,
            size: "medium",
            layoutGroup: "detail",
            content: (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{t("stat.activity")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="recent">
                    <TabsList className="h-8">
                      <TabsTrigger value="recent" className="text-xs">
                        {t("stat.recentTrades")}
                      </TabsTrigger>
                      <TabsTrigger value="open" className="text-xs">
                        {t("stat.openPositions")}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="recent" className="space-y-1">
                      {data.recentTrades.length === 0 && <Empty label={t("stat.noClosedTrades")} />}
                      {data.recentTrades.map((trade) => (
                        <Link
                          key={trade.key}
                          href={`/trades/${encodeURIComponent(trade.key)}?${query}`}
                          className="dashboard-activity-row flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/60"
                        >
                          <span className="flex items-center gap-2">
                            <Badge
                              variant={
                                trade.status === "win"
                                  ? "profit"
                                  : trade.status === "loss"
                                    ? "loss"
                                    : "secondary"
                              }
                            >
                              {statusLabel(trade.status)}
                            </Badge>
                            {trade.symbol}
                          </span>
                          <span className="dashboard-activity-detail flex items-center">
                            <span className="text-xs text-muted-foreground">
                              {trade.closedAt && dayKeyOf(trade.closedAt, data.timeZone)}
                            </span>
                            <Pnl value={trade.netPnl} />
                          </span>
                        </Link>
                      ))}
                    </TabsContent>
                    <TabsContent value="open" className="space-y-1">
                      {data.openPositions.length === 0 && <Empty label={t("stat.flatNoOpen")} />}
                      {data.openPositions.map((position) => (
                        <div
                          key={position.key}
                          className="dashboard-activity-row flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary">{directionLabel(position.direction)}</Badge>
                            {position.symbol}
                          </span>
                          <span className="tnum text-xs text-muted-foreground">
                            {format.number(position.quantity, 4)} @{" "}
                            <MonetaryValue>{format.number(position.avgEntry)}</MonetaryValue>
                          </span>
                        </div>
                      ))}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-10",
            label: t("stat.maxDrawdown"),
            icon: TrendingDown,
            size: "small",
            layoutGroup: "secondary",
            content: (
              <Card className="h-full">
                <StatHeader
                  title={t("stat.maxDrawdown")}
                  icon={TrendingDown}
                  hint={t("stat.maxDrawdownHint")}
                />
                <CardContent>
                  <div className="text-xl font-semibold tnum text-loss">
                    <MonetaryValue>{format.money(-m.maxDrawdown)}</MonetaryValue>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {m.maxDrawdownPct === null
                      ? t("stat.setInitialBalanceForPct")
                      : format.percent(m.maxDrawdownPct)}
                    {m.recoveryFactor !== null &&
                      ` · ${t("stat.recovery", { value: format.number(m.recoveryFactor) })}`}
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-11",
            label: t("stat.streaks"),
            icon: Flame,
            size: "small",
            layoutGroup: "secondary",
            content: (
              <Card className="h-full">
                <StatHeader title={t("stat.streaks")} icon={Flame} hint={t("stat.streaksHint")} />
                <CardContent>
                  <div className="text-xl font-semibold tnum">
                    {m.currentStreak > 0
                      ? `${format.number(m.currentStreak, 0)}W`
                      : m.currentStreak < 0
                        ? `${format.number(-m.currentStreak, 0)}L`
                        : "–"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("stat.best")} {format.number(m.maxWinStreak, 0)}W · {t("stat.worst")}{" "}
                    {format.number(m.maxLossStreak, 0)}L
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-12",
            label: t("stat.expectancy"),
            icon: Target,
            size: "small",
            layoutGroup: "secondary",
            content: (
              <Card className="h-full">
                <StatHeader
                  title={t("stat.expectancy")}
                  icon={Sigma}
                  hint={t("stat.expectancyHint")}
                />
                <CardContent>
                  {m.expectancy === null ? (
                    "–"
                  ) : (
                    <Pnl value={m.expectancy} className="text-xl font-semibold" />
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {m.avgRealizedR !== null && m.tradesWithRisk > 0
                      ? t("stat.avgR", {
                          r: format.number(m.avgRealizedR),
                          count: m.tradesWithRisk,
                        })
                      : t("stat.tagStopLosses")}
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-13",
            label: t("stat.avgDuration"),
            icon: Timer,
            size: "small",
            layoutGroup: "secondary",
            content: (
              <Card className="h-full">
                <StatHeader
                  title={t("stat.avgDuration")}
                  icon={Timer}
                  hint={t("stat.avgDurationHint")}
                />
                <CardContent>
                  <div className="text-xl font-semibold tnum">
                    {format.duration(m.avgDurationMs)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("stat.winnersVsLosers")}
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-14",
            label: t("stat.bestWorstDay"),
            icon: CalendarCheck,
            size: "small",
            layoutGroup: "secondary",
            content: (
              <Card className="h-full">
                <StatHeader
                  title={t("stat.bestWorstDay")}
                  icon={Trophy}
                  hint={t("stat.bestWorstDayHint")}
                />
                <CardContent className="space-y-1">
                  {bestDay && (
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <Pnl value={bestDay.netPnl} className="text-base font-semibold" />
                      <span className="text-xs text-muted-foreground">
                        {format.date(bestDay.date, { month: "short", day: "numeric" }, "UTC")}
                      </span>
                    </div>
                  )}
                  {worstDay && (
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <Pnl value={worstDay.netPnl} className="text-base font-semibold" />
                      <span className="text-xs text-muted-foreground">
                        {format.date(worstDay.date, { month: "short", day: "numeric" }, "UTC")}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            id: "widget-15",
            label: t("stat.tradeTimePerformance"),
            icon: Clock3,
            size: "full",
            layoutGroup: "full",
            content: (
              <Card className="h-full">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>{t("stat.tradeTimePerformance")}</CardTitle>
                  <HelpHint heading={t("stat.tradeTimePerformance")}>
                    {t("stat.tradeTimePerformanceHint")}
                  </HelpHint>
                </CardHeader>
                <CardContent>
                  <TimeHeatmap
                    hours={data.buckets.hour.map((b) => ({
                      key: b.key,
                      netPnl: b.netPnl,
                      trades: b.trades,
                    }))}
                  />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}

/** Stat-tile header: quiet label left, metric icon with an explainer right. */
function StatHeader({
  title,
  hint,
  icon: Icon,
}: {
  title: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const t = useTranslations("Dashboard");
  return (
    <CardHeader className="flex-row items-center justify-between space-y-0">
      <CardTitle>{title}</CardTitle>
      <Tooltip>
        <TooltipTrigger className="cursor-help" aria-label={t("stat.about", { title })}>
          <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
        </TooltipTrigger>
        <TooltipContent>
          <div className="mb-1 font-semibold">{title}</div>
          <div className="text-muted-foreground">{hint}</div>
        </TooltipContent>
      </Tooltip>
    </CardHeader>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

function EmptyState() {
  const t = useTranslations("Dashboard");
  const tn = useTranslations("Navigation");
  const common = useTranslations("Common");
  const [loadingDemo, setLoadingDemo] = useState(false);
  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      await postJson("/api/demo", {});
      window.location.reload();
    } catch {
      setLoadingDemo(false);
    }
  };
  return (
    <div>
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <h2 className="text-xl font-semibold">{t("empty.title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("empty.description")}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/import"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("empty.import")}
          </Link>
          <button
            onClick={loadDemo}
            disabled={loadingDemo}
            className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {loadingDemo ? common("loading") : t("empty.loadDemo")}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("empty.demoNote", { accounts: tn("accounts") })}
        </p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="dashboard-grid-stage space-y-3 p-4">
        <div className="dashboard-grid grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} data-card-size="small" className="dashboard-grid-card h-28" />
          ))}
        </div>
        <div className="dashboard-grid grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} data-card-size="medium" className="dashboard-grid-card h-72" />
          ))}
        </div>
      </div>
    </div>
  );
}
