# Recto — AI features planning doc

**Status:** draft — **held pending v1 launch signal**
**Author:** Michael O'Hara + Claude
**Date:** 2026-05-29 *(updated 2026-05-31: narrowed Phase 7 v1 scope to AI search only; locked questions 1, 4, 5)*

---

## v1 scope narrowing (2026-05-31)

After post-v1-ship reflection, Phase 7 v1 is narrowed to **AI-powered search only** — the one feature most likely to make Recto stand out as a reader. Everything else moves to "Beyond v7.0":

- ✅ **v7.0 ships:** AI-augmented natural-language search within the current document (with text-search fallback when no key is connected)
- ⏸️ **Beyond v7.0** (planning preserved, implementation deferred):
  - Ask-about-this-doc chat panel
  - Selection → "Explain this" popover
  - TL;DR / summary
  - Translate selection
  - Reading-level adjustment

This is held pending v1 launch signal (same triggers as Phases 8/9 — see [`PHASE-89-FORMATS-PLAN.md`](PHASE-89-FORMATS-PLAN.md)).

---

---

## The frame

Recto is a **viewer**, not an editor. AI features should make the viewing experience better — helping the reader *understand* what's on the page, not generating new content the user has to evaluate. We are **not** trying to be Notion AI or a chatbot.

Operating constraints:
- **BYOK (Bring Your Own Key).** User pastes their own API key. We never host inference, never bill, never log prompts on our infrastructure (we have none). User's text → user's chosen provider → user's account.
- **Sidecar, not centerpiece.** AI is opt-in, hidden when no key is set. The plain viewer experience must remain unchanged for users who never connect a key.
- **Restrained UI.** Match the designer's Spread aesthetic — clay accent on AI actions, no visual noise, no chatbot-style floating bubbles.
- **Privacy-explicit.** Any time text leaves the machine, the user knows it (first-run disclosure + visible "sending to <provider>" indicator on each call).
- **Cost-transparent.** Show approximate token count before sending large requests; show running session cost in a status-bar slot.

## Candidate feature set, ranked by value-vs-effort

### Tier 1 — Ship first, highest signal

1. **Ask about the current doc** *(chat panel, single-turn or short-turn)*
   "Summarize the introduction." / "What are the prerequisites?" / "Explain the architecture diagram."
   - Whole-doc context, user question, streamed answer
   - Maybe 80% of why someone would want AI in a viewer

2. **Explain selection** *(highlight → popover action)*
   Select a paragraph or term, "Explain this" → inline expansion in a side panel
   - Lower-friction than chat; great for technical docs full of jargon

3. **Natural-language search within doc**
   `Ctrl+F`-style overlay but accepts "where does it discuss caching" instead of exact text matching
   - Fits naturally with the deferred-from-Phase-4 `Ctrl+F` feature

### Tier 2 — Strong but not v1

4. **TL;DR / summary** — one-button summary of the current doc; useful when triaging unfamiliar files
5. **Translate selection** (or whole doc) — when reading docs in another language
6. **Reading-level adjustment** — "ELI5" / "give me the engineer's version" of a passage

### Tier 3 — Maybe / interesting but scope risk

7. **Search across recent files** — natural-language across the recents list
8. **Question-generation** — quiz-style questions about a doc (study aid)
9. **Cross-doc compare** — semantic diff of two open documents

### Out of scope, hard no

