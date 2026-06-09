# Recto — Phase 27: Live reload + manual refresh button

**Status:** planning draft — awaiting your review
**Issue:** [#27](https://github.com/michaeldohara/recto/issues/27)
**Author:** Michael O'Hara + Claude
**Date:** 2026-06-03

---

## What we're building

Two related things, intentionally sequenced:

1. **Manual refresh** — a `Refresh` action in the 3-dot menu and an `F5` keyboard shortcut. Re-reads the currently-open file from disk and re-renders. Ships first because it's the safer fallback for any edge case the watcher misses.
2. **Auto-reload** — a file watcher on the open file's path. When an external editor (VS Code, Word, Notepad++, anything) saves a change, Recto detects it and re-renders automatically. No clicks needed.

Both preserve scroll position and view mode. Both work across all four supported formats.

## Why two pieces

The watcher will be reliable most of the time but file-system events are notoriously edge-case-prone (atomic saves, network drives, permissions, rapid writes). The manual refresh button is the always-works escape hatch. Even if auto-reload is perfect, the button is still useful — sometimes a user just wants to force a fresh read without leaving and re-opening.

If we shipped only auto-reload and a watcher bug stranded a user looking at stale content, they'd have no recovery. Ship manual first; layer auto on top.

## Architecture

### Manual refresh (Phase 27a)

Trivial. We already have `loadFile(path)` and per-file scroll-position memory. Refresh is:

1. Capture the current `STATE.path` and current scroll position before reload
2. Call `loadFile(STATE.path)` again
3. Restore scroll position after render completes

Menu wiring: new `data-act="refresh"` item in `src/index.html`, handler in `src/main.js`. `F5` keybinding in the existing `keydown` handler. Disabled state when no file is open (matches how `Save as Markdown…` already greys out for non-`.docx` files).

### Auto-reload (Phase 27b)

```
User opens file in Recto
  ↓
loadFile(path)
  ↓
Rust: watch_file(path) → notify crate registers OS-level watcher
  ↓
External editor saves the file
  ↓
notify emits Modify event
  ↓
Rust: debounce 200ms, emit Tauri event "file-changed" → frontend
  ↓
JS: receive event, capture scroll, call loadFile(path) again, restore scroll
  ↓
User sees updated content; no click required
```

Two new Rust commands:
- `watch_file(path)` — start watching a path; replaces any previous watcher
- `unwatch_file()` — stop watching (called when loading a different file or closing)

Frontend listens to a `file-changed` Tauri event and triggers the same refresh flow Phase 27a builds.

### Atomic-save handling

Many editors (Vim by default, VS Code on Windows, Word) don't write to the original file directly — they write to a temp file and rename it over the original. The notify watcher sees this as `Remove` followed by `Create` rather than `Modify`. If we naively unwatch on Remove, we lose the new file.

Strategy: on any event for our watched path (Modify, Remove, Create, Rename), debounce 200ms, then re-stat the path. If the file exists after the debounce window, reload from it. If it doesn't, show a banner. This naturally absorbs the temp-rename pattern as long as the new file lands on the same path within the debounce window (which it always does for atomic saves — that's the whole point of the pattern).

### Edge cases and how we handle them

| Scenario | Behavior |
|---|---|
| File saved via normal write | Detect → debounce → reload |
| File saved via atomic temp + rename | Detect Remove + Create → debounce → stat → reload (path still exists) |
| File deleted externally | Detect Remove → debounce → stat fails → show non-modal banner "File no longer exists; using last loaded version" |
| File renamed / moved | Same as deleted from our perspective; banner explains, user can re-open |
| File briefly locked mid-save | Reload fails with permission error → wait 100ms → retry once → if still fails, show banner |
| Binary file mid-save (corrupt .docx parse) | Catch parse error → keep displaying previous successful render → silent log → wait for next event |
| Very rapid writes (autosaving editor) | 200ms debounce coalesces; we read once per quiet period |
| User has no file open | Watcher inactive; refresh button disabled |
| User opens a different file | Unwatch old path, watch new path |
| Network drive / OneDrive / iCloud paths | notify supports these on Windows via ReadDirectoryChangesW; should work but worth a manual test |

