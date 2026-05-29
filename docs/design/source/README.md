# Design source — Spread brand kit

Vendored from the handoff bundle the designer (claude.ai/design) produced.
Original URL of this design:
https://claude.ai/design/p/d758ccf6-fb91-4ab6-a85c-07e0571204a7?file=recto-review.html

## Files

- `recto-app.html` / `recto-app.css` / `recto-content.js` / `recto-viewer.js` — the working prototype. The implementation in `src/` lifts these and adapts file I/O / drag-drop for Tauri.
- `recto-review.html` — the lookbook (both editions × 5 priority states). Open in a browser to see the full review.
- `recto-status.html` — status-bar anatomy spec.
- `recto-logos.html` — earlier logo-direction comparison (Folio / Spread / Ligature / Prompt / Margin).
- `marks.jsx` / `design-canvas.jsx` — JSX components used by the review pages.
- `screenshots/` — designer-rendered screenshots of each state.

## Not vendored

- The chat transcript (`chats/chat1.md` in the bundle) — contains the back-and-forth conversation; kept out of the public repo for privacy.
- User-uploaded reference images — out for the same reason.

If you need any of those, the original handoff bundle URL is at the top of this file.