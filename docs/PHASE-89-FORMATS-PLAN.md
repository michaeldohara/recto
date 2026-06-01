# Recto — Phases 8 & 9: `.docx` + JSON/XML support

**Status:** active queue — targeted for **v0.2.0** (Phase 8 / .docx) and **v0.3.0** (Phase 9 / JSON-XML). v1.0.0 tag when both land.
**Author:** Michael O'Hara + Claude
**Date:** 2026-05-31 *(updated same day: promoted from "held pending v1 launch signal" to active queue — these are core audience needs, not speculative features)*

## Why active rather than held

The earlier "held pending launch signal" stamp confused two distinct cases:

- **Speculative features** (e.g. AI search) — genuinely uncertain whether users want them. Wait-for-signal applies.
- **Known audience needs** (`.docx`, JSON/XML) — the project owner *is* the target audience and has explicitly stated they'll use these daily for their actual job. The signal is the spec.

`.docx` and JSON/XML viewing aren't "would be nice"; they're "I won't reach for Recto over Notepad++ without them." Building them is filling in the audience-defined core, not chasing a hypothesis.

---

## Why combined

Both extensions share the same infrastructure work: extend `loadFile()` in `main.js` to switch behavior on file extension, route to a format-specific renderer. Different content, same router. Doc'ing them together keeps the dispatch design coherent.

Both are gated on the same launch-signal triggers documented at the bottom — no code starts until v1 has had its public moment.

---

## Phase 8 — `.docx` read-only support

### Scope