## Phasing

### Phase 27a — Manual refresh (ship first)

- New menu item `Refresh` with `F5` shortcut
- Handler captures scroll → calls `loadFile(STATE.path)` → restores scroll
- Disabled state when `STATE.path` is empty
- One small change to `src/index.html`, one to `src/main.js`. No Rust changes, no new deps.
- **Estimate: ~30 minutes**
- **Risk: very low** — extends an existing function, doesn't change boot or file-load semantics

### Phase 27b — Auto-reload via file watcher

- Add `notify` crate to `Cargo.toml` (or use `tauri-plugin-fs` if simpler)
- Two new Rust commands: `watch_file(path)`, `unwatch_file()`
- Boot integration: call `watch_file` after every successful `loadFile`
- Frontend listens for `file-changed` Tauri event → triggers the Phase 27a refresh path
- Atomic-save handling: debounce + stat
- Edge-case handling: banner for delete/rename, retry-once for lock, swallow parse errors
- **Estimate: ~half day** (most of the time is in edge-case handling + manual testing)
- **Risk: medium** — file watching is famously finicky; needs real-world testing across editor styles (VS Code, Word, Notepad++, raw `echo > file.md` from PowerShell)

### Phase 27c — Manual testing matrix (before release)

Test that auto-reload works correctly when:
- VS Code saves a `.md`
- Word saves a `.docx`
- Notepad++ saves a `.json`
- PowerShell redirects to a `.xml` (`Set-Content`)
- File is deleted while open
- File is renamed while open
- File on OneDrive / network drive is modified by another machine
- App is left open for hours with no file changes (watcher leak check)

## Open questions

Things I'd want your call on before writing code. None are blockers; defaults exist for all of them.

1. **Where exactly does Refresh go in the menu?**
   - **A.** At the top, just under `Open file…` — grouped with file-input actions
   - **B.** At the bottom, near `Set as default app…` — grouped with utility actions
   - **C.** As a button in the title bar next to `Open` — most discoverable, costs titlebar real estate

   Default if you don't specify: **A** (top of menu, under Open file).

2. **Should auto-reload show a brief "Updated" indicator?**
   - **A.** Silent — content just updates, no UI cue (matches how editors work)
   - **B.** Quick toast at the bottom-right of the status bar for ~1 second
   - **C.** Subtle pulse on the file name in the status bar

   Default: **A** (silent). It's a viewer; loud notifications would feel intrusive.

3. **Auto-reload toggle in settings?**
   - **A.** Always on, no setting (simplest)
   - **B.** Default on, toggle in some future settings menu (we don't have one yet)

   Default: **A** (always on). Add a toggle if/when a real settings menu exists.

4. **Should Refresh always re-read from disk, or skip the read if file's modification time hasn't changed?**
   - **A.** Always re-read (simpler, slightly wastes I/O for unchanged files)
   - **B.** Compare mtime; skip the read if unchanged

   Default: **A** (always re-read). It's a viewer for human-sized documents; the I/O is trivial. Worry about optimization only if it matters.

## What this doesn't do

- No diff highlighting of changed regions (out of scope for this phase; could be a v2 feature)
- No "changes saved" / "changes lost" warnings (we're a viewer; the user's editor owns those concepts)
- No reload of the recents list or app state (only the currently-open file)
- No watching of an entire folder (single file only, until multi-doc view #26 ships and changes that frame)

## Estimate summary

| Phase | Effort | Risk |
|---|---|---|
| 27a — manual refresh | ~30 min | very low |
| 27b — auto-reload | ~half day | medium |
| 27c — testing matrix | ~1 hour | n/a |
| **Total** | **~4–5 hours** | mostly in 27b |

## Held pending your sign-off

Won't start coding until you've reviewed this doc and either approved or pushed back on the architecture / phasing / open questions. If you'd rather ship 27a alone and defer 27b, that's fine — manual refresh is independently useful.
