"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_CSV_BYTES, type MarketCsvDataset } from "@/lib/market-csv";
import { RESOLUTIONS, type MarketBar, type Resolution } from "@/lib/market-data";
import { postJson, useApi } from "@/lib/use-api";
import { useErrorText } from "@/lib/i18n-error";
import { codeFrom } from "@/lib/api-error";
import { useFormat } from "@/lib/use-format";
import { decodeImportFile } from "@/lib/decode-import";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";
import { MonetaryValue } from "./privacy";
interface Preview {
  count: number;
  from: string;
  to: string;
  sample: MarketBar[];
}
const PRICE_BASES = ["raw", "split", "adjusted", "midpoint", "bid", "ask"] as const;
export function MarketCsvSettings({ onChange }: { onChange: () => void }) {
  const t = useTranslations("MarketData");
  const format = useFormat();
  const errorText = useErrorText();
  const {
    data,
    refresh,
    error: listError,
    errorCode: listErrorCode,
  } = useApi<{ datasets: MarketCsvDataset[] }>("/api/market-data/csv");
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [symbol, setSymbol] = useState("");
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [currency, setCurrency] = useState("");
  const [priceBasis, setPriceBasis] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const change = () => {
    setPreview(null);
    setMessage("");
    setError("");
  };
  const act = async (action: "preview" | "import" | "remove", id?: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = await postJson<Preview>("/api/market-data/csv", {
        action,
        id,
        ...file,
        symbol,
        resolution,
        currency,
        priceBasis,
      });
      if (action === "preview") setPreview(body);
      else {
        setPreview(null);
        setMessage(action === "import" ? t("importSuccess") : t("removeSuccessCsv"));
        refresh();
        onChange();
      }
    } catch (cause) {
      setError(
        errorText(cause instanceof Error ? cause.message : null, codeFrom(cause)) ||
          t("requestFailed"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-lg border p-3" id="market-csv">
      <h3 className="text-sm font-medium">{t("csvTitle")}</h3>
      <p className="text-xs text-muted-foreground">{t("csvDescription")}</p>
      <a className="text-xs underline" href="/market-data-template.csv" download>
        {t("downloadTemplate")}
      </a>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="candle-file">{t("candleFile")}</Label>
          <Input
            id="candle-file"
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            disabled={busy}
            onChange={async (event) => {
              const selected = event.target.files?.[0];
              change();
              setFile(null);
              if (!selected) return;
              if (selected.size > MAX_CSV_BYTES) {
                setError(t("fileTooLarge"));
                return;
              }
              setBusy(true);
              try {
                setFile({
                  name: selected.name,
                  content: decodeImportFile(await selected.arrayBuffer()),
                });
              } catch {
                setError(t("readFailed"));
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="candle-symbol">{t("instrumentSymbol")}</Label>
          <Input
            id="candle-symbol"
            value={symbol}
            disabled={busy}
            placeholder={t("symbolPlaceholder")}
            onChange={(event) => {
              change();
              setSymbol(event.target.value.trim());
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="candle-resolution">{t("candleResolution")}</Label>
          <OptionSelect
            id="candle-resolution"
            value={resolution}
            disabled={busy}
            onValueChange={(value) => {
              change();
              setResolution(value as Resolution);
            }}
          >
            <option value="" disabled>
              {t("chooseResolution")}
            </option>
            {Object.keys(RESOLUTIONS).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </OptionSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="candle-currency">{t("quoteCurrency")}</Label>
          <Input
            id="candle-currency"
            value={currency}
            disabled={busy}
            maxLength={12}
            onChange={(event) => {
              change();
              setCurrency(event.target.value.toUpperCase());
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="candle-basis">{t("priceBasis")}</Label>
          <OptionSelect
            id="candle-basis"
            value={priceBasis}
            disabled={busy}
            onValueChange={(value) => {
              change();
              setPriceBasis(value);
            }}
          >
            <option value="" disabled>
              {t("chooseBasis")}
            </option>
            {PRICE_BASES.map((value) => (
              <option key={value} value={value}>
                {t(`basisLabels.${value}`)}
              </option>
            ))}
          </OptionSelect>
        </div>
      </div>
      <Button
        variant="outline"
        disabled={busy || !file || !symbol || !currency || !resolution || !priceBasis}
        onClick={() => void act("preview")}
      >
        {t("validatePreview")}
      </Button>
      {preview && (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs">
            {t("candleCount", { count: preview.count })} ·{" "}
            {format.dateTime(preview.from, { dateStyle: "short", timeStyle: "short" }, "UTC")} –{" "}
            {format.dateTime(preview.to, { dateStyle: "short", timeStyle: "short" }, "UTC")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="text-left">{t("firstCandles")}</caption>
              <thead>
                <tr>
                  {(["colTime", "colOpen", "colHigh", "colLow", "colClose"] as const).map(
                    (label) => (
                      <th key={label} className="p-2">
                        {t(label)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((bar) => (
                  <tr key={bar.time}>
                    <td className="p-2">
                      {format.dateTime(
                        bar.time,
                        { dateStyle: "short", timeStyle: "medium" },
                        "UTC",
                      )}
                    </td>
                    {[bar.open, bar.high, bar.low, bar.close].map((value, index) => (
                      <td key={index} className="p-2">
                        <MonetaryValue>{format.number(value, 8)}</MonetaryValue>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button disabled={busy} onClick={() => void act("import")}>
            {t("importCandles")}
          </Button>
        </div>
      )}
      {(error || listError) && (
        <p role="alert" className="text-xs text-destructive">
          {error || errorText(listError, listErrorCode)}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
      {data?.datasets.map((dataset) => (
        <div
          key={dataset.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
        >
          <div className="min-w-0 text-xs">
            <p className="break-all font-medium">
              {dataset.name} · {dataset.symbol} · {dataset.resolution}
            </p>
            <p className="text-muted-foreground">
              {t("candleCount", { count: dataset.count })} · {dataset.currency} ·{" "}
              {t(`basisLabels.${dataset.priceBasis}`)} ·{" "}
              {format.date(dataset.from, { dateStyle: "short" }, "UTC")} –{" "}
              {format.date(dataset.to, { dateStyle: "short" }, "UTC")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void act("remove", dataset.id)}
          >
            {t("removeDataset")}
          </Button>
        </div>
      ))}
    </div>
  );
}
