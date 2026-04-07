import { getAllSeries, getThreads, getResponses } from "./db";
import { getLocalizedField } from "./locale";
import type { Thread, Response } from "../types";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function field(i18n: Record<string, any>, key: string, locale: string): string {
  return (getLocalizedField(i18n, key, locale) as string) ?? "";
}

const CSS = `
:root {
  --bg: #ffffff;
  --bg2: #f8f9fb;
  --border: #e5e7eb;
  --text: #1a1d23;
  --text2: #5f6672;
  --text3: #9198a5;
  --primary: #4f7be8;
  --radius: 6px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1117;
    --bg2: #1a1d27;
    --border: #2e313b;
    --text: #e8eaef;
    --text2: #9198a5;
    --text3: #5f6672;
    --primary: #6b93ec;
  }
}
@font-face {
  font-family: "Saitamaar";
  src: url("https://da1eth.github.io/AA/HeadKasen.woff2") format("woff2");
  font-display: swap;
}
@font-face {
  font-family: "Saitamaar";
  font-style: normal; font-weight: 400;
  src: url(//cdn.jsdelivr.net/font-nanum/1.0/nanumgothiccoding/v2/NanumGothicCoding-Regular.woff) format('woff');
  unicode-range: U+AC00-D7A3, U+3130-318F;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  padding: 24px 20px;
}
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
.series-header {
  text-align: center;
  padding: 32px 0 24px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}
.series-header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
.series-meta { font-size: 12px; color: var(--text2); }
.series-meta .tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 99px;
  background: var(--bg2);
  color: var(--text2);
  font-size: 11px;
  margin: 0 2px;
}
details {
  margin-bottom: 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg2);
}
summary {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text2);
}
details .toc-list {
  padding: 0 16px 12px;
  list-style: none;
}
details .toc-list li {
  padding: 4px 0;
  font-size: 13px;
}
details .toc-list li a { color: var(--text); }
details .toc-list li a:hover { color: var(--primary); }
.thread-section {
  margin-bottom: 40px;
}
.thread-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 16px;
  font-size: 13px;
}
.thread-nav .current {
  font-weight: 600;
  color: var(--text);
}
.thread-nav .nav-sep {
  color: var(--text3);
}
.thread-header {
  text-align: center;
  padding: 20px 0 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.thread-header h2 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
.thread-header .meta { font-size: 12px; color: var(--text2); }
.response {
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
}
.response:last-child { border-bottom: none; }
.response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 14px;
  color: var(--text2);
}
.response-header .author { font-weight: 500; color: #16a34a; }
.response-header .author.trip { font-weight: 700; }
.response-header .id, .response-header .date { color: var(--text3); }
.response-body {
  font-family: "ＭＳ Ｐゴシック", "MS PGothic", "IPAMonaPGothic", Mona, Monapo, "Saitamaar", "NanumGothicCoding", monospace;
  font-size: 14px;
  line-height: 1.2;
  white-space: pre;
  overflow-x: auto;
}
.footer {
  text-align: center;
  padding: 24px 0;
  font-size: 11px;
  color: var(--text3);
  border-top: 1px solid var(--border);
  margin-top: 40px;
}
`;

