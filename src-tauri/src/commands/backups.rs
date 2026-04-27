use chrono::Local;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

use crate::{authz, db};

fn yobo_documents_backups_dir() -> Result<PathBuf, String> {
  let docs = dirs::document_dir().ok_or_else(|| "Impossible de trouver le dossier Documents.".to_string())?;
  Ok(docs.join("YOBO").join("Backups"))
}

fn ensure_dir(path: &Path) -> Result<(), String> {
  fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupNowInput {
  pub user_id: i64,
}

#[tauri::command]
pub fn backups_create_now(input: BackupNowInput) -> Result<String, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, input.user_id)?;

  let dir = yobo_documents_backups_dir()?;
  ensure_dir(&dir)?;

  let ts = Local::now().format("%Y%m%d-%H%M%S").to_string();
  let filename = format!("yobo-backup-{}.sqlite", ts);
  let dst = dir.join(filename);

  let src = db::sqlite_db_path()?;
  fs::copy(&src, &dst).map_err(|e| e.to_string())?;

  Ok(dst.to_string_lossy().to_string())
}

