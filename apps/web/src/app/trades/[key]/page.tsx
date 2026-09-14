"use client";
import { AiNotice } from "@/components/ai-notice";
import { Checkbox } from "@/components/ui/checkbox";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FilterBar } from "@/components/filter-bar";
import { Pnl } from "@/components/pnl";
import { MonetaryValue, MonetaryField } from "@/components/privacy";
import { TradeMarketData } from "@/components/trade-market-data";
import { EquityArea } from "@/components/charts/equity-area";
import { VoiceNote } from "@/components/voice-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { Attachments } from "@/components/attachments";
import { ReviewExport } from "@/components/review-export";
import { RuleChecklist } from "@/components/rule-checklist";
import { useAutosave } from "@/lib/use-autosave";
import { postJson, useApi } from "@/lib/use-api";
import { useFormat } from "@/lib/use-format";
import { useErrorText } from "@/lib/i18n-error";
import { codeFrom } from "@/lib/api-error";
import { tradeKeyFromSegment } from "@/lib/trade-links";
import { formatTimestamp } from "@/lib/timezone";

interface TradeDetail {
  riskAmount: number | null;
  realizedR: number | null;
  plannedR: number | null;
  contractMultiplier: number | null;
  currency: string;
  key: string;
  accountId: string;
  symbol: string;
  assetClass: string | null;
  direction: "long" | "short";
  status: string;
  openedAt: string;
  closedAt: string | null;
  quantity: number;
  avgEntry: number;
  avgExit: number | null;
  grossPnl: number;
  fees: number;
  netPnl: number;
  durationMs: number | null;
  exitsJson: string;
  notes: string | null;
  tagsJson: string | null;
  mistakesJson: string | null;
  playbookId: string | null;
  rating: number | null;
  stopLoss: number | null;
  profitTarget: number | null;
  reviewedAt: string | null;
}

interface ExecutionRow {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  executedAt: string;
}

export default function TradePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const tradeKey = tradeKeyFromSegment(key);
  return <TradeView key={tradeKey} tradeKey={tradeKey} />;
}

