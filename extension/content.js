// ===== Japanese block detection (from ja-blocks.ts) =====
const JA_CORE_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;
const SPLIT_RE = /([\u0020\u3000\t\n\r]+|[\u3010\u3011\u300C\u300D\u300E\u300F\uFF08\uFF09\u3008\u3009\u300A\u300B\[\]\(\)\u2460-\u2473\u2474-\u2487\u2488-\u249B\u24EA-\u24FF\u203B\uFF0A])/;

function isJaBlock(token) {
  const matches = token.match(JA_CORE_RE);
  return matches !== null && matches.length >= 2;
}

function extractJaBlocks(text) {
  const tokens = text.split(SPLIT_RE);
  return tokens.filter((t) => t && !SPLIT_RE.test(t) && isJaBlock(t));
}

// ===== State =====
let mode = "idle"; // idle | selecting | ready | translating
let selectedContainer = null;
let toolbar = null;
let settingsModal = null;
let config = null;
let targetLang = "ko";
let translatedCount = 0;
let highlightOn = true;
let highlightColor = "rgba(34, 197, 94, 0.1)";
let totalCount = 0;
let cancelFlag = false;

// ===== Highlight style =====
let highlightStyleEl = null;

function applyHighlightStyle() {
  if (!highlightStyleEl) {
    highlightStyleEl = document.createElement("style");
    highlightStyleEl.id = "libraa-highlight-style";
    document.head.appendChild(highlightStyleEl);
  }
  if (highlightOn) {
    highlightStyleEl.textContent = `.libraa-block.translated { background-color: ${highlightColor} !important; }`;
  } else {
    highlightStyleEl.textContent = `.libraa-block.translated { background-color: transparent !important; }`;
  }
}

function toggleHighlight() {
  highlightOn = !highlightOn;
  applyHighlightStyle();
  updateToolbar();
}

// ===== Load settings =====
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["provider", "apiKey", "model", "targetLang", "concurrency", "highlightColor"], (data) => {
      if (data.provider && data.model) {
        config = { provider: data.provider, apiKey: data.apiKey || "", model: data.model, concurrency: data.concurrency || 3 };
        targetLang = data.targetLang || "ko";
      }
      if (data.highlightColor) highlightColor = data.highlightColor;
      applyHighlightStyle();
      resolve();
    });
  });
}

// ===== LLM call via background =====
async function callLLM(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "llm-call", config, systemPrompt, userMessage },
      (response) => {
        if (response?.ok) resolve(response.text);
        else reject(new Error(response?.error || "LLM call failed"));
      },
    );
  });
}

// ===== Block translation =====
const JA_STILL_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;

function isStillJapanese(text) {
  const m = text.match(JA_STILL_RE);
  if (!m) return false;
  return m.length / text.length > 0.3;
}

async function translateBlock(text) {
  const langNames = { ko: "Korean", en: "English", ja: "Japanese" };
  const langName = langNames[targetLang] || targetLang;

  const systemPrompt = `You are a translator for Japanese AA (Ascii Art) works.
You will receive a Japanese text fragment. Determine if it is meaningful text or decorative.
Single words, names, katakana loanwords ARE meaningful — translate them.

Respond in JSON:
{"meaningful": true, "translation": "translated text in ${langName}"}
or {"meaningful": false}

IMPORTANT: When meaningful, "translation" MUST be in ${langName}, NOT Japanese.
JSON only.`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await callLLM(systemPrompt, text);
    try {
      const jsonStr = result.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.meaningful && parsed.translation) {
        if (parsed.translation.trim() === text.trim()) continue;
        if (isStillJapanese(parsed.translation) && attempt < 2) continue;
        return { meaningful: true, translated: parsed.translation };
      }
      return { meaningful: false, translated: text };
    } catch {
      if (result.trim() !== text.trim() && !isStillJapanese(result.trim())) {
        return { meaningful: true, translated: result.trim() };
      }
    }
  }
  return { meaningful: false, translated: text };
}

// ===== Wrap Japanese blocks in spans =====
function wrapJaBlocks(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent && extractJaBlocks(node.textContent).length > 0) {
      textNodes.push(node);
    }
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent;
    const tokens = text.split(SPLIT_RE);
    if (tokens.length <= 1 && !isJaBlock(text)) continue;

    const frag = document.createDocumentFragment();
    for (const token of tokens) {
      if (!token) continue;
      if (!SPLIT_RE.test(token) && isJaBlock(token)) {
        const span = document.createElement("span");
        span.className = "libraa-block";
        span.textContent = token;
        span.dataset.original = token;
        span.addEventListener("click", onBlockClick);
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(token));
      }
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

