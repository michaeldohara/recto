// ============================================================
// Recto — main frontend logic (Phase 1: render any .md file)
//
// Architecture:
//   - File I/O happens in Rust (see src-tauri/src/lib.rs)
//   - Frontend uses only window.__TAURI__ globals (no npm imports)
//     so we stay buildchain-free per docs/PLANNING.md
//   - Parsing via markdown-it loaded as UMD script in index.html
//   - Styling via vendored github-markdown-css (Phase 2 adds raw/memo modes)
// ============================================================

const { invoke } = window.__TAURI__.core;
const { getCurrentWebview } = window.__TAURI__.webview;

// Configure the Markdown parser.
// - html: false  → don't pass raw HTML through (safety: untrusted .md files)
// - linkify: true → auto-link bare URLs
// - typographer: false → don't substitute smart quotes etc. (let the source win)
const md = window.markdownit({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
});

const docEl = document.getElementById('doc');
const filenameEl = document.getElementById('filename');
const metaEl = document.getElementById('meta');
const openBtn = document.getElementById('open-btn');

let currentPath = null;

// ---------- File loading ----------

async function loadFile(path) {
  try {
    const content = await invoke('read_markdown_file', { path });
    render(content, path);
    currentPath = path;
  } catch (err) {
    showError(String(err));
  }
}

function render(markdown, path) {
  const html = md.render(markdown);
  docEl.innerHTML = `<article class="markdown-body">${html}</article>`;

  const filename = basename(path);
  filenameEl.textContent = filename;
  filenameEl.title = path;

  const stats = computeStats(markdown);
  metaEl.textContent = `${stats.words.toLocaleString()} words · ${stats.readingMin} min read`;
}

function showError(message) {
  docEl.innerHTML = `<div class="error-state">${escapeHtml(message)}</div>`;
  filenameEl.textContent = '';
  metaEl.textContent = '';
}

// ---------- Helpers ----------

function basename(path) {
  return path.split(/[\\/]/).pop() || path;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Word count for the status bar.
// Strips common Markdown syntax characters before counting whitespace-separated tokens.
// Per PLANNING.md "Status bar spec" — code blocks ARE included (tracked in stats but
// distinguished in a tooltip later in Phase 3).
function computeStats(text) {
  const stripped = text
    .replace(/```[\s\S]*?```/g, '')             // fenced code blocks
    .replace(/`[^`]+`/g, '')                     // inline code
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')   // images/links → keep alt/text only
    .replace(/^[#>\-*+]\s+/gm, '')               // leading list/heading/quote markers
    .replace(/[*_~|]/g, '');                     // emphasis / strikethrough / table pipes
  const words = (stripped.match(/\S+/g) || []).length;
  const readingMin = Math.max(1, Math.ceil(words / 200));
  return { words, readingMin };
}

// ---------- Triggers ----------

// File → Open button
openBtn.addEventListener('click', async () => {
  const path = await invoke('open_file_dialog');
  if (path) await loadFile(path);
});

// Ctrl+O keyboard shortcut
window.addEventListener('keydown', async (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    const path = await invoke('open_file_dialog');
    if (path) await loadFile(path);
  }
});

// Drag-drop anywhere in the window
getCurrentWebview().onDragDropEvent((event) => {
  if (event.payload.type === 'drop' && event.payload.paths.length > 0) {
    loadFile(event.payload.paths[0]);
  }
});
