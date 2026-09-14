"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/use-format";
import { usePrivacy } from "../privacy";
import { tooltipStyle, useVizTokens } from "./tokens";
import { ChartFrame } from "./chart-frame";

/** ISO calendar day, e.g. `2026-09-14`. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

export interface EquityPointDatum {
  t: string;
  cumNetPnl: number;
}

/** Cumulative P&L area — single series, crosshair tooltip, zero baseline. */
export function EquityArea({
  data,
  height = 240,
  valueFormat = "money",
  valueLabel,
  currency = "USD",
  curve = "monotone",
}: {
  data: EquityPointDatum[];
  height?: number;
  valueFormat?: "money" | "percent";
  valueLabel?: string;
  currency?: string;
  curve?: "monotone" | "stepAfter";
}) {
  const tokens = useVizTokens();
  const tc = useTranslations("Charts");
  const format = useFormat();
  const id = useId().replace(/:/g, "");
  const privacy = usePrivacy();
  const privateMode = privacy && valueFormat === "money";
  const formatValue = (value: number) =>
    valueFormat === "percent" ? format.percent(value, 2) : format.money(value, currency);
  const label = valueLabel ?? tc("cumulativePnl");
  // `t` is a display label: an ISO day for daily curves, or a bare time
  // ("09:35") for intraday curves. Only the former can be date-formatted.
  const dayLabel = (value: string) => {
    const text = String(value);
    return ISO_DAY.test(text)
      ? format.date(`${text.slice(0, 10)}T00:00:00Z`, { month: "short", day: "numeric" }, "UTC")
      : text;
  };
  if (!tokens) return <div style={{ height }} />;
  const line = tokens.brand;
  const top = Math.max(0, ...data.map((point) => point.cumNetPnl));
  const bottom = Math.min(0, ...data.map((point) => point.cumNetPnl));
  const zero = top === bottom ? 100 : (top / (top - bottom)) * 100;
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          key={String(privateMode)}
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id={`${id}-line`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={`${zero}%`} stopColor={line} />
              <stop offset={`${zero}%`} stopColor={tokens.loss} />
            </linearGradient>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={line} stopOpacity={0.3} />
              <stop offset={`${zero}%`} stopColor={line} stopOpacity={0.035} />
              <stop offset={`${zero}%`} stopColor={tokens.loss} stopOpacity={0.035} />
              <stop offset="100%" stopColor={tokens.loss} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={tokens.gridline} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="t"
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: tokens.baseline }}
            minTickGap={48}
            tickFormatter={dayLabel}
          />
          <YAxis
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={70}
            domain={[bottom, top === bottom ? 1 : top]}
            tickFormatter={(value: number) =>
              privateMode ? "••••" : formatValue(value).replace(".00", "")
            }
          />
          <ReferenceLine y={0} stroke={tokens.baseline} />
          <Tooltip
            contentStyle={tooltipStyle(tokens)}
            labelFormatter={(value) => {
              const text = String(value);
              return ISO_DAY.test(text)
                ? format.date(`${text.slice(0, 10)}T00:00:00Z`, { dateStyle: "medium" }, "UTC")
                : text;
            }}
            formatter={(value) => [privateMode ? tc("hidden") : formatValue(Number(value)), label]}
            cursor={{ stroke: tokens.inkMuted, strokeDasharray: "3 3" }}
          />
          <Area
            type={curve}
            dataKey="cumNetPnl"
            stroke={bottom < 0 ? (top > 0 ? `url(#${id}-line)` : tokens.loss) : line}
            strokeWidth={2}
            fill={`url(#${id}-fill)`}
            baseValue={0}
            dot={data.length === 1 ? { r: 3 } : false}
            activeDot={({ cx, cy, payload }) => (
              <circle
                cx={cx}
                cy={cy}
                r={4}
                fill={payload.cumNetPnl < 0 ? tokens.loss : line}
                stroke={tokens.card}
                strokeWidth={2}
              />
            )}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
