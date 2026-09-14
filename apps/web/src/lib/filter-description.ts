import type { AnalysisFilters } from "@luxalgo/journal-core";

export interface FilterDescriptionContext {
  /** Resolves `Filter.description.<filterKey>` labels. */
  translate: (key: string) => string;
  /** Resolves enum labels, e.g. `options("direction", "long")`. */
  option: (group: "direction" | "status" | "reviewed" | "asset", value: string) => string;
  accounts?: { id: string; name: string }[];
  playbooks?: { id: string; name: string }[];
  privateMode?: boolean;
  /** Locale-aware short weekday name, e.g. `weekday(0) === "Sun"`. */
  weekday?: (index: number) => string;
}

const ENUM_GROUPS: Record<string, "direction" | "status" | "reviewed" | "asset"> = {
  direction: "direction",
  status: "status",
  reviewed: "reviewed",
  assetClass: "asset",
};

export function describeFilters(
  filters: AnalysisFilters,
  context: FilterDescriptionContext,
): string {
  const {
    translate,
    option,
    accounts = [],
    playbooks = [],
    privateMode = false,
    weekday = (index) => String(index),
  } = context;
  const parts = Object.entries(filters)
    .filter(([, value]) => value)
    .map(([key, raw]) => {
      const label = translate(key);
      let value = String(raw);
      if (key === "accounts")
        value = value
          .split(",")
          .map((id) => accounts.find((a) => a.id === id)?.name ?? translate("selectedAccount"))
          .join(", ");
      else if (key === "playbookId")
        value = playbooks.find((p) => p.id === value)?.name ?? translate("selectedStrategy");
      else if (key === "weekdays")
        value = value
          .split(",")
          .map((day) => weekday(Number(day)))
          .join(", ");
      else if (ENUM_GROUPS[key]) value = option(ENUM_GROUPS[key], value);
      if (privateMode && /^(entry|exit|pnl)(Min|Max)$/.test(key)) value = "••••";
      return `${label}: ${value}`;
    });
  return parts.join(" · ") || translate("allTrades");
}
