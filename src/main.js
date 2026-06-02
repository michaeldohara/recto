// ============================================================
// recto — main viewer logic
//
// Adapted from the designer's recto-viewer.js for Tauri:
//   - File I/O via Rust commands (open_file_dialog, read_markdown_file,
//     read_docx_bytes, save_html_file, pick_save_path)
//   - Drag-drop via Tauri's onDragDropEvent (real OS file paths)
//   - Parsers: markdown-it (vendored UMD) for .md;
//     mammoth.js (vendored UMD) for .docx
//   - No npm imports, no build chain — vanilla per PLANNING.md
//
// File-type dispatch (Phase 8+):
//   FILE_TYPES describes which view modes apply per file type, the
//   default mode, and a render(state, mode) producer per type.
//   loadFile() dispatches on extension; render() pulls the right
//   producer; menu items grey themselves via syncMenuModes().
// ============================================================

(function () {
  "use strict";

  // ── Console hygiene ──────────────────────────────────────────
  // tauri-plugin-decorum logs "DECORUM: Controls already exist.
  // Skipping creation." every load because we also call
  // create_overlay_titlebar() from Rust setup (the call we actually
  // need for Win11 Snap Layouts). The dupe log is harmless but
  // clutters DevTools — drop it before anything else runs.
  const _origLog = console.log;
  console.log = function (...args) {
    if (typeof args[0] === 'string' && args[0].startsWith('DECORUM:')) return;
    return _origLog.apply(console, args);
  };

  const $ = (s, r = document) => r.querySelector(s);
  const { invoke, convertFileSrc } = window.__TAURI__.core;
  const { getCurrentWebview } = window.__TAURI__.webview;

  // ── Parser (markdown) ────────────────────────────────────────
  const md = window.markdownit({
    html: false,
    linkify: true,
    typographer: false,
    breaks: false,
  });

  // ── State ────────────────────────────────────────────────────
  const root = document.documentElement;
  const STATE = {
    content: '',        // raw text source (markdown) — empty for binary types
    html: null,         // pre-rendered HTML — populated for .docx
    docxBuffer: null,   // ArrayBuffer kept for "Save as Markdown" round-trip
    path: '',           // absolute path of currently loaded file
    fileType: 'markdown', // 'markdown' | 'docx'
    mode: 'rendered',   // 'raw' | 'rendered' | 'memo'
  };

  // Persisted across launches (Rust: load_app_state / save_app_state)
  const appState = {
    lastMode: 'rendered',
    recents: [],
    scrollPositions: {},
    setDefaultPromptDismissed: false,
  };

  root.classList.add('no-anim');

  // ── DOM refs ─────────────────────────────────────────────────
  const win       = $('#win');
  const content   = $('#content');
  const empty     = $('#empty');
  const menu      = $('#menu');
  const tocCheck  = $('#tocCheck');
  const tocList   = $('#tocList');
  const veil      = $('#dropVeil');
  const stFile    = $('#stFile');
  const stWords   = $('#stWords');
  const stRead    = $('#stRead');
  const stMode    = $('#stMode');

  let headings = [];
  let hasToc = false;
  let tocOpen = false;

  // ── Helpers ──────────────────────────────────────────────────
  function dirname(p) {
    if (!p) return '';
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    return i >= 0 ? p.slice(0, i) : '';
  }
  function basename(p) { return p ? (p.split(/[\\/]/).pop() || p) : ''; }
  function extOf(p) {
    const b = basename(p);
    const i = b.lastIndexOf('.');
    return i > 0 ? b.slice(i + 1).toLowerCase() : '';
  }
  function resolveRelative(dir, rel) {
    const back = dir.includes('\\');
    const sep = back ? '\\' : '/';
    const norm = back ? rel.replace(/\//g, '\\') : rel.replace(/\\/g, '/');
    return dir + sep + norm;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }
  function slug(t) {
    return t.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function hasContent() { return !!(STATE.content || STATE.html); }

  // Decode base64 string → Uint8Array (used for .docx bytes from Rust)
  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // ── Persistent state ─────────────────────────────────────────
  async function loadState() {
    try {
      const s = await invoke('load_app_state');
      if (s && typeof s === 'object') {
        if (['raw', 'rendered', 'memo'].includes(s.lastMode)) appState.lastMode = s.lastMode;
        if (Array.isArray(s.recents)) appState.recents = s.recents.filter((p) => typeof p === 'string').slice(0, 10);
        if (s.scrollPositions && typeof s.scrollPositions === 'object') appState.scrollPositions = s.scrollPositions;
        if (typeof s.setDefaultPromptDismissed === 'boolean') appState.setDefaultPromptDismissed = s.setDefaultPromptDismissed;
      }
    } catch (e) { console.warn('load_app_state failed:', e); }
  }
  let saveTimer = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      try { await invoke('save_app_state', { state: appState }); }
      catch (e) { console.warn('save_app_state failed:', e); }
    }, 300);
  }

  // ── Image-path rewriting (markdown only) ─────────────────────
  function rewriteImagePaths(html, fileDir) {
    if (!fileDir) return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.body.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (!src) return;
      if (/^(https?:|data:|file:|asset:|tauri:)/i.test(src)) return;
      if (/^[a-z]:[/\\]/i.test(src)) return;
      if (src.startsWith('/')) return;
      img.setAttribute('src', convertFileSrc(resolveRelative(fileDir, src)));
    });
    return doc.body.innerHTML;
  }

  // ── Word count helpers ───────────────────────────────────────
  // For markdown: strip syntax before counting
  function wordCountMarkdown(text) {
    return text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/^[#>\-*+]\s+/gm, '')
      .replace(/[*_~|]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .length;
  }
  // For HTML-source files (.docx): count words in text content
  function wordCountFromHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || '').split(/\s+/).filter(Boolean).length;
  }

  // ── Pretty-printers for JSON / XML ───────────────────────────
  function prettyJson(text) {
    return JSON.stringify(JSON.parse(text), null, 2);
  }

  // Small inline XML formatter — handles the 80% case (config files,
  // API responses, RSS, SOAP). Not a full parser; doesn't preserve
  // mixed-content whitespace perfectly. Tolerable for a viewer.
  function prettyXml(xml) {
    const trimmed = xml.trim();
    // Force linebreaks between tags
    const between = trimmed.replace(/>\s*</g, '>\n<');
    const lines = between.split('\n');
    const indentUnit = '  ';
    let depth = 0;
    const out = [];
    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // Closing tags: decrement first
      const isClose = /^<\//.test(line);
      // Self-closing or single-line element with both open + close + content
      const isSelfClose = /\/>\s*$/.test(line) || /^<\?/.test(line) || /^<!--/.test(line) || /^<!\[CDATA\[/.test(line) || /^<!DOCTYPE/i.test(line);
      const isFullElement = /^<([a-zA-Z][\w:-]*)([^>]*[^/])?>.*<\/\1>$/.test(line);

      if (isClose) depth = Math.max(0, depth - 1);
      out.push(indentUnit.repeat(depth) + line);
      // Opening tag (not self-close, not full single-line element, not close): increment
      if (!isClose && !isSelfClose && !isFullElement && /^<[^!?]/.test(line)) depth++;
    }
    return out.join('\n');
  }

  // ── File-type dispatch table ─────────────────────────────────
  // Adding Phase 9 formats (json/xml) means adding entries here.
  function memoPage(state, html) {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const fileDir = dirname(state.path);
    const dir = fileDir || '—';
    return `<div class="memo-page">` +
      `<div class="letterhead">` +
        `<div class="lh-left">` +
          `<span class="lh-file">${escapeHtml(basename(state.path))}</span>` +
          `<span class="lh-meta">${escapeHtml(dir)}</span>` +
        `</div>` +
        `<div class="lh-right">` +
          `<span class="lh-date">${escapeHtml(today)}</span>` +
          `<span class="lh-by">recto</span>` +
        `</div>` +
      `</div>` +
      `<article class="article memo">${html}</article>` +
    `</div>`;
  }
  // Build a syntax-highlighted code block. The .hljs class triggers
  // the github/github-dark theme; .data-view wraps with our paper bg.
  function highlightedBlock(language, source) {
    return `<div class="data-view"><pre class="data-pre"><code class="language-${language} hljs">${escapeHtml(source)}</code></pre></div>`;
  }
  function parseErrorBlock(label, message, source) {
    return `<div class="data-error"><span class="data-error-label">${escapeHtml(label)} parse error:</span> ${escapeHtml(message)}</div>` +
           `<pre class="raw">${escapeHtml(source)}</pre>`;
  }

  const FILE_TYPES = {
    markdown: {
      canRaw: true, canRendered: true, canMemo: true,
      defaultMode: 'rendered',
      render(state, mode) {
        const fileDir = dirname(state.path);
        if (mode === 'raw') return `<pre class="raw">${escapeHtml(state.content)}</pre>`;
        const html = rewriteImagePaths(md.render(state.content), fileDir);
        if (mode === 'memo') return memoPage(state, html);
        return `<article class="article">${html}</article>`;
      },
      metricText(state) {
        const w = wordCountMarkdown(state.content);
        return `${w.toLocaleString()} words`;
      },
      readingTimeText(state) {
        const w = wordCountMarkdown(state.content);
        return Math.max(1, Math.round(w / 230)) + ' min read';
      },
    },
    docx: {
      // .docx is binary — no useful source view, so Raw is disabled.
      canRaw: false, canRendered: true, canMemo: true,
      defaultMode: 'rendered',
      render(state, mode) {
        const html = state.html || '';
        if (mode === 'memo') return memoPage(state, html);
        return `<article class="article">${html}</article>`;
      },
      metricText(state) {
        const w = wordCountFromHtml(state.html || '');
        return `${w.toLocaleString()} words`;
      },
      readingTimeText(state) {
        const w = wordCountFromHtml(state.html || '');
        return Math.max(1, Math.round(w / 230)) + ' min read';
      },
    },
    json: {
      // Data files: Raw = source as-stored. Rendered = pretty + highlighted.
      // Memo doesn't apply (not a document).
      canRaw: true, canRendered: true, canMemo: false,
      defaultMode: 'rendered',
      render(state, mode) {
        if (mode === 'raw') return `<pre class="raw">${escapeHtml(state.content)}</pre>`;
        try {
          return highlightedBlock('json', prettyJson(state.content));
        } catch (e) {
          return parseErrorBlock('JSON', e.message || String(e), state.content);
        }
      },
      metricText(state) {
        const lines = (state.content.match(/\n/g) || []).length + 1;
        return `${lines.toLocaleString()} lines · ${state.content.length.toLocaleString()} chars`;
      },
      readingTimeText() { return '—'; },
    },
    xml: {
      canRaw: true, canRendered: true, canMemo: false,
      defaultMode: 'rendered',
      render(state, mode) {
        if (mode === 'raw') return `<pre class="raw">${escapeHtml(state.content)}</pre>`;
        try {
          return highlightedBlock('xml', prettyXml(state.content));
        } catch (e) {
          return parseErrorBlock('XML', e.message || String(e), state.content);
        }
      },
      metricText(state) {
        const lines = (state.content.match(/\n/g) || []).length + 1;
        return `${lines.toLocaleString()} lines · ${state.content.length.toLocaleString()} chars`;
      },
      readingTimeText() { return '—'; },
    },
  };
  function detectFileType(path) {
    const e = extOf(path);
    if (e === 'docx') return 'docx';
    if (e === 'json') return 'json';
    if (e === 'xml' || e === 'xsd' || e === 'xsl' || e === 'xslt' || e === 'svg' || e === 'rss' || e === 'atom') return 'xml';
    return 'markdown';
  }
  function modeAvailable(fileType, mode) {
    const t = FILE_TYPES[fileType] || FILE_TYPES.markdown;
    return Boolean(t[`can${capitalize(mode)}`]);
  }

  // ── Render ───────────────────────────────────────────────────
  function render() {
    if (!hasContent()) {
      showEmpty(true);
      return;
    }
    showEmpty(false);

    const typeDef = FILE_TYPES[STATE.fileType] || FILE_TYPES.markdown;

    // If current mode isn't supported for this file type, fall back.
    // setMode() will re-call render() once it switches.
    if (!modeAvailable(STATE.fileType, STATE.mode)) {
      setMode(typeDef.defaultMode);
      return;
    }

    content.innerHTML = typeDef.render(STATE, STATE.mode);

    // Apply syntax highlighting to any hljs code blocks we just inserted
    // (JSON/XML rendered blocks. Markdown code blocks intentionally left
    // un-highlighted in v0.3.0 — their dark-on-cream styling is the design.)
    if (window.hljs) {
      content.querySelectorAll('pre code.hljs').forEach((el) => {
        try { window.hljs.highlightElement(el); }
        catch (e) { /* tolerate — fall back to escaped source */ }
      });
    }

    // Tag headings for TOC (only meaningful in non-raw modes for prose docs)
    if (STATE.mode !== 'raw' && (STATE.fileType === 'markdown' || STATE.fileType === 'docx')) tagHeadings();
    else headings = [];

    content.scrollTop = 0;
    buildToc();
    updateStatus();
  }

  function tagHeadings() {
    headings = [...content.querySelectorAll('h2, h3')];
    const seen = {};
    headings.forEach((h) => {
      let id = slug(h.textContent);
      if (seen[id] != null) id += '-' + (++seen[id]);
      else seen[id] = 0;
      h.id = id;
    });
  }

  // ── Table of contents ────────────────────────────────────────
  function buildToc() {
    hasToc = STATE.mode !== 'raw' && headings.length >= 3;
    root.classList.toggle('has-toc', hasToc);
    if (!hasToc) { setToc(false); tocList.innerHTML = ''; return; }
    tocList.innerHTML = '';
    headings.forEach((h) => {
      const a = document.createElement('button');
      a.className = 'toc-link lvl-' + (h.tagName === 'H3' ? 3 : 2);
      a.textContent = h.textContent;
      a.dataset.target = h.id;
      a.addEventListener('click', () => {
        const top = h.getBoundingClientRect().top
                  - content.getBoundingClientRect().top
                  + content.scrollTop - 18;
        content.scrollTo({ top, behavior: 'smooth' });
      });
      tocList.appendChild(a);
    });
    spy();
  }
  function setToc(open) {
    tocOpen = open && hasToc;
    win.classList.toggle('toc-open', tocOpen);
    tocCheck.setAttribute('data-on', String(tocOpen));
    tocCheck.parentElement.setAttribute('aria-checked', String(tocOpen));
  }
  function spy() {
    if (!tocOpen) return;
    const links = [...tocList.children];
    const cTop = content.getBoundingClientRect().top;
    let active = headings[0];
    for (const h of headings) {
      if (h.getBoundingClientRect().top - cTop <= 90) active = h;
      else break;
    }
    links.forEach((l) =>
      l.classList.toggle('active', l.dataset.target === (active && active.id)));
  }

  // ── Status bar ───────────────────────────────────────────────
  function updateStatus() {
    if (!hasContent()) {
      stFile.textContent = '—';
      stFile.removeAttribute('title');
      stWords.textContent = '0 words';
      stRead.textContent = '—';
      stMode.textContent = capitalize(STATE.mode);
      return;
    }
    const typeDef = FILE_TYPES[STATE.fileType] || FILE_TYPES.markdown;
    stFile.textContent = basename(STATE.path);
    stFile.title = STATE.path;
    stWords.textContent = typeDef.metricText(STATE);
    stRead.textContent = typeDef.readingTimeText(STATE);
    stMode.textContent = capitalize(STATE.mode);
  }

  // ── Empty state ──────────────────────────────────────────────
  function showEmpty(on) {
    empty.hidden = !on;
    content.style.visibility = on ? 'hidden' : 'visible';
    if (on) {
      root.classList.remove('has-toc');
      setToc(false);
      updateStatus();
    }
  }

  // ── Mode switching (respects per-type availability) ──────────
  function setMode(m) {
    if (!['raw', 'rendered', 'memo'].includes(m)) return;
    if (!modeAvailable(STATE.fileType, m)) return; // no-op for disabled modes
    STATE.mode = m;
    root.setAttribute('data-mode', m);
    syncMenuModes();
    render();
    appState.lastMode = m;
    scheduleSave();
  }
  function syncMenuModes() {
    document.querySelectorAll('.mi[data-mode]').forEach((b) => {
      const m = b.dataset.mode;
      const ok = modeAvailable(STATE.fileType, m);
      b.setAttribute('aria-checked', String(m === STATE.mode));
      b.disabled = !ok;
      b.classList.toggle('mi-disabled', !ok);
    });
    // Save-as-Markdown is .docx-only
    const saveAsBtn = document.querySelector('.mi[data-act="save-as-md"]');
    if (saveAsBtn) {
      const ok = STATE.fileType === 'docx';
      saveAsBtn.disabled = !ok;
      saveAsBtn.classList.toggle('mi-disabled', !ok);
    }
  }

  // ── Menu ─────────────────────────────────────────────────────
  function toggleMenu(force) {
    const show = force != null ? force : menu.hidden;
    menu.hidden = !show;
  }
  $('#btnMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== $('#btnMenu')) {
      toggleMenu(false);
    }
  });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.mi');
    if (!item || item.disabled) return;
    if (item.dataset.mode) {
      setMode(item.dataset.mode);
      toggleMenu(false);
    } else if (item.dataset.act === 'toc') {
      setToc(!tocOpen);
    } else if (item.dataset.act === 'open') {
      openFile(); toggleMenu(false);
    } else if (item.dataset.act === 'save-as-md') {
      toggleMenu(false); saveAsMarkdown();
    } else if (item.dataset.act === 'export-pdf') {
      toggleMenu(false); exportPdf();
    } else if (item.dataset.act === 'export-html') {
      toggleMenu(false); exportHtml();
    } else if (item.dataset.act === 'set-default') {
      toggleMenu(false); openDefaultAppsModalFromMenu();
    }
  });

  // ── Export: PDF (window.print) + HTML (self-contained) ───────
  function exportPdf() {
    if (!hasContent()) return;
    window.print();
  }
  async function exportHtml() {
    if (!hasContent()) return;
    try {
      const defaultName = (basename(STATE.path) || 'recto-export').replace(/\.[^.]+$/, '') + '.html';
      const path = await invoke('pick_save_path', {
        defaultName,
        filterName: 'HTML',
        filterExts: ['html', 'htm'],
      });
      if (!path) return;
      const sourceEl =
        content.querySelector('.memo-page') ||
        content.querySelector('.article') ||
        content.querySelector('.raw');
      if (!sourceEl) return;
      const clone = sourceEl.cloneNode(true);
      await inlineImages(clone);
      const css = await fetchText('./styles/app.css').catch(() => '');
      const fontsCss = await fetchText('./vendor/fonts/fonts.css').catch(() => '');
      const html = buildStandaloneHtml({
        bodyHtml: clone.outerHTML,
        css, fontsCss,
        title: basename(STATE.path) || 'Recto export',
        mode: STATE.mode,
      });
      await invoke('save_html_file', { path, content: html });
    } catch (err) { console.warn('exportHtml failed:', err); }
  }
  async function fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
    return r.text();
  }
  async function inlineImages(root) {
    const imgs = root.querySelectorAll('img');
    await Promise.all([...imgs].map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || /^data:/i.test(src)) return;
      try {
        const r = await fetch(src);
        const blob = await r.blob();
        const dataUri = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        img.setAttribute('src', dataUri);
      } catch { /* tolerate */ }
    }));
  }
  function buildStandaloneHtml({ bodyHtml, css, fontsCss, title, mode }) {
    return `<!DOCTYPE html>
<html lang="en" data-edition="spread" data-mode="${escapeAttr(mode)}" data-theme="auto">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
${fontsCss}

${css}

/* Standalone overrides — no app chrome */
html, body { overflow: visible !important; height: auto !important; background: var(--paper) !important; }
.titlebar, .statusbar, .menu, .toc, .empty, .drop-veil, [data-tauri-decorum-tb] { display: none !important; }
.win, .stage { display: block !important; }
.content { padding: 0 !important; height: auto !important; overflow: visible !important; background: transparent !important; }
body { padding: 40px 24px; }
[data-mode="rendered"] body { max-width: 740px; margin: 0 auto; }
[data-mode="memo"] body { background: var(--stage) !important; }
.memo-page { margin: 0 auto !important; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
  }

  // ── Save as Markdown (.docx only) ────────────────────────────
  async function saveAsMarkdown() {
    if (STATE.fileType !== 'docx' || !STATE.docxBuffer) return;
    try {
      const defaultName = (basename(STATE.path) || 'recto-export').replace(/\.[^.]+$/, '') + '.md';
      const path = await invoke('pick_save_path', {
        defaultName,
        filterName: 'Markdown',
        filterExts: ['md', 'markdown'],
      });
      if (!path) return;
      const result = await window.mammoth.convertToMarkdown({ arrayBuffer: STATE.docxBuffer });
      // save_html_file is misleadingly named — it's "write a UTF-8 string to disk."
      // Reusing instead of duplicating; the Rust comment notes this.
      await invoke('save_html_file', { path, content: result.value });
    } catch (err) { console.warn('saveAsMarkdown failed:', err); }
  }

  // ── File open / load (Tauri-backed, type-dispatched) ─────────
  async function openFile() {
    try {
      const path = await invoke('open_file_dialog');
      if (path) await loadFile(path);
    } catch (err) { showError(String(err)); }
  }
  async function loadFile(path) {
    try {
      const fileType = detectFileType(path);

      if (fileType === 'docx') {
        const b64 = await invoke('read_docx_bytes', { path });
        const bytes = base64ToBytes(b64);
        const result = await window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        STATE.content = '';
        STATE.html = result.value || '';
        STATE.docxBuffer = bytes.buffer;
      } else {
        // markdown, json, xml — all read as UTF-8 text
        const text = await invoke('read_markdown_file', { path });
        STATE.content = text;
        STATE.html = null;
        STATE.docxBuffer = null;
      }
      STATE.path = path;
      STATE.fileType = fileType;

      // Ensure current mode is valid for the new file type; fall back if not
      if (!modeAvailable(fileType, STATE.mode)) {
        const def = FILE_TYPES[fileType].defaultMode;
        STATE.mode = def;
        root.setAttribute('data-mode', def);
      }
      syncMenuModes();
      render();

      // Recents (dedup, cap 10)
      appState.recents = [path, ...appState.recents.filter((p) => p !== path)].slice(0, 10);
      scheduleSave();

      // Restore previous reading position
      const pct = appState.scrollPositions[path];
      if (typeof pct === 'number' && pct > 0) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const max = Math.max(0, content.scrollHeight - content.clientHeight);
          content.scrollTop = pct * max;
        }));
      }
    } catch (err) { showError(String(err)); }
  }
  function showError(message) {
    empty.hidden = true;
    content.style.visibility = 'visible';
    content.innerHTML = `<article class="article"><pre class="raw">${escapeHtml(message)}</pre></article>`;
  }

  $('#btnOpen').addEventListener('click', openFile);
  $('#btnOpenEmpty').addEventListener('click', openFile);

  // ── Drag-drop ────────────────────────────────────────────────
  getCurrentWebview().onDragDropEvent((event) => {
    const t = event.payload.type;
    if (t === 'enter' || t === 'over') veil.hidden = false;
    else if (t === 'leave') veil.hidden = true;
    else if (t === 'drop') {
      veil.hidden = true;
      const paths = event.payload.paths || [];
      if (paths.length > 0) loadFile(paths[0]);
    }
  });

  // ── Keyboard ─────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === '1')        { e.preventDefault(); setMode('raw'); }
    else if (ctrl && e.key === '2')   { e.preventDefault(); setMode('rendered'); }
    else if (ctrl && e.key === '3')   { e.preventDefault(); setMode('memo'); }
    else if (ctrl && e.key === '\\')  { e.preventDefault(); setToc(!tocOpen); }
    else if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); openFile(); }
    else if (ctrl && e.key.toLowerCase() === 'p') { e.preventDefault(); exportPdf(); }
    else if (!ctrl && (e.key === 'j' || e.key === 'k')
             && document.activeElement.tagName !== 'INPUT') {
      content.scrollBy({ top: e.key === 'j' ? 320 : -320, behavior: 'smooth' });
    }
  });

  // ── Scroll spy + reading-position memory ─────────────────────
  let scrollSaveTimer = null;
  content.addEventListener('scroll', () => {
    requestAnimationFrame(spy);
    if (!STATE.path) return;
    if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => {
      scrollSaveTimer = null;
      const max = Math.max(1, content.scrollHeight - content.clientHeight);
      appState.scrollPositions[STATE.path] = content.scrollTop / max;
      scheduleSave();
    }, 250);
  }, { passive: true });

  // ── Recent files list in empty state ─────────────────────────
  function renderRecents() {
    document.querySelector('.recent-list')?.remove();
    const recents = (appState.recents || []).slice(0, 5);
    if (recents.length === 0) return;
    const inner = $('.empty-inner');
    if (!inner) return;
    const wrap = document.createElement('div');
    wrap.className = 'recent-list';
    wrap.innerHTML =
      '<div class="recent-header">Recent</div>' +
      recents.map((p) =>
        `<button class="recent-item" data-path="${escapeAttr(p)}" title="${escapeAttr(p)}">` +
          `<span class="recent-name">${escapeHtml(basename(p))}</span>` +
          `<span class="recent-path">${escapeHtml(dirname(p))}</span>` +
        `</button>`
      ).join('');
    inner.insertBefore(wrap, inner.firstChild);
    wrap.querySelectorAll('.recent-item').forEach((btn) =>
      btn.addEventListener('click', () => loadFile(btn.dataset.path)));
  }

  // ── Set-as-default prompt ────────────────────────────────────
  // The extensions Recto declares fileAssociations for (kept in sync
  // with tauri.conf.json). Variant extensions (e.g. xsd, xsl) share
  // the same activation behavior on Windows so checking the canonical
  // member of each group is sufficient.
  const KNOWN_EXTS = ['md', 'markdown', 'mdx', 'docx', 'json', 'xml'];

  async function checkDefaults() {
    const results = await Promise.all(
      KNOWN_EXTS.map(async (ext) => ({
        ext,
        progId: await invoke('check_default_for_ext', { ext }).catch(() => null),
      }))
    );
    return results;
  }

  function rectoOwns(progId) {
    return typeof progId === 'string' && /recto/i.test(progId);
  }

  function showDefaultModal(notDefaultFor) {
    const modal = $('#defaultModal');
    const list = $('#defaultList');
    const sub = $('#defaultSub');
    if (notDefaultFor.length === 0) {
      // Triggered from the menu when Recto is already default everywhere
      sub.textContent = 'Recto is already your default opener for all supported file types. Open Settings if you want to change anything.';
      list.hidden = true;
      list.innerHTML = '';
    } else {
      sub.textContent = "Recto isn't currently the default opener for these file types. Setting it as default lets you double-click these files in File Explorer to open them in Recto.";
      list.hidden = false;
      list.innerHTML = notDefaultFor
        .map((r) => `<li>.${escapeHtml(r.ext)}</li>`)
        .join('');
    }
    modal.hidden = false;
    // Push focus to the primary action so Enter accepts the suggested path
    requestAnimationFrame(() => $('#defaultBtnOpen').focus());
  }

  function hideDefaultModal() {
    $('#defaultModal').hidden = true;
  }

  // Shared by the modal's Open Settings button AND the 3-dot menu's
  // "Set as default app…" item. Copy "Recto" to clipboard so the user
  // can paste it into the Default Apps search box — Win11 22H2+ removed
  // the registeredAppUser deep-link, so the URI lands on the general
  // page and the clipboard shortcut saves the user from hunting.
  async function launchDefaultAppsSettings() {
    try { await navigator.clipboard.writeText('Recto'); }
    catch (err) { console.warn('clipboard.writeText failed:', err); }
    try { await invoke('open_default_apps_settings'); }
    catch (err) { console.warn('open_default_apps_settings failed:', err); }
  }

  // Menu-trigger entry point: re-evaluate current default state and
  // show the modal so the user gets the full explanation + the same
  // primary action even when invoked outside first launch.
  async function openDefaultAppsModalFromMenu() {
    const results = await checkDefaults();
    const notDefaultFor = results.filter((r) => !rectoOwns(r.progId));
    showDefaultModal(notDefaultFor);
  }

  $('#defaultBtnOpen').addEventListener('click', async () => {
    await launchDefaultAppsSettings();
    hideDefaultModal();
  });
  $('#defaultBtnSkip').addEventListener('click', () => {
    // Skip this launch only; re-evaluate next boot
    hideDefaultModal();
  });
  $('#defaultBtnDontAsk').addEventListener('click', () => {
    appState.setDefaultPromptDismissed = true;
    scheduleSave();
    hideDefaultModal();
  });

  async function maybeShowSetDefaultPrompt() {
    if (appState.setDefaultPromptDismissed) return;
    const results = await checkDefaults();
    const notDefaultFor = results.filter((r) => !rectoOwns(r.progId));
    // If Recto already owns at least one extension, treat that as an
    // implicit acceptance — no nag for the remaining types.
    if (notDefaultFor.length === results.length) {
      showDefaultModal(notDefaultFor);
    }
  }

  // ── Boot ─────────────────────────────────────────────────────
  (async function boot() {
    await loadState();
    if (['raw', 'rendered', 'memo'].includes(appState.lastMode)) {
      STATE.mode = appState.lastMode;
      root.setAttribute('data-mode', STATE.mode);
    }
    syncMenuModes();

    // If launched via "Open with Recto" (right-click verb / file association /
    // command line), load the requested file directly instead of empty state.
    const initial = await invoke('get_initial_file').catch(() => null);
    if (initial) {
      await loadFile(initial);
    } else {
      render(); // empty state
      renderRecents();
    }

    invoke('get_build_info').then((info) => {
      const badge = $('#stBuild');
      badge.textContent = `v${info.version}·${info.sha}`;
      badge.title = `Recto ${info.version} — commit ${info.sha}`;
    }).catch((e) => console.warn('get_build_info failed:', e));
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim')));

    // Defer the set-default check past first paint so the window
    // becomes interactive before the modal appears.
    setTimeout(() => { maybeShowSetDefaultPrompt().catch(() => {}); }, 600);
  })();
})();
