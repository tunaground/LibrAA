import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/app-store";
import { getLocalizedField, resolveLocale } from "../../lib/locale";
import { createThread, deleteThread, updateThreadI18n, updateThreadTags, updateThreadSortOrder, getAllTags } from "../../lib/db";
import { TagInput } from "../common/TagInput";
import { importLaa, exportThread } from "../../lib/laa";
import type { ThreadI18n } from "../../types";
import { Upload, Plus, Pencil, Download, Trash2, ClipboardPaste, FileText } from "lucide-react";
import { exportThreadHtml } from "../../lib/html-export";

interface ThreadPanelProps {
  onRefresh: () => Promise<void>;
  onSeriesRefresh: () => Promise<void>;
  onShowPaste: () => void;
  width: number;
}

export function ThreadPanel({ onRefresh, onSeriesRefresh, onShowPaste, width }: ThreadPanelProps) {
  const { t, i18n } = useTranslation();
  const { threadList, selectedThreadId, setSelectedThreadId } = useAppStore();
  const locale = i18n.language;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLocale, setEditLocale] = useState(locale);
  const [editFields, setEditFields] = useState<ThreadI18n>({});
  const [editTags, setEditTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    getAllTags().then(setAllTags);
  }, [threadList]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const selectedSeriesId = useAppStore((s) => s.selectedSeriesId);

  const handleCreate = async () => {
    const id = await createThread(selectedSeriesId, { [locale]: { name: t("thread.unnamed") } });
    await onRefresh();
    setSelectedThreadId(id);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t("thread.deleteConfirm"))) {
      await deleteThread(id);
      if (selectedThreadId === id) setSelectedThreadId(null);
      await onRefresh();
    }
  };

  const startEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const thread = threadList.find((t) => t.id === id);
    if (!thread) return;
    const resolved = resolveLocale(thread.i18n, locale);
    setEditingId(id);
    setEditLocale(resolved);
    setEditFields(thread.i18n[resolved] ?? {});
    setEditTags([...thread.tags]);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateThreadI18n(editingId, editLocale, editFields);
    await updateThreadTags(
      editingId,
      editTags,
    );
    setEditingId(null);
    await onRefresh();
  };

  const handleExport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const thread = threadList.find((t) => t.id === id);
      const rawName = (getLocalizedField(thread?.i18n ?? {}, "name", locale) as string) ?? "thread";
      const name = rawName.replace(/[/\\:*?"<>|]/g, "_");
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        defaultPath: `${name}.laa`,
        filters: [{ name: "LibrAA Archive", extensions: ["laa"] }],
      });
      if (path) {
        const data = await exportThread(id);
        await writeTextFile(path, data);
      }
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  const handleExportHtml = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const thread = threadList.find((t) => t.id === id);
      const rawName = (getLocalizedField(thread?.i18n ?? {}, "name", locale) as string) ?? "thread";
      const name = rawName.replace(/[/\\:*?"<>|]/g, "_");
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        defaultPath: `${name}.html`,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (path) {
        const data = await exportThreadHtml(id, locale);
        await writeTextFile(path, data);
      }
    } catch (e) {
      console.error("HTML export failed:", e);
    }
  };

  const handleReorder = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const draggedIdx = threadList.findIndex((t) => t.id === draggedId);
    const targetIdx = threadList.findIndex((t) => t.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    // Reorder: assign sort_order based on new position
    const reordered = [...threadList];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sortOrder !== i) {
        await updateThreadSortOrder(reordered[i].id, i);
      }
    }
    await onRefresh();
  };

  const handleImportFile = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await open({
        filters: [{ name: "Libraa Archive", extensions: ["laa"] }],
        multiple: false,
      });
      if (path) {
        const content = await readTextFile(path as string);
        await importLaa(content, selectedSeriesId);
        await onSeriesRefresh();
        await onRefresh();
      }
    } catch (e) {
      console.error("Import failed:", e);
    }
  };

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: `${width}px`,
      }}
    >
      <div className="panel-header">
        <span className="panel-header-title">{t("thread.title")}</span>
        <div className="flex" style={{ gap: "2px" }}>
          <button className="btn btn-icon btn-ghost" onClick={onShowPaste} title={t("import.paste")}>
            <ClipboardPaste size={14} />
          </button>
          <button className="btn btn-icon btn-ghost" onClick={handleImportFile} title={t("import.importFile")}>
            <Upload size={14} />
          </button>
          <button className="btn btn-icon btn-ghost" onClick={handleCreate} title={t("thread.create")}>
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {threadList.map((thread) => {
          const name =
            (getLocalizedField(thread.i18n, "name", locale) as string) ??
            t("thread.unnamed");
          const isSelected = selectedThreadId === thread.id;
          const isEditing = editingId === thread.id;

          if (isEditing) {
            return (
              <div key={thread.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--color-border-light)" }}>
                <div className="flex flex-col" style={{ gap: "8px" }}>
                  <select
                    value={editLocale}
                    onChange={(e) => {
                      const nl = e.target.value;
                      setEditLocale(nl);
                      setEditFields(thread.i18n[nl] ?? {});
                    }}
                    className="input"
                  >
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>
                  <input type="text" value={editFields.name ?? ""} onChange={(e) => setEditFields({ ...editFields, name: e.target.value })} placeholder={t("common.name")} className="input" />
                  <input type="text" value={editFields.author ?? ""} onChange={(e) => setEditFields({ ...editFields, author: e.target.value })} placeholder={t("common.author")} className="input" />
                  <input type="text" value={editFields.link ?? ""} onChange={(e) => setEditFields({ ...editFields, link: e.target.value })} placeholder={t("common.link")} className="input" />
                  <TagInput tags={editTags} onChange={setEditTags} suggestions={allTags} placeholder={t("common.tags")} />
                  <div className="flex" style={{ gap: "6px" }}>
                    <button className="btn btn-primary" onClick={saveEdit}>{t("common.save")}</button>
                    <button className="btn btn-secondary" onClick={() => setEditingId(null)}>{t("common.cancel")}</button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={thread.id}
              className={`list-item group ${isSelected ? "selected" : ""} ${dragOverId === thread.id ? "drop-target" : ""}`}
              onClick={() => setSelectedThreadId(thread.id)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-libraa-thread-id", thread.id);
                e.dataTransfer.setData("application/x-libraa-thread-reorder", thread.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-libraa-thread-reorder")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverId !== thread.id) setDragOverId(thread.id);
                }
              }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => {
                const draggedId = e.dataTransfer.getData("application/x-libraa-thread-reorder");
                if (draggedId) {
                  e.preventDefault();
                  setDragOverId(null);
                  handleReorder(draggedId, thread.id);
                }
              }}
            >
              <span className="list-item-name" style={{ flex: 1, minWidth: 0 }}>
                {name}
                {thread.responseCount != null && thread.responseCount > 0 && (
                  <span style={{ fontSize: "10px", color: isSelected ? "rgba(255,255,255,0.5)" : "var(--color-text-tertiary)", marginLeft: "6px" }}>
                    ({thread.responseCount})
                  </span>
                )}
              </span>
              <div className="flex shrink-0" style={{ gap: "2px" }}>
                <span className="action-icon" onClick={(e) => startEdit(thread.id, e)} title={t("common.edit")}><Pencil size={12} /></span>
                <span className="action-icon" onClick={(e) => handleExport(thread.id, e)} title={t("export.exportThread")}><Download size={12} /></span>
                <span className="action-icon" onClick={(e) => handleExportHtml(thread.id, e)} title={t("export.exportHtml")}><FileText size={12} /></span>
                <span className="action-icon danger" onClick={(e) => handleDelete(thread.id, e)} title={t("thread.delete")}><Trash2 size={12} /></span>
              </div>
            </div>
          );
        })}

        {threadList.length === 0 && (
          <div className="empty-state">{t("thread.noThreads")}</div>
        )}
      </div>
    </div>
  );
}