function renderResponses(responses: Response[], locale: string): string {
  return responses.map((resp) => {
    const authorName = field(resp.i18n, "authorName", locale);
    const authorId = field(resp.i18n, "authorId", locale);
    const body = field(resp.i18n, "body", locale);

    return `<div class="response">
  <div class="response-header">
    ${resp.sequence != null ? `<span class="seq">${resp.sequence}</span>` : ""}
    ${authorName ? `<span class="author${authorName.includes("◆") ? " trip" : ""}">${esc(authorName)}</span>` : ""}
    ${authorId ? `<span class="id">ID:${esc(authorId)}</span>` : ""}
    ${resp.postedAt ? `<span class="date">${esc(resp.postedAt)}</span>` : ""}
  </div>
  <pre class="response-body">${esc(body)}</pre>
</div>`;
  }).join("\n");
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
${body}
<div class="footer">Exported by LibrAA &mdash; ${new Date().toLocaleDateString()}</div>
</body>
</html>`;
}

export interface HtmlExportFile {
  filename: string;
  content: string;
}

export async function exportSeriesHtml(seriesId: string, locale: string): Promise<HtmlExportFile[]> {
  const allSeries = await getAllSeries();
  const series = allSeries.find((s) => s.id === seriesId);
  if (!series) throw new Error("Series not found");

  const seriesName = field(series.i18n, "name", locale) || "Series";
  const seriesAuthor = field(series.i18n, "author", locale);

  const threads = await getThreads(seriesId);
  const threadData: Array<{ thread: Thread; responses: Response[] }> = [];
  for (const thread of threads) {
    const responses = await getResponses(thread.id);
    threadData.push({ thread, responses });
  }

  const files: HtmlExportFile[] = [];
  const pad = (n: number) => String(n + 1).padStart(String(threadData.length).length, "0");

  // Build shared TOC
  const buildToc = (currentIndex: number) => {
    return `<details>
  <summary>스레드 목록 (${threadData.length})</summary>
  <ol class="toc-list">
    ${threadData.map((td, i) => {
      const tName = field(td.thread.i18n, "name", locale) || `Thread ${i + 1}`;
      if (i === currentIndex) return `<li><strong>${esc(tName)}</strong></li>`;
      return `<li><a href="${pad(i)}.html">${esc(tName)}</a></li>`;
    }).join("\n    ")}
  </ol>
</details>`;
  };

  // Generate each thread file
  for (let i = 0; i < threadData.length; i++) {
    const { thread, responses } = threadData[i];
    const name = field(thread.i18n, "name", locale) || `Thread ${i + 1}`;
    const author = field(thread.i18n, "author", locale);

    const prevFile = i > 0 ? `${pad(i - 1)}.html` : null;
    const nextFile = i < threadData.length - 1 ? `${pad(i + 1)}.html` : null;
    const prevName = i > 0 ? (field(threadData[i - 1].thread.i18n, "name", locale) || `Thread ${i}`) : "";
    const nextName = i < threadData.length - 1 ? (field(threadData[i + 1].thread.i18n, "name", locale) || `Thread ${i + 2}`) : "";

    const navItems: string[] = [];
    if (prevFile) navItems.push(`<a href="${prevFile}">&larr; ${esc(prevName)}</a>`);
    navItems.push(`<span class="current">${esc(name)}</span>`);
    if (nextFile) navItems.push(`<a href="${nextFile}">${esc(nextName)} &rarr;</a>`);
    const nav = `<div class="thread-nav">${navItems.join(`<span class="nav-sep">|</span>`)}</div>`;

    const threadBody = `<div class="series-header">
  <h1>${esc(seriesName)}</h1>
  ${seriesAuthor ? `<div class="series-meta">${esc(seriesAuthor)}</div>` : ""}
  ${series.tags.length > 0 ? `<div class="series-meta" style="margin-top:6px">${series.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</div>` : ""}
</div>
${threadData.length > 1 ? buildToc(i) : ""}
${nav}
<div class="thread-header">
  <h2>${esc(name)}</h2>
  ${author ? `<div class="meta">${esc(author)}</div>` : ""}
</div>
${renderResponses(responses, locale)}
${nav}`;

    files.push({
      filename: `${pad(i)}.html`,
      content: htmlPage(`${seriesName} - ${name}`, threadBody),
    });
  }

  return files;
}

export async function exportThreadHtml(threadId: string, locale: string): Promise<string> {
  const threads = await getThreads(null);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) throw new Error("Thread not found");

  const threadName = field(thread.i18n, "name", locale) || "Thread";
  const author = field(thread.i18n, "author", locale);
  const responses = await getResponses(threadId);

  let body = `<div class="thread-header">
  <h2>${esc(threadName)}</h2>
  ${author ? `<div class="meta">${esc(author)}</div>` : ""}
</div>
${renderResponses(responses, locale)}`;

  return htmlPage(threadName, body);
}