function TradeView({ tradeKey }: { tradeKey: string }) {
  const { data, error, errorCode, refresh } = useApi<{
    trade: TradeDetail;
    executions: ExecutionRow[];
    timeZone: string;
  }>(`/api/trades/${encodeURIComponent(tradeKey)}`);
  const [aiBusy, setAiBusy] = useState(false);
  const [critique, setCritique] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiErrorCode, setAiErrorCode] = useState<string | null>(null);
  const t = useTranslations("Trades");
  const format = useFormat();
  const errorText = useErrorText();
  const directionLabels: Record<string, string> = {
    long: t("direction.long"),
    short: t("direction.short"),
  };
  const statusLabels: Record<string, string> = {
    win: t("status.win"),
    loss: t("status.loss"),
    closed: t("status.closed"),
    open: t("status.open"),
    breakeven: t("status.breakeven"),
  };
  const sideLabels: Record<string, string> = {
    buy: t("side.buy"),
    sell: t("side.sell"),
  };

  if (!data) {
    return (
      <div>
        <FilterBar title={t("detailTitle")} />
        <div className="p-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {errorText(error, errorCode)}
            </p>
          ) : (
            <Skeleton className="h-96" />
          )}
        </div>
      </div>
    );
  }
  const { trade, executions, timeZone } = data;

  const patch = async (body: Record<string, unknown>) => {
    if (Object.keys(body).length)
      await postJson(`/api/trades/${encodeURIComponent(tradeKey)}`, body, "PATCH");
    refresh();
  };

  const runningPnl = (() => {
    const exits = JSON.parse(trade.exitsJson) as {
      executionId: string;
      grossPnl: number;
      quantity: number;
    }[];
    const times = new Map(executions.map((e) => [e.id, e.executedAt]));
    const totalExitQty = exits.reduce((total, exit) => total + exit.quantity, 0);
    let cum = 0;
    return exits
      .map((exit) => ({
        t: times.get(exit.executionId) ?? trade.openedAt,
        pnl: exit.grossPnl - (totalExitQty > 0 ? trade.fees * (exit.quantity / totalExitQty) : 0),
      }))
      .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))
      .map((event) => ({
        t: formatTimestamp(event.t, timeZone).slice(11, 16),
        cumNetPnl: (cum += event.pnl),
      }));
  })();

  const askCritique = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await postJson<{ critique: string }>("/api/ai/critique", { key: tradeKey });
      setCritique(result.critique);
    } catch (error) {
      setAiError(t("aiCritiqueFailed"));
      setAiErrorCode(codeFrom(error));
    } finally {
      setAiBusy(false);
    }
  };

  const riskAmount = trade.riskAmount;
  const directionLabel = directionLabels[trade.direction] ?? trade.direction;

  return (
    <div>
      <FilterBar title={`${trade.symbol} · ${directionLabel}`} />
      <div className="grid gap-3 p-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-3 xl:col-span-2">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
              <div>
                <div className="text-xs text-muted-foreground">{t("meta.netPnl")}</div>
                <Pnl value={trade.netPnl} className="text-2xl font-semibold" />
              </div>
              <Badge
                variant={
                  trade.status === "win" ? "profit" : trade.status === "loss" ? "loss" : "secondary"
                }
                className="text-sm"
              >
                {statusLabels[trade.status] ?? trade.status}
              </Badge>
              <Meta label={t("meta.gross")} value={format.money(trade.grossPnl)} monetary />
              <Meta label={t("meta.fees")} value={format.money(trade.fees)} monetary />
              <Meta label={t("meta.volume")} value={format.number(trade.quantity, 4)} />
              <Meta label={t("meta.avgEntry")} value={format.number(trade.avgEntry)} monetary />
              <Meta
                label={t("meta.avgExit")}
                monetary
                value={trade.avgExit === null ? t("status.open") : format.number(trade.avgExit)}
              />
              <Meta label={t("meta.duration")} value={format.duration(trade.durationMs)} />
              <Meta
                label={t("meta.netEntryNotional")}
                value={format.percent(
                  trade.avgEntry * trade.quantity > 0 &&
                    (trade.contractMultiplier !== null ||
                      !["futures", "option", "forex", "cfd"].includes(trade.assetClass ?? ""))
                    ? trade.netPnl /
                        (Math.abs(trade.avgEntry) *
                          trade.quantity *
                          (trade.contractMultiplier ?? 1))
                    : null,
                  2,
                )}
              />
              <Meta
                label={t("meta.plannedR")}
                value={trade.plannedR === null ? "–" : `${format.number(trade.plannedR)}R`}
              />
              <Meta
                label={t("meta.realizedR")}
                value={trade.realizedR === null ? "–" : `${format.number(trade.realizedR)}R`}
              />
            </CardContent>
          </Card>

          <TradeMarketData trade={trade} executions={executions} />

          {runningPnl.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("runningPnl")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("timesIn", { timeZone })}</p>
              </CardHeader>
              <CardContent>
                <EquityArea data={runningPnl} height={180} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("executions")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("timesIn", { timeZone })}</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("col.time")}</TableHead>
                    <TableHead>{t("col.side")}</TableHead>
                    <TableHead>{t("col.quantity")}</TableHead>
                    <TableHead>{t("col.price")}</TableHead>
                    <TableHead>{t("col.fee")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions
                    .sort((a, b) => a.executedAt.localeCompare(b.executedAt))
                    .map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell className="text-muted-foreground">
                          {formatTimestamp(execution.executedAt, timeZone)}
                        </TableCell>
                        <TableCell>
                          <span className={execution.side === "buy" ? "text-profit" : "text-loss"}>
                            {execution.side === "buy"
                              ? `▲ ${sideLabels.buy}`
                              : `▼ ${sideLabels.sell}`}
                          </span>
                        </TableCell>
                        <TableCell className="tnum">
                          {format.number(execution.quantity, 4)}
                        </TableCell>
                        <TableCell className="tnum">
                          <MonetaryValue>{format.number(execution.price)}</MonetaryValue>
                        </TableCell>
                        <TableCell className="tnum text-muted-foreground">
                          <MonetaryValue>{format.money(execution.fee)}</MonetaryValue>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-3">
          <AnnotationsCard key={trade.key} trade={trade} onPatch={patch} />
          <RuleChecklist tradeKey={trade.key} playbookId={trade.playbookId} />
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t("aiReview")}</CardTitle>
              <Button variant="outline" size="sm" onClick={askCritique} disabled={aiBusy}>
                <Sparkles />
                {aiBusy ? t("aiThinking") : t("aiCritique")}
              </Button>
            </CardHeader>
            {aiError && (
              <CardContent>
                <AiNotice
                  error={aiError}
                  code={aiErrorCode}
                  onRetry={() => void askCritique()}
                  onDismiss={() => {
                    setAiError(null);
                    setAiErrorCode(null);
                  }}
                />
              </CardContent>
            )}
            {critique && (
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{critique}</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  monetary = false,
}: {
  label: string;
  value: string;
  monetary?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum text-sm font-medium">
        {monetary ? <MonetaryValue>{value}</MonetaryValue> : value}
      </div>
    </div>
  );
}

