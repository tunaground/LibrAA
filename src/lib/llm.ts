import type { LLMProviderType } from "../types";
import { fetch } from "@tauri-apps/plugin-http";
import { extractJaBlocks } from "./ja-blocks";

interface LLMConfig {
  provider: LLMProviderType;
  apiKey: string;
  model: string;
}

interface LLMResponse {
  text: string;
}

const LANG_NAMES: Record<string, string> = {
  ko: "Korean",
  en: "English",
  ja: "Japanese",
  zh: "Chinese",
};

async function callClaude(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<LLMResponse> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  return { text: textBlock?.text ?? "" };
}

async function callOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<LLMResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content ?? "" };
}

async function callGemini(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<LLMResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { text };
}

async function callOllama(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<LLMResponse> {
  const response = await fetch("http://localhost:11434/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content ?? "" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLLMOnce(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<LLMResponse> {
  switch (config.provider) {
    case "claude":
      return callClaude(config, systemPrompt, userMessage);
    case "openai":
      return callOpenAI(config, systemPrompt, userMessage);
    case "gemini":
      return callGemini(config, systemPrompt, userMessage);
    case "ollama":
      return callOllama(config, systemPrompt, userMessage);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

const MAX_RETRIES = 10;
const BASE_DELAY = 5000; // 5 seconds
const MAX_DELAY = 120000; // 2 minutes

async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<LLMResponse> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callLLMOnce(config, systemPrompt, userMessage);
    } catch (e) {
      const errMsg = String(e);
      // Extract HTTP status code from error message
      const statusMatch = errMsg.match(/error: (\d{3})/i);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

      const isRateLimit = status === 429;
      const isServerError = status >= 500 && status < 600;
      const isRetryable = isRateLimit || isServerError;

      console.error(`[LLM] ${isRetryable ? "Retryable" : "Fatal"} error (${status || "unknown"}):`, errMsg.slice(0, 200));

      if (isRetryable && attempt < MAX_RETRIES) {
        const retryAfterMatch = errMsg.match(/retry.?after[:\s]*(\d+)/i);
        const retryAfter = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) * 1000 : 0;
        const delay = retryAfter || Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
        console.log(`[LLM] Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
}

interface BlockTranslation {
  original: string;
  translated: string;
  meaningful: boolean;
}

const BLOCK_SYSTEM_PROMPT_CACHE: Record<string, string> = {};

function getBlockSystemPrompt(langName: string): string {
  if (BLOCK_SYSTEM_PROMPT_CACHE[langName]) return BLOCK_SYSTEM_PROMPT_CACHE[langName];
  const prompt = `You are a translator for Japanese AA (Ascii Art) works (やる夫系).
These works draw from anime, manga, light novels, visual novels, and video game culture.

You will receive a Japanese text fragment extracted from an AA work.
Determine if it is meaningful text or just decorative (kanji used for shading like 闇闇闇, repeated symbols).
Single words, names, katakana loanwords (システム, スキル, etc.) ARE meaningful — translate them.

Respond in JSON format only:
{"meaningful": true, "translation": "translated text in ${langName}"}
or
{"meaningful": false}

IMPORTANT: When meaningful is true, "translation" MUST be in ${langName}, NOT in Japanese. Never return the original Japanese text as the translation.

Translation guidelines:
- Otaku/anime terminology: use ${langName} equivalents or keep original if commonly understood
- Japanese honorifics (-san, -sama, -kun, -chan): preserve as-is
- Character speech patterns (e.g., だお): convey personality in ${langName}
- Internet slang (w, 草): adapt to ${langName} equivalents
- RPG terms (HP, MP, skills): translate naturally for gamers

JSON only. No explanations.`;
  BLOCK_SYSTEM_PROMPT_CACHE[langName] = prompt;
  return prompt;
}

const JA_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;

function isStillJapanese(text: string): boolean {
  const matches = text.match(JA_RE);
  if (!matches) return false;
  // If more than 30% of characters are Japanese, it's not properly translated
  return matches.length / text.length > 0.3;
}

function parseBlockResponse(text: string, original: string): BlockTranslation {
  try {
    const jsonStr = text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed.meaningful && parsed.translation) {
      if (parsed.translation.trim() === original.trim()) {
        return { original, translated: original, meaningful: false };
      }
      return { original, translated: parsed.translation, meaningful: true };
    }
    return { original, translated: original, meaningful: false };
  } catch {
    const cleaned = text.trim();
    if (cleaned === original.trim()) {
      return { original, translated: original, meaningful: false };
    }
    return { original, translated: cleaned, meaningful: true };
  }
}

const BLOCK_MAX_RETRIES = 2;

export async function translateBlockSingle(
  config: LLMConfig,
  text: string,
  targetLang: string,
): Promise<BlockTranslation> {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const systemPrompt = getBlockSystemPrompt(langName);

  for (let attempt = 0; attempt <= BLOCK_MAX_RETRIES; attempt++) {
    const result = await callLLM(config, systemPrompt, text);
    const parsed = parseBlockResponse(result.text, text);

    // If meaningful but translation still contains mostly Japanese, retry
    if (parsed.meaningful && isStillJapanese(parsed.translated) && attempt < BLOCK_MAX_RETRIES) {
      console.log(`[translate] Retry ${attempt + 1}: still Japanese "${parsed.translated.slice(0, 30)}..."`);
      continue;
    }

    return parsed;
  }

  // Exhausted retries, return last result as-is
  return { original: text, translated: text, meaningful: false };
}

export interface BlockResult {
  input: string;
  meaningful: boolean;
  output: string;
  status: "done" | "error";
}

async function translateBlocksBatch(
  config: LLMConfig,
  blocks: string[],
  targetLang: string,
): Promise<BlockTranslation[]> {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const numbered = blocks.map((b, i) => `[${i}] ${b}`).join("\n");

  const systemPrompt = `Translate Japanese text fragments to ${langName}.
You receive numbered fragments. For each, decide if it's meaningful text or decorative (kanji shading, symbols).
Single words, names, katakana loanwords ARE meaningful — translate them.

Respond as a JSON array:
[{"i":0,"m":true,"t":"translation in ${langName}"},{"i":1,"m":false},...]

"i" = index, "m" = meaningful, "t" = translation (only when m=true, MUST be in ${langName}).
JSON only. No explanation.`;

  const result = await callLLM(config, systemPrompt, numbered);
  try {
    const jsonStr = result.text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr) as Array<{ i: number; m: boolean; t?: string }>;
    return blocks.map((block, i) => {
      const entry = parsed.find((p) => p.i === i);
      if (entry?.m && entry.t && entry.t.trim() !== block.trim() && !isStillJapanese(entry.t)) {
        return { original: block, translated: entry.t, meaningful: true };
      }
      return { original: block, translated: block, meaningful: false };
    });
  } catch {
    // Batch failed — return all as not-translated so individual fallback can handle
    return blocks.map((block) => ({ original: block, translated: block, meaningful: false }));
  }
}

export async function translateAAResponse(
  config: LLMConfig,
  body: string,
  targetLang: string,
  onBlockResult?: (result: BlockResult) => void,
  batch?: boolean,
): Promise<string> {
  const blocks = extractJaBlocks(body);
  if (blocks.length === 0) return body;

  const uniqueBlocks = [...new Set(blocks)];
  let result = body;

  if (batch && uniqueBlocks.length > 1) {
    // Batch mode: send all blocks in one API call
    try {
      const translations = await translateBlocksBatch(config, uniqueBlocks, targetLang);
      for (const t of translations) {
        if (t.meaningful) {
          result = result.split(t.original).join(t.translated);
        }
        onBlockResult?.({
          input: t.original,
          meaningful: t.meaningful,
          output: t.meaningful ? t.translated : t.original,
          status: "done",
        });
      }
      // Retry blocks that batch marked as not meaningful (may be batch errors)
      const missed = translations.filter((t) => !t.meaningful);
      for (const m of missed) {
        try {
          const retry = await translateBlockSingle(config, m.original, targetLang);
          if (retry.meaningful) {
            result = result.split(m.original).join(retry.translated);
            onBlockResult?.({
              input: m.original,
              meaningful: true,
              output: retry.translated,
              status: "done",
            });
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // Batch completely failed, fall through to individual mode
      for (const block of uniqueBlocks) {
        try {
          const translation = await translateBlockSingle(config, block, targetLang);
          if (translation.meaningful) {
            result = result.split(block).join(translation.translated);
          }
          onBlockResult?.({
            input: block,
            meaningful: translation.meaningful,
            output: translation.meaningful ? translation.translated : block,
            status: "done",
          });
        } catch (e) {
          onBlockResult?.({ input: block, meaningful: false, output: String(e), status: "error" });
        }
      }
    }
  } else {
    // Individual mode: one API call per block
    for (const block of uniqueBlocks) {
      try {
        const translation = await translateBlockSingle(config, block, targetLang);
        if (translation.meaningful) {
          result = result.split(block).join(translation.translated);
        }
        onBlockResult?.({
          input: block,
          meaningful: translation.meaningful,
          output: translation.meaningful ? translation.translated : block,
          status: "done",
        });
      } catch (e) {
        onBlockResult?.({ input: block, meaningful: false, output: String(e), status: "error" });
      }
    }
  }

  return result;
}

export async function translateText(
  config: LLMConfig,
  text: string,
  targetLang: string,
): Promise<string> {
  const langName = LANG_NAMES[targetLang] ?? targetLang;

  const systemPrompt = `Translate the given text into ${langName}. Return only the translated text, nothing else.`;

  const result = await callLLM(config, systemPrompt, text);
  return result.text;
}
