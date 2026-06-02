# Recto installer — designer brief

**Status:** placeholder BMPs shipping in v1.1.2. Looking for a designer pass to swap in properly-typeset versions.
**Owner:** Michael
**Date:** 2026-06-02

---

## What this is

Recto's Windows installer (NSIS) shows two custom images during install: a small **header banner** at the top of every page, and a tall **sidebar** on the Welcome + Finish pages. These are the first Recto-branded surface a user encounters — before the app even launches. Today they're rendered programmatically (Segoe UI on the brand palette) and they're fine, but the typography isn't pixel-matched to the in-app wordmark. Looking for your hand on this.

## What we need

Two BMP files at exact pixel dimensions:

### `header.bmp` — 150 × 57 px
- Shown top-right on every installer page (Welcome, License, Components, Directory, Installing, Finish)
- Current composition: small Spread mark left (~36×36) + "recto" wordmark + "document reader" subtitle
- Cream `#F6F0E3` background; thin hairline `#EAE2D3` at bottom for hand-crafted feel
- Total weight: feels like a discreet brand mark, not a banner

### `sidebar.bmp` — 164 × 314 px
- Shown on the LEFT of the Welcome and Finish pages only
- Current composition (top-to-bottom): large Spread mark (~96×96) centered → "recto" wordmark → "A viewer-first / document reader." tagline → clay `#B4542C` accent dot
- Cream `#F6F0E3` background
- Vertically dominant; meant to feel like the inside of a printed manuscript cover

## Brand reference

You've already designed everything below; this is just a quick recap.

| | |
|---|---|
| Mark (master) | `docs/design/master-icon.svg` (1024×1024) |
| Spread variant | `docs/design/icon-c-spread.svg` |
| Wordmark, light bg | `docs/design/wordmark-a-light.svg` |
| App CSS (token reference) | `src/styles/app.css` — `:root` block |

**Palette** (Spread / Manuscript edition):
- Paper `#F6F0E3` — backgrounds
- Surface `#EAE2D3` — hairlines, subtle elevation
- Ink `#221C15` — primary type
- Ink-2 `#5C5246` — secondary type
- Clay `#B4542C` — accent, sparingly

**Typography:**
- Wordmark: Hanken Grotesk
- Tagline / subtitle: Hanken Grotesk regular
- Match the wordmark exactly to `docs/design/wordmark-a-light.svg`

## Current placeholders (replace these)

- `src-tauri/installer/header.bmp`
- `src-tauri/installer/sidebar.bmp`

Open in Photopea / Photoshop / Affinity / Figma to see what's there today.

## Technical constraints

- **BMP format**, 24-bit (32-bit also fine — but no alpha; NSIS flattens against white. Anything transparent reads as white).
- **Exact pixel dimensions.** NSIS stretches if size is off, which looks awful. Don't design at 2× and hope for the best.
- **1× only** — NSIS doesn't do DPI scaling on these. Modern Windows will render them with whatever interpolation it chooses; flat colors and simple shapes tolerate this best.
- **Background must be the paper color** (`#F6F0E3`) all the way to every edge — NSIS composites these onto a similarly-colored installer page bg, and a mismatch reads as a hard rectangle around the image.

## Deliverables

1. **`src-tauri/installer/header.bmp`** — drop in, overwrite
2. **`src-tauri/installer/sidebar.bmp`** — drop in, overwrite
3. **Source files** (Figma / AI / SVG / whatever) — into `docs/design/source/installer/` so we can iterate later

PR welcome, or send the files however's easiest and I'll commit them.

## Out of scope (don't worry about)

- The app icon (`src-tauri/icons/icon.ico`) — already final
- The installer EXE icon — derived from the app icon, already final
- In-app chrome — separate work
- Welcome / Finish page text — controlled by NSIS, not your concern

---

Let me know if anything in the spec is unclear or if you want different proportions / a different sidebar composition.