// ===== Block click handler =====
async function onBlockClick(e) {
  if (!config) return;
  const span = e.target;
  if (span.classList.contains("translating")) return;

  // Toggle between original and translated
  if (span.classList.contains("translated")) {
    const showing = span.dataset.showing || "translated";
    if (showing === "translated") {
      span.textContent = span.dataset.original;
      span.dataset.showing = "original";
    } else {
      span.textContent = span.dataset.translated;
      span.dataset.showing = "translated";
    }
    return;
  }

  // First time — translate
  span.classList.add("translating");
  try {
    const result = await translateBlock(span.dataset.original);
    if (result.meaningful) {
      span.dataset.translated = result.translated;
      span.dataset.showing = "translated";
      span.textContent = result.translated;
      span.classList.add("translated");
    }
  } catch (err) {
    console.error("[LibrAA] Block translation failed:", err);
  }
  span.classList.remove("translating");
}

// ===== Auto-translate all blocks in container =====
async function translateSpan(span) {
  if (cancelFlag) return;
  span.classList.add("translating");
  try {
    const result = await translateBlock(span.dataset.original);
    if (cancelFlag) { span.classList.remove("translating"); return; }
    if (result.meaningful) {
      span.dataset.translated = result.translated;
      span.dataset.showing = "translated";
      span.textContent = result.translated;
      span.classList.add("translated");
    }
  } catch (err) {
    console.error("[LibrAA] Translation failed:", err);
  }
  span.classList.remove("translating");
  translatedCount++;
  updateToolbar();
}

async function translateAll() {
  if (!selectedContainer || !config) return;

  const blocks = [...selectedContainer.querySelectorAll(".libraa-block:not(.translated)")];
  totalCount = blocks.length;
  translatedCount = 0;
  cancelFlag = false;
  mode = "translating";
  updateToolbar();

  const concurrency = config.concurrency || 3;
  for (let i = 0; i < blocks.length; i += concurrency) {
    if (cancelFlag) break;
    const batch = blocks.slice(i, i + concurrency);
    await Promise.all(batch.map((span) => {
      if (cancelFlag) return Promise.resolve();
      return translateSpan(span);
    }));
  }

  mode = "ready";
  updateToolbar();
}

// ===== Container selection mode =====
function startSelecting() {
  mode = "selecting";
  document.body.style.cursor = "crosshair";

  document.addEventListener("mouseover", onSelectHover, true);
  document.addEventListener("mouseout", onSelectOut, true);
  document.addEventListener("click", onSelectClick, true);
  updateToolbar();
}

function onSelectHover(e) {
  if (mode !== "selecting") return;
  const el = e.target;
  if (el === toolbar || toolbar?.contains(el)) return;
  el.classList.add("libraa-selectable");
}

function onSelectOut(e) {
  if (mode !== "selecting") return;
  e.target.classList.remove("libraa-selectable");
}

function onSelectClick(e) {
  if (mode !== "selecting") return;
  const el = e.target;
  if (el === toolbar || toolbar?.contains(el)) return;

  e.preventDefault();
  e.stopPropagation();

  // Clean up
  document.removeEventListener("mouseover", onSelectHover, true);
  document.removeEventListener("mouseout", onSelectOut, true);
  document.removeEventListener("click", onSelectClick, true);
  document.querySelectorAll(".libraa-selectable").forEach((el) => el.classList.remove("libraa-selectable"));
  document.body.style.cursor = "";

  // Deselect previous
  if (selectedContainer) {
    selectedContainer.classList.remove("libraa-selected");
    unwrapBlocks(selectedContainer);
  }

  selectedContainer = el;
  selectedContainer.classList.add("libraa-selected");
  wrapJaBlocks(selectedContainer);

  mode = "ready";
  updateToolbar();
}

function unwrapBlocks(container) {
  const spans = container.querySelectorAll(".libraa-block");
  for (const span of spans) {
    span.replaceWith(document.createTextNode(span.dataset.original || span.textContent));
  }
  container.normalize();
}

