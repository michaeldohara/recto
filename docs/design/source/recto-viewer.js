/* ════════════════════════════════════════════════════════════════
   recto-app.js — single-window Markdown viewer (vanilla, Tauri-ready)
   State is driven by URL params so the same file can be embedded in
   review frames:  ?edition=spread|ligature  ?mode=raw|rendered|memo
                   ?toc=1  ?state=empty  ?theme=light|dark  ?doc=welcome
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const P = new URLSearchParams(location.search);

  // ── Edition marks ────────────────────────────────────────────
  const MARKS = {
    spread: (sw = 5) => `<svg viewBox="0 0 96 96" fill="none" width="100%" height="100%">
      <path d="M48 23 C38 16.5 26 16.5 13 19.5 V74 C26 71 38 71 48 77.5 Z" fill="none" stroke="var(--ink)" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M48 23 C58 16.5 70 16.5 83 19.5 V74 C70 71 58 71 48 77.5 Z" fill="var(--accent)"/>
      <line x1="48" y1="23" x2="48" y2="77.5" stroke="var(--ink)" stroke-width="${sw}" stroke-linecap="round"/></svg>`,
    ligature: () => `<svg viewBox="0 0 96 96" fill="none" width="100%" height="100%">
      <circle cx="48" cy="48" r="37" stroke="var(--ink)" stroke-width="5"/>
      <text x="48" y="49" text-anchor="middle" dominant-baseline="central"
        font-family="Newsreader, serif" font-weight="500" font-size="58" fill="var(--accent)">r</text></svg>`,
  };

  // ── State from params ────────────────────────────────────────
  const root = document.documentElement;
  const edition = P.get("edition") === "ligature" ? "ligature" : "spread";
  let mode = ["raw", "rendered", "memo"].includes(P.get("mode")) ? P.get("mode") : "rendered";
  const themeParam = P.get("theme");
  const docKey = P.get("doc") && window.RECTO_DOCS[P.get("doc")] ? P.get("doc") : "welcome";
  const startEmpty = P.get("state") === "empty";

  root.setAttribute("data-edition", edition);
  root.setAttribute("data-mode", mode);
  if (themeParam === "light" || themeParam === "dark") root.setAttribute("data-theme", themeParam);
  else root.setAttribute("data-theme", "auto");

  // inject marks
  $("#brandMark").innerHTML = MARKS[edition]();
  $("#emptyMark").innerHTML = MARKS[edition]();

  // ── marked config ────────────────────────────────────────────
  marked.setOptions({ gfm: true, breaks: false });

  let doc = window.RECTO_DOCS[docKey];
  let headings = [];
  let hasToc = false;

  // ── Render ───────────────────────────────────────────────────
  const content = $("#content");

  function slug(t) { return t.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, ""); }

  function escapeHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  function render() {
    if (startEmpty) { showEmpty(true); return; }
    showEmpty(false);

    if (mode === "raw") {
      content.innerHTML = `<pre class="raw">${escapeHtml(doc.md)}</pre>`;
    } else {
      const html = marked.parse(doc.md);
      if (mode === "memo") {
        const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const parts = doc.path.split(" / ");
        const file = parts.pop();
        const dir = parts.join(" / ") || "—";
        content.innerHTML =
          `<div class="memo-page">
             <div class="letterhead">
               <div class="lh-left">
                 <span class="lh-file">${file}</span>
                 <span class="lh-meta">${dir}</span>
               </div>
               <div class="lh-right">
                 <span class="lh-date">${today}</span>
                 <span class="lh-by">${doc.author || "recto"}</span>
               </div>
             </div>
             <article class="article memo">${html}</article>
           </div>`;
      } else {
        content.innerHTML = `<article class="article">${html}</article>`;
      }
      tagHeadings();
    }
    content.scrollTop = 0;
    buildToc();
    updateStatus();
    updateProgress();
  }

  function tagHeadings() {
    headings = [...content.querySelectorAll("h2, h3")];
    const seen = {};
    headings.forEach((h) => {
      let id = slug(h.textContent);
      if (seen[id] != null) id += "-" + (++seen[id]); else seen[id] = 0;
      h.id = id;
    });
  }

  // ── TOC ──────────────────────────────────────────────────────
  const tocList = $("#tocList");
  function buildToc() {
    hasToc = mode !== "raw" && headings.length >= 3;
    root.classList.toggle("has-toc", hasToc);
    $("#tocCheck").parentElement.setAttribute("aria-disabled", String(!hasToc));
    if (!hasToc) { setToc(false); tocList.innerHTML = ""; return; }
    tocList.innerHTML = "";
    headings.forEach((h) => {
      const a = document.createElement("button");
      a.className = "toc-link lvl-" + (h.tagName === "H3" ? 3 : 2);
      a.textContent = h.textContent;
      a.dataset.target = h.id;
      a.addEventListener("click", () => {
        const top = h.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop - 18;
        content.scrollTo({ top, behavior: "smooth" });
      });
      tocList.appendChild(a);
    });
    spy();
  }

  let tocOpen = false;
  function setToc(open) {
    tocOpen = open && hasToc;
    $("#win").classList.toggle("toc-open", tocOpen);
    const chk = $("#tocCheck");
    chk.setAttribute("data-on", String(tocOpen));
    $("#tocCheck").parentElement.setAttribute("aria-checked", String(tocOpen));
  }
  // render the menu check for "Show contents"
  function syncTocCheck() {
    const item = $("#tocCheck").parentElement;
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(tocOpen));
  }

  function spy() {
    if (!tocOpen) return;
    const links = [...tocList.children];
    const cTop = content.getBoundingClientRect().top;
    let active = headings[0];
    for (const h of headings) {
      if (h.getBoundingClientRect().top - cTop <= 90) active = h; else break;
    }
    links.forEach((l) => l.classList.toggle("active", l.dataset.target === (active && active.id)));
  }

  // ── Status + progress ────────────────────────────────────────
  function wordCount(md) {
    return md.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`\-|]/g, " ")
             .split(/\s+/).filter(Boolean).length;
  }
  function updateStatus() {
    const words = wordCount(doc.md);
    $("#stFile").textContent = startEmpty ? "—" : doc.path.split(" / ").pop();
    $("#stWords").textContent = words.toLocaleString() + " words";
    $("#stRead").textContent = Math.max(1, Math.round(words / 230)) + " min read";
    $("#stMode").textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
  }

  const progressEnabled = false; // progress lives in status %, kept minimal
  function updateProgress() { spy(); }

  // ── Empty state ──────────────────────────────────────────────
  function showEmpty(on) {
    $("#empty").hidden = !on;
    content.style.visibility = on ? "hidden" : "visible";
    if (on) {
      $("#stFile").textContent = "—";
      $("#stWords").textContent = "0 words";
      $("#stRead").textContent = "—";
      $("#stMode").textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
      root.classList.remove("has-toc"); setToc(false);
    }
  }

  // ── Mode switching ───────────────────────────────────────────
  function setMode(m) {
    mode = m;
    root.setAttribute("data-mode", m);
    syncMenuModes();
    render();
  }
  function syncMenuModes() {
    document.querySelectorAll(".mi[data-mode]").forEach((b) =>
      b.setAttribute("aria-checked", String(b.dataset.mode === mode)));
  }

  // ── Menu ─────────────────────────────────────────────────────
  const menu = $("#menu");
  function toggleMenu(force) {
    const show = force != null ? force : menu.hidden;
    menu.hidden = !show;
  }
  $("#btnMenu").addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== $("#btnMenu")) toggleMenu(false); });
  menu.addEventListener("click", (e) => {
    const item = e.target.closest(".mi"); if (!item) return;
    if (item.dataset.mode) { setMode(item.dataset.mode); toggleMenu(false); }
    else if (item.dataset.act === "toc") { setToc(!tocOpen); }
    else if (item.dataset.act === "open") { openFile(); toggleMenu(false); }
  });

  // ── Open / drag-drop ─────────────────────────────────────────
  const fileInput = $("#fileInput");
  function openFile() { fileInput.click(); }
  $("#btnOpen").addEventListener("click", openFile);
  $("#btnOpenEmpty").addEventListener("click", openFile);
  fileInput.addEventListener("change", (e) => { const f = e.target.files[0]; if (f) loadFile(f); });

  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      doc = { title: file.name.replace(/\.[^.]+$/, ""), path: file.name, md: String(reader.result) };
      render();
    };
    reader.readAsText(file);
  }

  const veil = $("#dropVeil");
  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => { e.preventDefault(); if (++dragDepth === 1) veil.hidden = false; });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("dragleave", (e) => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; veil.hidden = true; } });
  window.addEventListener("drop", (e) => {
    e.preventDefault(); dragDepth = 0; veil.hidden = true;
    const f = e.dataTransfer.files[0]; if (f) loadFile(f);
  });

  // ── Keyboard ─────────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === "1") { e.preventDefault(); setMode("raw"); }
    else if (ctrl && e.key === "2") { e.preventDefault(); setMode("rendered"); }
    else if (ctrl && e.key === "3") { e.preventDefault(); setMode("memo"); }
    else if (ctrl && e.key === "\\") { e.preventDefault(); setToc(!tocOpen); }
    else if (ctrl && e.key.toLowerCase() === "o") { e.preventDefault(); openFile(); }
    else if (!ctrl && (e.key === "j" || e.key === "k") && document.activeElement.tagName !== "INPUT") {
      content.scrollBy({ top: e.key === "j" ? 320 : -320, behavior: "smooth" });
    }
  });

  // ── Scroll spy ───────────────────────────────────────────────
  content.addEventListener("scroll", () => { requestAnimationFrame(spy); }, { passive: true });

  // ── Boot ─────────────────────────────────────────────────────
  root.classList.add("no-anim");
  syncMenuModes();
  render();
  syncTocCheck();
  if (P.get("toc") === "1") setToc(true);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("no-anim")));
})();
