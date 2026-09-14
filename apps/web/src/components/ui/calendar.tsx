"use client";

import { useMemo } from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { enUS, zhCN } from "react-day-picker/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

export function Calendar(props: DayPickerProps) {
  const locale = useLocale();
  const t = useTranslations("Accessibility");
  const labels = useMemo(
    () => ({
      labelNext: () => t("nextMonth"),
      labelPrevious: () => t("previousMonth"),
    }),
    [t],
  );
  return (
    <DayPicker
      showOutsideDays
      fixedWeeks
      locale={locale === "zh-CN" ? zhCN : enUS}
      labels={labels}
      className="journal-date-calendar"
      classNames={{
        months: "relative",
        month_caption: "flex h-9 items-center justify-center px-10 mb-3",
        caption_label: "text-sm font-medium tracking-tight",
        nav: "absolute inset-x-0 top-0 flex justify-between",
        button_previous: "journal-calendar-nav",
        button_next: "journal-calendar-nav",
        month_grid: "w-full table-fixed border-collapse",
        weekday: "h-8 text-center text-[11px] font-medium text-muted-foreground",
        day: "p-0.5 text-center",
        day_button: "journal-calendar-date",
        selected: "journal-date-selected",
        today: "journal-date-today",
        outside: "journal-date-outside",
        disabled: "opacity-30",
        hidden: "invisible",
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  );
}
