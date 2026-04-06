import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settings-store";
import type { LLMProviderType } from "../../types";
import { X } from "lucide-react";

interface SettingsDialogProps {
  onClose: () => void;
}

const PROVIDERS: { value: LLMProviderType; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
  { value: "claude", label: "Claude (Anthropic)" },
  { value: "ollama", label: "Ollama (로컬)" },
];

const MODELS: Record<LLMProviderType, { value: string; label: string }[] | null> = {
  openai: [
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
  claude: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  ],
  ollama: null, // 직접 입력
};

const LANGUAGES = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const { t, i18n } = useTranslation();
  const {
    llmProvider,
    llmApiKey,
    llmModel,
    concurrency,
    batchBlocks,
    setLlmProvider,
    setLlmApiKey,
    setLlmModel,
    setConcurrency,
    setBatchBlocks,
    saveSettings,
  } = useSettingsStore();
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await saveSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
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
          width: "460px",
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
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>{t("settings.title")}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <div className="flex flex-col" style={{ gap: "24px" }}>
            {/* Language */}
            <div className="flex flex-col" style={{ gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>
                {t("settings.language")}
              </label>
              <select
                value={i18n.language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="input"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--color-border)" }} />

            {/* LLM Settings */}
            <div className="flex flex-col" style={{ gap: "16px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600 }}>
                {t("settings.llm.title")}
              </h3>

              <div className="flex flex-col" style={{ gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                  {t("settings.llm.provider")}
                </label>
                <select
                  value={llmProvider}
                  onChange={(e) => {
                    const p = e.target.value as LLMProviderType;
                    setLlmProvider(p);
                    setLlmModel(MODELS[p]?.[0]?.value ?? "");
                  }}
                  className="input"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {llmProvider !== "ollama" && (
                <div className="flex flex-col" style={{ gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                    {t("settings.llm.apiKey")}
                  </label>
                  <input
                    type="password"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    className="input"
                  />
                </div>
              )}

              <div className="flex flex-col" style={{ gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                  {t("settings.llm.model")}
                </label>
                {MODELS[llmProvider] ? (
                  <select
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    className="input"
                  >
                    {MODELS[llmProvider]!.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="gemma3:12b"
                    className="input"
                  />
                )}
              </div>

              <div className="flex flex-col" style={{ gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                  {t("settings.llm.concurrency")}
                </label>
                <select
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="input"
                >
                  {[1, 2, 3, 5, 8, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div
                className="flex items-center"
                style={{ gap: "8px", cursor: "pointer" }}
                onClick={() => setBatchBlocks(!batchBlocks)}
              >
                <div style={{
                  width: "32px", height: "18px", borderRadius: "9px", padding: "2px",
                  background: batchBlocks ? "var(--color-primary)" : "var(--color-border)",
                  transition: "background 0.15s",
                }}>
                  <div style={{
                    width: "14px", height: "14px", borderRadius: "7px", background: "#fff",
                    transform: batchBlocks ? "translateX(14px)" : "translateX(0)",
                    transition: "transform 0.15s",
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                    {t("settings.llm.batchBlocks")}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>
                    {t("settings.llm.batchBlocksDesc")}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common.close")}
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? t("settings.llm.saved") : t("settings.llm.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
