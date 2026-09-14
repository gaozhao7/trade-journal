"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExportError, exportPdf, exportPng, type ReviewDocument } from "@/lib/export-review";
import { useFormat } from "@/lib/use-format";
import { usePrivacy } from "./privacy";
interface Preview {
  url: string;
  filename: string;
  type: string;
}
export function ReviewExport({
  document,
  containsFinancialData = false,
}: {
  document: ReviewDocument;
  containsFinancialData?: boolean;
}) {
  const t = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const format = useFormat();
  const privateMode = usePrivacy();
  const concealed = privateMode && containsFinancialData;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [files, setFiles] = useState<Preview[]>([]),
    [open, setOpen] = useState(false);
  const urls = useRef<string[]>([]);
  const [previewDocument, setPreviewDocument] = useState<ReviewDocument | null>(null);
  useEffect(
    () => () => {
      urls.current.forEach(URL.revokeObjectURL);
    },
    [],
  );
  const exportFailure = (cause: unknown): string => {
    if (cause instanceof ExportError) {
      if (cause.code === "fontUnsupported")
        return tErrors("exportFontUnsupported", {
          characters: String(cause.params?.characters ?? ""),
        });
      if (cause.code === "fontLoadFailed") return tErrors("exportFontLoadFailed");
      if (cause.code === "imageUnavailable") return tErrors("exportImageUnavailable");
      return tErrors("exportFailed");
    }
    return cause instanceof Error && cause.message ? cause.message : tErrors("exportFailed");
  };
  async function run(image: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await (image ? exportPng : exportPdf)(document);
      urls.current.forEach(URL.revokeObjectURL);
      const next = result.map((f) => ({
        url: URL.createObjectURL(f.blob),
        filename: f.filename,
        type: f.blob.type,
      }));
      urls.current = next.map((f) => f.url);
      setFiles(next);
      setPreviewDocument(document);
      setOpen(true);
    } catch (e) {
      setError(exportFailure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || concealed}
          onClick={() => void run(false)}
        >
          <Download />
          {t("exportPdf")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || concealed}
          onClick={() => void run(true)}
        >
          <ImageIcon />
          {t("exportPng")}
        </Button>
      </div>
      {concealed && <p className="text-xs text-muted-foreground">{t("privacyExportHint")}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Dialog open={open && !concealed} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("reviewExportTitle")}</DialogTitle>
          </DialogHeader>
          {files.map((f, i) => (
            <div key={f.url} className="space-y-3">
              <Button asChild size="sm">
                <a href={f.url} download={f.filename}>
                  {t("downloadFormat", {
                    format: f.type === "application/pdf" ? "PDF" : "PNG",
                  })}
                  {files.length > 1
                    ? ` · ${format.number(i + 1)}/${format.number(files.length)}`
                    : ""}
                </a>
              </Button>
              {f.type === "application/pdf" ? (
                <div className="rounded border bg-white p-6 text-slate-800">
                  <p className="mb-4 text-xs text-slate-500">{t("reviewTextHint")}</p>
                  <h3 className="mb-2 text-xl font-semibold">{previewDocument?.title}</h3>
                  <p className="mb-6 text-xs text-slate-500">{previewDocument?.subtitle}</p>
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {previewDocument?.lines.join("\n")}
                  </div>
                </div>
              ) : (
                <img src={f.url} alt={t("exportedAlt")} className="w-full rounded border" />
              )}
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
