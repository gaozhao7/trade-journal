"use client";
import { OptionSelect } from "@/components/ui/option-select";

import { HoverHint } from "@/components/ui/tooltip";
import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  DIMENSIONS,
  type Dimension,
  type AnalysisFilters,
  type GroupSummary,
} from "@luxalgo/journal-core";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { FilterFields, Field, fieldClass } from "@/components/filter-fields";
import { ReviewExport } from "@/components/review-export";
import { AskJournal } from "@/components/ask-journal";
import { ReportOverview } from "@/components/report-overview";
import { MonetaryValue, usePrivacy } from "@/components/privacy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApi } from "@/lib/use-api";
import { useErrorText } from "@/lib/i18n-error";
import { useFormat } from "@/lib/use-format";
import { describeFilters } from "@/lib/filter-description";

function ExplorerLoading() {
  const t = useTranslations("Reports");
  return (
    <p role="status" className="py-6 text-sm text-muted-foreground">
      {t("loadingExplorer")}
    </p>
  );
}
function TrendsLoading() {
  const t = useTranslations("Reports");
  return (
    <p role="status" className="py-6 text-sm text-muted-foreground">
      {t("loadingTrends")}
    </p>
  );
}
const TradeExplorer = dynamic(
  () => import("@/components/trade-explorer").then((module) => module.TradeExplorer),
  { loading: () => <ExplorerLoading /> },
);
const PerformanceTrendsReport = dynamic(
  () => import("@/components/performance-trends").then((module) => module.PerformanceTrendsReport),
  { loading: () => <TrendsLoading /> },
);
interface Group extends GroupSummary {
  row: string;
  column: string;
}
interface Analysis {
  accounts: { id: string; name: string }[];
  summary: GroupSummary;
  groups: Group[];
  playbooks: { id: string; name: string }[];
  currencies: string[];
  timeZone: string;
}
function Summary({ data }: { data: Analysis }) {
  const t = useTranslations("Reports");
  const format = useFormat();
  const s = data.summary;
  const currency = data.currencies[0] ?? "USD";
  const num = (n: number | null) => (n === null ? "–" : format.number(n));
  const rows = [
    ["closedTrades", format.number(s.trades, 0)],
    ["netPnl", format.money(s.netPnl, currency)],
    ["winRate", format.percent(s.winRate)],
    ["profitFactor", s.noLosses ? "∞" : num(s.profitFactor)],
    ["entryVolume", format.number(s.volume)],
    ["avgHoldingTime", format.duration(s.avgDurationMs)],
    ["avgPlannedR", num(s.avgPlannedR)],
    ["avgRealizedR", num(s.avgRealizedR)],
  ] as const;
  return (
    <div className="report-summary">
      <div className="report-summary-grid grid grid-cols-2 gap-4">
        {rows.map(([key, value]) => (
          <div key={key}>
            <p className="text-xs text-muted-foreground">{t(`summary.${key}`)}</p>
            <p className="mt-1 break-words text-base font-semibold tabular-nums sm:text-lg">
              {key === "netPnl" ? <MonetaryValue>{value}</MonetaryValue> : value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
function DimensionSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Dimension;
  onChange: (d: Dimension) => void;
}) {
  const t = useTranslations("Reports");
  return (
    <Field label={label}>
      <OptionSelect
        className={fieldClass}
        value={value}
        onValueChange={(next) => onChange(next as Dimension)}
      >
        {Object.keys(DIMENSIONS).map((key) => (
          <option key={key} value={key}>
            {t(`dimensions.${key}`)}
          </option>
        ))}
      </OptionSelect>
    </Field>
  );
}
const labels = (data: Analysis, key: string) =>
  data.playbooks.find((p) => p.id === key)?.name ?? key;
// Canonical weekday tokens come from the analysis API; they are data, not UI copy.
const WEEKDAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function GroupLabel({ dimension, children }: { dimension: Dimension; children: string }) {
  return dimension === "entryPrice" || dimension === "exitPrice" ? (
    <MonetaryValue>{children}</MonetaryValue>
  ) : (
    children
  );
}
function Breakdown({
  data,
  cross,
  primary,
  secondary,
}: {
  data: Analysis;
  cross: boolean;
  primary: Dimension;
  secondary: Dimension;
}) {
  const t = useTranslations("Reports");
  const format = useFormat();
  const currency = data.currencies[0] ?? "USD";
  const num = (n: number | null) => (n === null ? "–" : format.number(n));
  const display = (dimension: Dimension, key: string) =>
    dimension === "playbook"
      ? labels(data, key)
      : dimension === "weekday"
        ? format.weekdayShort(WEEKDAY_KEYS.indexOf(key))
        : key;
  const rowLabel = (k: string) => display(primary, k),
    colLabel = (k: string) => display(secondary, k);
  const rows = [...new Set(data.groups.map((g) => g.row))],
    columns = [...new Set(data.groups.map((g) => g.column))].sort((a, b) =>
      secondary === "weekday"
        ? WEEKDAY_KEYS.indexOf(a) - WEEKDAY_KEYS.indexOf(b)
        : a.localeCompare(b, format.locale, { numeric: true }),
    );
  if (primary === "weekday") rows.sort((a, b) => WEEKDAY_KEYS.indexOf(a) - WEEKDAY_KEYS.indexOf(b));
  const max = data.groups.reduce((max, g) => Math.max(max, Math.abs(g.netPnl)), 1);
  const cells = new Map(data.groups.map((g) => [JSON.stringify([g.row, g.column]), g]));
  return (
    <div className="space-y-4">
      {cross && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-3 text-left">
                  {t(`dimensions.${primary}`)} / {t(`dimensions.${secondary}`)}
                </th>
                {columns.map((c) => (
                  <th key={c} className="min-w-24 p-2">
                    <GroupLabel dimension={secondary}>{colLabel(c)}</GroupLabel>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r}>
                  <th className="p-3 text-left font-medium">
                    <GroupLabel dimension={primary}>{rowLabel(r)}</GroupLabel>
                  </th>
                  {columns.map((c) => {
                    const g = cells.get(JSON.stringify([r, c]));
                    return (
                      <HoverHint
                        key={c}
                        content={
                          g
                            ? t("cellTooltip", {
                                trades: g.trades,
                                winRate: format.percent(g.winRate),
                              })
                            : t("noTrades")
                        }
                      >
                        <td
                          key={c}
                          className="border border-background p-2 text-center tabular-nums"
                          style={{
                            background: g
                              ? `color-mix(in srgb, ${g.netPnl >= 0 ? "var(--profit-fill)" : "var(--loss)"} ${8 + (Math.abs(g.netPnl) / max) * 35}%, transparent)`
                              : undefined,
                          }}
                          tabIndex={0}
                        >
                          {g ? <MonetaryValue>{format.number(g.netPnl)}</MonetaryValue> : "-"}
                        </td>
                      </HoverHint>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">{t("cellValuesNote", { currency })}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              {[
                t(`dimensions.${primary}`),
                ...(cross ? [t(`dimensions.${secondary}`)] : []),
                t("table.trades"),
                t("table.winPct"),
                t("table.netPnl"),
                t("table.entryVolume"),
                t("table.avgPlannedR"),
                t("table.avgRealizedR"),
                t("table.avgDuration"),
              ].map((h) => (
                <th key={h} className="whitespace-nowrap border-b px-3 py-3 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.groups.map((g) => (
              <tr
                key={JSON.stringify([g.row, g.column])}
                className="border-b border-border/50 hover:bg-accent/30"
              >
                <td className="px-3 py-3 font-medium">
                  <GroupLabel dimension={primary}>{rowLabel(g.row)}</GroupLabel>
                </td>
                {cross && (
                  <td className="px-3 py-3">
                    <GroupLabel dimension={secondary}>{colLabel(g.column)}</GroupLabel>
                  </td>
                )}
                <td className="px-3">{format.number(g.trades, 0)}</td>
                <td className="px-3">{format.percent(g.winRate)}</td>
                <td
                  className={`whitespace-nowrap px-3 tabular-nums ${g.netPnl >= 0 ? "text-profit" : "text-loss"}`}
                >
                  <MonetaryValue>{format.money(g.netPnl, currency)}</MonetaryValue>
                </td>
                <td className="px-3">{format.number(g.volume)}</td>
                <td className="px-3">{num(g.avgPlannedR)}</td>
                <td className="px-3">{num(g.avgRealizedR)}</td>
                <td className="whitespace-nowrap px-3">{format.duration(g.avgDurationMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.groups.length && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("emptyFilters")}</p>
      )}
    </div>
  );
}
export default function ReportsPage() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}
const MODES = ["overview", "trends", "explorer", "breakdown", "cross", "compare"] as const;
function Reports() {
  const t = useTranslations("Reports");
  const tf = useTranslations("Filter");
  const format = useFormat();
  const errorText = useErrorText();
  const { query, values } = useFilters();
  const [mode, setMode] = useState<(typeof MODES)[number]>("overview"),
    [primary, setPrimary] = useState<Dimension>("symbol"),
    [secondary, setSecondary] = useState<Dimension>("weekday");
  const { data, error, errorCode, loading } = useApi<Analysis>(
    mode === "breakdown" || mode === "cross"
      ? `/api/analysis?${query}&primary=${primary}${mode === "cross" ? `&secondary=${secondary}` : ""}`
      : null,
  );
  const multi = (data?.currencies.length ?? 0) > 1;
  const num = (n: number | null) => (n === null ? "–" : format.number(n));
  const filterLine = (filters: AnalysisFilters) =>
    describeFilters(filters, {
      translate: (key) => tf(`description.${key}`),
      option: (group, value) => tf(`options.${group}.${value}`),
      accounts: data?.accounts,
      playbooks: data?.playbooks,
      weekday: format.weekdayShort,
    });
  return (
    <div>
      <FilterBar title={t("title")} />
      <div className="space-y-4 p-4">
        <AskJournal />
        <div className="flex flex-wrap items-center gap-2">
          {MODES.map((key) => (
            <Button
              key={key}
              size="sm"
              variant={mode === key ? "default" : "outline"}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              {t(`modes.${key}`)}
            </Button>
          ))}
        </div>
        <div key={mode} className="journal-report-section space-y-4" data-report-section={mode}>
          {mode === "overview" ? (
            <ReportOverview query={query} filters={values} />
          ) : mode === "trends" ? (
            <PerformanceTrendsReport key={query} query={query} />
          ) : mode === "explorer" ? (
            <TradeExplorer key={query} query={query} />
          ) : mode === "compare" ? (
            <Comparison key={query} initial={values} />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-wrap gap-3">
                      <DimensionSelect label={t("groupBy")} value={primary} onChange={setPrimary} />
                      {mode === "cross" && (
                        <DimensionSelect
                          label={t("thenBy")}
                          value={secondary}
                          onChange={setSecondary}
                        />
                      )}
                    </div>
                    {data && !multi && (
                      <ReviewExport
                        containsFinancialData
                        document={{
                          title:
                            mode === "cross"
                              ? t("breakdownTitle", {
                                  primary: t(`dimensions.${primary}`),
                                  secondary: t(`dimensions.${secondary}`),
                                })
                              : t("performanceTitle", { dimension: t(`dimensions.${primary}`) }),
                          subtitle: `${data.timeZone} · ${data.currencies[0] ?? t("accountCurrency")}`,
                          lines: [
                            t("filtersLine", { value: filterLine(values) }),
                            t("summaryLine", {
                              trades: format.number(data.summary.trades, 0),
                              pnl: format.number(data.summary.netPnl),
                              winRate: format.percent(data.summary.winRate),
                            }),
                            "",
                            ...data.groups.map((g) =>
                              t("exportGroupLine", {
                                row: labels(data, g.row),
                                column: g.column ? ` / ${labels(data, g.column)}` : "",
                                trades: g.trades,
                                pnl: format.number(g.netPnl),
                                winRate: format.percent(g.winRate),
                                plannedR: num(g.avgPlannedR),
                                realizedR: num(g.avgRealizedR),
                                volume: format.number(g.volume),
                                duration: format.duration(g.avgDurationMs),
                              }),
                            ),
                          ],
                        }}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {error ? (
                    <p role="alert" className="text-destructive">
                      {errorText(error, errorCode)}
                    </p>
                  ) : loading ? (
                    <p className="text-sm text-muted-foreground">{t("loadingReport")}</p>
                  ) : multi ? (
                    <p className="text-sm">
                      {t("multiCurrency", { currencies: data?.currencies.join(", ") ?? "" })}
                    </p>
                  ) : data ? (
                    <Summary data={data} />
                  ) : null}
                </CardContent>
              </Card>
              {data && !multi && !loading && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {mode === "cross"
                        ? `${t(`dimensions.${primary}`)} × ${t(`dimensions.${secondary}`)}`
                        : t("performanceBy", { dimension: t(`dimensions.${primary}`) })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Breakdown
                      data={data}
                      cross={mode === "cross"}
                      primary={primary}
                      secondary={secondary}
                    />
                  </CardContent>
                </Card>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("notes", { timeZone: data?.timeZone ?? t("journalTimezone") })}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function Comparison({ initial }: { initial: AnalysisFilters }) {
  const t = useTranslations("Reports");
  const tf = useTranslations("Filter");
  const tc = useTranslations("Common");
  const format = useFormat();
  const errorText = useErrorText();
  const privateMode = usePrivacy();
  const [a, setA] = useState<AnalysisFilters>({ ...initial, direction: "long" }),
    [b, setB] = useState<AnalysisFilters>({ ...initial, direction: "short" }),
    [nameA, setNameA] = useState(t("compare.longTrades")),
    [nameB, setNameB] = useState(t("compare.shortTrades")),
    [editing, setEditing] = useState<"a" | "b" | null>(null),
    [draft, setDraft] = useState<AnalysisFilters>({});
  const aa = useApi<Analysis>(`/api/analysis?${new URLSearchParams(a).toString()}`),
    bb = useApi<Analysis>(`/api/analysis?${new URLSearchParams(b).toString()}`);
  const currencies = new Set([...(aa.data?.currencies ?? []), ...(bb.data?.currencies ?? [])]),
    multi = currencies.size > 1;
  const num = (n: number | null) => (n === null ? "–" : format.number(n));
  const groupLine = (
    filters: AnalysisFilters,
    accounts?: { id: string; name: string }[],
    playbooks?: { id: string; name: string }[],
  ) =>
    describeFilters(filters, {
      translate: (key) => tf(`description.${key}`),
      option: (group, value) => tf(`options.${group}.${value}`),
      accounts,
      playbooks,
      privateMode,
      weekday: format.weekdayShort,
    });
  const metricLines = (name: string, d: Analysis) => [
    name,
    d.currencies.length === 1
      ? t("compare.metricTradesPnl", {
          trades: format.number(d.summary.trades, 0),
          pnl: format.number(d.summary.netPnl),
          currency: d.currencies[0] ?? "",
        })
      : t("compare.metricTradesPnlNoCurrency", {
          trades: format.number(d.summary.trades, 0),
          pnl: format.number(d.summary.netPnl),
        }),
    t("compare.metricRates", {
      winRate: format.percent(d.summary.winRate),
      plannedR: num(d.summary.avgPlannedR),
      realizedR: num(d.summary.avgRealizedR),
    }),
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("compare.intro")}</p>
      {multi && (
        <p role="alert" className="rounded-md border p-3 text-sm">
          {t("compare.multiCurrency")}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            { key: "a", name: nameA, setName: setNameA, filters: a, result: aa },
            { key: "b", name: nameB, setName: setNameB, filters: b, result: bb },
          ] as const
        ).map((group) => (
          <Card key={group.key}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  aria-label={t("compare.groupName", { key: group.key.toUpperCase() })}
                  className={`${fieldClass} min-w-32 flex-1 font-semibold`}
                  value={group.name}
                  onChange={(e) => group.setName(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft({ ...group.filters });
                    setEditing(group.key);
                  }}
                >
                  {t("compare.editFilters")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground break-words">
                {groupLine(
                  group.filters,
                  group.result.data?.accounts,
                  group.result.data?.playbooks,
                )}
              </p>
            </CardHeader>
            <CardContent>
              {group.result.error ? (
                <p role="alert" className="text-destructive">
                  {errorText(group.result.error, group.result.errorCode)}
                </p>
              ) : group.result.loading ? (
                <p>{tc("loading")}</p>
              ) : group.result.data && !multi ? (
                <Summary data={group.result.data} />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {aa.data && bb.data && !aa.loading && !bb.loading && !multi && (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <p className="text-sm">
              {t("compare.differencePrefix", { nameB, nameA })}{" "}
              <strong>
                <MonetaryValue>
                  {format.money(
                    bb.data.summary.netPnl - aa.data.summary.netPnl,
                    [...currencies][0] ?? "USD",
                  )}
                </MonetaryValue>
              </strong>{" "}
              {t("compare.netPnlTrades", {
                trades: format.number(bb.data.summary.trades - aa.data.summary.trades, 0),
              })}
            </p>
            <ReviewExport
              containsFinancialData
              document={{
                title: t("compare.vsTitle", { nameA, nameB }),
                lines: [
                  t("compare.groupLine", {
                    key: "A",
                    filters: groupLine(a, aa.data.accounts, aa.data.playbooks),
                  }),
                  t("compare.groupLine", {
                    key: "B",
                    filters: groupLine(b, bb.data.accounts, bb.data.playbooks),
                  }),
                  "",
                  ...metricLines(nameA, aa.data),
                  "",
                  ...metricLines(nameB, bb.data),
                ],
              }}
            />
          </CardContent>
        </Card>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("compare.groupFilters", { key: editing?.toUpperCase() ?? "" })}
            </DialogTitle>
          </DialogHeader>
          <FilterFields value={draft} onChange={setDraft} />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setDraft({})}>
              {t("compare.clear")}
            </Button>
            <Button
              onClick={() => {
                if (editing === "a") setA(draft);
                else setB(draft);
                setEditing(null);
              }}
            >
              {t("compare.applyToGroup")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
