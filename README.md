# LibrAA

Japanese AA (Ascii Art) works viewer, manager, and translator.

일본 AA(아스키 아트) 작품(야루오 등)을 관리하고 번역할 수 있는 데스크탑 앱 + 브라우저 확장입니다.

## Features

### Desktop App
- **Miller Column Layout** — Series | Threads | Viewer
- **Paste & Parse** — 2ch/5ch thread data
- **Block-based Translation** — Regex detects Japanese text blocks, LLM translates with meaning judgment
- **Multiple LLM Providers** — OpenAI, Google Gemini, Anthropic Claude, Ollama (local)
- **Shift+Click Block Translation** — Hover highlights Japanese blocks, click to translate individually
- **Translation Queue** — Progress bar, ETA, block-level logs, cancel support
- **Batch Block Translation** — Send all blocks in one API call to save quota
- **Multilingual** — Korean, English, Japanese UI with per-field locale support
- **Import/Export** — `.laa` data files for sharing, HTML export with navigation
- **Tag System** — Badge-style input with autocomplete
- **Drag & Drop** — Move threads between series, reorder threads

### Chrome Extension
- **In-page Translation** — Select a container, translate AA text in-place
- **Block Click** — Click any detected Japanese block to translate
- **Toggle Original/Translated** — Click translated text to toggle back to original
- **Highlight Control** — Toggle and customize translation highlight color

## Tech Stack

- **Desktop**: [Tauri v2](https://v2.tauri.app/) (Rust) + React + TypeScript + Vite
- **UI**: Tailwind CSS v4 + Lucide Icons
- **DB**: SQLite (tauri-plugin-sql)
- **Extension**: Chrome Manifest V3

## Install

### Desktop App

Download from [GitHub Releases](https://github.com/tunaground/LibrAA/releases):
- **macOS (Apple Silicon)**: `.dmg`
- **macOS (Intel)**: `.dmg`
- **Windows**: `.msi`

### Chrome Extension

1. Download `LibrAA-Extension-*.zip` from [Releases](https://github.com/tunaground/LibrAA/releases)
2. Extract the zip
3. Go to `chrome://extensions`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

### Build from Source

Requirements: Node.js 22+, Rust 1.77+

```bash
git clone https://github.com/tunaground/LibrAA.git
cd LibrAA
npm install
npm run tauri dev    # Development
npm run tauri build  # Production build
```

## Usage

### Desktop App

1. **Add Data**: Paste 2ch/5ch text or import `.laa` files
2. **Organize**: Create series, drag threads between series
3. **Translate**: Set up LLM provider in Settings, click translate
4. **Export**: `.laa` for data sharing, HTML for reading

### Translation Setup

| Provider | API Key | Best Model | Notes |
|----------|---------|------------|-------|
| OpenAI | Required | gpt-4.1-nano | Cheapest, fast |
| Gemini | Required | gemini-2.5-flash | Free tier available |
| Claude | Required | claude-sonnet-4 | Best quality |
| Ollama | Not needed | gemma4:e4b | Free, local |

### Chrome Extension

1. Click LibrAA extension icon to show toolbar
2. Click ⚙ to configure LLM provider
3. Click "범위 선택" to select a container on the page
4. Click "전체 번역" or click individual blocks
5. Click translated text to toggle original/translated

## Data

- **Database**: SQLite stored in app data directory
- **Settings**: JSON file with API keys (plain text)
- **Location**:
  - macOS: `~/Library/Application Support/net.tunaground.libraa/`
  - Windows: `%APPDATA%/net.tunaground.libraa/`
- **Reset**: Settings > Data Management > Reset Data

## AA Font

The app uses [Saitamaar](https://da1eth.github.io/AA/HeadKasen.woff2) font for AA rendering with [NanumGothicCoding](https://cdn.jsdelivr.net/font-nanum/1.0/nanumgothiccoding/) for Korean text. Both are loaded from CDN.

## License

MIT
