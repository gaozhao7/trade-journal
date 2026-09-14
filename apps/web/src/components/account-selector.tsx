"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FlaskConical, WalletCards } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select";
import { postJson, useApi } from "@/lib/use-api";
import { useErrorText } from "@/lib/i18n-error";

interface AccountOption {
  id: string;
  name: string;
  broker: string;
  archivedAt: string | null;
}

/** Quick account switching; the full Filters panel still supports multiple accounts. */
export function AccountSelector() {
  const t = useTranslations("Accounts");
  const errorText = useErrorText();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data, error, errorCode, refresh } = useApi<{ accounts: AccountOption[] }>(
    "/api/accounts?summary=1",
  );
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState("");
  const selected = params.get("accounts")?.split(",").filter(Boolean) ?? [];
  const accounts = data?.accounts.filter((a) => !a.archivedAt || selected.includes(a.id)) ?? [];
  const demo = accounts.find((a) => a.broker === "demo");
  const value = selected.length > 1 ? "multiple" : (selected[0] ?? "all");
  const label =
    selected.length > 1
      ? t("count", { count: selected.length })
      : (accounts.find((a) => a.id === selected[0])?.name ??
        (selected.length ? t("selectedAccount") : t("allAccounts")));

  function selectAccount(id: string) {
    const next = new URLSearchParams(params.toString());
    if (id === "all") next.delete("accounts");
    else next.set("accounts", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function select(value: string) {
    setDemoError("");
    if (value !== "load-demo") return selectAccount(value);
    setLoadingDemo(true);
    try {
      const result = await postJson<{ accountId: string }>("/api/demo", {});
      refresh();
      selectAccount(result.accountId);
    } catch {
      setDemoError(t("loadDemoError"));
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <div className="relative min-w-0 max-w-full">
      <Select value={value} onValueChange={(value) => void select(value)} disabled={loadingDemo}>
        <SelectTrigger
          aria-label={t("selectAccount")}
          className="h-8 w-44 max-w-full rounded-lg text-xs"
        >
          <WalletCards className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-left">
            {loadingDemo ? t("loadingDemo") : label}
          </span>
        </SelectTrigger>
        <SelectContent
          className="rounded-2xl border-border p-1 shadow-[var(--shadow-menu)]"
          align="end"
        >
          <SelectItem value="all" className="rounded-lg text-xs">
            {t("allAccounts")}
          </SelectItem>
          {selected.length > 1 && (
            <SelectItem value="multiple" disabled className="text-xs">
              {label}
            </SelectItem>
          )}
          {accounts
            .filter((a) => a.broker !== "demo")
            .map((account) => (
              <SelectItem key={account.id} value={account.id} className="rounded-lg text-xs">
                <span className="block max-w-64 truncate">
                  {account.name}
                  {account.archivedAt ? ` (${t("archived")})` : ""}
                </span>
              </SelectItem>
            ))}
          <div className="my-1 border-t" />
          <SelectItem value={demo?.id ?? "load-demo"} className="rounded-lg text-xs">
            <span className="flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
              {demo?.name ?? t("loadDemo")}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      {(demoError || error) && (
        <p role="alert" className="max-w-64 pt-1 text-xs text-destructive">
          {demoError || errorText(error, errorCode)}
        </p>
      )}
    </div>
  );
}
