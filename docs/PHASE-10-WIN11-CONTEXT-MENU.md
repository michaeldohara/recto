# Recto — Phase 10: Win11 first-panel right-click menu

**Status:** **SHELVED 2026-06-01** — testing showed our v1.0.1 NSIS-registered verb already lands on the Win11 first-panel a meaningful fraction of the time. Not deterministic (Microsoft's compact-menu heuristics aren't fully documented), but "Open with Recto" is on the first panel often enough that the engineering cost of the sparse-package / IExplorerCommand path doesn't pay off relative to other work. Doc preserved for if Win11 changes behavior or the heuristics shift against us.
**Author:** Michael O'Hara + Claude
**Date:** 2026-06-01

## Why shelved

Initial scoping assumed registry-verb apps **always** land in the "Show more options" submenu, never on the first panel. Empirical testing on real Win11 installs after shipping v1.0.1 contradicted that — the entry appears on the first panel inconsistently but often. The original scoping doc framed sparse-package + IExplorerCommand as the only path to first-panel placement; that was incorrect.

The technical analysis below is still accurate about the *interfaces and registration mechanisms* — useful reference if we need to revisit. But the cost/benefit no longer justifies starting the work today.

Re-open this doc when:
- Win11 update measurably changes the heuristics and our verb falls out of first-panel placement
- Recto gets enough users that the inconsistent placement becomes a recurring support burden
- The set-as-default-prompt alternative is built and we want to also tackle the "not-default user" path

---

---

## The problem

v1.0.1 ships with NSIS-registered "Open with Recto" verb. The verb works (after the v1.0.1 argv fix), but it lands in Windows 11's **"Show more options"** submenu — not the compact first-panel that appears by default. To hit that first panel, the app has to go through a Win11-specific shell-extension path that classic registry verbs can't reach.

Reference: Notepad++, WinRAR, 7-Zip (post-2022) all ship first-panel entries via this mechanism.

## Why the registry-verb approach can't reach the first panel

Win11's compact context menu (introduced in 22H2) is **curated**. Microsoft only shows entries from apps that:

