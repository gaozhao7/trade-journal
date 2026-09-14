"use client";
import { OptionSelect } from "@/components/ui/option-select";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useApi, postJson } from "@/lib/use-api";
import { useFormat } from "@/lib/use-format";
import { useErrorText } from "@/lib/i18n-error";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { fieldClass } from "@/components/filter-fields";
export function RuleChecklist({
  tradeKey,
  playbookId,
}: {
  tradeKey: string;
  playbookId: string | null;
}) {
  const t = useTranslations("Trades");
  const format = useFormat();
  const errorText = useErrorText();
  const url = `/api/trades/${encodeURIComponent(tradeKey)}/rules`;
  const { data, error, errorCode, refresh } = useApi<{
      name: string | null;
      rules: { rule: string; followed: boolean | null }[];
    }>(`${url}?playbook=${playbookId ?? ""}`),
    [failure, setFailure] = useState("");
  const evaluated = data?.rules.filter((r) => r.followed !== null) ?? [],
    followed = evaluated.filter((r) => r.followed).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ruleReviewTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.name ? (
          <>
            <p className="text-sm font-medium">{data.name}</p>
            <p className="text-xs text-muted-foreground">
              {t("adherenceSummary", {
                pct: format.percent(evaluated.length ? followed / evaluated.length : null, 0),
                assessed: evaluated.length,
                total: data.rules.length,
              })}
            </p>
            {data.rules.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("addRulesHint")}</p>
            )}
            {data.rules.map((r) => (
              <label
                key={r.rule}
                className="flex items-center justify-between gap-3 border-t pt-2 text-sm"
              >
                <span>{r.rule}</span>
                <OptionSelect
                  aria-label={r.rule}
                  className={`${fieldClass} !w-32 shrink-0`}
                  value={r.followed === null ? "unreviewed" : String(r.followed)}
                  onValueChange={async (next) => {
                    try {
                      await postJson(url, {
                        rule: r.rule,
                        followed: next === "unreviewed" ? null : next === "true",
                      });
                      refresh();
                      setFailure("");
                    } catch (e) {
                      setFailure(String(e));
                    }
                  }}
                >
                  <option value="unreviewed">{t("assessment.unreviewed")}</option>
                  <option value="true">{t("assessment.followed")}</option>
                  <option value="false">{t("assessment.broken")}</option>
                </OptionSelect>
              </label>
            ))}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t("assignPlaybookHint")}</p>
        )}
        {(error || failure) && (
          <p role="alert" className="text-xs text-destructive">
            {error ? errorText(error, errorCode) : failure}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
