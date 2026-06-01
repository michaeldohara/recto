; ────────────────────────────────────────────────────────────────
; Recto — custom NSIS installer hooks
;
; Tauri's `fileAssociations` config adds Recto to the Windows
; "Open with" submenu. These hooks go further and add a **top-level**
; right-click verb labeled "Open with Recto" for every extension
; Recto handles, so users get to it in one click instead of two.
;
; Registry path:
;   HKCU\Software\Classes\SystemFileAssociations\<ext>\shell\OpenWithRecto
;
; HKCU (not HKLM) because the installer runs per-user (no admin).
; The SystemFileAssociations branch is the modern Windows alias that
; lets verbs attach to a file extension directly, regardless of which
; ProgID currently owns it. Survives even if the user later picks
; a different default opener for that extension.
;
; The uninstaller cleanly removes every key we added.
; ────────────────────────────────────────────────────────────────

!macro AddOpenWithRectoVerb _EXT
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${_EXT}\shell\OpenWithRecto" "" "Open with Recto"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${_EXT}\shell\OpenWithRecto" "Icon" "$INSTDIR\recto.exe,0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${_EXT}\shell\OpenWithRecto\command" "" '"$INSTDIR\recto.exe" "%1"'
!macroend

!macro RemoveOpenWithRectoVerb _EXT
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${_EXT}\shell\OpenWithRecto"
!macroend

; ── Installer: write the verbs after install completes ──────────
!macro NSIS_HOOK_POSTINSTALL
  ; Markdown family
  !insertmacro AddOpenWithRectoVerb ".md"
  !insertmacro AddOpenWithRectoVerb ".markdown"
  !insertmacro AddOpenWithRectoVerb ".mdx"
  ; Word
  !insertmacro AddOpenWithRectoVerb ".docx"
  ; JSON
  !insertmacro AddOpenWithRectoVerb ".json"
  ; XML family
  !insertmacro AddOpenWithRectoVerb ".xml"
  !insertmacro AddOpenWithRectoVerb ".xsd"
  !insertmacro AddOpenWithRectoVerb ".xsl"
  !insertmacro AddOpenWithRectoVerb ".xslt"
  !insertmacro AddOpenWithRectoVerb ".rss"
  !insertmacro AddOpenWithRectoVerb ".atom"
!macroend

; ── Uninstaller: clean up every key we wrote ────────────────────
!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro RemoveOpenWithRectoVerb ".md"
  !insertmacro RemoveOpenWithRectoVerb ".markdown"
  !insertmacro RemoveOpenWithRectoVerb ".mdx"
  !insertmacro RemoveOpenWithRectoVerb ".docx"
  !insertmacro RemoveOpenWithRectoVerb ".json"
  !insertmacro RemoveOpenWithRectoVerb ".xml"
  !insertmacro RemoveOpenWithRectoVerb ".xsd"
  !insertmacro RemoveOpenWithRectoVerb ".xsl"
  !insertmacro RemoveOpenWithRectoVerb ".xslt"
  !insertmacro RemoveOpenWithRectoVerb ".rss"
  !insertmacro RemoveOpenWithRectoVerb ".atom"
!macroend
