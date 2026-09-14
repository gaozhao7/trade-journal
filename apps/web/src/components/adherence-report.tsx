"use client";
import { useTranslations } from "next-intl";
import { useApi } from "@/lib/use-api";
import { useErrorText } from "@/lib/i18n-error";
import { useFormat } from "@/lib/use-format";
import { useFilters } from "@/components/filter-bar";
import { MonetaryValue } from "./privacy";
import type { GroupSummary } from "@luxalgo/journal-core";
interface Adherence {
  id: string;
  total: number;
  evaluated: number;
  possible: number;
  rate: number | null;
  currencies: string[];
  followed: GroupSummary;
  broken: GroupSummary;
  unassessed: number;
  rules: {
    rule: string;
    evaluated: number;
    rate: number | null;
    followed: GroupSummary;
    broken: GroupSummary;
  }[];
}
export function AdherenceReport({ bookId }: { bookId: string }) {
  const t = useTranslations("Reports");
  const format = useFormat();
  const errorText = useErrorText();
  const { query } = useFilters();
  const { data, error, errorCode } = useApi<{ books: Adherence[] }>(`/api/adherence?${query}`);
  const b = data?.books.find((b) => b.id === bookId);
  if (error)
    return (
      <p role="alert" className="text-xs text-destructive">
        {errorText(error, errorCode)}
      </p>
    );
  if (!b) return null;
  // Only a single known currency can be rendered as money; an empty list
  // (no evaluated trades) or a mixed set must not reach the formatter.
  const currency = b.currencies.length === 1 ? (b.currencies[0] ?? null) : null;
  const rate = (n: number | null) => (n === null ? "–" : format.percent(n, 0));
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t("adherence.title")}</span>
        <strong className="text-lg">{rate(b.rate)}</strong>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("adherence.summary", {
          evaluated: format.number(b.evaluated, 0),
          possible: format.number(b.possible, 0),
          total: format.number(b.total, 0),
          unassessed: format.number(b.unassessed, 0),
        })}
      </p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        {(
          [
            ["allFollowed", b.followed],
            ["oneBroken", b.broken],
          ] as const
        ).map(([key, stats]) => (
          <div key={key} className="rounded-md bg-muted/40 p-2">
            <p className="mb-1 font-medium">{t(`adherence.${key}`)}</p>
            <p>
              {t("adherence.tradesWin", {
                trades: format.number(stats.trades, 0),
                winRate: format.percent(stats.winRate, 0),
              })}
            </p>
            {currency && (
              <p className={stats.netPnl >= 0 ? "text-profit" : "text-loss"}>
                <MonetaryValue>{format.money(stats.netPnl, currency)}</MonetaryValue>
              </p>
            )}
          </div>
        ))}
      </div>
      {b.currencies.length > 1 && (
        <p className="text-xs text-muted-foreground">{t("adherence.mixedHidden")}</p>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">{t("adherence.byRule")}</summary>
        <div className="mt-2 space-y-3">
          {b.rules.map((r) => (
            <div key={r.rule} className="border-t pt-2">
              <p className="font-medium">{r.rule}</p>
              <p className="text-muted-foreground">
                {t("adherence.ruleLine", {
                  rate: rate(r.rate),
                  evaluated: format.number(r.evaluated, 0),
                })}
              </p>
              <p>
                {t("adherence.ruleSplit", {
                  trades: format.number(r.followed.trades, 0),
                  winRate: format.percent(r.followed.winRate, 0),
                  brokenTrades: format.number(r.broken.trades, 0),
                  brokenWinRate: format.percent(r.broken.winRate, 0),
                })}
              </p>
              {currency && (
                <p>
                  {t("adherence.rulePnl", {
                    followed: format.number(r.followed.netPnl),
                    broken: format.number(r.broken.netPnl),
                    currency,
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
