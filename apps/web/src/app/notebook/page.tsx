"use client";
import { OptionSelect } from "@/components/ui/option-select";

import { Suspense, useRef, useState } from "react";
import { ArrowLeft, FolderPlus, Plus, Search } from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { VoiceNote } from "@/components/voice-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Attachments } from "@/components/attachments";
import { ReviewExport } from "@/components/review-export";
import { useAutosave } from "@/lib/use-autosave";
import { postJson, useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/i18n-error";
import { useFormat } from "@/lib/use-format";
import { ApiError } from "@/lib/api-error";

interface NoteRow {
  id: string;
  folderId: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface FolderRow {
  id: string;
  name: string;
  kind: string;
}

export default function NotebookPage() {
  return (
    <Suspense>
      <Notebook />
    </Suspense>
  );
}

function Notebook() {
  const t = useTranslations("Notebook");
  const tc = useTranslations("Common");
  const format = useFormat();
  const errorText = useErrorText();
  const [folder, setFolder] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const { data, refresh } = useApi<{ notes: NoteRow[]; folders: FolderRow[] }>(
    `/api/notes?folder=${folder}&q=${encodeURIComponent(search)}`,
  );
  const selected = data?.notes.find((note) => note.id === selectedId) ?? null;

  const createNote = async () => {
    const result = await postJson<{ id: string }>("/api/notes", {
      folderId: folder === "all" ? "my-notes" : folder,
      title: "",
    });
    refresh();
    setSelectedId(result.id);
  };

  const createFolder = async () => {
    if (creatingFolder || !folderName.trim()) return;
    setCreatingFolder(true);
    setFolderError("");
    try {
      const result = await postJson<{ id: string }>("/api/folders", { name: folderName });
      setFolder(result.id);
      setSelectedId(null);
      setSearch("");
      refresh();
      setFolderOpen(false);
      setFolderName("");
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null;
      setFolderError(
        errorText(error instanceof Error ? error.message : t("folderCreateFailed"), code),
      );
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <div>
      <Dialog open={folderOpen} onOpenChange={(open) => !creatingFolder && setFolderOpen(open)}>
        <DialogContent>
          <DialogTitle>{t("newFolderTitle")}</DialogTitle>
          <DialogDescription>{t("newFolderDescription")}</DialogDescription>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void createFolder();
            }}
          >
            <label className="block space-y-2 text-sm">
              <span>{t("folderNameLabel")}</span>
              <Input
                autoFocus
                value={folderName}
                maxLength={100}
                required
                disabled={creatingFolder}
                onChange={(event) => {
                  setFolderName(event.target.value);
                  setFolderError("");
                }}
              />
            </label>
            {folderError && (
              <p role="alert" className="text-sm text-destructive">
                {folderError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={creatingFolder}
                onClick={() => setFolderOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={creatingFolder || !folderName.trim()}>
                {creatingFolder ? t("creating") : t("createFolder")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <FilterBar
        title={t("title")}
        actions={
          <Button size="sm" onClick={createNote}>
            <Plus />
            {t("newNote")}
          </Button>
        }
      />
      <div className="notebook-workspace" data-note-open={Boolean(selected)}>
        <div className="notebook-folders min-w-0 space-y-0.5 overflow-y-auto border-r p-2">
          <button
            className={cn(
              "w-full rounded-md px-2.5 py-1.5 text-left text-sm",
              folder === "all"
                ? "bg-accent font-medium"
                : "text-muted-foreground hover:bg-accent/60",
            )}
            onClick={() => setFolder("all")}
          >
            {t("allNotes")}
          </button>
          {data?.folders
            .filter((f) => f.id !== "all")
            .map((f) => (
              <button
                key={f.id}
                className={cn(
                  "w-full break-words rounded-md px-2.5 py-1.5 text-left text-sm",
                  folder === f.id
                    ? "bg-accent font-medium"
                    : "text-muted-foreground hover:bg-accent/60",
                )}
                onClick={() => setFolder(f.id)}
              >
                {f.name}
              </button>
            ))}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              setFolderError("");
              setFolderOpen(true);
            }}
          >
            <FolderPlus />
            {t("newFolder")}
          </Button>
        </div>

        <div className="notebook-list min-w-0 overflow-y-auto border-r">
          <div className="sticky top-0 z-[1] space-y-2 border-b bg-background p-2">
            <div className="flex min-w-0 items-center gap-2 xl:hidden">
              <OptionSelect
                aria-label={t("folderAria")}
                value={folder}
                onValueChange={(next) => setFolder(next)}
                className="h-9 min-w-0 flex-1 rounded-lg border bg-card px-2 text-sm"
              >
                <option value="all">{t("allNotes")}</option>
                {data?.folders
                  .filter((item) => item.id !== "all")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </OptionSelect>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label={t("newFolder")}
                onClick={() => {
                  setFolderError("");
                  setFolderOpen(true);
                }}
              >
                <FolderPlus />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-8"
              />
            </div>
          </div>
          {data?.notes.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("emptyTitle")}</p>
          )}
          {data?.notes.map((note) => (
            <button
              key={note.id}
              className={cn(
                "block w-full border-b px-3 py-2.5 text-left hover:bg-accent/40",
                selectedId === note.id && "bg-accent/60",
              )}
              onClick={() => setSelectedId(note.id)}
            >
              <div className="truncate text-sm font-medium">{note.title || t("untitled")}</div>
              <div className="truncate text-xs text-muted-foreground">
                {format.date(note.updatedAt)} · {note.content.slice(0, 60) || t("emptyPreview")}
              </div>
            </button>
          ))}
        </div>

        <div className="notebook-editor min-w-0 overflow-y-auto p-3 sm:p-4">
          {selected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-3 md:hidden"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft />
              {t("backToNotes")}
            </Button>
          )}
          {selected ? (
            <NoteEditor key={selected.id} note={selected} onChanged={refresh} />
          ) : (
            <p className="py-24 text-center text-sm text-muted-foreground">{t("selectOrCreate")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteEditor({ note, onChanged }: { note: NoteRow; onChanged: () => void }) {
  const t = useTranslations("Notebook");
  const tc = useTranslations("Common");
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [mode, setMode] = useState<"edit" | "preview">(note.content.trim() ? "preview" : "edit");
  const editor = useRef<RichEditorHandle>(null);
  const {
    save: queueSave,
    status,
    flush,
  } = useAutosave(`/api/notes/${note.id}`, "PATCH", onChanged);
  const save = (title: string, content: string) => queueSave({ title, content });

  return (
    <Card className="mx-auto max-w-3xl">
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              save(event.target.value, content);
            }}
            className="notebook-editor-title border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            placeholder={t("titlePlaceholder")}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
          >
            {mode === "preview" ? tc("edit") : tc("preview")}
          </Button>
          <VoiceNote
            onPrepare={() => editor.current?.focus()}
            onText={(text) => {
              const next = content ? `${content} ${text}` : text;
              setContent(next);
              save(title, next);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={async () => {
              if (window.confirm(t("deleteConfirm"))) {
                await postJson(`/api/notes/${note.id}`, undefined, "DELETE");
                onChanged();
              }
            }}
          >
            {tc("delete")}
          </Button>
        </div>
        <RichEditor
          editorRef={editor}
          mode={mode}
          onModeChange={setMode}
          showModeToggle={false}
          value={content}
          onChange={(value) => {
            setContent(value);
            save(title, value);
          }}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span role="status">{status}</span>
          <Button variant="ghost" size="sm" onClick={() => void flush()}>
            {tc("saveNow")}
          </Button>
        </div>
        <ReviewExport document={{ title: title || t("noteExportTitle"), lines: [content] }} />
        <Attachments type="note" id={note.id} />
      </CardContent>
    </Card>
  );
}