// ===== Settings modal =====
function toggleSettings() {
  if (settingsModal) {
    settingsModal.remove();
    settingsModal = null;
    return;
  }

  settingsModal = document.createElement("div");
  settingsModal.className = "libraa-settings";
  settingsModal.innerHTML = `
    <div class="settings-title">LibrAA Settings</div>
    <div class="settings-group">
      <label>Provider</label>
      <select id="libraa-s-provider">
        <option value="openai">OpenAI</option>
        <option value="gemini">Google Gemini</option>
        <option value="claude">Claude</option>
        <option value="ollama">Ollama (로컬)</option>
      </select>
    </div>
    <div class="settings-group" id="libraa-s-apikey-row">
      <label>API Key</label>
      <input type="password" id="libraa-s-apikey">
    </div>
    <div class="settings-group">
      <label>Model</label>
      <input type="text" id="libraa-s-model">
    </div>
    <div class="settings-group">
      <label>Concurrency</label>
      <select id="libraa-s-concurrency">
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="5">5</option>
        <option value="8">8</option>
        <option value="10">10</option>
      </select>
    </div>
    <div class="settings-group">
      <label>Target Language</label>
      <select id="libraa-s-lang">
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
      </select>
    </div>
    <div class="settings-group">
      <label>Highlight Color</label>
      <select id="libraa-s-hlcolor">
        <option value="rgba(34, 197, 94, 0.1)">연녹색</option>
        <option value="rgba(79, 123, 232, 0.1)">연파랑</option>
        <option value="rgba(234, 179, 8, 0.1)">연노랑</option>
        <option value="rgba(168, 85, 247, 0.1)">연보라</option>
        <option value="rgba(239, 68, 68, 0.1)">연빨강</option>
        <option value="rgba(0, 0, 0, 0)">투명</option>
      </select>
    </div>
    <div class="settings-footer">
      <button class="btn-primary" id="libraa-s-save">저장</button>
      <button class="btn-secondary" id="libraa-s-close">닫기</button>
    </div>
  `;
  document.body.appendChild(settingsModal);

  // Load current values
  const pEl = settingsModal.querySelector("#libraa-s-provider");
  const kEl = settingsModal.querySelector("#libraa-s-apikey");
  const kRow = settingsModal.querySelector("#libraa-s-apikey-row");
  const mEl = settingsModal.querySelector("#libraa-s-model");
  const cEl = settingsModal.querySelector("#libraa-s-concurrency");
  const lEl = settingsModal.querySelector("#libraa-s-lang");

  const hlcEl = settingsModal.querySelector("#libraa-s-hlcolor");

  chrome.storage.sync.get(["provider", "apiKey", "model", "concurrency", "targetLang", "highlightColor"], (data) => {
    if (data.provider) pEl.value = data.provider;
    if (data.apiKey) kEl.value = data.apiKey;
    if (data.model) mEl.value = data.model;
    if (data.concurrency) cEl.value = data.concurrency;
    if (data.targetLang) lEl.value = data.targetLang;
    if (data.highlightColor) hlcEl.value = data.highlightColor;
    kRow.style.display = pEl.value === "ollama" ? "none" : "block";
  });

  pEl.addEventListener("change", () => {
    kRow.style.display = pEl.value === "ollama" ? "none" : "block";
  });

  settingsModal.querySelector("#libraa-s-save").addEventListener("click", () => {
    chrome.storage.sync.set({
      provider: pEl.value,
      apiKey: kEl.value,
      model: mEl.value,
      concurrency: Number(cEl.value),
      targetLang: lEl.value,
      highlightColor: hlcEl.value,
    }, () => {
      highlightColor = hlcEl.value;
      applyHighlightStyle();
      loadSettings();
      settingsModal.remove();
      settingsModal = null;
      updateToolbar();
    });
  });

  settingsModal.querySelector("#libraa-s-close").addEventListener("click", () => {
    settingsModal.remove();
    settingsModal = null;
  });
}

// ===== Reset =====
function resetAll() {
  if (selectedContainer) {
    unwrapBlocks(selectedContainer);
    selectedContainer.classList.remove("libraa-selected");
    selectedContainer = null;
  }
  cancelFlag = true;
  mode = "idle";
  updateToolbar();
}

