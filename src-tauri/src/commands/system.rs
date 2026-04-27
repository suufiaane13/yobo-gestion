
#[tauri::command]
pub fn relaunch(app_handle: tauri::AppHandle) {
  app_handle.restart();
}