- Anything that **writes back** to the source file (we're a viewer)
- Image generation
- Code execution
- Voice (TTS/STT)

## Architecture sketch

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (vanilla JS in WebView)                           │
│  - AI sidebar panel + selection popover                     │
│  - Streams responses, renders markdown reply incrementally  │
│  - Never holds the API key in memory long-term              │
└────────────────────────────┬────────────────────────────────┘
                             │ invoke('ai_*', { ... })
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Rust (src-tauri/src/ai.rs)                                 │
│  - Secure key storage via Tauri stronghold OR Windows       │
│    Credential Manager (open question, see below)            │
│  - HTTP client to provider API                              │
│  - Streaming responses via Server-Sent Events → emit Tauri  │
│    events to frontend (ai-chunk, ai-done, ai-error)         │
│  - Token counting (rough — provider's own counts in usage   │
│    block of response)                                       │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             ↓
                    Provider API (Anthropic / OpenAI)
```

**Why Rust proxy and not direct from JS:**
- API key never enters JavaScript memory — stays in Rust-side secure storage, only the response chunks cross IPC
- Easier to swap providers without touching frontend
- Easier to centrally enforce rate limits / cost caps later

## UI integration concept

**No new chrome when no key is connected.** Recto looks identical to v0.1.0.

**With a key connected:**

- **New menu item** in the 3-dot dropdown: "Ask Recto…" (`Ctrl+K`)
- **Right-side drawer** (mirrors TOC drawer on the left), `Ctrl+;` to toggle, ~360px wide
  - Top: "Ask about this doc" input field, Send button (clay-accented)
  - Body: scrolling conversation log (current doc as implicit context)
  - Footer: cost meter (`~$0.0023 this session`), Disconnect link
- **Selection popover** when text is highlighted in the doc — small floating chip near the selection with one button: "Explain"
- **Status bar gains** a small `AI` badge between the build version and the mode label when connected
- **First-run disclosure** modal on first attempt to use AI: explains what gets sent and to whom, prompts for key

**No floating chatbot bubble. No always-visible AI button. No notifications.**

## Phasing

Mirror the v1 phased approach — each ship-able, each demoable.

| Phase | Scope | Estimate |
|---|---|---|
| **7a — Foundation** | Settings UI for paste-key / forget-key, secure storage, test-connection round-trip, AI menu item gated on key-present | ~1 day |
| **7b — Ask sidebar** | Right-side drawer, single-turn ask-about-this-doc, streaming responses, basic conversation log | ~1.5 days |
| **7c — Selection explain** | Highlight → floating popover → "Explain this" action → inline answer in sidebar | ~½ day |
| **7d — NL search** | Bring back the deferred `Ctrl+F` but AI-augmented when key present (fall back to text match when not) | ~1 day |
| **7e — Polish + cost guards** | Cost meter, per-request token preview before send, monthly soft cap with warning, multi-turn refinement | ~1 day |

Tier 2 features (summary, translate, reading-level) come after 7e as small additions.

## Open questions — your call before I draft Phase 7a

1. ~~Provider — Anthropic only, OpenAI only, or both?~~ ✅ **DECIDED: Anthropic-only for v1.**
   Multi-provider support (OpenAI, Gemini, Ollama, etc.) tracked separately — see [issue #8](https://github.com/michaeldohara/recto/issues/8). v1 ships with a single provider integration and a clean enough abstraction that adding a provider later is additive, not a rewrite.

2. **Key storage backend:**
   - **Tauri Stronghold** (encrypted file with passphrase) — most secure, but user has to set a passphrase the first time, which is friction
   - **Windows Credential Manager** (`keyring` crate) — no passphrase, integrates with OS, less ceremony, slightly less hardened
   - **Plain config file in app data** — easiest to implement, terrible idea, don't
   - **My recommendation:** Credential Manager. The friction tradeoff of Stronghold isn't worth it for personal-use BYOK.

3. **Default model:**
   - For Anthropic: Claude Sonnet 4.5 / 4.6? Or Haiku for cost? User-configurable in settings?
   - **My recommendation:** Default Sonnet 4.6 (matches what user uses elsewhere). Settings dropdown for switching to Haiku for cheaper / faster responses.

4. ~~Cost cap UI~~ ✅ **DECIDED: estimate-labeled running indicator, no hard cap.**
   Status-bar shows running session cost as an *estimate* (with tooltip explaining it's based on published rates and may not reflect prompt caching / enterprise contracts / credits). No hard refuse — user's provider-side billing limits remain the source of truth.

5. ~~Multi-doc context in v1?~~ ✅ **DECIDED: single-doc only for v1.**
   Multi-doc context (asking across recents, asking across a folder) needs chunking + retrieval + likely embeddings. Real complexity step that earns its own phase post-1.0 — separate issue when we get there.

6. **Monetization tie-in:**
   - You said in our monetization talk that v1 doesn't go paid. Does that hold for AI features?
   - Could AI features eventually be a "Pro" gate (free version views, Pro version connects AI)?
   - **My recommendation:** AI stays free + BYOK in v1.x. The BYOK model means we pay nothing per user; gating it behind Pro fights the "user brings their own value" frame. If you eventually want a paid tier, gate something OTHER than AI (e.g., themes, sync, multi-window).

## What I'd want from you next

Pick the path on questions 1–6 (or push back on any of the assumptions) and I'll fold the answers into a tightened version of this doc + start drafting the Phase 7a sub-tasks. No code until that's signed off.

If the whole framing feels wrong — say so. Easier to redirect now than after I've written 600 lines of Rust HTTP client.
