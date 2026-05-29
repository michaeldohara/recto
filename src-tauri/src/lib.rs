use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_decorum::WebviewWindowExt;

// Read a UTF-8 text file from disk and return its contents.
// Used for loading .md files dropped on the window or chosen via File → Open.
#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))
}

// Open the native file-picker dialog filtered to Markdown files.
// Returns the selected path, or None if the user cancelled.
// Implemented in Rust so the frontend can stay free of npm-package imports
// (and we can stay buildchain-free).
#[tauri::command]
async fn open_file_dialog(app: tauri::AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "mkd", "mdown", "mdwn", "mkdn"])
        .blocking_pick_file()
        .map(|fp| fp.to_string())
}

// Returns the app version (from Cargo.toml) and git short SHA
// (captured by build.rs). Displayed in the status bar so it's
// always clear which commit is running.
#[tauri::command]
fn get_build_info() -> serde_json::Value {
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "sha": env!("RECTO_GIT_SHA"),
    })
}

// Resolve the on-disk path for app state (lastMode, recents, scroll
// positions). Located in the OS-conventional per-user app data dir.
fn state_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create dir: {e}"))?;
    Ok(dir.join("state.json"))
}

// Load the persisted app state. Returns an empty object on first run.
#[tauri::command]
fn load_app_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let path = state_file(&app)?;
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let s = std::fs::read_to_string(&path).map_err(|e| format!("read: {e}"))?;
    serde_json::from_str(&s).map_err(|e| format!("parse: {e}"))
}

// Persist the app state. Whole-blob writes; tiny state, atomic enough.
#[tauri::command]
fn save_app_state(app: tauri::AppHandle, state: serde_json::Value) -> Result<(), String> {
    let path = state_file(&app)?;
    let s = serde_json::to_string_pretty(&state).map_err(|e| format!("serialize: {e}"))?;
    std::fs::write(&path, s).map_err(|e| format!("write: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_decorum::init())
        .setup(|app| {
            // Decorum injects its own min/max/close buttons into the main
            // window's titlebar so Win11 Snap Layouts work on hover.
            let main_window = app.get_webview_window("main").unwrap();
            main_window.create_overlay_titlebar().unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_markdown_file,
            open_file_dialog,
            get_build_info,
            load_app_state,
            save_app_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
