import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/app-store";
import { useSettingsStore } from "../../stores/settings-store";
import { getResponses, updateResponseI18n, deleteResponseI18n, deleteResponse, getThreads, updateThreadI18n, createResponse } from "../../lib/db";
import { getLocalizedField, resolveLocale } from "../../lib/locale";
import { translateAAResponse, translateText } from "../../lib/llm";

import type { Response, ResponseI18n } from "../../types";
import { Pencil, Plus, Trash2, Languages, Eraser } from "lucide-react";
import { AABody } from "./AABody";

interface SelectionInfo {
  responseId: string;
  text: string;
  x: number;
  y: number;
}

type QueueItemStatus = "pending" | "translating" | "done" | "error" | "retrying" | "skipped" | "cancelled";

type QueueItemType = "batch" | "single" | "selection";

interface BlockLog {
  input: string;
  meaningful: boolean;
  output: string;
  status: "done" | "error";
}

interface QueueItem {
  responseId: string;
  sequence: number | null;
  status: QueueItemStatus;
  type: QueueItemType;
  error?: string;
  blockLogs?: BlockLog[];
}

function useShiftKey() {
  const [shift, setShift] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Shift") setShift(true); };
    const up = (e: KeyboardEvent) => { if (e.key === "Shift") setShift(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  return shift;
}

export function ResponsePanel() {
  const { t, i18n } = useTranslation();
  const selectedThreadId = useAppStore((s) => s.selectedThreadId);
  const locale = i18n.language;
  const [responses, setResponses] = useState<Response[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLocale, setEditLocale] = useState(locale);
  const [editFields, setEditFields] = useState<ResponseI18n>({});
  const [queueHeight, setQueueHeight] = useState(200);
  const [whiteBg, setWhiteBg] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0 });
  const translateStartRef = useRef<number>(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addBody, setAddBody] = useState("");
  const [addAuthorName, setAddAuthorName] = useState("");
  const [addAuthorId, setAddAuthorId] = useState("");
  const [addPostedAt, setAddPostedAt] = useState("");
  const [addSequence, setAddSequence] = useState("");
  const llmProvider = useSettingsStore((s) => s.llmProvider);
  const llmApiKey = useSettingsStore((s) => s.llmApiKey);
  const llmModel = useSettingsStore((s) => s.llmModel);
  const concurrency = useSettingsStore((s) => s.concurrency);
  const batchBlocks = useSettingsStore((s) => s.batchBlocks);
  const shiftHeld = useShiftKey();
  const cancelRef = useRef(false);

  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const hoveredRef = useRef<HTMLElement | null>(null);
  const [selectionTranslating, setSelectionTranslating] = useState(false);
  const [translatingBlock, setTranslatingBlock] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const llmConfig = { provider: llmProvider, apiKey: llmApiKey, model: llmModel };
  const targetLang = locale === "ja" ? "ko" : locale;
  const canTranslate = !!llmApiKey || llmProvider === "ollama";

  const refreshResponses = useCallback(async () => {
    if (!selectedThreadId) {
      setResponses([]);
      return;
    }
    const data = await getResponses(selectedThreadId);
    setResponses(data);
  }, [selectedThreadId]);

  useEffect(() => {
    refreshResponses();
  }, [refreshResponses]);

  const startEdit = (resp: Response) => {
    const resolved = resolveLocale(resp.i18n, locale);
    setEditingId(resp.id);
    setEditLocale(resolved);
    setEditFields(resp.i18n[resolved] ?? {});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateResponseI18n(editingId, editLocale, editFields);
    setEditingId(null);
    await refreshResponses();
  };

  const translateSingleResponse = async (resp: Response, force: boolean) => {
    if (!canTranslate) return;
    const jaBody = resp.i18n["ja"]?.body;
    if (!jaBody || jaBody.trim().length === 0) return;
    if (!force && resp.i18n[targetLang]?.body) return;

    setTranslatingId(resp.id);
    setQueue((q) => [...q, { responseId: resp.id, sequence: resp.sequence, status: "translating" as QueueItemStatus, type: "single" as QueueItemType, blockLogs: [] }]);
    try {
      const translated = await translateAAResponse(llmConfig, jaBody, targetLang, (br) => {
        setQueue((q) => q.map((item) => item.responseId === resp.id
          ? { ...item, blockLogs: [...(item.blockLogs ?? []), br] }
          : item));
      }, batchBlocks);
      await updateResponseI18n(resp.id, targetLang, {
        ...resp.i18n[targetLang],
        body: translated,
      });
      updateQueueItem(resp.id, "done");
    } catch (e) {
      console.error(`Translation failed for response ${resp.id}:`, e);
      updateQueueItem(resp.id, "error", String(e));
    }
    setTranslatingId(null);
    await refreshResponses();
  };

  const removeTranslation = async (resp: Response) => {
    if (!resp.i18n[targetLang]) return;
    await deleteResponseI18n(resp.id, targetLang);
    await refreshResponses();
  };

  const resetAddForm = () => {
    setAddBody("");
    setAddAuthorName("");
    setAddAuthorId("");
    setAddPostedAt("");
    setAddSequence("");
  };

  const [addSeqError, setAddSeqError] = useState(false);

  const handleAddResponse = async () => {
    if (!selectedThreadId || !addBody.trim()) return;
    const seq = addSequence ? parseInt(addSequence, 10) : responses.reduce((max, r) => Math.max(max, r.sequence ?? 0), 0) + 1;
    if (addSequence && responses.some((r) => r.sequence === seq)) {
      setAddSeqError(true);
      return;
    }
    setAddSeqError(false);
    const newId = await createResponse(selectedThreadId, seq, addPostedAt || null, {
      [locale]: {
        body: addBody,
        authorName: addAuthorName || undefined,
        authorId: addAuthorId || undefined,
      },
    });
    resetAddForm();
    await refreshResponses();
    // Scroll to newly created response after React re-render
    setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-response-id="${newId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }, 100);
  };

  const handleDeleteResponse = async (resp: Response) => {
    if (confirm(t("response.deleteConfirm"))) {
      await deleteResponse(resp.id);
      await refreshResponses();
    }
  };

  const updateQueueItem = (id: string, status: QueueItemStatus, error?: string) => {
    setQueue((q) => q.map((item) => item.responseId === id ? { ...item, status, error } : item));
  };

  const removeAllTranslations = async () => {
    if (!confirm(t("translate.removeAllConfirm"))) return;
    for (const resp of responses) {
      if (resp.i18n[targetLang]) {
        await deleteResponseI18n(resp.id, targetLang);
      }
    }
    await refreshResponses();
  };

  const cancelTranslation = () => {
    cancelRef.current = true;
    setTranslating(false);
    setQueue((q) => q.map((item) =>
      item.status === "pending" || item.status === "translating"
        ? { ...item, status: "cancelled" as QueueItemStatus }
        : item
    ));
  };

  const handleTranslateAll = async (force: boolean) => {
    if (!selectedThreadId || !canTranslate) return;
    cancelRef.current = false;
    translateStartRef.current = Date.now();
    setTranslating(true);

    // Translate thread title/author
    if (!cancelRef.current) {
      try {
        const threads = await getThreads(null);
        const thread = threads.find((t) => t.id === selectedThreadId);
        if (thread) {
          const sourceI18n = thread.i18n["ja"] ?? Object.values(thread.i18n)[0];
          if (sourceI18n && (force || !thread.i18n[targetLang]?.name)) {
            const fields: Record<string, string | undefined> = {};
            if (sourceI18n.name && !cancelRef.current) {
              fields.name = await translateText(llmConfig, sourceI18n.name, targetLang);
            }
            if (sourceI18n.author && !cancelRef.current) {
              fields.author = await translateText(llmConfig, sourceI18n.author, targetLang);
            }
            if (!cancelRef.current) {
              await updateThreadI18n(selectedThreadId, targetLang, {
                ...thread.i18n[targetLang],
                ...fields,
                link: sourceI18n.link,
                firstPostedAt: sourceI18n.firstPostedAt,
                lastPostedAt: sourceI18n.lastPostedAt,
              });
            }
          }
        }
      } catch (e) {
        console.error("Thread translation failed:", e);
      }
    }

    // Build queue
    const toTranslate = responses.filter((r) => {
      const jaBody = r.i18n["ja"]?.body;
      if (!jaBody || jaBody.trim().length === 0) return false;
      if (!force && r.i18n[targetLang]?.body) return false;
      return true;
    });
    const skipped = responses.filter((r) => {
      const jaBody = r.i18n["ja"]?.body;
      if (!jaBody || jaBody.trim().length === 0) return false;
      if (!force && r.i18n[targetLang]?.body) return true;
      return false;
    });
    setQueue((q) => [
      ...q,
      ...skipped.map((r) => ({ responseId: r.id, sequence: r.sequence, status: "skipped" as QueueItemStatus, type: "batch" as QueueItemType })),
      ...toTranslate.map((r) => ({ responseId: r.id, sequence: r.sequence, status: "pending" as QueueItemStatus, type: "batch" as QueueItemType })),
    ]);

    const total = toTranslate.length;
    setTranslateProgress({ current: 0, total });

    let completed = 0;
    for (let i = 0; i < toTranslate.length; i += concurrency) {
      if (cancelRef.current) break;
      const batch = toTranslate.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (resp) => {
          if (cancelRef.current) return;
          setQueue((q) => q.map((item) => item.responseId === resp.id
            ? { ...item, status: "translating" as QueueItemStatus, blockLogs: [] }
            : item));
          const jaBody = resp.i18n["ja"]!.body!;
          try {
            const translated = await translateAAResponse(llmConfig, jaBody, targetLang, (br) => {
              setQueue((q) => q.map((item) => item.responseId === resp.id
                ? { ...item, blockLogs: [...(item.blockLogs ?? []), br] }
                : item));
            }, batchBlocks);
            if (cancelRef.current) return;
            await updateResponseI18n(resp.id, targetLang, {
              ...resp.i18n[targetLang],
              body: translated,
            });
            updateQueueItem(resp.id, "done");
          } catch (e) {
            const errMsg = String(e);
            if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate")) {
              updateQueueItem(resp.id, "retrying", errMsg);
            } else {
              updateQueueItem(resp.id, "error", errMsg);
            }
            console.error(`Translation failed for response ${resp.id}:`, e);
          }
          completed++;
          setTranslateProgress({ current: completed, total });
          await refreshResponses();
        }),
      );
    }

    setTranslating(false);
    await refreshResponses();
  };

  // Selection-based translation
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onPointerUp = () => {
      // Small delay to let browser finalize selection
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSelection(null);
          return;
        }

        const anchorNode = sel.anchorNode;
        if (!anchorNode) { setSelection(null); return; }

        // Walk up from text node to find pre[data-response-id]
        let el: HTMLElement | null = anchorNode.nodeType === Node.TEXT_NODE
          ? anchorNode.parentElement
          : anchorNode as HTMLElement;
        while (el && !(el.tagName === "PRE" && el.hasAttribute("data-response-id"))) {
          el = el.parentElement;
        }
        if (!el) { setSelection(null); return; }

        const responseId = el.getAttribute("data-response-id");
        if (!responseId) { setSelection(null); return; }

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const scrollRect = container.getBoundingClientRect();

        setSelection({
          responseId,
          text: sel.toString(),
          x: rect.left + rect.width / 2 - scrollRect.left,
          y: rect.top - scrollRect.top + container.scrollTop - 36,
        });
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      // Dismiss if clicking outside the floating button
      const target = e.target as HTMLElement;
      if (!target.closest("[data-selection-btn]")) {
        // Only update state if selection exists, to avoid unnecessary re-renders
        setSelection((prev) => prev ? null : prev);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-resp]") as HTMLElement | null;
      if (target === hoveredRef.current) return;
      if (hoveredRef.current) hoveredRef.current.classList.remove("resp-hovered");
      hoveredRef.current = target;
      if (target) target.classList.add("resp-hovered");
    };

    const onMouseLeave = () => {
      if (hoveredRef.current) {
        hoveredRef.current.classList.remove("resp-hovered");
        hoveredRef.current = null;
      }
    };

    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);
    return () => {
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  const translateSelection = async () => {
    if (!selection || !canTranslate) return;
    setSelectionTranslating(true);

    const resp = responses.find((r) => r.id === selection.responseId);
    if (!resp) { setSelectionTranslating(false); return; }

    // Add to queue
    const queueId = `sel-${selection.responseId}`;
    setQueue((q) => [...q, { responseId: queueId, sequence: resp.sequence, status: "translating" as QueueItemStatus, type: "selection" as QueueItemType }]);

    try {
      const translated = await translateText(llmConfig, selection.text, targetLang);

      const sourceBody = resp.i18n["ja"]?.body ?? "";
      const existingBody = resp.i18n[targetLang]?.body ?? sourceBody;
      const newBody = existingBody.replace(selection.text, translated);

      await updateResponseI18n(selection.responseId, targetLang, {
        ...resp.i18n[targetLang],
        body: newBody,
      });

      setQueue((q) => q.map((item) => item.responseId === queueId ? { ...item, status: "done" as QueueItemStatus } : item));
      await refreshResponses();
    } catch (e) {
      console.error("Selection translation failed:", e);
      setQueue((q) => q.map((item) => item.responseId === queueId ? { ...item, status: "error" as QueueItemStatus, error: String(e) } : item));
    }

    setSelectionTranslating(false);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const translateBlock = useCallback(async (respId: string, text: string) => {
    if (!canTranslate) return;
    setTranslatingBlock(text);

    const resp = responses.find((r) => r.id === respId);
    if (!resp) { setTranslatingBlock(null); return; }

    const queueId = `blk-${respId}-${Date.now()}`;
    setQueue((q) => [...q, { responseId: queueId, sequence: resp.sequence, status: "translating" as QueueItemStatus, type: "selection" as QueueItemType }]);

    try {
      const translated = await translateText(llmConfig, text, targetLang);
      const sourceBody = resp.i18n["ja"]?.body ?? "";
      const existingBody = resp.i18n[targetLang]?.body ?? sourceBody;
      const newBody = existingBody.replace(text, translated);

      await updateResponseI18n(respId, targetLang, {
        ...resp.i18n[targetLang],
        body: newBody,
      });
      setQueue((q) => q.map((item) => item.responseId === queueId ? { ...item, status: "done" as QueueItemStatus } : item));
      await refreshResponses();
    } catch (e) {
      console.error("Block translation failed:", e);
      setQueue((q) => q.map((item) => item.responseId === queueId ? { ...item, status: "error" as QueueItemStatus, error: String(e) } : item));
    }

    setTranslatingBlock(null);
  }, [canTranslate, responses, targetLang, llmConfig, refreshResponses]);

  if (!selectedThreadId) {
    return (
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div className="empty-state">{t("response.selectThread")}</div>
      </div>
    );
  }

  const isBusy = translating || translatingId !== null;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
      {/* Toolbar */}
      <div className="panel-header" style={{ gap: "8px" }}>
        <span className="panel-header-title" style={{ marginRight: "auto" }}>
          {t("response.title")}
        </span>
        <div
          onClick={() => setWhiteBg(!whiteBg)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            cursor: "pointer",
            fontSize: "10px",
            color: "var(--color-text-tertiary)",
            userSelect: "none",
          }}
          title={t("response.whiteBg")}
        >
          <div style={{
            width: "28px", height: "16px", borderRadius: "8px", padding: "2px",
            background: whiteBg ? "var(--color-primary)" : "var(--color-border)",
            transition: "background 0.15s",
          }}>
            <div style={{
              width: "12px", height: "12px", borderRadius: "6px", background: "#fff",
              transform: whiteBg ? "translateX(12px)" : "translateX(0)",
              transition: "transform 0.15s",
            }} />
          </div>
          <span>BG</span>
        </div>
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => { setShowAddForm(!showAddForm); if (showAddForm) resetAddForm(); }}
          title={t("response.add")}
        >
          <Plus size={15} />
        </button>
        {canTranslate && (
          translating ? (
            <button
              className="btn btn-secondary"
              onClick={cancelTranslation}
              style={{ gap: "6px" }}
            >
              {t("translate.cancel")} ({translateProgress.current}/{translateProgress.total})
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => handleTranslateAll(shiftHeld)}
              disabled={isBusy || responses.length === 0}
            >
              {shiftHeld
                ? t("translate.forceTranslate")
                : t("translate.translate")}
            </button>
          )
        )}
        {responses.some((r) => !!r.i18n[targetLang]?.body) && (
          <button
            className="btn btn-ghost"
            onClick={removeAllTranslations}
            style={{ fontSize: "11px", color: "var(--color-danger)" }}
          >
            {t("translate.removeAll")}
          </button>
        )}
      </div>

      {/* Responses */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef} style={{ position: "relative", background: whiteBg ? "#ffffff" : undefined, color: whiteBg ? "#111827" : undefined }}>
        {responses.length === 0 && !showAddForm ? (
          <div className="empty-state">{t("response.noResponses")}</div>
        ) : (
          <>
          {responses.map((resp) => {
            const authorName =
              (getLocalizedField(resp.i18n, "authorName", locale) as string) ??
              t("response.anonymous");
            const authorId = getLocalizedField(resp.i18n, "authorId", locale) as string | null;
            const body = (getLocalizedField(resp.i18n, "body", locale) as string) ?? "";
            const isEditing = editingId === resp.id;
            const isTranslatingThis = translatingId === resp.id || queue.some((q) => q.responseId === resp.id && q.status === "translating");
            const hasJaBody = resp.i18n["ja"]?.body && resp.i18n["ja"].body.trim().length > 0;
            const hasTranslation = !!resp.i18n[targetLang]?.body;
            return (
              <div key={resp.id}>
              <div
                data-resp
                style={{
                  padding: "20px 20px",
                  borderBottom: "1px solid var(--color-border-light)",
                }}
              >
                {/* Response header */}
                <div
                  className="flex items-center"
                  style={{
                    gap: "8px",
                    marginBottom: "14px",
                    fontSize: "14px",
                    minHeight: "22px",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {resp.sequence != null && (
                    <span>{resp.sequence}</span>
                  )}
                  <span style={{ fontWeight: authorName.includes("◆") ? 700 : 500, color: "#16a34a" }}>{authorName}</span>
                  {authorId && (
                    <span style={{ color: "var(--color-text-tertiary)" }}>ID:{authorId}</span>
                  )}
                  {resp.postedAt && (
                    <span style={{ color: "var(--color-text-tertiary)" }}>{resp.postedAt}</span>
                  )}
                  <div style={{ flex: 1 }} />
                  {!isEditing && (
                    <>
                      {hasJaBody && canTranslate && (
                        <span
                          className="action-icon"
                          style={isTranslatingThis ? { display: "inline-flex", animation: "pulse 1.5s infinite" } : {}}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={isTranslatingThis ? undefined : () => translateSingleResponse(resp, shiftHeld)}
                          title={shiftHeld ? t("translate.forceTranslate") : t("translate.translate")}
                        >
                          <Languages size={12} />
                        </span>
                      )}
                      {hasTranslation && !isTranslatingThis && (
                        <span
                          className="action-icon danger"
                          onClick={() => removeTranslation(resp)}
                          title={t("translate.remove")}
                        >
                          <Eraser size={12} />
                        </span>
                      )}
                      <span
                        className="action-icon"
                        onClick={() => startEdit(resp)}
                        title={t("common.edit")}
                      >
                        <Pencil size={12} />
                      </span>
                      <span
                        className="action-icon danger"
                        onClick={() => handleDeleteResponse(resp)}
                        title={t("common.delete")}
                      >
                        <Trash2 size={12} />
                      </span>
                    </>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex flex-col" style={{ gap: "10px" }}>
                    <div className="flex items-center" style={{ gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                        Locale:
                      </span>
                      <select
                        value={editLocale}
                        onChange={(e) => {
                          const newLocale = e.target.value;
                          setEditLocale(newLocale);
                          const existing = responses.find((r) => r.id === editingId);
                          if (existing) {
                            setEditFields(existing.i18n[newLocale] ?? {});
                          }
                        }}
                        className="input"
                        style={{ width: "auto" }}
                      >
                        <option value="ja">日本語</option>
                        <option value="ko">한국어</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <textarea
                      ref={(el) => {
                        if (el) {
                          el.style.height = "auto";
                          el.style.height = el.scrollHeight + 2 + "px";
                        }
                      }}
                      value={editFields.body ?? ""}
                      onChange={(e) => {
                        setEditFields({ ...editFields, body: e.target.value });
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + 2 + "px";
                      }}
                      className="input"
                      style={{
                        minHeight: "80px",
                        fontFamily: "var(--font-aa)",
                        fontSize: "13px",
                        lineHeight: "1.2",
                        resize: "vertical",
                      }}
                    />
                    <div className="flex" style={{ gap: "8px" }}>
                      <button className="btn btn-primary" onClick={saveEdit}>
                        {t("common.save")}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setEditingId(null)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <pre
                    data-response-id={resp.id}
                    style={{
                      fontFamily: "var(--font-aa)",
                      fontSize: "14px",
                      lineHeight: "1.2",
                      whiteSpace: "pre",
                      overflowX: "auto",
                    }}
                  >
                    <AABody
                      body={body}
                      responseId={resp.id}
                      shiftHeld={shiftHeld}
                      translatingBlock={translatingBlock}
                      onTranslateBlock={translateBlock}
                    />
                  </pre>
                )}
              </div>
              </div>
            );
          })}

          </>
        )}

        {/* Floating selection translate button */}
        {selection && canTranslate && (
          <button
            data-selection-btn
            className="btn btn-primary"
            onClick={translateSelection}
            disabled={selectionTranslating}
            style={{
              position: "absolute",
              left: `${selection.x}px`,
              top: `${selection.y}px`,
              transform: "translateX(-50%)",
              zIndex: 10,
              fontSize: "11px",
              padding: "4px 10px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            {selectionTranslating ? t("translate.translating") : t("translate.translateSelection")}
          </button>
        )}
      </div>

      {/* Status bar + Translation log panel */}
      <div style={{ flexShrink: 0, background: "var(--color-bg-secondary)" }}>
        {/* Vertical resize handle */}
        {showQueue && queue.length > 0 && (
          <div
            style={{
              height: "5px",
              cursor: "row-resize",
              borderTop: "1px solid var(--color-border)",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startH = queueHeight;
              const onMove = (ev: PointerEvent) => {
                setQueueHeight(Math.max(80, Math.min(600, startH - (ev.clientY - startY))));
              };
              const onUp = () => {
                document.removeEventListener("pointermove", onMove);
                document.removeEventListener("pointerup", onUp);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
              };
              document.addEventListener("pointermove", onMove);
              document.addEventListener("pointerup", onUp);
              document.body.style.cursor = "row-resize";
              document.body.style.userSelect = "none";
            }}
          />
        )}
        {/* Status bar (always visible) */}
        <div
          onClick={() => queue.length > 0 && setShowQueue(!showQueue)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 20px",
            cursor: queue.length > 0 ? "pointer" : "default",
            fontSize: "11px",
            color: "var(--color-text-tertiary)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {queue.length > 0 && (
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
              background: translating ? "var(--color-primary)" : queue.some((q) => q.status === "error") ? "var(--color-danger)" : "#22c55e",
              animation: translating ? "pulse 1.5s infinite" : "none",
            }} />
          )}
          <span style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
            {queue.length === 0
              ? t("translate.logEmpty")
              : translating
                ? (() => {
                    const { current, total } = translateProgress;
                    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
                    const elapsed = (Date.now() - translateStartRef.current) / 1000;
                    const eta = current > 0 && total > current
                      ? Math.round((elapsed / current) * (total - current))
                      : 0;
                    const etaStr = eta > 60
                      ? `${Math.floor(eta / 60)}m ${eta % 60}s`
                      : eta > 0 ? `${eta}s` : "";
                    return (
                      <>
                        <span>{t("translate.progress", translateProgress)}</span>
                        <span style={{
                          flex: 1, maxWidth: "120px", height: "4px", borderRadius: "2px",
                          background: "var(--color-border)",
                        }}>
                          <span style={{
                            display: "block", height: "100%", borderRadius: "2px",
                            background: "var(--color-primary)",
                            width: `${pct}%`,
                            transition: "width 0.3s",
                          }} />
                        </span>
                        <span>{pct}%</span>
                        {etaStr && <span style={{ color: "var(--color-text-tertiary)" }}>ETA {etaStr}</span>}
                      </>
                    );
                  })()
                : t("translate.queueDone", { done: queue.filter((q) => q.status === "done").length, total: queue.filter((q) => q.status !== "skipped").length })}
          </span>
          {queue.length > 0 && (
            <span style={{ fontSize: "10px" }}>{showQueue ? "▼" : "▲"}</span>
          )}
          {queue.length > 0 && !translating && (
            <button
              className="btn btn-ghost"
              onClick={(e) => { e.stopPropagation(); setQueue([]); setShowQueue(false); }}
              style={{ fontSize: "10px", padding: "1px 6px" }}
            >
              {t("translate.clearLog")}
            </button>
          )}
        </div>

        {/* Detail list */}
        {showQueue && queue.length > 0 && (
          <div style={{ height: `${queueHeight}px`, overflowY: "auto", borderTop: "1px solid var(--color-border-light)" }}>
              {queue.filter((q) => q.status !== "skipped").sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)).map((item, idx) => (
                <div key={`${item.responseId}-${idx}`}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "4px 20px",
                      fontSize: "11px",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <span style={{
                      width: "5px", height: "5px", borderRadius: "50%", flexShrink: 0,
                      background:
                        item.status === "done" ? "#22c55e" :
                        item.status === "translating" ? "var(--color-primary)" :
                        item.status === "error" ? "var(--color-danger)" :
                        item.status === "retrying" ? "#f59e0b" :
                        item.status === "cancelled" ? "#f59e0b" :
                        "var(--color-text-tertiary)",
                    }} />
                    <span>#{item.sequence ?? "?"}</span>
                    <span style={{
                      fontSize: "9px",
                      padding: "0 4px",
                      borderRadius: "3px",
                      background: "var(--color-bg-tertiary)",
                      color: "var(--color-text-tertiary)",
                    }}>
                      {item.type === "batch" && t("translate.typeBatch")}
                      {item.type === "single" && t("translate.typeSingle")}
                      {item.type === "selection" && t("translate.typeSelection")}
                    </span>
                    <span style={{ flex: 1, fontSize: "10px", color: "var(--color-text-tertiary)" }}>
                      {item.status === "pending" && t("translate.queuePending")}
                      {item.status === "translating" && t("translate.translating")}
                      {item.status === "done" && t("translate.done")}
                      {item.status === "error" && t("translate.error")}
                      {item.status === "retrying" && t("translate.queueRetrying")}
                      {item.status === "cancelled" && t("translate.cancelled")}
                    </span>
                    {item.blockLogs && item.blockLogs.length > 0 && (
                      <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>
                        {item.blockLogs.filter((b) => b.meaningful).length}/{item.blockLogs.length} blocks
                      </span>
                    )}
                  </div>
                  {/* Block-level logs */}
                  {item.blockLogs && item.blockLogs.length > 0 && (
                    <div style={{ padding: "2px 20px 6px 40px" }}>
                      {item.blockLogs.map((bl, bi) => (
                        <div key={bi} style={{
                          display: "flex",
                          gap: "6px",
                          fontSize: "10px",
                          lineHeight: "1.6",
                          color: bl.status === "error" ? "var(--color-danger)" : "var(--color-text-tertiary)",
                        }}>
                          <span style={{
                            width: "4px", height: "4px", borderRadius: "50%", flexShrink: 0, marginTop: "5px",
                            background: bl.status === "error" ? "var(--color-danger)" : bl.meaningful ? "#22c55e" : "var(--color-text-tertiary)",
                          }} />
                          <span style={{ color: "var(--color-text-secondary)", maxWidth: "40%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {bl.input}
                          </span>
                          <span style={{ color: "var(--color-text-tertiary)" }}>→</span>
                          <span style={{
                            maxWidth: "40%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            color: bl.meaningful ? "var(--color-text)" : "var(--color-text-tertiary)",
                            fontStyle: bl.meaningful ? "normal" : "italic",
                          }}>
                            {bl.meaningful ? bl.output : t("translate.notMeaningful")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Sticky add response form */}
      {showAddForm && (
        <div
          style={{
            flexShrink: 0,
            borderTop: "2px solid var(--color-primary)",
            background: "var(--color-bg-secondary)",
            padding: "12px 20px",
          }}
        >
          <div className="flex" style={{ gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
            <input
              type="text"
              value={addSequence}
              onChange={(e) => { setAddSequence(e.target.value); setAddSeqError(false); }}
              placeholder={t("response.sequence")}
              className="input"
              style={{ width: "70px", borderColor: addSeqError ? "var(--color-danger)" : undefined }}
              title={addSeqError ? t("response.seqExists") : ""}
            />
            <input
              type="text"
              value={addAuthorName}
              onChange={(e) => setAddAuthorName(e.target.value)}
              placeholder={t("common.name")}
              className="input"
              style={{ width: "120px" }}
            />
            <input
              type="text"
              value={addAuthorId}
              onChange={(e) => setAddAuthorId(e.target.value)}
              placeholder="ID"
              className="input"
              style={{ width: "100px" }}
            />
            <input
              type="text"
              value={addPostedAt}
              onChange={(e) => setAddPostedAt(e.target.value)}
              placeholder={t("common.date")}
              className="input"
              style={{ flex: 1, minWidth: "140px" }}
            />
          </div>
          {addSeqError && (
            <p style={{ fontSize: "11px", color: "var(--color-danger)", marginBottom: "6px" }}>
              {t("response.seqExists")}
            </p>
          )}
          <textarea
            value={addBody}
            onChange={(e) => { setAddBody(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight + 2, 200) + "px"; }}
            placeholder={t("response.newBody")}
            className="input"
            style={{ minHeight: "60px", maxHeight: "200px", fontFamily: "var(--font-aa)", fontSize: "13px", lineHeight: "1.2", resize: "vertical", marginBottom: "8px" }}
          />
          <div className="flex" style={{ gap: "8px" }}>
            <button className="btn btn-primary" onClick={handleAddResponse} disabled={!addBody.trim()}>
              {t("common.save")}
            </button>
            <button className="btn btn-secondary" onClick={() => { setShowAddForm(false); resetAddForm(); }}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
