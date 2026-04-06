import { useEffect, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/app-store";
import { useSettingsStore } from "../../stores/settings-store";
import { getAllSeries, getThreads } from "../../lib/db";
import { SeriesPanel } from "../series/SeriesPanel";
import { ThreadPanel } from "../thread/ThreadPanel";
import { ResponsePanel } from "../response/ResponsePanel";
import { PasteDialog } from "../import/PasteDialog";
import { SettingsDialog } from "../settings/SettingsDialog";
import { ManualDialog } from "../settings/ManualDialog";
import { ResizeHandle } from "./ResizeHandle";
import { Settings, BookOpen } from "lucide-react";

const MIN_PANEL_WIDTH = 140;
const DEFAULT_SERIES_WIDTH = 220;
const DEFAULT_THREAD_WIDTH = 280;

export function AppShell() {
  const { t } = useTranslation();
  const {
    selectedSeriesId,
    showPasteDialog,
    showSettings,
    setSeriesList,
    setThreadList,
    setShowPasteDialog,
    setShowSettings,
  } = useAppStore();

  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const [seriesWidth, setSeriesWidth] = useState(DEFAULT_SERIES_WIDTH);
  const [threadWidth, setThreadWidth] = useState(DEFAULT_THREAD_WIDTH);
  const [showManual, setShowManual] = useState(false);

  const refreshSeries = useCallback(async () => {
    const series = await getAllSeries();
    setSeriesList(series);
  }, [setSeriesList]);

  const refreshThreads = useCallback(async () => {
    const threads = await getThreads(selectedSeriesId);
    setThreadList(threads);
  }, [selectedSeriesId, setThreadList]);

  useEffect(() => {
    refreshSeries();
    loadSettings();
  }, [refreshSeries, loadSettings]);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  const handleSeriesResize = useCallback((delta: number) => {
    setSeriesWidth((w) => Math.max(MIN_PANEL_WIDTH, w + delta));
  }, []);

  const handleThreadResize = useCallback((delta: number) => {
    setThreadWidth((w) => Math.max(MIN_PANEL_WIDTH, w + delta));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header
        className="flex items-center justify-between shrink-0"
        style={{
          height: "var(--header-height)",
          padding: "0 16px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-secondary)",
        }}
      >
        <h1 style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.01em" }}>
          {t("app.title")}
        </h1>
        <div className="flex" style={{ gap: "6px" }}>
          <button className="btn btn-icon btn-ghost" onClick={() => setShowManual(true)} title={t("manual.title")}>
            <BookOpen size={15} />
          </button>
          <button className="btn btn-icon btn-secondary" onClick={() => setShowSettings(true)} title={t("settings.title")}>
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Miller Columns */}
      <div className="flex flex-1 min-h-0">
        <SeriesPanel onRefresh={refreshSeries} onThreadMoved={refreshThreads} onThreadRefresh={refreshThreads} width={seriesWidth} />
        <ResizeHandle onResize={handleSeriesResize} />
        <ThreadPanel onRefresh={refreshThreads} onSeriesRefresh={refreshSeries} onShowPaste={() => setShowPasteDialog(true)} width={threadWidth} />
        <ResizeHandle onResize={handleThreadResize} />
        <ResponsePanel />
      </div>

      {/* Dialogs */}
      {showPasteDialog && (
        <PasteDialog
          onClose={() => setShowPasteDialog(false)}
          onSaved={() => {
            setShowPasteDialog(false);
            refreshSeries();
            refreshThreads();
          }}
        />
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showManual && <ManualDialog onClose={() => setShowManual(false)} />}
    </div>
  );
}
