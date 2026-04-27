use crate::{authz, db};

#[tauri::command]
pub fn database_save_backup_dialog(user_id: i64) -> Result<String, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;
  drop(conn);

  let src = db::sqlite_db_path()?;
  let dest = rfd::FileDialog::new()
    .set_file_name("yobo-backup.sqlite")
    .save_file()
    .ok_or_else(|| "Annulé.".to_string())?;

  std::fs::copy(&src, &dest).map_err(|e| format!("Copie impossible : {}", e))?;
  Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn database_restore_pick_dialog(user_id: i64) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;
  drop(conn);

  let picked = rfd::FileDialog::new()
    .add_filter("SQLite", &["sqlite", "db"])
    .pick_file()
    .ok_or_else(|| "Annulé.".to_string())?;

  let dest = db::sqlite_db_path()?;
  std::fs::copy(&picked, &dest).map_err(|e| format!("Restauration impossible : {}", e))?;
  Ok(())
}
