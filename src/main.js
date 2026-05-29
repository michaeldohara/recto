// ============================================================
// recto — main viewer logic
//
// Adapted from the designer's recto-viewer.js for Tauri:
//   - File I/O via Rust commands (open_file_dialog, read_markdown_file)
//   - Drag-drop via Tauri's onDragDropEvent (real OS file paths)
//   - Parser is markdown-it (vendored, UMD-loaded in index.html)
//   - No npm imports, no build chain — vanilla per PLANNING.md
//
// Behavior preserved from the design:
//   - Title-bar menu (Open, view modes, Show contents)
//   - View modes: raw / rendered / memo (Ctrl+1/2/3)
//   - TOC drawer that auto-builds when doc has ≥3 headings (Ctrl+\)
//   - Scroll-spy current-heading marker
//   - J/K page scroll
//   - Drop-veil drag overlay
//   - Empty state shown when no file loaded
//   - `no-anim` boot to prevent initial-paint transitions
// ============================================================

(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const { invoke, convertFileSrc } = window.__TAURI__.core;
  const { getCurrentWebview } = window.__TAURI__.webview;

  // ── Parser ───────────────────────────────────────────────────
  const md = window.markdownit({
    html: false,
    linkify: true,
    typographer: false,
    breaks: false,
  });

  // ── State ────────────────────────────────────────────────────
  const root = document.documentElement;
  const STATE = {
    content: '',       // raw markdown source of currently loaded file
    path: '',          // absolute path of currently loaded file
    mode: 'rendered',  // 'raw' | 'rendered' | 'memo'
  };

  root.classList.add('no-anim'); // suppress transitions on initial paint

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
  function slug(t) {
    return t.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Rewrite relative image paths through Tauri's asset: protocol so
  // ![alt](images/foo.png) resolves against the loaded file's folder.
  function rewriteImagePaths(html, fileDir) {
    if (!fileDir) return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.body.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (!src) return;
      if (/^(https?:|data:|file:|asset:|tauri:)/i.test(src)) return;
      if (/^[a-z]:[/\\]/i.test(src)) return; // Windows absolute (C:\...)
      if (src.startsWith('/')) return;        // POSIX absolute
      img.setAttribute('src', convertFileSrc(resolveRelative(fileDir, src)));
    });
    return doc.body.innerHTML;
  }

  // Word count — strip common Markdown syntax before tokenising.
  // Reading speed: 230 wpm (matches designer's spec).
  function wordCount(text) {
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

  // ── Render ───────────────────────────────────────────────────
  function render() {
    if (!STATE.content) {
      showEmpty(true);
      return;
    }
    showEmpty(false);

    const fileDir = dirname(STATE.path);
    const filename = basename(STATE.path);

    if (STATE.mode === 'raw') {
      content.innerHTML = `<pre class="raw">${escapeHtml(STATE.content)}</pre>`;
      headings = [];
    } else {
      const html = rewriteImagePaths(md.render(STATE.content), fileDir);
      if (STATE.mode === 'memo') {
        const today = new Date().toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
        const dir = fileDir || '—';
        content.innerHTML =
          `<div class="memo-page">` +
            `<div class="letterhead">` +
              `<div class="lh-left">` +
                `<span class="lh-file">${escapeHtml(filename)}</span>` +
                `<span class="lh-meta">${escapeHtml(dir)}</span>` +
              `</div>` +
              `<div class="lh-right">` +
                `<span class="lh-date">${escapeHtml(today)}</span>` +
                `<span class="lh-by">recto</span>` +
              `</div>` +
            `</div>` +
            `<article class="article memo">${html}</article>` +
          `</div>`;
      } else {
        content.innerHTML = `<article class="article">${html}</article>`;
      }
      tagHeadings();
    }

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
    if (!hasToc) {
      setToc(false);
      tocList.innerHTML = '';
      return;
    }
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
    if (!STATE.content) {
      stFile.textContent = '—';
      stFile.removeAttribute('title');
      stWords.textContent = '0 words';
      stRead.textContent = '—';
      stMode.textContent = capitalize(STATE.mode);
      return;
    }
    const words = wordCount(STATE.content);
    stFile.textContent = basename(STATE.path);
    stFile.title = STATE.path;
    stWords.textContent = words.toLocaleString() + ' words';
    stRead.textContent = Math.max(1, Math.round(words / 230)) + ' min read';
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

  // ── Mode switching ───────────────────────────────────────────
  function setMode(m) {
    if (!['raw', 'rendered', 'memo'].includes(m)) return;
    STATE.mode = m;
    root.setAttribute('data-mode', m);
    syncMenuModes();
    render();
  }
  function syncMenuModes() {
    document.querySelectorAll('.mi[data-mode]').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.mode === STATE.mode)));
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
    if (!item) return;
    if (item.dataset.mode) {
      setMode(item.dataset.mode);
      toggleMenu(false);
    } else if (item.dataset.act === 'toc') {
      setToc(!tocOpen);
    } else if (item.dataset.act === 'open') {
      openFile();
      toggleMenu(false);
    }
  });

  // ── File open (Tauri-backed) ─────────────────────────────────
  async function openFile() {
    try {
      const path = await invoke('open_file_dialog');
      if (path) await loadFile(path);
    } catch (err) {
      showError(String(err));
    }
  }
  async function loadFile(path) {
    try {
      const content = await invoke('read_markdown_file', { path });
      STATE.content = content;
      STATE.path = path;
      render();
    } catch (err) {
      showError(String(err));
    }
  }
  function showError(message) {
    empty.hidden = true;
    content.style.visibility = 'visible';
    content.innerHTML = `<article class="article"><pre class="raw">${escapeHtml(message)}</pre></article>`;
  }

  $('#btnOpen').addEventListener('click', openFile);
  $('#btnOpenEmpty').addEventListener('click', openFile);

  // ── Drag-drop (Tauri's onDragDropEvent gives real OS paths) ──
  getCurrentWebview().onDragDropEvent((event) => {
    const t = event.payload.type;
    if (t === 'enter' || t === 'over') {
      veil.hidden = false;
    } else if (t === 'leave') {
      veil.hidden = true;
    } else if (t === 'drop') {
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
    else if (!ctrl && (e.key === 'j' || e.key === 'k')
             && document.activeElement.tagName !== 'INPUT') {
      content.scrollBy({ top: e.key === 'j' ? 320 : -320, behavior: 'smooth' });
    }
  });

  // ── Scroll spy ───────────────────────────────────────────────
  content.addEventListener('scroll', () => requestAnimationFrame(spy), { passive: true });

  // ── Boot ─────────────────────────────────────────────────────
  syncMenuModes();
  render(); // shows empty state since STATE.content is ''
  // Two rAF ticks ensure styles settle before re-enabling transitions
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim')));
})();
