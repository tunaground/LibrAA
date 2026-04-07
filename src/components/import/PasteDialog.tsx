import { useState, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { parseThreadText, testPattern, countCaptureGroups, DEFAULT_HEADER_PATTERN, LABELED_HEADER_PATTERN, DEFAULT_GROUP_MAP } from "../../lib/parser";
import type { GroupMap } from "../../lib/parser";
import { createThreadWithResponses } from "../../lib/db";
import { useAppStore } from "../../stores/app-store";
import type { ParsedThread } from "../../types";
import { X, ChevronDown, ChevronRight } from "lucide-react";

const GROUP_COLORS = [
  "rgba(79, 123, 232, 0.25)",   // #1 blue
  "rgba(34, 197, 94, 0.25)",    // #2 green
  "rgba(234, 179, 8, 0.25)",    // #3 yellow
  "rgba(168, 85, 247, 0.25)",   // #4 purple
  "rgba(239, 68, 68, 0.25)",    // #5 red
  "rgba(6, 182, 212, 0.25)",    // #6 cyan
];

const GROUP_FIELDS = [
  { value: "sequence", label: "Sequence" },
  { value: "authorName", label: "Author" },
  { value: "postedAt", label: "Date" },
  { value: "authorId", label: "ID" },
  { value: "", label: "(무시)" },
] as const;

interface PasteDialogProps {
  onClose: () => void;
  onSaved: () => void;
}

export function PasteDialog({ onClose, onSaved }: PasteDialogProps) {
  const { t } = useTranslation();
  const selectedSeriesId = useAppStore((s) => s.selectedSeriesId);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedThread | null>(null);
  const [threadName, setThreadName] = useState("");
  const [sourceLocale, setSourceLocale] = useState("ja");
  const [saving, setSaving] = useState(false);
  const [regexOpen, setRegexOpen] = useState(false);
  const [customPattern, setCustomPattern] = useState(DEFAULT_HEADER_PATTERN);
  const [groupMap, setGroupMap] = useState<GroupMap>({ ...DEFAULT_GROUP_MAP });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const patternResult = useMemo(() => {
    if (!rawText) return { matchedLines: new Map(), firstMatch: null, matchCount: 0, error: null };
    const isDefault = customPattern === DEFAULT_HEADER_PATTERN;
    return testPattern(rawText, customPattern, isDefault ? LABELED_HEADER_PATTERN : undefined);
  }, [rawText, customPattern]);

  const groupCount = useMemo(() => countCaptureGroups(customPattern), [customPattern]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleParse = () => {
    const result = parseThreadText(rawText, customPattern, groupMap);
    setParsed(result);
  };

  const handleSave = async () => {
    if (!parsed || parsed.responses.length === 0) return;
    setSaving(true);
    try {
      await createThreadWithResponses(
        selectedSeriesId,
        threadName ? { [sourceLocale]: { name: threadName } } : {},
        [],
        parsed.responses.map((r) => ({
          sequence: r.sequence,
          postedAt: r.postedAt ?? null,
          i18n: {
            [sourceLocale]: {
              authorName: r.authorName,
              authorId: r.authorId,
              body: r.body,
            },
          },
        })),
      );
      onSaved();
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          width: "90vw",
          maxWidth: "860px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>{t("import.pasteTitle")}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {!parsed ? (
            <div className="flex flex-col" style={{ gap: "12px" }}>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                {t("import.pasteDescription")}
              </p>
              <div className="flex" style={{ gap: "10px" }}>
                <div className="flex flex-col" style={{ gap: "4px", width: "140px", flexShrink: 0 }}>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                    {t("import.sourceLanguage")}
                  </label>
                  <select
                    value={sourceLocale}
                    onChange={(e) => setSourceLocale(e.target.value)}
                    className="input"
                  >
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="flex flex-col" style={{ gap: "4px", flex: 1 }}>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                    {t("common.name")}
                  </label>
                  <input
                    type="text"
                    value={threadName}
                    onChange={(e) => setThreadName(e.target.value)}
                    placeholder={t("thread.unnamed")}
                    className="input"
                  />
                </div>
              </div>

              {/* Regex settings */}
              <div style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}>
                <button
                  type="button"
                  onClick={() => setRegexOpen(!regexOpen)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                    padding: "8px 12px",
                    background: "var(--color-bg-secondary)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {regexOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Header Regex
                  {rawText && (
                    <span style={{
                      marginLeft: "auto",
                      fontSize: "11px",
                      color: patternResult.error ? "var(--color-danger)" : "var(--color-primary)",
                    }}>
                      {patternResult.error ? "Invalid regex" : `${patternResult.matchCount ?? patternResult.matchedLines.size} headers`}
                    </span>
                  )}
                </button>
                {regexOpen && (
                  <div style={{ padding: "10px 12px", borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                      type="text"
                      value={customPattern}
                      onChange={(e) => setCustomPattern(e.target.value)}
                      className="input"
                      spellCheck={false}
                      style={{ fontFamily: "monospace", fontSize: "11px" }}
                    />
                    {patternResult.error && (
                      <span style={{ fontSize: "11px", color: "var(--color-danger)" }}>{patternResult.error}</span>
                    )}
                    {/* Group mapping */}
                    {groupCount > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {Array.from({ length: groupCount }, (_, i) => {
                          const groupIdx = i + 1;
                          const currentField = Object.entries(groupMap).find(([, v]) => v === groupIdx)?.[0] ?? "";
                          const sampleValue = patternResult.firstMatch?.[groupIdx] ?? "";
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <span style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                borderRadius: "2px",
                                background: GROUP_COLORS[i % GROUP_COLORS.length],
                                border: "1px solid rgba(0,0,0,0.15)",
                                flexShrink: 0,
                              }} />
                              <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", minWidth: "16px" }}>#{groupIdx}</span>
                              <select
                                value={currentField}
                                onChange={(e) => {
                                  const newMap = { ...groupMap };
                                  // Clear previous assignment of this group
                                  for (const k of Object.keys(newMap) as (keyof GroupMap)[]) {
                                    if (newMap[k] === groupIdx) newMap[k] = 0;
                                  }
                                  if (e.target.value) {
                                    newMap[e.target.value as keyof GroupMap] = groupIdx;
                                  }
                                  setGroupMap(newMap);
                                }}
                                className="input"
                                style={{ width: "90px", height: "24px", fontSize: "10px", padding: "0 4px" }}
                              >
                                {GROUP_FIELDS.map((f) => (
                                  <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                              </select>
                              {sampleValue && (
                                <span style={{
                                  fontSize: "10px",
                                  color: "var(--color-text-tertiary)",
                                  maxWidth: "120px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}>
                                  {sampleValue}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Textarea with highlight overlay */}
              <div style={{ position: "relative", height: "300px" }}>
                <div
                  ref={highlightRef}
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    padding: "7px 10px",
                    fontFamily: "var(--font-aa)",
                    fontSize: "13px",
                    lineHeight: "1.3",
                    whiteSpace: "pre",
                    pointerEvents: "none",
                    border: "1px solid transparent",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {rawText.split("\n").map((line, i) => {
                    const lineHL = patternResult.matchedLines.get(i);
                    if (!lineHL) {
                      return <div key={i} style={{ color: "transparent", marginLeft: "-10px", marginRight: "-10px", paddingLeft: "10px", paddingRight: "10px" }}>{line || "\u00A0"}</div>;
                    }
                    // Build spans with group-colored backgrounds
                    const segments: { text: string; color: string }[] = [];
                    let pos = 0;
                    const ranges = [...lineHL.groupRanges]
                      .filter((r) => r.start >= 0)
                      .sort((a, b) => a.start - b.start);
                    for (const r of ranges) {
                      if (r.start > pos) {
                        segments.push({ text: line.slice(pos, r.start), color: "rgba(200,200,200,0.15)" });
                      }
                      segments.push({ text: line.slice(r.start, r.end), color: GROUP_COLORS[r.group % GROUP_COLORS.length] });
                      pos = r.end;
                    }
                    if (pos < line.length) {
                      segments.push({ text: line.slice(pos), color: ranges.length > 0 ? "rgba(200,200,200,0.15)" : "rgba(200,200,200,0.1)" });
                    }
                    if (segments.length === 0) {
                      segments.push({ text: line || "\u00A0", color: "rgba(200,200,200,0.1)" });
                    }
                    return (
                      <div key={i} style={{ color: "transparent", marginLeft: "-10px", marginRight: "-10px", paddingLeft: "10px", paddingRight: "10px" }}>
                        {segments.map((s, j) => (
                          <span key={j} style={{ background: s.color }}>{s.text}</span>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <textarea
                  ref={textareaRef}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  onScroll={handleScroll}
                  placeholder={t("import.pasteHint")}
                  className="input"
                  style={{
                    position: "relative",
                    height: "100%",
                    width: "100%",
                    fontFamily: "var(--font-aa)",
                    fontSize: "13px",
                    lineHeight: "1.3",
                    resize: "none",
                    background: "transparent",
                    caretColor: "var(--color-text)",
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: "14px" }}>
              <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                {t("import.parseSuccess", { count: parsed.responses.length })}
              </p>
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  maxHeight: "400px",
                  overflowY: "auto",
                }}
              >
                {parsed.responses.map((resp, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 14px",
                      borderBottom: i < parsed.responses.length - 1 ? "1px solid var(--color-border-light)" : "none",
                    }}
                  >
                    <div className="flex" style={{ gap: "8px", fontSize: "11px", color: "var(--color-text-secondary)", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{resp.sequence}</span>
                      {resp.authorName && <span>{resp.authorName}</span>}
                      {resp.authorId && <span>ID:{resp.authorId}</span>}
                      {resp.postedAt && <span>{resp.postedAt}</span>}
                    </div>
                    <pre
                      style={{
                        fontFamily: "var(--font-aa)",
                        fontSize: "11px",
                        lineHeight: "1.2",
                        whiteSpace: "pre",
                        overflowX: "auto",
                        maxHeight: "120px",
                        overflowY: "auto",
                      }}
                    >
                      {resp.body}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "16px 24px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {!parsed ? (
            <>
              <button className="btn btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
              <button className="btn btn-primary" onClick={handleParse} disabled={!rawText.trim()}>
                {t("import.parse")}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setParsed(null)}>{t("common.cancel")}</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || parsed.responses.length === 0}
              >
                {saving ? "..." : t("import.save")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
