"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

export interface DailyBarDatum {
  date: string;
  netPnl: number;
}

/**
 * Net daily P&L. Polarity is geometry first (bars grow from the zero baseline);
 * green/red only reinforces. Rounded corners sit at the data end.
 */
export function DailyBars({
  data,
  height = 240,
}: {
  data: DailyBarDatum[];
  height?: number | `${number}%`;
}) {
  const tokens = useVizTokens();
  const tc = useTranslations("Charts");
  const format = useFormat();
  const privateMode = usePrivacy();
  if (!tokens) return <div style={{ height }} />;
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          key={String(privateMode)}
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          barCategoryGap="20%"
        >
          <CartesianGrid stroke={tokens.gridline} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: tokens.baseline }}
            minTickGap={48}
          />
          <YAxis
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={70}
            tickFormatter={(value: number) =>
              privateMode ? "••••" : format.money(value).replace(".00", "")
            }
          />
          <ReferenceLine y={0} stroke={tokens.baseline} />
          <Tooltip
            contentStyle={tooltipStyle(tokens)}
            formatter={(value) => [
              privateMode ? tc("hidden") : format.money(Number(value)),
              tc("netPnl"),
            ]}
            cursor={{ fill: tokens.gridline, opacity: 0.4 }}
          />
          <Bar dataKey="netPnl" isAnimationActive={false} maxBarSize={28}>
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={entry.netPnl >= 0 ? tokens.profitFill : tokens.loss}
                radius={(entry.netPnl >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]) as unknown as number}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
