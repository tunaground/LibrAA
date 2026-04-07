// Safari polyfill: storage.sync → storage.local
if (typeof chrome !== "undefined" && chrome.storage && !chrome.storage.sync) {
  chrome.storage.sync = chrome.storage.local;
}

const providerEl = document.getElementById("provider");
const apiKeyEl = document.getElementById("apiKey");
const apiKeyRow = document.getElementById("apikey-row");
const modelEl = document.getElementById("model");
const concurrencyEl = document.getElementById("concurrency");
const targetLangEl = document.getElementById("targetLang");
const saveBtn = document.getElementById("save");
const savedEl = document.getElementById("saved");

// Load saved settings
chrome.storage.sync.get(["provider", "apiKey", "model", "targetLang", "concurrency"], (data) => {
  if (data.provider) providerEl.value = data.provider;
  if (data.apiKey) apiKeyEl.value = data.apiKey;
  if (data.model) modelEl.value = data.model;
  if (data.concurrency) concurrencyEl.value = data.concurrency;
  if (data.targetLang) targetLangEl.value = data.targetLang;
  updateApiKeyVisibility();
});

providerEl.addEventListener("change", updateApiKeyVisibility);

function updateApiKeyVisibility() {
  apiKeyRow.style.display = providerEl.value === "ollama" ? "none" : "block";
}

saveBtn.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      provider: providerEl.value,
      apiKey: apiKeyEl.value,
      model: modelEl.value,
      concurrency: Number(concurrencyEl.value),
      targetLang: targetLangEl.value,
    },
    () => {
      savedEl.style.display = "block";
      setTimeout(() => (savedEl.style.display = "none"), 2000);
    },
  );
});
