# Recto — v1 planning doc

**Status:** draft for review
**Author:** Michael O'Hara
**Date:** 2026-05-28
**Name:** Recto (locked in 2026-05-28 — typography term for the right-hand page of an open book; paired conceptually with `verso`, the left-hand page)

---

## The gap this fills

The MD-tool space is crowded with **editors that happen to render** (MarkText, Typora, Obsidian, Joplin, Zettlr, VS Code preview). Almost none of them are **viewer-first**: fast open from File Explorer, no editor chrome, no plugins, no sync, no project sidebar — just "show me the file, nicely, and let me print it." The slice that's genuinely thin:

- **Viewer-only**, with double-click-from-Explorer as the headline workflow
- **Multiple rendering audiences** for the same source (raw / rendered / memo) — most viewers ship one look
- **Print-first PDF export** that actually paginates well — most viewers' PDF output is screen-grab quality

That's the gap. It's also exactly what I'd use daily for reading planning docs, carrier proposal drafts, and other people's `README.md` files without opening a full editor.

## What it is, in one sentence

A single-window Windows app that opens `.md` files from File Explorer, renders them in one of three view modes (raw / rendered / memo), and exports clean PDF or HTML.

## Format scope

Recto reads **text-bearing documents that technical professionals encounter daily**. The principle, not a wish-list — every format proposal gets evaluated against this frame.

| Format | When supported |
|---|---|
| Markdown (`.md` / `.markdown` / `.mdx`) | v0.1.0 (shipped) |
| Word documents (`.docx`) | **v0.2.0** — Phase 8 (active queue — see [`PHASE-89-FORMATS-PLAN.md`](PHASE-89-FORMATS-PLAN.md)) |
| JSON (`.json`) | **v0.3.0** — Phase 9 |
| XML (`.xml`) | **v0.3.0** — Phase 9 |

**v1.0.0** is tagged when all four formats are in the box. That's the audience-complete release.

The same three view modes apply across formats. **"Rendered" mode universally means *"the most readable form of this file"*** — GitHub-styled HTML for Markdown, mammoth output for `.docx`, pretty-printed + syntax-highlighted source for JSON/XML. Modes that don't apply to a file type (e.g. Memo for JSON, Raw for `.docx`) are disabled in the menu.

### Explicitly out of scope

