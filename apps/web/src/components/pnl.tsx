"use client";

import { useFormat } from "@/lib/use-format";
import { cn, pnlClass } from "@/lib/utils";
import { MonetaryValue } from "./privacy";

/** Signed P&L text — the sign carries polarity; color only reinforces it. */
export function Pnl({
  value,
  className,
  currency = "USD",
}: {
  value: number;
  className?: string;
  currency?: string;
}) {
  const format = useFormat();
  return (
    <span className={cn("tnum", pnlClass(value), className)}>
      <MonetaryValue>{format.money(value, currency)}</MonetaryValue>
    </span>
  );
}