- Drop or Open a `.docx` file → renders in Rendered or Memo mode
- **Save as Markdown** action — extract markdown from the `.docx`, prompt save dialog
- File association: `.docx` registered with Recto (alongside `.md`)
- Raw mode disabled for `.docx` (it's binary — no useful source view)
- Read-only, period. No editing, no save-back-as-docx.

### Implementation

**Parser: [mammoth.js](https://github.com/mwilliamson/mammoth.js)** (vendored under `src/vendor/`, ~400 KB).

- Pure JS, mature, handles 90%+ of real-world `.docx` (Word, Google Docs export, LibreOffice export)
- Can output **both HTML and markdown** directly — covers our "render" AND "save as md" paths with one library
- Aligns with our "no system dependency for users" identity (vs. Pandoc which would require the user install it themselves)
- Pandoc shell-out remains as a v2 power-user option if anyone asks for tracked-changes / footnote fidelity

**Frontend flow** (in `main.js`):

1. `loadFile(path)` detects extension via existing helper
2. For `.docx`: `invoke('read_docx_bytes', { path })` returns base64-encoded bytes (mammoth needs binary, not text)
3. Frontend decodes base64 → ArrayBuffer → `mammoth.convertToHtml({ arrayBuffer })`
4. Resulting HTML fed into the existing rendering pipeline (`.article` class — current mode applies)
5. Image-rewriting step skipped (mammoth inlines images as base64 in its output)

**Rust side** (`lib.rs`):

- `read_docx_bytes(path) -> Result<String, String>` — reads bytes, base64-encodes for transit across IPC

**Save as Markdown:**

- Menu item appears only when current file is a `.docx`
- `mammoth.convertToMarkdown({ arrayBuffer })` → markdown string
- `invoke('pick_save_path', { defaultName: 'foo.md' })` → save dialog
- `invoke('save_text_file', { path, content })` writes it

**File association:**

- `tauri.conf.json` → `bundle.fileAssociations` adds `.docx` with `text/plain` MIME (or specific docx MIME)

### Edge cases worth flagging now

- **Tracked changes** — mammoth ignores them (renders the "current" view). Acceptable.
- **Comments** — mammoth ignores them by default. Acceptable for a viewer.
- **Embedded images** — mammoth base64-inlines into HTML. Large docs may produce huge HTML strings; cap at ~10MB and warn if exceeded.
- **Password-protected docs** — mammoth errors. Show a friendly "this doc is password-protected" message.
- **Non-`.docx` Word formats** (`.doc` legacy) — mammoth doesn't support; show "convert to .docx first" message.

### Estimate

**~2–3 days.** Bulk is testing mammoth output across real-world `.docx` files (varied Word versions, Google Docs exports, formatting edge cases) and tuning the styling so mammoth's HTML output respects our design tokens.

### Demoable

Drop a `.docx` from email/Google Docs export → renders cleanly in rendered or memo mode. Menu → **Save as Markdown** → produces a clean `.md` file.

---

## Phase 9 — JSON / XML pretty-printing

### Scope

- Drop or Open a `.json` or `.xml` file → renders **pretty-printed + syntax-highlighted** by default
- Raw mode shows the source exactly as stored on disk (may be minified)
- Memo mode disabled (data isn't a document)
- File association: `.json` and `.xml` registered with Recto

### Why this earns its keep

Existing tooling pain (notably called out by primary audience):
- Notepad++ requires plugins (XML Tools, JSTool) that are finicky to install and break across versions
- VS Code opens these as editor files with no folding-by-default and editor chrome
- Online formatters require uploading data — a non-starter for anything sensitive (API responses, configs, payloads)
- "Just open as text" is unreadable for any non-trivial doc

Recto's promise: **drop the file, see it formatted, no setup.**

### Implementation

**JSON:**

- `JSON.stringify(JSON.parse(text), null, 2)` — one line gets pretty-printing
- Render as `<pre><code class="language-json">...</code></pre>` and call `hljs.highlightElement()` (highlight.js is already bundled for code-block highlighting in markdown — `language-json` is in the common-langs subset)
- Parse errors: render the raw text with a small `JSON parse error: <details>` banner above

**XML:**

- Tiny formatter: vendored [`vkbeautify`](https://github.com/vkiryukhin/vkBeautify) (~3 KB) or ~50-line inline implementation
- Same `<pre><code class="language-xml">` + highlight.js pattern
- Malformed XML: render the raw text with `XML parse warning: <details>` banner

**Frontend flow** (in `main.js`):

- `loadFile()` extension dispatch:
  - `.json` → `prettyJson(text)` → highlighted
  - `.xml` → `prettyXml(text)` → highlighted
- Mode handling: rendered mode is the default and most-useful view; raw mode shows as-stored

**Mode availability per file type:**

| File type | Raw | Rendered | Memo |
|---|---|---|---|
| `.md` / `.markdown` / `.mdx` | ✓ | ✓ | ✓ |
| `.docx` | – | ✓ | ✓ |
| `.json` / `.xml` | ✓ | ✓ | – |

Disabled modes appear greyed in the menu; `Ctrl+1/2/3` for an N/A mode is a no-op.

### Estimate

**~1 day.** Smaller than `.docx` because no external library needed (just `JSON.stringify` and a tiny XML formatter). Most of the day goes to file-type routing, error-state banners, and the per-file-type menu greying.

### Demoable

Drop a `.json` API response → see it formatted, indented, color-highlighted. Drop an `.xml` config → same.

---

## Shared infrastructure work

These pieces are common to both phases and only need to be built once:

- **File-extension routing** in `loadFile()` — switch keyed on extension dispatches to format-specific renderers
- **Mode-availability matrix** — menu items disable/grey when current mode doesn't apply to the file type
- **Status-bar adjustments** — "word count" not meaningful for JSON/XML; substitute "lines · chars" for those formats
- **File association config** — extend `tauri.conf.json` `fileAssociations` for all four new extensions in one bundle config update

### Suggested phase order

1. Build the **routing + mode-matrix** infrastructure as Phase 8a (it serves both phases)
2. Phase 8b: `.docx` rendering on top of routing
3. Phase 8c: `.docx` save-as-markdown + file association
4. Phase 9: JSON/XML pretty-printing + file association

Total estimate combined: **~4 days** of focused work once started.

---

## Open questions (defer until we start)

1. **Embedded `.docx` images >10MB** — base64 inline anyway, refuse to render, or stream from a temp file via the asset protocol?
2. **JSON line numbers** — yes for files over ~500 lines, no for short? Or always on / always off?
3. **XML namespaces** — pretty-print as separate lines or fold into element?
4. **Should "Rendered" mode for JSON detect minified-by-default and always pretty-print, vs respecting incoming formatting?** Recommendation: always pretty-print in Rendered, Raw shows as-stored.

---

## Release plan

- **v0.2.0** — Phase 8 ships (.docx read + Save as Markdown)
- **v0.3.0** — Phase 9 ships (JSON / XML pretty-printing)
- **v1.0.0** — tag when 0.3 lands. This is the audience-complete release.

Launch-and-listen discipline still applies — but to *post-1.0* features (AI search, theme marketplace, cloud sync, multi-doc context). Those wait for real signal from users beyond the project owner.
