use tauri::Manager;

#[tauri::command]
fn quit_app(app_handle: tauri::AppHandle) {
  let _ = std::process::Command::new("pkill")
    .arg("-f")
    .arg("mcpProxy.mjs")
    .output();

  for (_label, window) in app_handle.webview_windows() {
    let _ = window.close();
  }

  std::process::exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![quit_app])
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(desktop)]
      {
        // Start the background node proxy for NotebookLM on Mac
        let _ = std::process::Command::new("/usr/local/bin/node")
          .arg("/Users/julio/projects/Renal_Review/skola-main/server/mcpProxy.mjs")
          .spawn();
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