(With one-line rationale per exclusion, so we don't re-litigate.)

- **PDF** — completely different problem space (fonts, vectors, scanned-image OCR). Dedicated viewer ecosystem already exists.
- **YAML / TOML / INI** — niche enough that JSON + XML cover the 80% inspection case.
- **CSV / TSV** — spreadsheet workflow, different mental model.
- **EPUB** — long-form ebook reading is a different use case (Calibre etc.).
- **RTF / `.doc` legacy** — minimal demand; convert via Pandoc if needed.
- **Source code files (`.js` / `.py` / `.rs` / etc.)** — IDE territory, not a reading workflow.

Future requests to add format X get measured against the principle. If "text-bearing document a technical professional encounters daily" → consider. Otherwise → polite decline.

## v1 scope

### In — core
- Open `.md` file via:
  - Double-click from File Explorer (file association registered by installer)
  - Drag-drop onto window (dropping a different file replaces current)
  - `File → Open…` dialog
- Three view modes, toggled with `Ctrl+1/2/3`:
  - **Raw** — monospace, no rendering
  - **Rendered** — GitHub-flavored CSS
  - **Memo** — fixed-width body, serif, header block (filename + date + author), print-aware
- Export current view to:
  - **PDF** (via `window.print()` → OS print dialog; on Windows the user picks "Microsoft Print to PDF")
  - **HTML** (self-contained, inlined CSS)
- Recent files list (last 10)
- Remember last view mode + last folder across sessions
- Light/dark toggle (auto-follows Windows theme is fine)

### In — copied-from-the-best (cheap upgrades that earn their keep)

Audit of MarkText / Typora / Obsidian / VS Code preview / GitHub turned up these as the high-value-low-cost wins. All fit in roughly a day of work and don't drift toward "editor."

- **Syntax-highlighted code blocks** — bundle highlight.js (common-langs subset). Single biggest "looks pro" upgrade.
- **Copy-button on code blocks** — GitHub-style overlay, one JS handler.
- **Find in document (`Ctrl+F`)** — custom in-page find overlay (system WebView doesn't expose a built-in find bar to embed).
- **Auto table of contents** — collapsible sidebar built from headings, `Ctrl+\` to toggle. Hidden by default; appears when doc has 3+ headings.
- **Relative-path image rendering** — use Tauri's `convertFileSrc` so relative `![](images/foo.png)` paths in the MD resolve against the loaded file's folder via the `asset:` protocol.
- **Heading anchor links** — hover heading → `#` appears → click copies a deep link to clipboard.
- **Open-recent landing view** — empty-launch shows recent files instead of a blank window.
- **Reading-position memory** — re-open a file, scroll back to where you left off. Keyed on file path.
- **Status bar: word count + reading time** — see [Status bar spec](#status-bar-spec) below.

### Out (v1 — explicitly skipped)
- Editing of any kind
- Live-reload / file watching
- Multi-tab / multi-window
- Plugins, themes beyond light/dark, custom CSS
- DOCX export (Pandoc shell-out is a v2 one-liner if I actually need it)
- Cloud sync, settings sync
- Linux/Mac support
- Custom MD extensions beyond what markdown-it ships with (tables, fenced code, task lists — those come free)

### Won't ever do (scope guard)
- Become an editor
- Become a knowledge base / wiki / notes app
- Ship a plugin system
- Wiki-style `[[links]]`, file tree sidebar, multi-tab, mobile, Linux/Mac
- Mermaid / KaTeX / other heavy renderer extensions (revisit only if I miss them personally)

## Status bar spec

Thin bar pinned to the bottom of the window (`<footer>` element in `index.html`). Always visible in all three view modes. Updates whenever the loaded file changes.

**Contents (left → right):**
- Filename (truncated with ellipsis if too long; full path in tooltip)
- `•` separator
- **Word count** — count of whitespace-separated tokens in the *rendered text content* (i.e. after markdown parsing, so syntax characters like `#`, `*`, `>`, `-` aren't counted; URLs in `[text](url)` count `text` only). Code blocks are included but tracked separately in tooltip.
- `•` separator
- **Reading time** — `max(1, ceil(words / 200))` minutes. Format: `3 min read` or `< 1 min read` for very short docs.
- Right-aligned: current view mode label (`Raw` / `Rendered` / `Memo`) so the mode is always visible

**Tooltip on the word count** shows the breakdown: total words, prose words, code-block words, character count. One-line hover, not a popup.

**Implementation:** computed once on file load by a small JS function (`computeStats(rendered)` in `main.js`); the result updates the footer DOM directly. No IPC round-trip needed — purely frontend. No recomputation on view-mode switch (same source, same numbers).

**Why it's worth its keep:** for memo mode it answers "is this doc the right length for what I'm sending?" without scrolling; for any mode it's a fast scan of "how much is here." Costs ~30 lines of JS + the `<footer>` markup in `index.html`.

## The three view modes, concretely

| Mode     | CSS file        | Use case                                          |
|----------|-----------------|---------------------------------------------------|
| Raw      | `raw.css`       | "Just show me the source" — copy-paste, debugging |
| Rendered | `rendered.css`  | Daily reading — GitHub-style                      |
| Memo     | `memo.css`      | Print / share — looks like a real document        |

Same HTML container, same parsed output, different stylesheet swapped in. The mode toggle is a single `setAttribute('data-mode', mode)` on `<body>` and the stylesheets gate on that attribute (`body[data-mode="memo"] .doc { … }`).

**Memo mode** is the differentiator. Requirements:
- ~6.5" body width, serif body font, 11pt
- Top-of-page header block: filename, today's date, "Michael O'Hara"
- `@page` rules so PDF export paginates cleanly (page numbers in footer, no orphaned headings)
- This is the mode that makes the tool worth using over `glow` or VS Code preview

## Tech stack

- **Tauri 2.x** (Rust shell + system WebView) for the app shell
- **Vanilla HTML / CSS / JS** for the UI — no React, Svelte, or build chain
- **markdown-it** (bundled, no CDN) for parsing
- **highlight.js** (common-langs subset, bundled) for code blocks
- **github-markdown-css** (MIT, single file) as the base for rendered mode
- No other runtime deps

**Why this stack (and why it's defensible to anyone reading the repo):**

This app is fundamentally "WebView + a thin native shell" — file dialogs, drag-drop, window chrome, file association, installer. That's literally Tauri's reason to exist; choosing it isn't being trendy, it's matching tool to problem.

- **~5–10 MB binaries** vs 70+ MB for .NET single-file or 150+ MB for Electron. Matches the "no bloat" identity of the tool itself.
- **Native system WebView** (Edge WebView2 on Windows) — same rendering engine the .NET option would have used, no bundled Chromium.
- **Tauri's bundler ships installer + portable + file-association registration** out of the box; no separate Inno Setup file needed.
- **All the substantive work (markdown parsing, view-mode CSS, TOC, syntax highlight, copy-button, word-count, reading-position) is JS** — same code regardless of shell, and the shell stays out of the way.
- **Vanilla JS, no framework, no build chain** — earns its keep on an app this small; keeps "lightweight" honest.
- **Rust footprint is shallow** — window setup, IPC handlers, file-system access via `tauri-plugin-fs`/`tauri-plugin-dialog`. Probably <200 lines of Rust total.
- **Cross-platform is free** even though v1 commits to Windows-only — stops foreclosing the option.

**Trade-off acknowledged:** PDF export is less elegant than WebView2's `PrintToPdfAsync`. v1 uses `window.print()` → the OS print dialog (which on Windows offers "Microsoft Print to PDF" out of the box — feels native, one extra click). Silent PDF export via WebView CDP is a v1.1 candidate.

## Repo layout

Standard Tauri 2.x layout — `src/` is the frontend (HTML/CSS/JS), `src-tauri/` is the Rust shell. Tauri's bundler reads `tauri.conf.json` for file association, installer config, and bundle identifiers.

```
recto/
  docs/
    PLANNING.md            ← this file
    DECISIONS.md           ← anything non-obvious I commit to later
  src/                     ← frontend (loaded by the WebView)
    index.html             ← single-page shell
    main.js                ← IPC, mode switching, TOC, status bar
    markdown.js            ← markdown-it wiring, highlight.js, anchors, copy-code
    state.js               ← recent files, reading-position, last-mode (via tauri-plugin-store)
    styles/
      app.css              ← window chrome, status bar, TOC sidebar
      raw.css
      rendered.css
      memo.css
    vendor/
      markdown-it.min.js
      highlight.min.js
      github-markdown.css
  src-tauri/               ← Rust shell
    Cargo.toml
    tauri.conf.json        ← bundler config: file association, installer, icons
    build.rs
    src/
      main.rs              ← window, IPC commands
      commands.rs          ← file open, recent-files store ops
    icons/
    capabilities/          ← Tauri 2 permission model
      default.json
  .editorconfig
  .gitignore
  LICENSE                  ← MIT
  README.md
  package.json             ← dev scripts only (no framework deps)
```

Follows Tauri's standard layout so anyone familiar with the framework can navigate it.

## Phases

Seven small phases, each ending in a **demoable artifact**. ~6 days of part-time work total. Each phase = one short-lived branch + PR-to-self for clean history.

### Phase 0 — Scaffold & first commit (≈ 1 day)
- Install Rust toolchain + Tauri prereqs (one-time): `rustup`, Microsoft C++ Build Tools, Node.js LTS
- `cargo install create-tauri-app` → `cargo create-tauri-app` (vanilla JS template, no framework)
- Reshape into the repo layout above; `git init`; per-repo identity (noreply email)
- `.gitignore` (Tauri template's + Rust's `target/`), LICENSE (MIT), minimal README
- First commit → set personal account scoped to this terminal only (`$env:GH_TOKEN = (gh auth token --user michaeldohara)`) — avoids global `gh auth switch` that would impact other running terminals → `gh repo create michaeldohara/recto --public --source=. --push`
- Set GH "About" (description + topics: `markdown`, `viewer`, `tauri`, `rust`, `windows`)
- **Demoable:** repo URL works; `pnpm tauri dev` opens an empty Tauri window.

### Phase 1 — Render anything (≈ 1 day)
- Add `tauri-plugin-fs` + `tauri-plugin-dialog` for file open
- Drag-drop via Tauri's `onDragDropEvent` + `File → Open…` menu
- Bundle `markdown-it` + `github-markdown-css` under `src/vendor/`
- Render with `rendered.css` only
- **Demoable:** drop an `.md` on the window → renders with GitHub styling.

### Phase 2 — Three view modes + image paths (≈ ½ day)
- Add `raw.css` + `memo.css`
- `Ctrl+1/2/3` swap stylesheet via JS
- Use Tauri's `convertFileSrc` to serve relative images from the loaded file's folder via the `asset:` protocol (configured in `tauri.conf.json`)
- Memo mode `@page` rules
- **Demoable:** cycle a real doc through raw → rendered → memo; relative images load.

### Phase 3 — Reading polish (≈ 1½ days)
- highlight.js (common-langs subset) on code blocks
- Copy-button overlay on code blocks
- Heading anchors (`#` on hover → clipboard)
- Auto-TOC sidebar (`Ctrl+\` toggle, hidden default, shown if ≥3 headings)
- Status bar per the spec above
- **Demoable:** a real planning doc looks pro; word count + TOC + code copy all working.

### Phase 4 — File workflow & state (≈ 1 day)
- Recent files (top 10) in `File` menu — persisted via `tauri-plugin-store`
- Empty-launch landing = recent files list
- Reading-position memory (scroll % per file path)
- Last view mode + last folder persisted
- `Ctrl+F` → custom in-page find (small JS overlay; system WebView doesn't expose a built-in find bar to embed)
- **Demoable:** close & reopen → lands where you left off.

### Phase 5 — Export (≈ ½ day)
- `Ctrl+P` / `File → Export PDF…` → `window.print()` → user picks "Microsoft Print to PDF" from OS dialog
- `File → Export HTML…` → self-contained file with inlined CSS (Rust-side `fs::write`)
- Verify memo-mode PDF paginates cleanly via the OS print path
- **Demoable:** multi-page memo → clean PDF.

### Phase 6 — Distribution (≈ ½ day)
- Configure `tauri.conf.json` bundle section: app name, identifier, icons, file association (`.md`), NSIS installer target
- `pnpm tauri build` → produces NSIS installer + portable `.exe` in one command
- Smoke-test on clean profile: install → double-click `.md` → opens
- README screenshots of each view mode
- `gh release create v0.1.0` with installer + portable attached
- **Demoable:** clean machine → install → double-click `.md` → ✅.

## Done criteria for v1

v1 release tag goes out when every phase's "demoable" works on a fresh Win11 box.

## v1.1 / v2 backlog (not a commitment — just a parking lot)

**v1.1 (small, soon-after-v1):**
- WinGet manifest submission to [winget-pkgs](https://github.com/microsoft/winget-pkgs)
- Silent PDF export via WebView CDP (skip the OS print dialog)
- Theme-folder discovery (`%APPDATA%\recto\themes\*.css` → `View → Theme` menu)
- macOS / Linux builds (free with Tauri — turn on only if there's actual demand)

**v2 (further out):**
- DOCX export via Pandoc shell-out
- File-watch / live reload (toggleable)
- Print directly (skip the PDF intermediate)
- "Slide" view mode (split on `---`)
- "Outline" view mode (collapsible heading tree)
- Diff mode (side-by-side render of two MD files)
- Drop-target shell extension ("Send to → recto")

## First-public-repo overhead (do once, before first commit)

This is my first public repo, so this section captures the setup so I don't redo the thinking.

**Identity hygiene — must-do before first commit** (gh account-switching is already routine; this is the personal-repo-specific bit):
- Switch `gh` active account to personal before `gh repo create` (or scope per-session via `$env:GH_TOKEN` — the route we used to avoid impacting other terminals)
- Per-repo git identity override so the global work identity doesn't leak (run inside the recto folder after `git init`):
  ```powershell
  git config user.name "Michael O'Hara"
  git config user.email "31449199+michaeldohara@users.noreply.github.com"
  ```
- Confirm noreply email is enabled on the personal account (GitHub → Settings → Emails → "Keep my email addresses private" + "Block command line pushes that expose my email")

**Repo creation:**
- `git init` + scaffolded Tauri project + LICENSE (MIT) + README.md → first commit
- `$env:GH_TOKEN = (gh auth token --user michaeldohara)` (session-scoped) → `gh repo create michaeldohara/recto --public --source=. --remote=origin --push`
- Set GitHub "About" panel: description + topics (`markdown`, `viewer`, `tauri`, `rust`, `windows`)

**Skip for v1 (cargo-cult overhead):**
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- Issue/PR templates
- Branch protection on `main`
- Dependabot / CodeQL / Actions
- Release automation (`gh release create v0.1.0` by hand is fine)

## Decisions locked in

1. ~~Working name~~ — ship as `recto`, rebrand long-term. ✅
2. **License: MIT.** Single LICENSE at repo root, no per-file headers. ✅
3. **Installer + portable in v1 (both — Tauri's bundler produces them in one build); winget manifest in v1.1.** Installer registers the `.md` file association and Start Menu entry; portable is a free byproduct. ✅
4. **Everlong-branded CSS stays out of the public repo entirely.** v1 ships three baked-in modes (raw / rendered / memo); for v1 personal use, the Everlong variant lives only in my local checkout. v1.1 adds theme-folder discovery from `%APPDATA%\recto\themes\*.css` so anyone (including me) can drop in custom stylesheets without forking. ✅
