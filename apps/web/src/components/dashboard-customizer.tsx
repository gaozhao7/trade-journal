"use client";

import { forwardRef, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  ChevronDown,
  Gauge,
  RotateCcw,
  Search,
  SearchX,
  Settings2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface CardOption {
  id: string;
  label: string;
  /** Decorative icon; a card without one falls back to a generic glyph. */
  icon?: LucideIcon;
}

interface DashboardCustomizerProps {
  widgets: CardOption[];
  hidden: string[];
  open: boolean;
  onOpenChange(open: boolean): void;
  onVisibilityChange(id: string, visible: boolean): void;
  onShowAll(): void;
  onRestore(): void;
}

export function DashboardCustomizer(props: DashboardCustomizerProps) {
  const t = useTranslations("Dashboard");
  return (
    <Popover.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Popover.Trigger asChild>
        <Button type="button" variant="outline" size="sm" className="dashboard-customize-trigger">
          <Settings2 />
          {t("customize.trigger")}
          <ChevronDown className="dashboard-customize-chevron" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <CustomizerPanel {...props} />
      </Popover.Portal>
    </Popover.Root>
  );
}

const CustomizerPanel = forwardRef<HTMLDivElement, DashboardCustomizerProps>(
  function CustomizerPanel(
    { widgets, hidden, onVisibilityChange, onShowAll, onRestore },
    forwardedRef,
  ) {
    const t = useTranslations("Dashboard");
    const titleId = useId();
    const [query, setQuery] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [listHeight, setListHeight] = useState<number>();
    const [highlight, setHighlight] = useState<{ top: number; height: number } | null>(null);
    const matches = widgets.filter((widget) =>
      widget.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    );

    useLayoutEffect(() => {
      const list = listRef.current;
      if (!list) return;
      const measure = () => setListHeight(Math.min(352, list.offsetHeight));
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(list);
      return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
      setHighlight(null);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [query]);

    function spotlight(button: HTMLButtonElement) {
      setHighlight({ top: button.offsetTop, height: button.offsetHeight });
    }

    function focusResult(index: number) {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-card-toggle]");
      if (!buttons?.length) return;
      const button = buttons[(index + buttons.length) % buttons.length];
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "nearest" });
    }

    return (
      <Popover.Content
        ref={forwardedRef}
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="dashboard-customize-panel"
        aria-labelledby={titleId}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus({ preventScroll: true });
        }}
        onInteractOutside={(event) => {
          // Keep the existing move arrows usable while this non-modal panel is open.
          if (
            event.target instanceof Element &&
            event.target.closest("[data-dashboard-move-controls]")
          )
            event.preventDefault();
        }}
      >
        <div className="dashboard-customize-heading">
          <h2 id={titleId}>{t("customize.heading")}</h2>
          <span className="dashboard-customize-count">
            {t("customize.visible", { count: widgets.length - hidden.length })}
          </span>
          <Popover.Close asChild>
            <button
              type="button"
              className="dashboard-customize-icon-button"
              aria-label={t("customize.close")}
            >
              <X size={14} />
            </button>
          </Popover.Close>
        </div>
        <div className="dashboard-customize-search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            aria-label={t("customize.findAria")}
            placeholder={t("customize.findPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                focusResult(event.key === "ArrowDown" ? 0 : -1);
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="dashboard-customize-icon-button"
              aria-label={t("customize.clearSearch")}
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div
          ref={scrollRef}
          className="dashboard-customize-results"
          style={{ height: listHeight }}
          onPointerLeave={() => {
            const focused = listRef.current?.querySelector<HTMLButtonElement>(
              "[data-card-toggle]:focus",
            );
            if (focused) spotlight(focused);
            else setHighlight(null);
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setHighlight(null);
          }}
          onKeyDown={(event) => {
            const buttons = Array.from(
              listRef.current?.querySelectorAll<HTMLButtonElement>("[data-card-toggle]") ?? [],
            );
            const index = buttons.indexOf(event.target as HTMLButtonElement);
            if (index < 0) return;
            const next = {
              ArrowDown: index + 1,
              ArrowUp: index - 1,
              Home: 0,
              End: buttons.length - 1,
            }[event.key];
            if (next !== undefined) {
              event.preventDefault();
              focusResult(next);
            }
          }}
        >
          <div ref={listRef} className="dashboard-customize-list">
            <div
              aria-hidden="true"
              className="dashboard-customize-highlight"
              style={{
                opacity: highlight ? 1 : 0,
                height: highlight?.height ?? 46,
                transform: `translateY(${highlight?.top ?? 4}px)`,
              }}
            />
            {matches.map((widget, index) => {
              const visible = !hidden.includes(widget.id);
              const Icon = widget.icon ?? Gauge;
              return (
                <button
                  key={widget.id}
                  type="button"
                  role="switch"
                  aria-checked={visible}
                  aria-label={t("customize.showCard", { label: widget.label })}
                  data-card-toggle
                  className="dashboard-customize-option"
                  style={{ "--option-index": Math.min(index, 7) } as CSSProperties}
                  onPointerEnter={(event) => spotlight(event.currentTarget)}
                  onFocus={(event) => spotlight(event.currentTarget)}
                  onClick={() => onVisibilityChange(widget.id, !visible)}
                >
                  <span className="dashboard-customize-card-icon" aria-hidden="true">
                    <Icon size={15} strokeWidth={1.7} />
                  </span>
                  <span className="dashboard-customize-label">{widget.label}</span>
                  <span className="dashboard-customize-switch" aria-hidden="true">
                    <span />
                  </span>
                </button>
              );
            })}
            {matches.length === 0 && (
              <div className="dashboard-customize-empty">
                <SearchX size={22} aria-hidden="true" />
                <p>{t("customize.noMatching")}</p>
                <button type="button" onClick={() => setQuery("")}>
                  {t("customize.clearSearchButton")}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="dashboard-customize-footer">
          <button type="button" onClick={onRestore} aria-label={t("customize.restoreAria")}>
            <RotateCcw size={13} aria-hidden="true" />
            {t("customize.resetLayout")}
          </button>
          <button type="button" onClick={onShowAll} disabled={hidden.length === 0}>
            {t("customize.showAll")}
          </button>
        </div>
        <span role="status" className="sr-only">
          {t("customize.found", {
            count: matches.length,
            visible: widgets.length - hidden.length,
            total: widgets.length,
          })}
        </span>
      </Popover.Content>
    );
  },
);
