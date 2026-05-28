# Recto — Design System

Quick reference for the visual identity. Lives alongside `PLANNING.md`. Mockups are in this same folder; open `preview.html` in a browser to compare.

## Brand pillars

- **Document-centric.** The app gets out of the way; the Markdown content is the product.
- **Type-driven.** No decorative chrome. Where typography can do the work, illustration shouldn't.
- **Restrained.** Monochrome warm grays plus one accent. Single typeface family for UI. No gradients, no shadows, no skeuomorphism.

## Logo

- **Direction A (recommended):** Pure wordmark — `recto` set in a heavy geometric sans, tightly tracked. App icon is the letter `R` in the same treatment, on a 12% rounded square. No illustrative glyph.
- Mockup fonts use the system fallback (Segoe UI Variable on Windows 11); final production would use a licensed typeface (Inter Display Black, GT America Black, or Söhne Breit Kraftig) or a custom-drawn letterform.
- Two alternate directions (B: page-corner mark, C: open-book spread) sketched in `preview.html` for comparison only.

## Color palette

### Light mode
| Role | Hex | Notes |
|---|---|---|
| Background | `#fafaf9` | Warm off-white (not pure) |
| Text | `#1c1917` | Near-black, warm |
| Text muted | `#57534e` | Secondary copy, status bar |
| Accent | `#1e3a8a` | Deep ink blue — active state, focus rings, current-position markers |
| Separators | `#e7e5e4` | Hairlines |

### Dark mode
| Role | Hex | Notes |
|---|---|---|
| Background | `#1c1917` | |
| Text | `#fafaf9` | |
| Text muted | `#a8a29e` | Bumped lighter for legibility |
| Accent | `#3b5fc9` | Lighter blue for legibility on dark |
| Separators | `#3f3a37` | |

## Typography

| Where | Typeface | Weight | Notes |
|---|---|---|---|
| UI chrome (title bar, menus, status bar) | Inter | 500 / 600 | Tabular numerals for status-bar numerics |
| Rendered mode body | Inter | 400 | 16 px base, line-height 1.6 |
| Memo mode body | Charter (fallback: Georgia) | 400 | 11 pt for print, serif for letterhead feel |
| Raw mode body | JetBrains Mono (fallback: Cascadia Code, SF Mono) | 400 | Monospaced, all syntax visible |
| Wordmark | Inter Display Black (final: licensed/custom) | 900 | Tightly tracked (-4% to -5% letter-spacing) |

Fallback chains in CSS:
```css
--font-sans: 'Inter', 'Segoe UI Variable', system-ui, -apple-system, sans-serif;
--font-serif: 'Charter', 'Iowan Old Style', 'Georgia', serif;
--font-mono: 'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace;
```

## Window chrome

- **Custom title bar.** 32 px tall, wordmark flush-left, three-dot menu flush-right. Borderless feel — no traffic-light row, no large nav.
- **Status bar.** 24 px tall, hairline divider above. Left to right: filename · word count · reading time. Right-aligned: current view mode (`Raw` / `Rendered` / `Memo`). Tabular numerals throughout.
- **TOC sidebar** (when toggled with `Ctrl+\`): slides in from the left, 260 px wide. Hairline divider on the right edge. Indented heading hierarchy. Current heading marked with a 2 px accent bar on the left edge.
- **Document area:** centered, max-width 740 px (rendered) or 720 px (memo), generous vertical padding.

## Icons in UI

Lucide only. Consistent 1.5 px stroke width. Used sparingly — file menu actions, mode switcher, sidebar toggle. No icons where text suffices.

## Motion

Minimal. The only animation in v1 is the TOC sidebar slide (180 ms ease-out). View-mode swaps are instant (no fade) — they're a stylesheet change, and the snap feels responsive rather than animated.
