# Recto

A fast, viewer-first Markdown reader for Windows. Open `.md` files from File Explorer, switch between three rendering modes, and export clean PDF or HTML — without the editor chrome of Obsidian, Typora, or VS Code.

The name comes from typography: a *recto* is the right-hand page of an open book — the face you read.

<!-- TODO: hero screenshot here — rendered mode with a real doc loaded -->

## Why another Markdown viewer?

Most Markdown tools are *editors that happen to render*. Recto is the opposite: a viewer-only tool that opens fast, renders well, and prints beautifully. Three view modes mean the same source can be read as raw text, as a GitHub-style document, or as a printable memo — depending on what you need.

## Features

- **Three view modes** — `Raw` (monospace source), `Rendered` (GitHub-flavored sans), `Memo` (serif page, sized for print)
- **Table of contents** drawer that auto-builds when a doc has 3+ headings
- **Open via** drag-drop, `File → Open…`, or double-click an associated `.md` from File Explorer
- **Export** to PDF (via OS print dialog) or self-contained HTML (with images base64-embedded)
- **Reading-position memory** — close a file, reopen, lands where you left off
- **Recent files** in the empty state, one click to reopen
- **Native** custom titlebar with Windows 11 Snap Layouts on the maximize button
- **Light / dark** via system preference
- Vendored fonts: Newsreader, Hanken Grotesk, IBM Plex Mono — no CDN, fast launch

## Install

### Windows installer (recommended)

Download the latest installer from the [Releases page](https://github.com/michaeldohara/recto/releases). It registers Recto as the default opener for `.md`, `.markdown`, and `.mdx` (your choice on first launch).

### Portable

A standalone `recto.exe` is also attached to each release — no install, no registry entries. Drop it anywhere and run.

### Via WinGet *(coming in v1.1)*

```powershell
winget install michaeldohara.recto
```

## Keyboard shortcuts

| Action | Keys |
|---|---|
| Open file | `Ctrl + O` |
| Raw mode | `Ctrl + 1` |
| Rendered mode | `Ctrl + 2` |
| Memo mode | `Ctrl + 3` |
| Toggle table of contents | `Ctrl + \` |
| Export PDF | `Ctrl + P` |
| Page down / up | `J` / `K` |

## Build from source

Requires Node.js LTS, Rust toolchain (`rustup default stable`), and Microsoft C++ Build Tools.

```powershell
pnpm install
pnpm tauri dev      # run in dev mode
pnpm tauri build    # produce NSIS installer + portable .exe
```

Artifacts land in `src-tauri/target/release/bundle/`:
- `nsis/Recto_<version>_x64-setup.exe` — installer
- `recto.exe` — portable binary

## Tech

[Tauri 2.x](https://tauri.app) + vanilla HTML/CSS/JS — small binary (~10 MB), native system WebView (Edge WebView2 on Windows), no Chromium bundled, no build chain.

Frontend renders Markdown with [markdown-it](https://github.com/markdown-it/markdown-it) (vendored locally). Custom titlebar via [tauri-plugin-decorum](https://github.com/clearlysid/tauri-plugin-decorum) so Win11 Snap Layouts work on the maximize button.

Brand design system in [`docs/design/`](docs/design/). Phase plan + decisions in [`docs/PLANNING.md`](docs/PLANNING.md).

## License

[MIT](LICENSE)
