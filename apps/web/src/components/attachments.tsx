"use client";
import { HoverHint } from "./ui/tooltip";
import { useRef, useState } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postJson, useApi } from "@/lib/use-api";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/i18n-error";
import { useFormat } from "@/lib/use-format";
export function Attachments({
  type,
  id,
}: {
  type: "trade" | "day" | "note" | "missed" | "prop-account" | "prop-entry";
  id: string;
}) {
  const t = useTranslations("Journal");
  const format = useFormat();
  const errorText = useErrorText();
  const { data, error, refresh } = useApi<{
    attachments: { id: string; name: string; mime: string; size: number }[];
  }>(`/api/attachments?type=${type}&id=${encodeURIComponent(id)}`);
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Paperclip />
          {busy ? t("attachments.uploading") : t("attachments.add")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("attachments.hint")}</span>
      </div>
      <input
        ref={input}
        aria-label={t("attachments.uploadAria")}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        multiple
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          setBusy(true);
          setFailure("");
          try {
            for (const file of files) {
              const body = new FormData();
              body.append("type", type);
              body.append("id", id);
              body.append("file", file);
              const r = await fetch("/api/attachments", { method: "POST", body });
              const result = await r.json();
              if (!r.ok) throw new Error(result.error);
            }
          } catch (err) {
            setFailure(
              errorText(err instanceof Error ? err.message : t("attachments.uploadFailed"), null),
            );
          } finally {
            setBusy(false);
            if (input.current) input.current.value = "";
            refresh();
          }
        }}
      />
      {(failure || error) && (
        <p role="alert" className="text-xs text-destructive">
          {failure || errorText(error, null)}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {data?.attachments.map((a) => (
          <div key={a.id} className="min-w-0 rounded-md border p-2">
            <HoverHint content={a.name}>
              <a
                href={`/api/attachments/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                {a.mime.startsWith("image/") && (
                  <img
                    src={`/api/attachments/${a.id}`}
                    alt={a.name}
                    className="mb-2 h-28 w-full rounded object-contain"
                  />
                )}
                <span className="block truncate text-xs underline">{a.name}</span>
              </a>
            </HoverHint>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("attachments.sizeKb", { size: format.number(a.size / 1024, 0) })}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={t("attachments.removeAria", { name: a.name })}
                onClick={async () => {
                  if (!window.confirm(t("attachments.removeConfirm", { name: a.name }))) return;
                  try {
                    await postJson(`/api/attachments/${a.id}`, undefined, "DELETE");
                    refresh();
                  } catch (e) {
                    setFailure(
                      errorText(
                        e instanceof Error ? e.message : t("attachments.uploadFailed"),
                        null,
                      ),
                    );
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
