"use client";

import { useState } from "react";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { EdgeScoreComponents } from "@luxalgo/journal-core";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/use-format";
import { tooltipStyle, useVizTokens } from "./tokens";
import { ChartFrame } from "./chart-frame";

/** The open Edge Score, drawn from its six 0-100 components. */
export function EdgeRadar({
  components,
  height = 220,
}: {
  components: EdgeScoreComponents;
  height?: number | `${number}%`;
}) {
  const tokens = useVizTokens();
  const tc = useTranslations("Charts");
  const format = useFormat();
  const [radius, setRadius] = useState(48);
  if (!tokens) return <div style={{ height }} />;
  const labels: Record<keyof EdgeScoreComponents, string> = {
    winRate: tc("edge.winRate"),
    profitFactor: tc("edge.profitFactor"),
    avgWinLoss: tc("edge.avgWinLoss"),
    drawdown: tc("edge.drawdown"),
    recovery: tc("edge.recovery"),
    consistency: tc("edge.consistency"),
  };
  const data = (Object.keys(labels) as (keyof EdgeScoreComponents)[]).map((key) => ({
    metric: labels[key],
    value: Math.round(components[key]),
  }));
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        onResize={(width, height) =>
          setRadius(Math.max(20, Math.min(width / 2 - 84, height / 2 - 34)))
        }
      >
        <RadarChart className="journal-edge-radar" data={data} outerRadius={radius}>
          <PolarGrid stroke={tokens.gridline} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <PolarAngleAxis dataKey="metric" tick={{ fill: tokens.inkMuted, fontSize: 11 }} />
          <Tooltip
            cursor={false}
            allowEscapeViewBox={{ x: false, y: false }}
            contentStyle={tooltipStyle(tokens)}
            formatter={(value) => [`${format.number(Number(value), 0)}/100`, tc("score")]}
          />
          <Radar
            dataKey="value"
            stroke={tokens.brand}
            fill={tokens.brand}
            fillOpacity={0.28}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
