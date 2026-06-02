# Recto — Monetization plan

**Status:** strategic framing, not active work. Reference doc for when paid-tier development becomes worthwhile.
**Author:** Michael O'Hara + Claude
**Date:** 2026-06-01

---

## Frame

Recto v1.x ships free. The product itself — viewing markdown / docx / json / xml with three modes, export, recents, reading-position memory — is permanently free, permanently open source. That's the audience-trust baseline.

A paid tier eventually exists for users who want **what we provide ongoing value for** — either things that cost us money to run (cloud sync, hosted AI) or things requiring substantial creator-tools work (theme marketplace authoring).

The rule, in one sentence: **never gate something the user already pays a third party for.**

## Free tier (forever, no friction)

Everything that exists in v1.x:

- All three view modes (raw / rendered / memo) for all four formats (md / docx / json / xml)
- Export to PDF (via OS print) and self-contained HTML
- Save as Markdown for .docx
- Recent files, reading-position memory, last-mode persistence
- Custom titlebar, Win11 Snap Layouts, drag-drop, file associations
- **BYOK AI** — user pastes own Anthropic key, all AI features unlock (see [`AI-FEATURES-PLAN.md`](AI-FEATURES-PLAN.md))
- Use of any community-built theme

The free tier is the portfolio piece. Polished, complete, no nag screens, no upgrade prompts. This is what builds the audience.

## Paid tier (eventually)

The rule for what gets gated: **(a) we have ongoing infrastructure cost per user, OR (b) we provide substantial work-product value the user can't get free elsewhere.**

### Strong paid-tier candidates

| Feature | Why it fits | Cost shape |
|---|---|---|
| **Recto Cloud Sync** — recents, reading positions, settings, theme choice across machines | We run storage / sync server. Real ongoing per-user cost. | Hosting + S3-equivalent: maybe $0.05–$0.20/user/month at small scale |
| **Recto AI (curated)** — user doesn't manage an Anthropic key; we proxy through our account | Zero-friction for non-developers / non-power-users. We pay Anthropic per token. | Real per-token cost; price above margin. ~$5–$10/month flat |
| **Annotations + highlights** with cloud-synced persistence | Combines workflow value with sync infrastructure | Storage cost |
| **Remote source integration** — WebDAV, S3, Dropbox, OneDrive folders as document sources | Significant engineering, ongoing maintenance per integration | No per-user runtime cost; real dev cost |

### Maybe-paid (depends on usage shape)

| Feature | Notes |
|---|---|
| **Theme creator tools** (advanced visual editor, publish-to-marketplace flow) | Free side: install + use any community theme. Paid side: tools for *authoring + publishing* themes. Marketplace itself stays free for browsers. |
| **Multi-window / split view** — read two docs side-by-side, sync scrolling | Pure engineering, no per-user cost. Could be free. Industry convention is to use this as a "Pro" gate. |
| **OCR for scanned PDFs** | If we ship PDF support someday (currently out of scope per Format Scope in PLANNING.md). OCR backend determines cost: local Tesseract = free; API-based = per-user. |

### Permanently free (never gated)

- Core viewing (every format Recto supports — md, docx, json, xml, anything we add later)
- BYOK AI (user brings own key)
- Basic theme installation (drop a `.recto-theme.css` in `%APPDATA%\Recto\themes\`)
- Export to PDF and HTML
- File associations, recents, reading position — anything that makes the daily experience work

Charging for these would erode the audience trust that the polished free viewer earned.

## The two-tier AI model in detail

Per the lock-in from [`AI-FEATURES-PLAN.md`](AI-FEATURES-PLAN.md) Q6:

| | Free tier | Paid tier |
|---|---|---|
| Configuration | User pastes own Anthropic API key | User toggles "Recto AI" on in settings |
| Billing | User pays Anthropic directly per token | User pays Recto a flat monthly fee |
| Provider | Anthropic (key user owns) | Anthropic (key we own) |
| Feature parity | All AI features unlocked | All AI features unlocked |
| What we charge for | $0 — nothing | The convenience of not managing a key + the abstraction layer |

**Critical:** feature parity is the same. The paid tier doesn't unlock *more* AI capability — it removes the *friction* of having an Anthropic account. This keeps the offer honest. A power user with their own key isn't being punished; a casual user without one isn't being excluded.

## The theme marketplace concept

If the theme system gets to a community-built ecosystem (à la VSCode themes, Obsidian themes, Sublime color schemes):

- **Free:** install any theme. Drop a `.recto-theme.css` in the themes folder OR install from the gallery (gallery is a curated GitHub-hosted list with one-click install).
- **Free:** basic in-app theme editor — color pickers + font dropdowns + live preview, outputs a CSS file.
- **Paid:** advanced theme creator tools — type ramp editor, contrast checker, batch export, "publish to gallery" workflow that proposes a PR to the manifest repo automatically.
- **Marketplace dynamics:** creators can monetize their themes directly via their own gallery profiles (we take a small cut; or stay completely hands-off and let creators self-distribute). Stays an idea, not a commitment.

The architectural work in v1.x that enables this: extending the `data-edition` token system to load a third (or Nth) custom-CSS edition from a user-writable folder. Cheap, additive, sets up the marketplace without committing to building it now. Tracked as a v1.1 stub idea — not built yet.

## What this means for current work

- **AI features (Phase 7 / `AI-FEATURES-PLAN.md`)** — built free as BYOK. Curated AI tier requires infrastructure work we're not committed to until launch signal warrants it.
- **Cloud sync** — separate planning doc when we get there. Real backend work; not v1.x.
- **Theme system stub** — small v1.1 ask: extend CSS variable token system to support `data-edition="custom"` + load user-provided CSS. Sets up marketplace without committing to building marketplace. Tracked as backlog if/when we want to make this concrete.

## When this becomes real

The trigger for actually building paid-tier features is **enough usage to justify the engineering and infrastructure investment.**

Practical thresholds:
- ~500+ regular users → cloud sync is worth building (enough demand + enough engineering ROI)
- ~50+ users asking specifically for Recto AI without managing keys → curated AI tier worth piloting
- ~5+ third-party themes published organically → theme marketplace polish becomes worthwhile

Below those thresholds, paid-tier work is premature. The strongest move for Recto today is to keep the free tier excellent and let the audience build.

## Indefinite scope guard

Even if Recto gets popular: **the free tier never shrinks.** If a feature is in the free tier on the day a user installed, it stays in the free tier for them forever. No retroactive paywalls. No "you used to be able to do X for free, now it's $5/month." That's a one-shot reputation kill, no recovery.

New features can launch paid. Existing free features stay free. That's the durable trust frame.
