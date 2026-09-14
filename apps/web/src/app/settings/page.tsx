"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import { JournalDefaultSettings } from "@/components/journal-default-settings";
import { MarketDataSettings } from "@/components/market-data-settings";
import { AiSettings } from "@/components/ai-settings";
import { Download } from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeZonePicker } from "@/components/timezone-picker";
import { Label } from "@/components/ui/label";
import { postJson, useApi } from "@/lib/use-api";

interface SettingsPayload {
  locale: Locale;
  timeZone: string;
  importTimeZone: string;
  multipliers: Record<string, number>;
}

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const t = useTranslations("Settings");
  const common = useTranslations("Common");
  const router = useRouter();
  const { data } = useApi<SettingsPayload>("/api/settings");
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [timeZone, setTimeZone] = useState("");
  const [importTimeZone, setImportTimeZone] = useState("");
  const [multipliers, setMultipliers] = useState("");
  const [savedMultipliers, setSavedMultipliers] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    if (!data) return;
    setLocale(data.locale);
    setTimeZone(data.timeZone);
    setImportTimeZone(data.importTimeZone);
    setSavedMultipliers(data.multipliers ?? {});
    setMultipliers(
      Object.entries(data.multipliers ?? {})
        .map(([symbol, value]) => `${symbol}=${value}`)
        .join("\n"),
    );
  }, [data]);

  const save = async () => {
    const parsedMultipliers: Record<string, number> = {};
    for (const line of multipliers.split("\n")) {
      const [symbol, value] = line.split("=").map((part) => part.trim());
      if (symbol && value && Number.isFinite(Number(value)))
        parsedMultipliers[symbol.toUpperCase()] = Number(value);
    }
    // Only touch multipliers when they changed: saving them rebuilds every
    // account's trades, so an unchanged save must not trigger that work.
    const multipliersChanged =
      JSON.stringify(parsedMultipliers) !== JSON.stringify(savedMultipliers);
    try {
      await postJson(
        "/api/settings",
        {
          locale,
          timeZone,
          importTimeZone,
          ...(multipliersChanged ? { multipliers: parsedMultipliers } : {}),
        },
        "PATCH",
      );
      setFailure("");
    } catch {
      setFailure(t("saveFailed"));
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    // `/api/settings` also refreshes the locale cookie, so a route refresh is
    // enough to re-render in the new language — no full page reload.
    router.refresh();
  };

  return (
    <div>
      <FilterBar title={t("title")} />
      <div className="mx-auto max-w-2xl space-y-3 p-4">
        <JournalDefaultSettings />
        <MarketDataSettings />
        <Card>
          <CardHeader>
            <CardTitle>{t("journal")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="language" className="mb-1 block text-xs text-muted-foreground">
                {t("language")}
              </Label>
              <select
                id="language"
                value={locale}
                aria-describedby="language-description"
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="zh-CN">{common("chinese")}</option>
                <option value="en-US">{common("english")}</option>
              </select>
              <p id="language-description" className="mt-1 text-xs text-muted-foreground">
                {t("languageDescription")}
              </p>
            </div>
            <div>
              <Label
                htmlFor="display-timezone"
                className="mb-1 block text-xs text-muted-foreground"
              >
                {t("displayTimezone")}
              </Label>
              <TimeZonePicker
                id="display-timezone"
                label={t("displayTimezone")}
                value={timeZone}
                onValueChange={setTimeZone}
                disabled={!data}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("displayTimezoneDescription")}
              </p>
            </div>
            <div>
              <Label htmlFor="import-timezone" className="mb-1 block text-xs text-muted-foreground">
                {t("importTimezone")}
              </Label>
              <TimeZonePicker
                id="import-timezone"
                label={t("importTimezone")}
                value={importTimeZone}
                onValueChange={setImportTimeZone}
                disabled={!data}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("importTimezoneDescription")}</p>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                {t("contractMultipliers")}
              </Label>
              <textarea
                value={multipliers}
                onChange={(event) => setMultipliers(event.target.value)}
                placeholder={"ES=50\nNQ=20\nMES=5"}
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("multipliersSaved")}</p>
            {failure && (
              <p role="alert" className="text-xs text-destructive">
                {failure}
              </p>
            )}
            <Button onClick={save} disabled={!data}>
              {saved ? common("saved") : common("save")}
            </Button>
          </CardContent>
        </Card>
        <AiSettings />
        <Card>
          <CardHeader>
            <CardTitle>{common("yourData")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <a href="/api/export" download="trade-journal-export.json">
              <Button variant="outline">
                <Download />
                {common("fullBackup")}
              </Button>
            </a>
            <a href="/api/export?format=csv" download>
              <Button variant="outline">
                <Download />
                {common("tradesCsv")}
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
