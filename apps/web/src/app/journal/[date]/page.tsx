"use client";
import { AiNotice } from "@/components/ai-notice";

import Link from "next/link";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { IntradayPoint, TradeMetrics } from "@luxalgo/journal-core";
import { EquityArea } from "@/components/charts/equity-area";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { Pnl } from "@/components/pnl";
import { MonetaryValue } from "@/components/privacy";
import { VoiceNote } from "@/components/voice-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { Attachments } from "@/components/attachments";
import { ReviewExport } from "@/components/review-export";
import { useAutosave } from "@/lib/use-autosave";
import { postJson, useApi } from "@/lib/use-api";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/use-format";
import { useErrorText } from "@/lib/i18n-error";
import { codeFrom } from "@/lib/api-error";

interface TradeRowLite {
  key: string;
  symbol: string;
  direction: string;
  status: string;
  netPnl: number;
  quantity: number;
  avgEntry: number;
  avgExit: number | null;
  fees: number;
}

interface DayPayload {
  date: string;
  metrics: TradeMetrics;
  trades: TradeRowLite[];
  intraday: IntradayPoint[];
  note: string;
}

export default function JournalDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  return (
    <Suspense>
      <JournalDay key={date} date={date} />
    </Suspense>
  );
}

function JournalDay({ date }: { date: string }) {
  const t = useTranslations("Journal");
  const tc = useTranslations("Common");
  const td = useTranslations("Trades");
  const format = useFormat();
  const errorText = useErrorText();
  const { query } = useFilters();
  const { data, error, errorCode } = useApi<DayPayload>(`/api/journal/${date}?${query}`);
  const [note, setNote] = useState<string | null>(null);
  const noteEditor = useRef<RichEditorHandle>(null);
  const { save, status: saving, flush } = useAutosave(`/api/journal/${date}`, "PUT");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiErrorCode, setAiErrorCode] = useState<string | null>(null);
  const noteValue = note ?? data?.note ?? "";
  const displayDate = format.date(`${date}T00:00:00Z`, undefined, "UTC");
  const directionLabel = (direction: string) =>
    direction === "short" ? td("direction.short") : td("direction.long");
  const scheduleSave = (value: string) => {
    setNote(value);
    save({ note: value });
  };

  const generateRecap = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await postJson<{ recap: string }>(`/api/ai/recap`, { date });
      const merged = noteValue ? `${noteValue}\n\n---\n\n${result.recap}` : result.recap;
      scheduleSave(merged);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : t("aiRecapFailed"));
      setAiErrorCode(codeFrom(error));
    } finally {
      setAiBusy(false);
    }
  };

  const m = data?.metrics;
  return (
    <div>
      <FilterBar title={t("dayTitle", { date: displayDate })} />
      <div className="grid gap-3 p-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-3 xl:col-span-2">
          {m && m.closedTrades > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("dayStats")}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 2xl:grid-cols-5">
                <Stat label={t("stat.netPnl")}>
                  <Pnl value={m.netPnl} className="font-semibold" />
                </Stat>
                <Stat label={t("stat.trades")}>{m.closedTrades}</Stat>
                <Stat label={t("stat.winRate")}>{format.percent(m.winRate)}</Stat>
                <Stat label={t("stat.winners")}>{m.wins}</Stat>
                <Stat label={t("stat.losers")}>{m.losses}</Stat>
                <Stat label={t("stat.gross")}>
                  <MonetaryValue>{format.money(m.grossPnl)}</MonetaryValue>
                </Stat>
                <Stat label={t("stat.fees")}>
                  <MonetaryValue>{format.money(m.fees)}</MonetaryValue>
                </Stat>
                <Stat label={t("stat.volume")}>{format.number(m.totalVolume, 0)}</Stat>
                <Stat label={t("stat.profitFactor")}>
                  {m.profitFactorIsInfinite
                    ? "∞"
                    : m.profitFactor === null
                      ? "–"
                      : format.number(m.profitFactor)}
                </Stat>
                <Stat label={t("stat.expectancy")}>
                  <MonetaryValue>
                    {m.expectancy === null ? "–" : format.money(m.expectancy)}
                  </MonetaryValue>
                </Stat>
              </CardContent>
            </Card>
          ) : (
            m && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t("noClosedTrades")}
                </CardContent>
              </Card>
            )
          )}

          {data && data.intraday.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("intradayTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <EquityArea
                  data={data.intraday.map((p) => ({
                    t: p.t.slice(11, 16),
                    cumNetPnl: p.cumNetPnl,
                  }))}
                  height={200}
                />
              </CardContent>
            </Card>
          )}

          {data && data.trades.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("stat.trades")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {data.trades.map((trade) => (
                  <Link
                    key={trade.key}
                    href={`/trades/${encodeURIComponent(trade.key)}?${query}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60"
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
                        {trade.status.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{trade.symbol}</span>
                      <span className="text-xs text-muted-foreground">
                        {directionLabel(trade.direction)}
                      </span>
                    </span>
                    <span className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                      <span className="tnum text-xs text-muted-foreground">
                        {format.number(trade.quantity, 4)} @{" "}
                        <MonetaryValue>{format.number(trade.avgEntry)}</MonetaryValue>
                        {trade.avgExit !== null && (
                          <>
                            {" "}
                            → <MonetaryValue>{format.number(trade.avgExit)}</MonetaryValue>
                          </>
                        )}
                      </span>
                      <Pnl value={trade.netPnl} />
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          {!data && <Skeleton className="h-64" />}
        </div>

        <Card className="h-fit">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>{t("dayNote")}</CardTitle>
            <div className="flex items-center gap-2">
              <VoiceNote
                onPrepare={() => noteEditor.current?.focus()}
                onText={(text) =>
                  scheduleSave(
                    noteValue ? `${noteValue}${noteValue.endsWith(" ") ? "" : " "}${text}` : text,
                  )
                }
              />
              <Button
                variant="outline"
                size="sm"
                onClick={generateRecap}
                disabled={aiBusy || !data}
              >
                <Sparkles />
                {aiBusy ? t("writing") : t("aiRecap")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiError && (
              <div className="mb-4">
                <AiNotice
                  error={aiError}
                  code={aiErrorCode}
                  onRetry={() => void generateRecap()}
                  onDismiss={() => {
                    setAiError(null);
                    setAiErrorCode(null);
                  }}
                />
              </div>
            )}
            {data ? (
              <RichEditor editorRef={noteEditor} value={noteValue} onChange={scheduleSave} />
            ) : error ? (
              <p role="alert" className="text-sm text-destructive">
                {errorText(error, errorCode)}
              </p>
            ) : (
              <Skeleton className="h-48" />
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span role="status">{saving}</span>
              <Button variant="ghost" size="sm" onClick={() => void flush()}>
                {tc("saveNow")}
              </Button>
            </div>
            <ReviewExport
              containsFinancialData
              document={{
                title: t("exportDayTitle", { date: displayDate }),
                subtitle: query ? t("exportFilters", { query }) : t("exportAllAccounts"),
                lines: [
                  t("exportSummary", {
                    closed: m?.closedTrades ?? 0,
                    pnl: format.number(m?.netPnl ?? 0),
                  }),
                  "",
                  noteValue,
                ],
              }}
            />
            <Attachments type="day" id={date} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum">{children}</div>
    </div>
  );
}
