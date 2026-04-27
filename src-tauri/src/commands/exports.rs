use rusqlite::Connection;
use serde::Deserialize;
use std::path::{Path, PathBuf};

use crate::{authz, db};

fn yobo_documents_root() -> Result<PathBuf, String> {
  let docs = dirs::document_dir().ok_or_else(|| "Dossier Documents introuvable.".to_string())?;
  Ok(docs.join("YOBO"))
}

fn ensure_dir(p: &Path) -> Result<(), String> {
  std::fs::create_dir_all(p).map_err(|e| format!("Création dossier impossible : {}", e))?;
  Ok(())
}

fn ensure_active_user(conn: &Connection, user_id: i64) -> Result<(), String> {
  let _ = authz::active_user_role(conn, user_id)?;
  Ok(())
}

fn map_export_subdir(kind: &str) -> Option<&'static str> {
  match kind.trim().to_lowercase().as_str() {
    "csv" => Some("Exports\\CSV"),
    "logs" => Some("Exports\\Logs"),
    "qr" => Some("Exports\\QR"),
    "pdf" => Some("Exports\\PDF"),
    "sql" => Some("Exports\\SQL"),
    "images" => Some("Exports\\Images"),
    "backups" => Some("Backups"),
    _ => None,
  }
}

fn sanitize_filename(name: &str) -> String {
  let raw = name.trim();
  if raw.is_empty() {
    return "export.txt".to_string();
  }
  raw
    .chars()
    .map(|c| match c {
      '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
      _ => c,
    })
    .collect::<String>()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportWriteTextInput {
  pub user_id: i64,
  /// csv | logs | qr | pdf | sql | images | backups
  pub kind: String,
  pub filename: String,
  pub content: String,
}

#[tauri::command]
pub fn exports_write_text_file(input: ExportWriteTextInput) -> Result<String, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  ensure_active_user(&conn, input.user_id)?;
  drop(conn);

  let rel = map_export_subdir(&input.kind).ok_or_else(|| "Type d’export invalide.".to_string())?;
  let root = yobo_documents_root()?;
  let dir = root.join(rel);
  ensure_dir(&dir)?;

  let file = sanitize_filename(&input.filename);
  let path = dir.join(file);
  std::fs::write(&path, input.content.as_bytes()).map_err(|e| format!("Écriture impossible : {}", e))?;
  Ok(path.to_string_lossy().into_owned())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportWriteBytesInput {
  pub user_id: i64,
  pub kind: String,
  pub filename: String,
  /// base64 data (UTF-8) not supported; use bytes array
  pub bytes: Vec<u8>,
}

#[tauri::command]
pub fn exports_write_bytes_file(input: ExportWriteBytesInput) -> Result<String, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  ensure_active_user(&conn, input.user_id)?;
  drop(conn);

  let rel = map_export_subdir(&input.kind).ok_or_else(|| "Type d’export invalide.".to_string())?;
  let root = yobo_documents_root()?;
  let dir = root.join(rel);
  ensure_dir(&dir)?;

  let file = sanitize_filename(&input.filename);
  let path = dir.join(file);
  std::fs::write(&path, &input.bytes).map_err(|e| format!("Écriture impossible : {}", e))?;
  Ok(path.to_string_lossy().into_owned())
}

