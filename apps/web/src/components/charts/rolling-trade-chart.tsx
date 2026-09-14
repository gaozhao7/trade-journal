"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformanceTrends } from "@/lib/performance-trends";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/use-format";
import { usePrivacy } from "../privacy";
import { ChartFrame } from "./chart-frame";
import { tooltipStyle, useVizTokens } from "./tokens";

export function RollingTradeChart({
  data,
  metric,
  reference,
  currency,
  timeZone,
}: {
  data: PerformanceTrends["points"];
  metric: "winRate" | "avgNetPnl";
  reference: number;
  currency: string;
  timeZone: string;
}) {
  const tokens = useVizTokens();
  const tc = useTranslations("Charts");
  const format = useFormat();
  const privacy = usePrivacy();
  const rate = metric === "winRate";
  const formatValue = (value: number) =>
    rate ? format.percent(value, 0) : privacy ? "••••" : format.money(value, currency);
  if (!tokens) return <div className="h-60" />;
  return (
    <ChartFrame height={240}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 14, bottom: 4, left: 0 }}
          aria-label={rate ? tc("rolling.ariaWinRate") : tc("rolling.ariaAvgNetPnl")}
        >
          <CartesianGrid stroke={tokens.gridline} vertical={false} />
          <XAxis
            dataKey="sequence"
            type="number"
            domain={["dataMin", "dataMax"]}
            allowDecimals={false}
            tickFormatter={(value: number) => `#${value}`}
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: tokens.baseline }}
            minTickGap={24}
          />
          <YAxis
            width={rate ? 48 : 80}
            domain={
              rate ? [0, 1] : [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]
            }
            tickFormatter={formatValue}
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          {!rate && <ReferenceLine y={0} stroke={tokens.baseline} />}
          <ReferenceLine
            y={reference}
            stroke={tokens.inkMuted}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
          <Tooltip
            contentStyle={tooltipStyle(tokens)}
            labelFormatter={(label) => {
              const index = String(label);
              const point = data.find((point) => point.sequence === Number(index));
              return point
                ? tc("rolling.tradePoint", {
                    index,
                    date: format.date(
                      new Date(point.closedAt),
                      { month: "short", day: "numeric", year: "numeric" },
                      timeZone,
                    ),
                  })
                : tc("rolling.tradeIndex", { index });
            }}
            formatter={(value) => [formatValue(Number(value)), tc("rolling.seriesName")]}
          />
          <Line
            dataKey={metric}
            type="linear"
            stroke={tokens.brand}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
