# Recto — Privacy

**Short version: Recto collects nothing, sends nothing, and never phones home.**

Recto is a local-only Windows desktop application. The viewing of your `.md`, `.docx`, `.json`, and `.xml` files happens entirely on your machine. No file contents, file paths, usage metrics, or identifying information ever leave your device.

## What Recto does NOT do

- **No telemetry.** No usage statistics, feature-tracking, "anonymous diagnostics," or pings of any kind.
- **No analytics.** No third-party analytics scripts, no Google Analytics, no Plausible, nothing.
- **No crash reporting.** Recto does not send error reports anywhere. If it crashes, that information stays on your machine.
- **No remote calls.** Recto does not contact any server, including ours (we don't have one). It does not check for updates by calling out — update checks happen only when you manually visit the GitHub releases page.
- **No accounts.** No sign-in, no user identity, no cloud profile.
- **No cookies, no tracking pixels, no fingerprinting.**

## What Recto stores locally on your machine

All of the following lives at `%APPDATA%\com.michaeldohara.recto\state.json` and is read/written only by Recto itself:

- The list of recently-opened file paths (most-recent 10)
- The view mode you last used (raw / rendered / memo)
- Your scroll position per file (so reopening a doc resumes where you left off)
- Whether you dismissed the "set as default app" prompt

You can delete `state.json` at any time. Recto will recreate it empty on next launch.

Windows file associations registered by the installer live in your registry under `HKCU\Software\Classes\SystemFileAssociations\*\shell\OpenWithRecto`. The uninstaller removes them cleanly.

## Bring-your-own-key AI features (future)

If a future version of Recto adds AI-assisted features (planned for v7.0, currently held), those will use a **Bring Your Own Key** model: you paste your own Anthropic API key into Recto's settings; Recto sends your selected text directly to Anthropic's API using your key; the response comes back to you.

**We never proxy AI traffic, never see your key, and never see your prompts or responses.** Your billing relationship is between you and Anthropic.

The first time you trigger an AI feature, Recto will show a clear disclosure explaining what data is being sent and to whom, with an opportunity to cancel.

## Paid "Recto Cloud" features (eventual, optional)

If we ever offer paid hosted services (cloud sync, hosted "curated" AI, theme marketplace — see [`docs/MONETIZATION-PLAN.md`](docs/MONETIZATION-PLAN.md)), those will have their own clearly-published privacy policy at the point they ship. The free, open-source Recto installer this document covers will always remain local-only.

## Open source

Recto is MIT-licensed and the full source is at https://github.com/michaeldohara/recto. You can verify everything in this document by reading the code.

## Questions

Open an issue at https://github.com/michaeldohara/recto/issues if anything here is unclear or if you notice a behavior in Recto that contradicts this policy.

---

*Last updated: 2026-06-02*
