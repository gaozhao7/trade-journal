"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/use-api";
import { codeFrom } from "@/lib/api-error";
import { AiNotice } from "./ai-notice";

/** Natural-language questions against your own aggregates — BYO AI provider key. */
export function AskJournal() {
  const t = useTranslations("AI");
  const locale = useLocale();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");

  const suggestions = t.raw("suggestions") as string[];

  const ask = async (q: string) => {
    if (busy || !q.trim()) return;
    q = q.trim();
    setLastQuestion(q);
    setBusy(true);
    setError(null);
    setErrorCode(null);
    setAnswer(null);
    try {
      const result = await postJson<{ answer: string }>("/api/ai/ask", {
        question: q,
        locale,
      });
      setAnswer(result.answer);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "");
      setErrorCode(codeFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (question.trim()) void ask(question);
          }}
        >
          <Input
            aria-label={t("askAriaLabel")}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t("placeholder")}
          />
          <Button type="submit" disabled={busy || !question.trim()}>
            <Sparkles />
            {busy ? t("thinking") : t("ask")}
          </Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              disabled={busy}
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent disabled:cursor-wait disabled:opacity-50"
              onClick={() => {
                setQuestion(suggestion);
                void ask(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
        {error && (
          <AiNotice
            error={error}
            code={errorCode}
            onRetry={() => void ask(lastQuestion)}
            onDismiss={() => setError(null)}
          />
        )}
        {answer && <p className="whitespace-pre-wrap pt-1 text-sm leading-relaxed">{answer}</p>}
      </CardContent>
    </Card>
  );
}