1. Are packaged as **MSIX or sparse-packaged** (so Windows can trust the entry's declared metadata)
2. Register an **IExplorerCommand** handler in their `.appxmanifest`
3. Implement the actual COM interface so Windows can call into the app at right-click time

Classic registry verbs (what we have) auto-route to the legacy "Show more options" submenu. The path to first-panel placement isn't a different registry key — it's a different *architecture*.

## The architecture, end to end

```
                  Recto repo (NSIS-installed today)
                          │
                          ├──  recto.exe              (main app — unchanged)
                          ├──  recto-shell.dll       ← NEW: COM server, IExplorerCommand impl
                          └──  Package.appxmanifest  ← NEW: declares the shell extension
                                  ↓
                          Built + signed → recto-shell.appx
                                  ↓
                          Registered via NSIS post-install step
                                  ↓
                  Windows 11 picks it up → first-panel right-click entry
```

Three new components:

1. **`recto-shell.dll`** — Rust DLL implementing the `IExplorerCommand` COM interface. When the user opens the right-click menu on a `.md`/`.docx`/etc., Windows loads this DLL into `explorer.exe`, calls `GetTitle()`/`GetIcon()`/`GetFlags()` to decide whether/how to show our entry, and calls `Invoke()` if the user clicks it. The DLL spawns `recto.exe <selected-path>` and exits.

2. **`Package.appxmanifest`** — XML manifest declaring the shell extension. Identifies the COM server, the file types it activates for, the display name, etc. Tiny file — maybe 60 lines.

3. **Sparse package wrapper** — packs the manifest + a stub `.appx` that registers the COM server with Windows. Sparse packages don't deploy the app contents (the NSIS installer still does that) — they only register the metadata needed for shell extensions. Signed `.appx` file is installed post-NSIS-install via a `Add-AppxPackage` PowerShell call (or via `PackageManager` API from Rust).

## Phases

### Phase 10a — Build the IExplorerCommand DLL

- New Rust crate at `src-tauri/recto-shell/` — separate from the main `recto` crate (different output type: `cdylib`, not `bin`)
- Dependencies: `windows` crate (Microsoft's official Win32/COM bindings for Rust), `serde` for any config
- Implement `IExplorerCommand` with these methods:
  - `GetTitle()` → "Open with Recto"
  - `GetIcon()` → path to `recto.exe,0`
  - `GetFlags()` → ECF_DEFAULT (or hide for non-matching extensions)
  - `GetState()` → enable/disable based on file extension
  - `Invoke()` → spawn `recto.exe` with selected file paths
- Implement `IObjectWithSite`, `IClassFactory`, the standard COM scaffolding
- Build target: `recto_shell.dll`
- **Estimate: 1 day** (most COM scaffolding is boilerplate; `windows-rs` examples for `IExplorerCommand` exist)

### Phase 10b — Sparse package + manifest + NSIS integration

- Write `installer/sparse/Package.appxmanifest` declaring the shell extension, file type activations, COM CLSID
- Build script generates a `.appx` from manifest + the DLL using `makeappx` (ships with Windows SDK)
- Extend `src-tauri/installer/recto-hooks.nsh` to:
  - **POSTINSTALL:** call `Add-AppxPackage -ExternalLocation $INSTDIR recto-shell.appx`
  - **PREUNINSTALL:** call `Remove-AppxPackage Recto.Shell_<version>`
- Test install → right-click → entry appears on first panel
- **Estimate: 1 day** (mostly XML + PowerShell wiring; manifest schema has many fields but only a few matter for our use)

### Phase 10c — Code signing

The sparse package **must be signed** for Windows to install it without errors (sideloading restrictions). Three sub-options:

| Cert type | Cost | Effect |
|---|---|---|
| Self-signed | $0 | Works for dev / personal use; users see "Unknown publisher" SmartScreen warning on install |
| Standard OV cert (Sectigo / DigiCert) | $200-500/year | Removes "Unknown publisher"; still builds SmartScreen reputation over many installs |
| EV cert | $300-1000/year + hardware token | Instant SmartScreen reputation, no warnings for any user |

The signing also extends to the **NSIS installer itself** — currently unsigned, which means v1.0.x users already see a SmartScreen warning. Signing the installer is a separate-but-related win that comes for free with a cert purchase.

CI integration: GitHub Actions can sign the build automatically if we store the cert in repo secrets. ~30 min one-time setup.

**Estimate: ½ day** for signing pipeline + GitHub Actions integration once a cert is in hand. Cert procurement itself is a few hours of paperwork.

## Cost summary

| | Time | Money |
|---|---|---|
| 10a: COM DLL | 1 day | — |
| 10b: Sparse package + NSIS integration | 1 day | — |
| 10c: Signing pipeline | ½ day | $200-500/year (standard cert) |
| Total | **2.5 days + cert** | **~$300/yr if signed** |

## Alternatives considered

### Stay with current behavior, accept "Show more options" placement
- **Pro:** zero work
- **Con:** ongoing minor friction for every user

### Ship registry hack as in-app setting
- An in-app preference "Add Recto to Win11 classic right-click menu" that writes the `InprocServer32` blank-CLSID hack we mentioned in v1.0.1 release notes
- **Pro:** one Tauri command + checkbox, ~½ day
- **Con:** affects ALL right-click menus globally (not just Recto's), users may not want that
- **Verdict:** mention in README as opt-in user workaround; don't ship as a Recto feature

### Ship via Microsoft Store (full MSIX)
- **Pro:** Microsoft signs the package; first-panel placement; auto-update infrastructure
- **Con:** Store submission process, Microsoft takes 12-15% if monetized, much heavier packaging requirements, less flexibility, slow review cycles
- **Verdict:** not aligned with the small-side-project / direct-distribution identity. Revisit only if Recto pivots to commercial.

### Skip first-panel, polish set-as-default flow instead
- On first launch, prompt "Make Recto the default opener for .md / .docx / .json / .xml?"
- After "Yes", double-click works for all of them — no right-click needed
- **Pro:** much less engineering (~½ day), removes the need for first-panel placement for most workflows
- **Con:** users who don't want Recto as default still hit the right-click friction
- **Verdict:** **strong contender** — see Open Question #1 below

## Open questions for your review

### 1. Is the first-panel right-click really the highest-leverage workflow win?

The alternative — **prompt-to-set-as-default on first launch** — solves the same root pain (clunky workflow to open files in Recto) with much less work. If the user makes Recto the default opener for `.md`, double-clicking the file in Explorer "just works" forever. No right-click needed.

Counter: some users explicitly **don't** want Recto as default (they keep VS Code as default for `.md` editing, want Recto only when reading). For those users, first-panel right-click is the right answer.

**My recommendation:** ship the set-as-default-prompt as Phase 10a (½ day) first. See if it sufficiently addresses the friction. If users still want first-panel right-click for the "not-default-but-easy-to-reach" case, do the full sparse package work as Phase 10b.

### 2. Self-signed (free) or pay for a cert?

Self-signed works for personal use + a small audience comfortable with "Unknown publisher" warnings. Standard cert is ~$300/yr and removes that warning.

For Recto's portfolio-piece identity, a signed installer is a meaningful polish — shows you know what you're doing. But it's $300/yr ongoing.

**My recommendation:** self-signed for v1.x; revisit signing if and when Recto hits real distribution (WinGet, public launch, real user growth).

### 3. Single dev cert or shared with other projects?

If you anticipate other personal projects that'd benefit from signing, a single cert can sign multiple binaries. Sectigo and DigiCert both support this.

**My recommendation:** if you're already paying, get one that can sign all your work. Reduces per-project overhead.

### 4. Should we tackle the *unsigned NSIS installer* SmartScreen warning at the same time?

Currently `Recto_1.0.1_x64-setup.exe` triggers SmartScreen on first install ("Unknown publisher / Don't run / More info → Run anyway"). This is bigger user-friction than the right-click submenu thing.

If we're going to procure a cert anyway, signing the NSIS installer should happen first — bigger win per dollar.

**My recommendation:** sequence as (1) prompt-to-set-as-default, (2) sign NSIS installer if going paid-cert route, (3) sparse package + IExplorerCommand for first-panel right-click. Each step is independently shippable.

## Held pending your call on the open questions

This work doesn't start until questions 1–4 are answered. The doc captures the thinking; the implementation phases will be created as tasks once we lock the approach.

If you pick:
- **Question 1 → "ship set-as-default prompt first":** that becomes a quick v1.1.0 (half-day work, no cert needed)
- **Question 1 → "go straight to sparse package":** Phase 10 proper, full 2.5 days + cert decision
- **Question 4 → "sign the installer first":** standalone v1.0.2 (signing pipeline + cert), then either path on Question 1
