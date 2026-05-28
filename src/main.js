// ============================================================
// Recto — main frontend logic
//
// Phase 1: file load + render + drag-drop + status bar
// Phase 2: three view modes (raw / rendered / memo) +
//          relative-path image rendering via asset: protocol
//
// Architecture:
//   - File I/O happens in Rust (see src-tauri/src/lib.rs)
//   - Frontend uses only window.__TAURI__ globals (no npm imports)
//     so we stay buildchain-free per docs/PLANNING.md
//   - Parsing via markdown-it loaded as UMD script in index.html
// ============================================================

const { invoke, convertFileSrc } = window.__TAURI__.core;
const { getCurrentWebview } = window.__TAURI__.webview;

// ---------- Parser ----------

const md = window.markdownit({
  html: false,        // safety: don't pass raw HTML from untrusted .md
  linkify: true,
  typographer: false,
  breaks: false,
});

// ---------- App state ----------

const STATE = {
  content: '',           // last-loaded raw Markdown source
  path: '',              // absolute path of last-loaded file
  mode: 'rendered',      // 'raw' | 'rendered' | 'memo'
};

const MODE_LABELS = {
  raw: 'Raw',
  rendered: 'Rendered',
  memo: 'Memo',
};

// ---------- DOM ----------

const docEl = document.getElementById('doc');
const filenameEl = document.getElementById('filename');
const metaEl = document.getElementById('meta');
const modeLabelEl = document.getElementById('mode-label');
const openBtn = document.getElementById('open-btn');

// ---------- File loading + rendering ----------

async function loadFile(path) {
  try {
    const content = await invoke('read_markdown_file', { path });
    STATE.content = content;
    STATE.path = path;
    renderCurrent();
  } catch (err) {
    showError(String(err));
  }
}

function setMode(mode) {
  if (!MODE_LABELS[mode]) return;
  STATE.mode = mode;
  document.body.dataset.mode = mode;
  modeLabelEl.textContent = MODE_LABELS[mode];
  renderCurrent();
}

function renderCurrent() {
  if (!STATE.content) {
    showEmpty();
    return;
  }

  const fileDir = dirname(STATE.path);
  const filename = basename(STATE.path);

  if (STATE.mode === 'raw') {
    docEl.innerHTML = `<pre class="doc-raw">${escapeHtml(STATE.content)}</pre>`;
  } else if (STATE.mode === 'memo') {
    const html = rewriteImagePaths(md.render(STATE.content), fileDir);
    const header = renderMemoHeader(filename);
    docEl.innerHTML = `<article class="doc-memo">${header}${html}</article>`;
  } else {
    // rendered (default)
    const html = rewriteImagePaths(md.render(STATE.content), fileDir);
    docEl.innerHTML = `<article class="markdown-body doc-rendered">${html}</article>`;
  }

  // Status bar
  filenameEl.textContent = filename;
  filenameEl.title = STATE.path;
  const stats = computeStats(STATE.content);
  metaEl.textContent = `${stats.words.toLocaleString()} words · ${stats.readingMin} min read`;

  // Reset scroll on file load (but not on mode change for same content)
  docEl.scrollTop = 0;
}

function renderMemoHeader(filename) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `<div class="memo-header">` +
    `<span class="memo-doc-title">${escapeHtml(filename)}</span>` +
    `<span class="memo-date">${escapeHtml(today)}</span>` +
  `</div>`;
}

function showEmpty() {
  docEl.innerHTML = `<div class="empty-state">` +
    `<p class="empty-hint">Drop a Markdown file here<br/>or click <strong>Open</strong></p>` +
  `</div>`;
  filenameEl.textContent = '';
  filenameEl.title = '';
  metaEl.textContent = '';
}

function showError(message) {
  docEl.innerHTML = `<div class="error-state">${escapeHtml(message)}</div>`;
  filenameEl.textContent = '';
  metaEl.textContent = '';
}

// ---------- Path helpers + image rewriting ----------

function dirname(path) {
  if (!path) return '';
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return idx >= 0 ? path.slice(0, idx) : '';
}

function basename(path) {
  if (!path) return '';
  return path.split(/[\\/]/).pop() || path;
}

function resolveRelative(dir, rel) {
  // Append rel to dir using the dir's separator style.
  // Don't normalize ".." — let the OS resolve it when the asset URL is fetched.
  const useBackslash = dir.includes('\\');
  const sep = useBackslash ? '\\' : '/';
  const normalizedRel = useBackslash
    ? rel.replace(/\//g, '\\')
    : rel.replace(/\\/g, '/');
  return dir + sep + normalizedRel;
}

// Rewrite <img src="..."> in rendered HTML so relative paths resolve
// against the loaded .md file's folder via Tauri's asset: protocol.
function rewriteImagePaths(html, fileDir) {
  if (!fileDir) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    // Skip absolute URLs, data URIs, asset:/ URLs
    if (/^(https?:|data:|file:|asset:|tauri:)/i.test(src)) return;
    // Skip absolute Windows paths (C:\..., D:/...)
    if (/^[a-z]:[/\\]/i.test(src)) return;
    // Skip absolute POSIX paths (/usr/local/...)
    if (src.startsWith('/')) return;

    const absPath = resolveRelative(fileDir, src);
    img.setAttribute('src', convertFileSrc(absPath));
  });
  return doc.body.innerHTML;
}

// ---------- Misc helpers ----------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Status-bar word count.
// Strips common Markdown syntax before tokenizing — close enough for v1;
// tooltip breakdown (prose vs code) deferred to Phase 3.
function computeStats(text) {
  const stripped = text
    .replace(/```[\s\S]*?```/g, '')              // fenced code blocks
    .replace(/`[^`]+`/g, '')                     // inline code
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')   // images/links → alt/text only
    .replace(/^[#>\-*+]\s+/gm, '')               // heading/list/quote markers
    .replace(/[*_~|]/g, '');                     // emphasis / table pipes
  const words = (stripped.match(/\S+/g) || []).length;
  const readingMin = Math.max(1, Math.ceil(words / 200));
  return { words, readingMin };
}

// ---------- Triggers ----------

openBtn.addEventListener('click', async () => {
  const path = await invoke('open_file_dialog');
  if (path) await loadFile(path);
});

window.addEventListener('keydown', async (e) => {
  if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;

  switch (e.key) {
    case '1': e.preventDefault(); setMode('raw'); break;
    case '2': e.preventDefault(); setMode('rendered'); break;
    case '3': e.preventDefault(); setMode('memo'); break;
    case 'o':
    case 'O': {
      e.preventDefault();
      const path = await invoke('open_file_dialog');
      if (path) await loadFile(path);
      break;
    }
  }
});

// Drag-drop anywhere in the window
getCurrentWebview().onDragDropEvent((event) => {
  if (event.payload.type === 'drop' && event.payload.paths.length > 0) {
    loadFile(event.payload.paths[0]);
  }
});
