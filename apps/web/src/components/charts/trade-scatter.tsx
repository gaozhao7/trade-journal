"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useMemo } from "react";
import {
  clockLabel,
  type PlottedTrade,
  type TradeXAxis,
  type TradeYAxis,
} from "@/lib/trade-explorer";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/use-format";
import { usePrivacy } from "../privacy";
import { ChartFrame } from "./chart-frame";
import { tooltipStyle, useVizTokens } from "./tokens";

export function TradeScatter({
  points,
  x,
  y,
  currency,
  timeZone,
  onSelect,
}: {
  points: PlottedTrade[];
  x: TradeXAxis;
  y: TradeYAxis;
  currency: string;
  timeZone: string;
  onSelect: (point: PlottedTrade) => void;
}) {
  const tokens = useVizTokens();
  const tc = useTranslations("Charts");
  const tf = useTranslations("Filter");
  const format = useFormat();
  const privateMode = usePrivacy();
  const groups = useMemo(
    () => [
      points.filter((p) => (p.netPnl ?? 0) > 0),
      points.filter((p) => (p.netPnl ?? 0) < 0),
      points.filter((p) => (p.netPnl ?? 0) === 0),
    ],
    [points],
  );
  const directionLabel = (value: string) =>
    value === "long"
      ? tf("options.direction.long")
      : value === "short"
        ? tf("options.direction.short")
        : value;
  const yLabel = (n: number) =>
    y === "realizedR"
      ? `${format.number(n, 2)}R`
      : privateMode
        ? "••••"
        : format.money(n, currency);
  const xLabel = (n: number) =>
    x === "entryMinute"
      ? clockLabel(n)
      : x === "mae" || x === "mfe"
        ? privateMode
          ? "••••"
          : format.money(n, currency)
        : format.number(n, 1);
  const yName = (value: TradeYAxis) =>
    value === "netPnl" ? tc("scatter.netPnl") : tc("scatter.realizedR");
  if (!tokens) return <div className="h-80" />;
  return (
    <ChartFrame height={340}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 12, right: 24, bottom: 8, left: 0 }}
          aria-label={tc("scatter.ariaLabel")}
        >
          <CartesianGrid stroke={tokens.gridline} />
          <XAxis
            type="number"
            dataKey="x"
            domain={x === "entryMinute" ? [0, 1440] : [0, "auto"]}
            ticks={x === "entryMinute" ? [0, 360, 720, 1080, 1440] : undefined}
            minTickGap={24}
            tickFormatter={xLabel}
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: tokens.baseline }}
          />
          <YAxis
            type="number"
            dataKey="y"
            width={82}
            domain={[(min: number) => Math.min(min, 0), (max: number) => Math.max(max, 0)]}
            tickFormatter={yLabel}
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis range={[44, 44]} />
          <ReferenceLine y={0} stroke={tokens.inkMuted} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: tokens.inkMuted }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as PlottedTrade | undefined;
              return active && point ? (
                <div style={{ ...tooltipStyle(tokens), maxWidth: 230, overflowWrap: "anywhere" }}>
                  <p className="font-medium">
                    {point.symbol} · {directionLabel(point.direction)}
                  </p>
                  <p className="text-xs">
                    {tc("scatter.closed", {
                      date: format.date(
                        new Date(point.closedAt),
                        { dateStyle: "medium", timeStyle: "short" },
                        timeZone,
                      ),
                    })}
                  </p>
                  <p>
                    {x === "durationMinutes"
                      ? tc("scatter.xDuration", { minutes: format.number(point.x, 2) })
                      : x === "entryMinute"
                        ? tc("scatter.xEntry", { time: clockLabel(point.x) })
                        : tc("scatter.estimated", {
                            axis: x.toUpperCase(),
                            value: xLabel(point.x),
                          })}
                  </p>
                  <p>
                    {y === "netPnl" || y === "realizedR"
                      ? tc("scatter.value", { label: yName(y), value: yLabel(point.y) })
                      : tc("scatter.estimated", { axis: y.toUpperCase(), value: yLabel(point.y) })}
                  </p>
                  <p className="text-xs text-muted-foreground">{tc("scatter.selectHint")}</p>
                </div>
              ) : null;
            }}
          />
          {groups.map((data, index) => (
            <Scatter
              key={index}
              data={data}
              name={[tc("scatter.positive"), tc("scatter.negative"), tc("scatter.zero")][index]}
              shape="circle"
              fill={[tokens.profitFill, tokens.loss, tokens.inkMuted][index]}
              fillOpacity={0.7}
              stroke={[tokens.profit, tokens.loss, tokens.inkMuted][index]}
              strokeWidth={1}
              isAnimationActive={false}
              onClick={(value: { payload?: PlottedTrade }) => {
                if (value.payload) onSelect(value.payload);
              }}
              cursor="pointer"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
