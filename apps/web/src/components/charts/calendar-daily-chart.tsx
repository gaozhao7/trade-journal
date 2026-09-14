"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import type { CalendarInsights } from "@/lib/calendar-insights";
import { useFormat } from "@/lib/use-format";
import { usePrivacy } from "../privacy";
import { ChartFrame } from "./chart-frame";
import { tooltipStyle, useVizTokens } from "./tokens";

export function CalendarDailyChart({
  data,
  currency,
  onInspect,
}: {
  data: CalendarInsights["trend"];
  currency: string;
  onInspect: (date: string) => void;
}) {
  const tokens = useVizTokens();
  const tc = useTranslations("Charts");
  const format = useFormat();
  const privacy = usePrivacy();
  if (!tokens) return <div className="h-60" />;
  return (
    <ChartFrame height={240}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          aria-label={tc("dailyChart.ariaLabel")}
          data={data}
          margin={{ top: 12, right: 8, bottom: 4, left: 0 }}
          onClick={(state) => {
            if (
              typeof state.activeLabel === "string" &&
              data.some((day) => day.date === state.activeLabel)
            )
              onInspect(state.activeLabel);
          }}
        >
          <CartesianGrid stroke={tokens.gridline} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(date: string) =>
              format.date(
                `${date.slice(0, 10)}T00:00:00Z`,
                { month: "numeric", day: "numeric" },
                "UTC",
              )
            }
            minTickGap={24}
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: tokens.baseline }}
          />
          <YAxis
            width={76}
            tick={{ fill: tokens.inkMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              privacy ? "••••" : format.money(value, currency).replace(/\.00$/, "")
            }
          />
          <ReferenceLine y={0} stroke={tokens.baseline} />
          <Tooltip
            contentStyle={tooltipStyle(tokens)}
            cursor={{ fill: tokens.gridline, opacity: 0.35 }}
            formatter={(value, name) => [
              privacy ? tc("hidden") : format.money(Number(value), currency),
              name === "average" ? tc("fiveDayAverage") : tc("dailyChart.seriesName"),
            ]}
          />
          <Bar dataKey="netPnl" maxBarSize={22} isAnimationActive={false} cursor="pointer">
            {data.map((day) => (
              <Cell
                key={day.date}
                fill={
                  day.netPnl > 0
                    ? tokens.profitFill
                    : day.netPnl < 0
                      ? tokens.loss
                      : tokens.inkMuted
                }
              />
            ))}
          </Bar>
          {data.length >= 8 && (
            <Line
              dataKey="average"
              type="linear"
              stroke={tokens.foreground}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
