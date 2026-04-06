import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseThreadText } from "../../lib/parser";
import { createThreadWithResponses } from "../../lib/db";
import { useAppStore } from "../../stores/app-store";
import type { ParsedThread } from "../../types";
import { X } from "lucide-react";

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

  const handleParse = () => {
    const result = parseThreadText(rawText);
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
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={t("import.pasteHint")}
                className="input"
                style={{
                  height: "300px",
                  fontFamily: "var(--font-aa)",
                  fontSize: "13px",
                  lineHeight: "1.3",
                  resize: "vertical",
                }}
              />
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