// ===== Toolbar =====
function createToolbar() {
  toolbar = document.createElement("div");
  toolbar.className = "libraa-toolbar";
  document.body.appendChild(toolbar);
  updateToolbar();
}

function updateToolbar() {
  if (!toolbar) return;

  const hlBtn = `<button class="btn-secondary" id="libraa-hl-toggle">${highlightOn ? "HL ON" : "HL OFF"}</button>`;
  const settingsBtn = '<button class="btn-secondary" id="libraa-settings">설정</button>';

  if (mode === "idle") {
    toolbar.innerHTML = `
      <span style="font-weight:600">LibrAA</span>
      <button class="btn-primary" id="libraa-select">범위 선택</button>
      ${!config ? '<span class="status">⚠ 설정 필요</span>' : ''}
      ${hlBtn}${settingsBtn}
    `;
    toolbar.querySelector("#libraa-select")?.addEventListener("click", startSelecting);
  } else if (mode === "selecting") {
    toolbar.innerHTML = `
      <span style="font-weight:600">LibrAA</span>
      <span class="status">번역할 영역을 클릭하세요</span>
      <button class="btn-secondary" id="libraa-cancel-select">취소</button>
      ${hlBtn}${settingsBtn}
    `;
    toolbar.querySelector("#libraa-cancel-select")?.addEventListener("click", () => {
      document.removeEventListener("mouseover", onSelectHover, true);
      document.removeEventListener("mouseout", onSelectOut, true);
      document.removeEventListener("click", onSelectClick, true);
      document.querySelectorAll(".libraa-selectable").forEach((el) => el.classList.remove("libraa-selectable"));
      document.body.style.cursor = "";
      mode = "idle";
      updateToolbar();
    });
  } else if (mode === "ready") {
    const blockCount = selectedContainer?.querySelectorAll(".libraa-block:not(.translated)").length || 0;
    toolbar.innerHTML = `
      <span style="font-weight:600">LibrAA</span>
      <span class="status">${blockCount} blocks</span>
      <button class="btn-primary" id="libraa-translate-all">전체 번역</button>
      <button class="btn-secondary" id="libraa-reselect">다시 선택</button>
      <button class="btn-danger" id="libraa-reset">초기화</button>
      ${hlBtn}${settingsBtn}
    `;
    toolbar.querySelector("#libraa-translate-all")?.addEventListener("click", translateAll);
    toolbar.querySelector("#libraa-reselect")?.addEventListener("click", startSelecting);
    toolbar.querySelector("#libraa-reset")?.addEventListener("click", resetAll);
  } else if (mode === "translating") {
    const pct = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;
    toolbar.innerHTML = `
      <span style="font-weight:600">LibrAA</span>
      <span class="status">${translatedCount}/${totalCount}</span>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="status">${pct}%</span>
      <button class="btn-danger" id="libraa-cancel">취소</button>
      ${hlBtn}${settingsBtn}
    `;
    toolbar.querySelector("#libraa-cancel")?.addEventListener("click", () => {
      cancelFlag = true;
      // Remove translating state from all spans immediately
      document.querySelectorAll(".libraa-block.translating").forEach((el) => el.classList.remove("translating"));
      mode = "ready";
      updateToolbar();
    });
  }

  // Common buttons
  toolbar.querySelector("#libraa-hl-toggle")?.addEventListener("click", toggleHighlight);
  toolbar.querySelector("#libraa-settings")?.addEventListener("click", toggleSettings);
}

// ===== Toggle toolbar =====
function toggleToolbar() {
  if (!toolbar) {
    createToolbar();
  } else {
    toolbar.remove();
    toolbar = null;
    if (mode === "selecting") {
      document.removeEventListener("mouseover", onSelectHover, true);
      document.removeEventListener("mouseout", onSelectOut, true);
      document.removeEventListener("click", onSelectClick, true);
      document.querySelectorAll(".libraa-selectable").forEach((el) => el.classList.remove("libraa-selectable"));
      document.body.style.cursor = "";
      mode = "idle";
    }
  }
}

// ===== Init =====
async function init() {
  await loadSettings();

  // Toggle toolbar when extension icon clicked
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "toggle-toolbar") toggleToolbar();
  });

  // Listen for settings updates from popup
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.provider || changes.apiKey || changes.model || changes.targetLang || changes.concurrency) {
      loadSettings();
    }
  });
}

init();