function AnnotationsCard({
  trade,
  onPatch,
}: {
  trade: TradeDetail;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(trade.notes ?? "");
  const noteEditor = useRef<RichEditorHandle>(null);
  const [tags, setTags] = useState((JSON.parse(trade.tagsJson ?? "[]") as string[]).join(", "));
  const [mistakes, setMistakes] = useState(
    (JSON.parse(trade.mistakesJson ?? "[]") as string[]).join(", "),
  );
  const [stopLoss, setStopLoss] = useState(trade.stopLoss?.toString() ?? "");
  const [profitTarget, setProfitTarget] = useState(trade.profitTarget?.toString() ?? "");
  const { data: playbookData } = useApi<{ playbooks: { id: string; name: string }[] }>(
    "/api/playbooks",
  );
  const {
    save: debounced,
    status: saveStatus,
    flush,
  } = useAutosave(`/api/trades/${encodeURIComponent(trade.key)}`, "PATCH", () => void onPatch({}));

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const t = useTranslations("Trades");
  const format = useFormat();
  const statusLabels: Record<string, string> = {
    win: t("status.win"),
    loss: t("status.loss"),
    closed: t("status.closed"),
    open: t("status.open"),
    breakeven: t("status.breakeven"),
  };
  const directionLabels: Record<string, string> = {
    long: t("direction.long"),
    short: t("direction.short"),
  };
  const directionLabel = directionLabels[trade.direction] ?? trade.direction;
  const statusText = statusLabels[trade.status] ?? trade.status;
  const saveStatusText = (s: string) => {
    if (!s) return "";
    if (s === "Saving…") return t("saveStatus.saving");
    if (s === "Saved") return t("saveStatus.saved");
    if (s.startsWith("Not saved: "))
      return t("saveStatus.failed", { message: s.slice("Not saved: ".length) });
    return s;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("journalThisTrade")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => void onPatch({ rating: trade.rating === star ? null : star })}
                aria-label={t("rateStars", { count: star })}
              >
                <Star
                  className={`h-4 w-4 ${trade.rating !== null && star <= trade.rating ? "fill-current text-series-4 text-yellow-600" : "text-muted-foreground"}`}
                />
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={trade.reviewedAt !== null}
              onCheckedChange={(checked) => void onPatch({ reviewed: checked === true })}
            />
            {t("reviewed")}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">{t("stopLoss")}</label>
            <MonetaryField>
              <Input
                value={stopLoss}
                onChange={(event) => {
                  setStopLoss(event.target.value);
                  debounced({
                    stopLoss: event.target.value === "" ? null : Number(event.target.value),
                  });
                }}
                placeholder={t("stopLossPlaceholder")}
                inputMode="decimal"
              />
            </MonetaryField>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("profitTarget")}</label>
            <MonetaryField>
              <Input
                value={profitTarget}
                onChange={(event) => {
                  setProfitTarget(event.target.value);
                  debounced({
                    profitTarget: event.target.value === "" ? null : Number(event.target.value),
                  });
                }}
                placeholder={t("profitTargetPlaceholder")}
                inputMode="decimal"
              />
            </MonetaryField>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">{t("playbook")}</label>
          <Select
            value={trade.playbookId ?? "none"}
            onValueChange={(value) => void onPatch({ playbookId: value === "none" ? null : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("noPlaybook")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("noPlaybook")}</SelectItem>
              {playbookData?.playbooks.map((playbook) => (
                <SelectItem key={playbook.id} value={playbook.id}>
                  {playbook.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">{t("tagsHint")}</label>
          <Input
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              debounced({ tags: parseList(event.target.value) });
            }}
            placeholder={t("tagsPlaceholder")}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("mistakes")}</label>
          <Input
            value={mistakes}
            onChange={(event) => {
              setMistakes(event.target.value);
              debounced({ mistakes: parseList(event.target.value) });
            }}
            placeholder={t("mistakesPlaceholder")}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs text-muted-foreground">{t("notes")}</label>
            <VoiceNote
              onPrepare={() => noteEditor.current?.focus()}
              onText={(text) => {
                const next = notes ? `${notes} ${text}` : text;
                setNotes(next);
                debounced({ notes: next });
              }}
            />
          </div>
          <RichEditor
            editorRef={noteEditor}
            value={notes}
            onChange={(value) => {
              setNotes(value);
              debounced({ notes: value });
            }}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span role="status">{saveStatusText(saveStatus)}</span>
            <Button variant="ghost" size="sm" onClick={() => void flush()}>
              {t("saveNow")}
            </Button>
          </div>
          <ReviewExport
            containsFinancialData
            document={{
              title: `${trade.symbol} · ${directionLabel} ${t("doc.review")}`,
              subtitle: `${trade.openedAt} · ${trade.currency}`,
              lines: [
                `${t("doc.status")}: ${statusText} | ${t("doc.quantity")}: ${format.number(trade.quantity)}`,
                `${t("doc.entry")}: ${format.number(trade.avgEntry)} | ${t("doc.exit")}: ${
                  trade.avgExit === null ? t("doc.open") : format.number(trade.avgExit)
                }`,
                `${t("doc.netPnl")}: ${format.money(trade.netPnl, trade.currency)} | ${t("doc.fees")}: ${format.money(trade.fees, trade.currency)}`,
                `${t("doc.stop")}: ${stopLoss || t("doc.unspecified")} | ${t("doc.target")}: ${
                  profitTarget || t("doc.unspecified")
                }`,
                `${t("doc.tags")}: ${tags || t("doc.none")} | ${t("doc.mistakes")}: ${
                  mistakes || t("doc.none")
                }`,
                "",
                notes,
              ],
            }}
          />
          <Attachments type="trade" id={trade.key} />
        </div>
      </CardContent>
    </Card>
  );
}
