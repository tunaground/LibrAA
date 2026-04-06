import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/app-store";
import { getLocalizedField, resolveLocale } from "../../lib/locale";
import { createSeries, deleteSeries, updateSeriesI18n, updateSeriesTags, updateThreadSeriesId, getAllTags } from "../../lib/db";
import { TagInput } from "../common/TagInput";
import { exportSeries, importLaa } from "../../lib/laa";
import type { SeriesI18n } from "../../types";
import { Upload, Plus, Pencil, Download, Trash2, FileText } from "lucide-react";
import { exportSeriesHtml } from "../../lib/html-export";

interface SeriesPanelProps {
  onRefresh: () => Promise<void>;
  onThreadMoved: () => Promise<void>;
  onThreadRefresh: () => Promise<void>;
  width: number;
}

export function SeriesPanel({ onRefresh, onThreadMoved, onThreadRefresh, width }: SeriesPanelProps) {
  const { t, i18n } = useTranslation();
  const { seriesList, selectedSeriesId, setSelectedSeriesId } = useAppStore();
  const locale = i18n.language;
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLocale, setEditLocale] = useState(locale);
  const [editFields, setEditFields] = useState<SeriesI18n>({});
  const [editTags, setEditTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    getAllTags().then(setAllTags);
  }, [seriesList]);

  const handleCreate = async () => {
    await createSeries({ [locale]: { name: t("series.unnamed") } });
    await onRefresh();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t("series.deleteConfirm"))) {
      await deleteSeries(id);
      if (selectedSeriesId === id) setSelectedSeriesId(null);
      await onRefresh();
    }
  };

  const startEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const series = seriesList.find((s) => s.id === id);
    if (!series) return;
    const resolved = resolveLocale(series.i18n, locale);
    setEditingId(id);
    setEditLocale(resolved);
    setEditFields(series.i18n[resolved] ?? {});
    setEditTags([...series.tags]);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateSeriesI18n(editingId, editLocale, editFields);
    await updateSeriesTags(
      editingId,
      editTags,
    );
    setEditingId(null);
    await onRefresh();
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetId !== targetId) {
      setDropTargetId(targetId);
    }
  };

  const handleDrop = async (seriesId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
    const threadId = e.dataTransfer.getData("application/x-libraa-thread-id");
    if (!threadId) return;
    await updateThreadSeriesId(threadId, seriesId);
    await onRefresh();
    await onThreadMoved();
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
        await onRefresh();
        await onThreadRefresh();
      }
    } catch (e) {
      console.error("Import failed:", e);
    }
  };

  const handleExport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const series = seriesList.find((s) => s.id === id);
      const rawName = (getLocalizedField(series?.i18n ?? {}, "name", locale) as string) ?? "series";
      const name = rawName.replace(/[/\\:*?"<>|]/g, "_");
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        defaultPath: `${name}.laa`,
        filters: [{ name: "LibrAA Archive", extensions: ["laa"] }],
      });
      if (path) {
        const data = await exportSeries(id);
        await writeTextFile(path, data);
      }
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  const handleExportHtml = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const series = seriesList.find((s) => s.id === id);
      const rawName = (getLocalizedField(series?.i18n ?? {}, "name", locale) as string) ?? "series";
      const dirName = rawName.replace(/[/\\:*?"<>|]/g, "_");
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");
      const basePath = await open({ directory: true });
      if (basePath) {
        const dirPath = `${basePath}/${dirName}`;
        if (!(await exists(dirPath))) {
          await mkdir(dirPath);
        }
        const files = await exportSeriesHtml(id, locale);
        for (const file of files) {
          await writeTextFile(`${dirPath}/${file.filename}`, file.content);
        }
      }
    } catch (e) {
      console.error("HTML export failed:", e);
    }
  };

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: `${width}px`,
        background: "var(--color-bg-secondary)",
      }}
    >
      <div className="panel-header">
        <span className="panel-header-title">{t("series.title")}</span>
        <div className="flex" style={{ gap: "2px" }}>
          <button className="btn btn-icon btn-ghost" onClick={handleImportFile} title={t("import.importFile")}>
            <Upload size={14} />
          </button>
          <button className="btn btn-icon btn-ghost" onClick={handleCreate} title={t("series.create")}>
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* "All" option — drop here to unassign series */}
        <div
          className={`list-item ${selectedSeriesId === null ? "selected" : ""} ${dropTargetId === "__all__" ? "drop-target" : ""}`}
          onClick={() => setSelectedSeriesId(null)}
          onDragOver={(e) => handleDragOver(e, "__all__")}
          onDragLeave={() => setDropTargetId(null)}
          onDrop={(e) => handleDrop(null, e)}
        >
          <span className="list-item-name">{t("series.all")}</span>
        </div>

        {seriesList.map((series) => {
          const name =
            (getLocalizedField(series.i18n, "name", locale) as string) ??
            t("series.unnamed");
          const isSelected = selectedSeriesId === series.id;
          const isEditing = editingId === series.id;

          if (isEditing) {
            return (
              <div key={series.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--color-border-light)" }}>
                <div className="flex flex-col" style={{ gap: "8px" }}>
                  <select
                    value={editLocale}
                    onChange={(e) => {
                      const nl = e.target.value;
                      setEditLocale(nl);
                      setEditFields(series.i18n[nl] ?? {});
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
              key={series.id}
              className={`list-item group ${isSelected ? "selected" : ""} ${dropTargetId === series.id ? "drop-target" : ""}`}
              onClick={() => setSelectedSeriesId(series.id)}
              onDragOver={(e) => handleDragOver(e, series.id)}
              onDragLeave={() => setDropTargetId(null)}
              onDrop={(e) => handleDrop(series.id, e)}
            >
              <span className="list-item-name" style={{ flex: 1, minWidth: 0 }}>{name}</span>
              {series.tags.length > 0 && (
                <div className="flex shrink-0" style={{ gap: "3px", marginRight: "6px" }}>
                  {series.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                  {series.tags.length > 2 && (
                    <span className="tag">+{series.tags.length - 2}</span>
                  )}
                </div>
              )}
              <div className="flex shrink-0" style={{ gap: "2px" }}>
                <span className="action-icon" onClick={(e) => startEdit(series.id, e)} title={t("common.edit")}><Pencil size={12} /></span>
                <span className="action-icon" onClick={(e) => handleExport(series.id, e)} title={t("export.exportSeries")}><Download size={12} /></span>
                <span className="action-icon" onClick={(e) => handleExportHtml(series.id, e)} title={t("export.exportHtml")}><FileText size={12} /></span>
                <span className="action-icon danger" onClick={(e) => handleDelete(series.id, e)} title={t("series.delete")}><Trash2 size={12} /></span>
              </div>
            </div>
          );
        })}

        {seriesList.length === 0 && (
          <div className="empty-state">{t("series.noSeries")}</div>
        )}
      </div>
    </div>
  );
}
