# Recto

A fast, viewer-first Markdown reader for Windows. Open `.md` files from File Explorer, switch between three rendering modes (raw / rendered / memo), and export clean PDF or HTML — without the editor chrome of Obsidian, Typora, or VS Code.

**Status:** pre-release (Phase 0 — scaffold). Not yet usable.

## Why another Markdown viewer?

Most Markdown tools are *editors that happen to render*. Recto is the opposite: a viewer-only tool that opens fast, renders well, and prints beautifully. Three view modes mean the same source can be read as raw text, as a GitHub-style document, or as a printable memo — depending on what you need.

The name comes from typography: a *recto* is the right-hand page of an open book — the face you read.

## Tech

Tauri 2.x + vanilla HTML/CSS/JS — small binary, native system WebView, no Chromium bundled. Cross-platform-capable but Windows is the v1 target.

## Build from source

Requires Node.js LTS, Rust toolchain (`rustup default stable`), and Microsoft C++ Build Tools.

```powershell
pnpm install
pnpm tauri dev    # run in dev mode
pnpm tauri build  # produce NSIS installer + portable .exe
```

## Planning

Design rationale, scope decisions, and phase plan live in [`docs/PLANNING.md`](docs/PLANNING.md). Logo and visual identity exploration in [`docs/design/`](docs/design/).

## License

[MIT](LICENSE)
