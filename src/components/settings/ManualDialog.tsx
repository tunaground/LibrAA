import { useTranslation } from "react-i18next";
import { X, ClipboardPaste, Upload, Download, Plus, Pencil, Trash2, Settings, BookOpen } from "lucide-react";
import type { ReactNode } from "react";

interface ManualDialogProps {
  onClose: () => void;
}

const ICON_MAP: Record<string, ReactNode> = {
  "{icon:paste}": <ClipboardPaste size={12} style={{ display: "inline", verticalAlign: "-2px" }} />,
  "{icon:upload}": <Upload size={12} style={{ display: "inline", verticalAlign: "-2px" }} />,
  "{icon:download}": <Download size={12} style={{ display: "inline", verticalAlign: "-2px" }} />,
  "{icon:plus}": <Plus size={12} style={{ display: "inline", verticalAlign: "-2px" }} />,
  "{icon:pencil}": <Pencil size={12} style={{ display: "inline", verticalAlign: "-2px" }} />,
  "{icon:trash}": <Trash2 size={12} style={{ display: "inline", verticalAlign: "-2px" }} />,
  "{icon:settings}": <Settings size={12} style={{ display: "inline", verticalAlign: "-2px" }} />,
  "{icon:book}": <BookOpen size={12} style={{ display: "inline", verticalAlign: "-2px" }} />,
};

function renderWithIcons(text: string): ReactNode {
  const parts = text.split(/(\{icon:\w+\})/g);
  return parts.map((part, i) =>
    ICON_MAP[part] ? <span key={i}>{ICON_MAP[part]}</span> : <span key={i}>{part}</span>,
  );
}

export function ManualDialog({ onClose }: ManualDialogProps) {
  const { t } = useTranslation();

  const sections = t("manual.sections", { returnObjects: true }) as Array<{
    title: string;
    items: string[];
  }>;

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
          width: "560px",
          maxHeight: "80vh",
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
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>{t("manual.title")}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div className="flex flex-col" style={{ gap: "20px" }}>
            {sections.map((section, i) => (
              <div key={i}>
                <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
                  {section.title}
                </h3>
                <ul style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: "1.8", paddingLeft: "16px" }}>
                  {section.items.map((item, j) => (
                    <li key={j}>{renderWithIcons(item)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "16px 24px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
