"use client";
import { HoverHint } from "./ui/tooltip";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CalendarMonth } from "@luxalgo/journal-core";
import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/use-format";
import { Pnl } from "./pnl";
import { MonetaryValue, usePrivacy } from "./privacy";

const useCompactMoney = (currency: string) => {
  const locale = useLocale();
  return useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
      }),
    [locale, currency],
  );
};

/**
 * The P&L calendar — an HTML grid, not a chart. Each traded day prints its
 * signed P&L and trade count; the background tint scales with magnitude
 * (lightness carries magnitude, which survives CVD; the number carries sign).
 */
export function CalendarPnl({
  calendar,
  currency = "USD",
  monetary = true,
}: {
  calendar: CalendarMonth;
  currency?: string;
  monetary?: boolean;
}) {
  const t = useTranslations("Calendar");
  const format = useFormat();
  const maxAbs = Math.max(
    1,
    ...calendar.weeks.flatMap((week) => week.days.map((day) => Math.abs(day?.netPnl ?? 0))),
  );
  return (
    <div className="journal-calendar min-w-0 w-full">
      <div className="journal-calendar-grid grid gap-1 text-xs">
        {format.weekdays().map((weekday) => (
          <div key={weekday} className="px-1 pb-1 text-muted-foreground">
            {weekday}
          </div>
        ))}
        <div className="journal-calendar-week-heading px-1 pb-1 text-right text-muted-foreground">
          {t("week")}
        </div>
        {calendar.weeks.map((week, weekIndex) => (
          <CalendarWeekRow
            key={weekIndex}
            week={week}
            maxAbs={maxAbs}
            currency={currency}
            monetary={monetary}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
        <span className="text-muted-foreground">
          {t("footerDays", { days: calendar.tradingDays })}
          {monetary && <> · {t("footerGreen", { days: calendar.winningDays })}</>}
        </span>
        <span>
          {t("month")}:{" "}
          {monetary ? (
            <Pnl value={calendar.monthNetPnl} currency={currency} className="font-semibold" />
          ) : (
            <span className="text-muted-foreground">{t("multipleCurrencies")}</span>
          )}
        </span>
      </div>
    </div>
  );
}

function CalendarWeekRow({
  week,
  maxAbs,
  currency,
  monetary,
}: {
  week: CalendarMonth["weeks"][number];
  maxAbs: number;
  currency: string;
  monetary: boolean;
}) {
  const t = useTranslations("Calendar");
  const format = useFormat();
  const compactMoney = useCompactMoney(currency);
  const search = useSearchParams();
  const privacy = usePrivacy();
  return (
    <>
      {week.days.map((day, dayIndex) => {
        if (!day) return <div key={dayIndex} className="journal-calendar-day rounded-md" />;
        const traded = day.trades > 0;
        const intensity = traded ? 0.1 + 0.38 * (Math.abs(day.netPnl) / maxAbs) : 0;
        const performance = !monetary
          ? "neutral"
          : day.netPnl > 0
            ? "profit"
            : day.netPnl < 0
              ? "loss"
              : "neutral";
        const status = !monetary
          ? t("multipleCurrencies")
          : privacy
            ? t("pnlHidden")
            : format.money(day.netPnl, currency);
        const tradeCount = t("tradesCount", { count: day.trades });
        return (
          <HoverHint key={day.date} heading={day.date} content={`${status} · ${tradeCount}`}>
            <Link
              key={day.date}
              href={`/journal/${day.date}?${search}`}
              aria-label={`${day.date}, ${status}, ${tradeCount}`}
              className={cn(
                "journal-calendar-day journal-calendar-day-link min-w-0 rounded-md border",
                !traded && "border-transparent bg-muted/30",
              )}
              data-performance={performance}
              style={
                traded && monetary
                  ? {
                      backgroundColor: `color-mix(in oklab, ${
                        performance === "profit"
                          ? "var(--profit-fill)"
                          : performance === "loss"
                            ? "var(--loss)"
                            : "var(--neutral-mid)"
                      } ${Math.round(intensity * 100)}%, var(--card))`,
                    }
                  : undefined
              }
            >
              <div className="text-muted-foreground">{Number(day.date.slice(8))}</div>
              {traded && (
                <>
                  <div className="journal-calendar-full tnum font-medium">
                    {monetary ? (
                      <MonetaryValue>{format.money(day.netPnl, currency)}</MonetaryValue>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="journal-calendar-compact tnum font-medium">
                    {monetary ? (
                      <MonetaryValue>{compactMoney.format(day.netPnl)}</MonetaryValue>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="journal-calendar-trades text-muted-foreground">{tradeCount}</div>
                </>
              )}
            </Link>
          </HoverHint>
        );
      })}
      <div className="journal-calendar-week flex rounded-md bg-muted/40 p-1.5">
        <span className="journal-calendar-week-label text-muted-foreground">{t("weekTotal")}</span>
        {week.weekTrades > 0 ? (
          <>
            {monetary && (
              <Pnl value={week.weekNetPnl} currency={currency} className="font-medium" />
            )}
            <span className="text-muted-foreground">
              {t("tradesCount", { count: week.weekTrades })}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </div>
    </>
  );
}
