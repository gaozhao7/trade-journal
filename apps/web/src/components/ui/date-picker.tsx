"use client";

import { useEffect, useId, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { formatDateInput, parseDateInput } from "@/lib/date-input";

function CalendarLoading() {
  const t = useTranslations("Accessibility");
  return <div role="status" aria-label={t("loadingCalendar")} className="h-[300px]" />;
}

// The calendar is loaded on demand, not in every page's initial filter-bar bundle.
const Calendar = dynamic(() => import("./calendar").then((module) => module.Calendar), {
  loading: () => <CalendarLoading />,
});

export function DatePicker({
  value,
  onValueChange,
  label,
  min,
  max,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  min?: string;
  max?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("Common");
  const validation = useTranslations("Validation");
  const accessibility = useTranslations("Accessibility");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);
  const allowed = (date: string) => (!min || date >= min) && (!max || date <= max);
  const select = (date: string) => {
    setDraft(date);
    setInvalid(false);
    onValueChange(date);
    setOpen(false);
  };
  const today = formatDateInput(new Date());
  const selected = parseDateInput(value);
  const invalidMessage =
    min && max
      ? validation("invalidDateRange", { min, max })
      : max
        ? validation("invalidDateBefore", { max })
        : min
          ? validation("invalidDateAfter", { min })
          : validation("invalidDate");
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <span className="relative block min-w-0">
          <Input
            value={draft}
            aria-label={label}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            placeholder="YYYY-MM-DD"
            disabled={disabled}
            className="journal-date-input pr-10 tabular-nums"
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              setInvalid(false);
              if (!next || (parseDateInput(next) && allowed(next))) onValueChange(next);
            }}
            onBlur={() => setInvalid(Boolean(draft && (!parseDateInput(draft) || !allowed(draft))))}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
              }
              if (event.key === "Escape") {
                setDraft(value);
                setInvalid(false);
              }
            }}
          />
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={accessibility("dateInputHint", { label })}
              className="absolute top-0 right-0 flex size-9 items-center justify-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
            </button>
          </Popover.Trigger>
          {invalid && (
            <span id={errorId} role="alert" className="mt-1 block text-xs text-destructive">
              {invalidMessage}
            </span>
          )}
        </span>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          aria-label={accessibility("calendarDialog", { label })}
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="journal-popup journal-menu-surface z-50 w-[296px] max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-xl border bg-popover p-3 text-popover-foreground outline-none"
        >
          <Calendar
            mode="single"
            autoFocus
            selected={selected}
            defaultMonth={selected ?? parseDateInput(max ?? "") ?? new Date()}
            onSelect={(date) => select(date ? formatDateInput(date) : "")}
            disabled={(date) => !allowed(formatDateInput(date))}
          />
          <div className="mt-3 flex items-center justify-between border-t pt-2">
            <Button variant="ghost" size="sm" disabled={!draft} onClick={() => select("")}>
              {t("clear")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!allowed(today)}
              onClick={() => select(today)}
            >
              {t("today")}
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
