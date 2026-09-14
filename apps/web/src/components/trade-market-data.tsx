"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Vela } from "@luxalgo/vela";
import { useLocale, useTranslations } from "next-intl";
import {
  RESOLUTIONS,
  type MarketConnection,
  type ExcursionEstimate,
  type Resolution,
  type TradeMarketResult,
} from "@/lib/market-data";
import { providerInfo } from "@/lib/market-providers";
import type { MarketCsvDataset } from "@/lib/market-csv";
import { replayFrame } from "@/lib/trade-replay";
import { useApi } from "@/lib/use-api";
import { useFormat } from "@/lib/use-format";
import { useErrorText } from "@/lib/i18n-error";
import { TradeChart, type ChartExecution, type ChartTrade } from "./trade-chart";
import { usePrivacy } from "./privacy";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";

export function TradeMarketData({
  trade,
  executions,
}: {
  trade: ChartTrade & { currency: string };
  executions: ChartExecution[];
}) {
  const privacy = usePrivacy();
  const t = useTranslations("Trades");
  const c = useTranslations("Common");
  const format = useFormat();
  const errorText = useErrorText();
  const { data: saved, refresh: refreshSaved } = useApi<{
    saved: { estimate: ExcursionEstimate } | null;
  }>(`/api/trades/${encodeURIComponent(trade.key)}/market-data`);
  const { data: connections, error: connectionError } = useApi<{ connections: MarketConnection[] }>(
    "/api/market-data/connections",
  );
  const available = connections?.connections.filter((connection) => connection.configured) ?? [];
  const [provider, setProvider] = useState("");
  const [symbol, setSymbol] = useState(trade.symbol);
  const [dataset, setDataset] = useState("");
  const [resolution, setResolution] = useState<Resolution>("1m");
  const info = providerInfo(provider);
  const { data: csv } = useApi<{ datasets: MarketCsvDataset[] }>(
    info?.mode === "csv" ? "/api/market-data/csv" : null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<TradeMarketResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const invalidate = () => {
    controller.current?.abort();
    setBusy(false);
    setResult(null);
    setError("");
  };
  const load = async () => {
    if (!available.some((item) => item.id === provider) || (info?.datasets && !dataset)) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/trades/${encodeURIComponent(trade.key)}/market-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          symbol,
          dataset,
          resolution,
          basisConfirmed: confirmed,
        }),
        signal: request.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? t("dataRequestFailed"));
      if (!request.signal.aborted) {
        setResult(body);
        refreshSaved();
      }
    } catch (cause) {
      if (!request.signal.aborted)
        setError(cause instanceof Error ? cause.message : t("dataRequestFailed"));
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>{t("marketDataReplay")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("loadCandlesHint")}</p>
          {connectionError && (
            <p role="alert" className="text-sm text-destructive">
              {errorText(connectionError)}
            </p>
          )}
          {!available.length && (
            <p className="text-sm text-muted-foreground">
              {t.rich("connectProviderHint", {
                link: (chunks) => (
                  <a className="underline" href="/settings#market-data">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          )}
          {!trade.closedAt ? (
            <p className="text-sm text-muted-foreground">{t("availableAfterClose")}</p>
          ) : (
            available.length > 0 && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="market-provider">{t("dataProvider")}</Label>
                    <OptionSelect
                      id="market-provider"
                      value={provider}
                      onValueChange={(value) => {
                        invalidate();
                        setProvider(value);
                        setDataset("");
                        setConfirmed(false);
                      }}
                    >
                      <option value="" disabled>
                        {t("chooseDataSource")}
                      </option>
                      {available.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </OptionSelect>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="market-symbol">{t("providerSymbol")}</Label>
                    <Input
                      id="market-symbol"
                      value={symbol}
                      onChange={(event) => {
                        invalidate();
                        setSymbol(event.target.value);
                        setConfirmed(false);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="market-resolution">{t("candleResolution")}</Label>
                    <OptionSelect
                      id="market-resolution"
                      value={resolution}
                      onValueChange={(value) => {
                        invalidate();
                        setResolution(value as Resolution);
                      }}
                    >
                      {Object.keys(RESOLUTIONS).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </OptionSelect>
                  </div>
                  {(info?.datasets ||
                    info?.mode === "csv" ||
                    info?.id === "london-strategic-edge") && (
                    <div className="space-y-1">
                      <Label htmlFor="market-dataset">{t("dataFeed")}</Label>
                      {info?.datasets || info?.mode === "csv" ? (
                        <OptionSelect
                          id="market-dataset"
                          value={dataset}
                          onValueChange={(value) => {
                            invalidate();
                            setDataset(value);
                            setConfirmed(false);
                          }}
                        >
                          {(
                            info.datasets ?? [
                              { value: "", label: t("automaticMatchingFile") },
                              ...(csv?.datasets ?? []).map((item) => ({
                                value: item.id,
                                label: `${item.name} · ${item.symbol} · ${item.resolution}`,
                              })),
                            ]
                          ).map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </OptionSelect>
                      ) : (
                        <Input
                          id="market-dataset"
                          value={dataset}
                          placeholder={t("leaveBlankAuto")}
                          onChange={(event) => {
                            invalidate();
                            setDataset(event.target.value);
                            setConfirmed(false);
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {info?.description} {info?.symbolHint} {t("optionHistoryUnsupported")}
                </p>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    className="mt-0.5"
                    onChange={(event) => {
                      invalidate();
                      setConfirmed(event.target.checked);
                    }}
                  />
                  <span>{t("confirmEstimates", { currency: trade.currency })}</span>
                </label>
                <p className="text-xs text-muted-foreground">{t("estimateHelp")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      busy ||
                      !symbol.trim() ||
                      !available.some((item) => item.id === provider) ||
                      Boolean(info?.datasets && !dataset)
                    }
                    onClick={() => void load()}
                  >
                    {busy
                      ? t("loadingHistory")
                      : confirmed
                        ? t("loadDataSaveEstimates")
                        : t("loadCandlesReplay")}
                  </Button>
                  {busy && (
                    <Button variant="outline" onClick={invalidate}>
                      {c("cancel")}
                    </Button>
                  )}
                  {result && (
                    <Button variant="outline" onClick={invalidate}>
                      {t("showOriginalChart")}
                    </Button>
                  )}
                </div>
              </>
            )
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {errorText(error)}
            </p>
          )}
        </CardContent>
      </Card>
      {!result && saved?.saved && (
        <p className="text-xs text-muted-foreground">{t("savedEstimatesHint")}</p>
      )}
      {result && result.bars.length > 0 ? (
        <HistoricalReplay
          history={result}
          trade={trade}
          executions={executions}
          privacy={privacy}
        />
      ) : (
        <>
          <div
            className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-3"
            aria-label={t("aria.marketDataFeatureStatus")}
          >
            <div>
              <p className="text-xs text-muted-foreground">{t("estimatedMae")}</p>
              <p className="text-sm">
                {busy
                  ? t("loadingCandles")
                  : error
                    ? t("dataRequestFailed")
                    : saved?.saved
                      ? privacy
                        ? "••••"
                        : format.money(saved.saved.estimate.mae!, trade.currency)
                      : t("loadToCalculate")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("estimatedMfe")}</p>
              <p className="text-sm">
                {busy
                  ? t("loadingCandles")
                  : error
                    ? t("dataRequestFailed")
                    : saved?.saved
                      ? privacy
                        ? "••••"
                        : format.money(saved.saved.estimate.mfe!, trade.currency)
                      : t("loadToCalculate")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("tradeReplay")}</p>
              <p className="text-sm">{busy ? t("loadingCandles") : t("availableAfterCandles")}</p>
            </div>
          </div>
          {result && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("noCandlesReturned")}
            </p>
          )}
          <TradeChart trade={trade} executions={executions} />
        </>
      )}
    </div>
  );
}

function HistoricalReplay({
  history,
  trade,
  executions,
  privacy,
}: {
  history: TradeMarketResult;
  trade: ChartTrade & { currency: string };
  executions: ChartExecution[];
  privacy: boolean;
}) {
  const t = useTranslations("Trades");
  const format = useFormat();
  const [count, setCount] = useState(history.bars.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("4");
  useEffect(() => {
    setCount(history.bars.length);
    setPlaying(false);
  }, [history]);
  useEffect(() => {
    if (!playing || privacy) return;
    const timer = window.setInterval(
      () => {
        if (!document.hidden) setCount((current) => Math.min(current + 1, history.bars.length));
      },
      1000 / Number(speed),
    );
    return () => window.clearInterval(timer);
  }, [playing, privacy, speed, history.bars.length]);
  useEffect(() => {
    if (count >= history.bars.length || privacy) setPlaying(false);
  }, [count, privacy, history.bars.length]);
  const complete = count === history.bars.length;
  const frame = useMemo(
    () => replayFrame(history, history.estimate.priceBasisMismatch ? [] : executions, count),
    [history, executions, count],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("historicalCandles")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t("historySummary", {
            provider: history.provider,
            symbol: history.symbol,
            resolution: history.resolution,
            candles: format.number(history.bars.length, 0),
            fetched: format.dateTime(history.fetchedAt),
          })}
        </p>
        {privacy ? (
          <p className="text-sm text-muted-foreground">{t("privacyHidden")}</p>
        ) : (
          <>
            {history.estimate.priceBasisMismatch && (
              <p role="status" className="rounded-md border p-3 text-sm text-muted-foreground">
                {t("priceBasisMismatch")}
              </p>
            )}
            <ReplayChart history={history} nextFrame={frame} />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPlaying(false);
                  setCount(1);
                }}
              >
                {t("restart")}
              </Button>
              <Button
                onClick={() => {
                  if (complete) setCount(1);
                  setPlaying(!playing);
                }}
              >
                {playing ? t("pause") : t("play")}
              </Button>
              <Button
                variant="outline"
                disabled={complete}
                onClick={() => {
                  setPlaying(false);
                  setCount((current) => Math.min(current + 1, history.bars.length));
                }}
              >
                {t("nextCandle")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPlaying(false);
                  setCount(history.bars.length);
                }}
              >
                {t("showAll")}
              </Button>
              <OptionSelect
                aria-label={t("replaySpeed")}
                className="w-24"
                value={speed}
                onValueChange={setSpeed}
              >
                <option value="1">1×</option>
                <option value="2">2×</option>
                <option value="4">4×</option>
              </OptionSelect>
            </div>
            <input
              aria-label={t("replayPosition")}
              type="range"
              min={1}
              max={history.bars.length}
              value={count}
              className="w-full accent-primary"
              onChange={(event) => {
                setPlaying(false);
                setCount(Number(event.target.value));
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t("replayProgress", {
                count,
                total: history.bars.length,
                through: format.dateTime(
                  frame.through,
                  { dateStyle: "medium", timeStyle: "short" },
                  "UTC",
                ),
              })}
            </p>
          </>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("estimatedMaeAdverse")}</p>
            <p className="font-medium">
              {privacy
                ? "••••"
                : !complete
                  ? t("hiddenDuringReplay")
                  : history.estimate.mae === null
                    ? t("unavailable")
                    : format.money(history.estimate.mae, trade.currency).replace(/^\+/, "")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("estimatedMfeFavorable")}</p>
            <p className="font-medium">
              {privacy
                ? "••••"
                : !complete
                  ? t("hiddenDuringReplay")
                  : history.estimate.mfe === null
                    ? t("unavailable")
                    : format.money(history.estimate.mfe, trade.currency).replace(/^\+/, "")}
            </p>
          </div>
        </div>
        <details className="text-xs text-muted-foreground" open>
          <summary className="cursor-pointer">{t("dataCoverageLimits")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {[...history.warnings, ...history.estimate.warnings].map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

function ReplayChart({
  history,
  nextFrame,
}: {
  history: TradeMarketResult;
  nextFrame: ReturnType<typeof replayFrame<ChartExecution>>;
}) {
  const t = useTranslations("Trades");
  const locale = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<Vela | null>(null);
  const frame = useRef(nextFrame);
  const latest = useRef(nextFrame);
  latest.current = nextFrame;
  const update = useRef<(() => void) | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    setError("");
    void (async () => {
      const { Vela, registerNativeIndicator, unregisterNativeIndicator } =
        await import("@luxalgo/vela");
      if (disposed || !host.current) return;
      const type = `replay-fills-${crypto.randomUUID()}`;
      registerNativeIndicator({
        type,
        title: t("recordedFills"),
        paneHint: "price",
        overlay: true,
        inputsSchema: () => [],
        defaultInputs: () => ({}),
        create: () => ({
          start(ctx) {
            ctx.emit({
              labels: frame.current.fills.map((fill, index) => ({
                id: `fill-${index}`,
                paneId: "price",
                xloc: "bar_time" as const,
                x: Date.parse(fill.executedAt),
                y: fill.price,
                yloc: "price" as const,
                text: `${fill.side === "buy" ? t("side.buy") : t("side.sell")} ${fill.quantity}`,
                style: "label_left" as const,
                color: fill.side === "buy" ? "#087f23" : "#bd2626",
                textColor: "#ffffff",
                size: "small" as const,
                textAlign: "center" as const,
                fontFamily: "default" as const,
                overlay: true,
              })),
            });
            ctx.setStatus("idle");
          },
          onBars() {},
          onViewport() {},
          setInputs() {},
          suspend() {},
          resume() {},
          stop() {},
        }),
      });
      const dark = () => document.documentElement.classList.contains("dark");
      const instance = new Vela(host.current, {
        symbol: history.symbol,
        timeframe: { "1m": "1", "5m": "5", "15m": "15", "1h": "60", "1d": "1D" }[
          history.resolution
        ],
        data: latest.current.bars,
        live: false,
        height: 420,
        theme: dark() ? "dark" : "light",
        priceStyle: "candles",
        volume: true,
        drawings: false,
      });
      chart.current = instance;
      frame.current = latest.current;
      instance.addNativeIndicator(type);
      let updating = false;
      // Coalesce rapid scrubbing/ticks instead of queuing expensive Vela reloads.
      const flush = async () => {
        if (updating || disposed) return;
        updating = true;
        try {
          do {
            frame.current = latest.current;
            await instance.setMarket({ data: frame.current.bars });
          } while (!disposed && frame.current !== latest.current);
        } catch {
          if (!disposed) setError(t("chartUpdateError"));
        } finally {
          updating = false;
        }
      };
      update.current = () => {
        void flush();
      };
      const observer = new MutationObserver(() => instance.setTheme(dark() ? "dark" : "light"));
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      cleanup = () => {
        update.current = null;
        observer.disconnect();
        instance.destroy();
        unregisterNativeIndicator(type);
        if (chart.current === instance) chart.current = null;
      };
    })().catch(() => {
      if (!disposed) setError(t("chartRenderError"));
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [history, locale]);
  useEffect(() => {
    update.current?.();
  }, [nextFrame, history]);
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div ref={host} className="h-[420px] overflow-hidden rounded-lg border" />
    </>
  );
}
