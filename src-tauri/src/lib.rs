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
            open_file_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
