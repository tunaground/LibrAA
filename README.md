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

### Safari Extension (macOS)

1. Download `LibrAA-Safari-Extension-*.zip` from [Releases](https://github.com/tunaground/LibrAA/releases)
2. Extract the zip
3. Move `LibrAA Translator.app` to Applications
4. Run the app once
5. Safari > 설정 > 고급 > **"웹 개발자용 기능 보기"** 활성화
6. Safari > 개발 > **"서명되지 않은 확장 허용"** 활성화
7. Safari > 설정 > 확장에서 **LibrAA Translator** 활성화

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
| Ollama | Not needed | qwen3:4b | Free, local |

#### Ollama Setup

Ollama를 사용하려면 먼저 [Ollama](https://ollama.com/)를 설치하고 모델을 다운로드합니다.

```bash
ollama pull qwen3:4b
```

Chrome 확장에서 사용할 경우, CORS 허용이 필요합니다.

**macOS (Ollama 앱 사용 시):**
```bash
launchctl setenv OLLAMA_ORIGINS "*"
# Ollama 앱 재시작
```

**macOS (터미널에서 직접 실행):**
```bash
OLLAMA_ORIGINS="*" ollama serve
```

**Windows (시스템 환경변수 설정):**
1. 시스템 환경변수에 `OLLAMA_ORIGINS` = `*` 추가
   - 설정 > 시스템 > 정보 > 고급 시스템 설정 > 환경 변수
2. Ollama 재시작

또는 PowerShell에서:
```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```

추천 모델:
| 모델 | 크기 | 특징 |
|------|------|------|
| qwen3:4b | 3GB | 빠르고 일본어 번역 품질 좋음 |
| gemma3:12b | 8GB | 느리지만 품질 우수 |
| gemma4:e4b | 큼 | 높은 품질, 느림 |

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
