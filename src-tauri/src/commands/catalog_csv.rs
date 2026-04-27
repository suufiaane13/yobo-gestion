use rusqlite::params;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

use crate::{authz, db};

fn yobo_documents_csv_dir() -> Result<PathBuf, String> {
  let docs = dirs::document_dir().ok_or_else(|| "Impossible de trouver le dossier Documents.".to_string())?;
  Ok(docs.join("YOBO").join("Exports").join("CSV"))
}

fn ensure_dir(path: &Path) -> Result<(), String> {
  fs::create_dir_all(path).map_err(|e| e.to_string())
}

fn csv_escape(cell: &str) -> String {
  let needs = cell.contains(';') || cell.contains('"') || cell.contains('\n') || cell.contains('\r');
  if !needs {
    return cell.to_string();
  }
  format!("\"{}\"", cell.replace('"', "\"\""))
}

fn csv_parse_line(line: &str) -> Result<Vec<String>, String> {
  // CSV simple avec séparateur ';' et guillemets " (doublés -> ""); suffisant pour nos exports.
  let mut out: Vec<String> = Vec::new();
  let mut cur = String::new();
  let mut chars = line.chars().peekable();
  let mut in_quotes = false;
  while let Some(ch) = chars.next() {
    if in_quotes {
      if ch == '"' {
        if matches!(chars.peek(), Some('"')) {
          chars.next();
          cur.push('"');
        } else {
          in_quotes = false;
        }
      } else {
        cur.push(ch);
      }
      continue;
    }
    match ch {
      ';' => {
        out.push(cur.clone());
        cur.clear();
      }
      '"' => in_quotes = true,
      _ => cur.push(ch),
    }
  }
  out.push(cur);
  Ok(out)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogCsvExportInput {
  pub user_id: i64,
}

#[tauri::command]
pub fn catalog_export_csv_to_documents(input: CatalogCsvExportInput) -> Result<String, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, input.user_id)?;

  let dir = yobo_documents_csv_dir()?;
  ensure_dir(&dir)?;

  let mut csv = String::new();
  csv.push_str("category_label;category_emoji;product_name;product_emoji;product_description;sizes_json;active\n");

  let mut stmt = conn
    .prepare(
      r#"
      SELECT c.label, c.emoji, p.name, p.emoji, COALESCE(p.description, ''), p.sizes, p.active
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ORDER BY c.position ASC, c.id ASC, p.id ASC
      "#,
    )
    .map_err(|e| e.to_string())?;

  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
  while let Some(r) = rows.next().map_err(|e| e.to_string())? {
    let cat_label: String = r.get(0).map_err(|e| e.to_string())?;
    let cat_emoji: String = r.get(1).map_err(|e| e.to_string())?;
    let p_name: String = r.get(2).map_err(|e| e.to_string())?;
    let p_emoji: String = r.get(3).map_err(|e| e.to_string())?;
    let p_desc: String = r.get(4).map_err(|e| e.to_string())?;
    let sizes_json: String = r.get(5).map_err(|e| e.to_string())?;
    let active: i64 = r.get(6).map_err(|e| e.to_string())?;

    csv.push_str(&csv_escape(&cat_label));
    csv.push(';');
    csv.push_str(&csv_escape(&cat_emoji));
    csv.push(';');
    csv.push_str(&csv_escape(&p_name));
    csv.push(';');
    csv.push_str(&csv_escape(&p_emoji));
    csv.push(';');
    csv.push_str(&csv_escape(&p_desc));
    csv.push(';');
    csv.push_str(&csv_escape(&sizes_json));
    csv.push(';');
    csv.push_str(if active == 1 { "1" } else { "0" });
    csv.push('\n');
  }

  let ts = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
  let filename = format!("catalogue-{}.csv", ts);
  let dst = dir.join(filename);
  fs::write(&dst, csv.as_bytes()).map_err(|e| e.to_string())?;
  Ok(dst.to_string_lossy().to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogCsvImportPickInput {
  pub user_id: i64,
}

#[tauri::command]
pub fn catalog_import_csv_pick_dialog(input: CatalogCsvImportPickInput) -> Result<String, String> {
  let mut conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, input.user_id)?;

  let file = rfd::FileDialog::new()
    .add_filter("CSV", &["csv"])
    .pick_file()
    .ok_or_else(|| "Import annulé.".to_string())?;

  let raw = fs::read_to_string(&file).map_err(|e| e.to_string())?;
  let mut lines = raw.lines();
  let header = lines.next().ok_or_else(|| "CSV vide.".to_string())?;
  let h = csv_parse_line(header)?;
  if h.len() < 7
    || h[0] != "category_label"
    || h[1] != "category_emoji"
    || h[2] != "product_name"
    || h[3] != "product_emoji"
    || h[4] != "product_description"
    || h[5] != "sizes_json"
    || h[6] != "active"
  {
    return Err("Format CSV invalide. Utilisez le fichier exporté par YOBO.".to_string());
  }

  let tx = conn.transaction().map_err(|e| e.to_string())?;

  for (idx, line) in lines.enumerate() {
    let line = line.trim();
    if line.is_empty() {
      continue;
    }
    let cols = csv_parse_line(line)?;
    if cols.len() < 7 {
      return Err(format!("Ligne {} invalide (colonnes manquantes).", idx + 2));
    }
    let cat_label = cols[0].trim();
    let cat_emoji = cols[1].trim();
    let p_name = cols[2].trim();
    let p_emoji = cols[3].trim();
    let p_desc = cols[4].trim();
    let sizes_json = cols[5].trim();
    let active = cols[6].trim() == "1";

    if cat_label.is_empty() || cat_emoji.is_empty() || p_name.is_empty() || p_emoji.is_empty() || sizes_json.is_empty() {
      return Err(format!("Ligne {} invalide (champs requis).", idx + 2));
    }

    // Validation JSON tailles
    let _: serde_json::Value = serde_json::from_str(sizes_json).map_err(|_| {
      format!(
        "Ligne {} invalide (sizes_json doit être un JSON, ex: {{\"S\":20,\"M\":40}} ou {{\"\":5}}).",
        idx + 2
      )
    })?;

    // Upsert catégorie par label
    let cat_id: i64 = tx
      .query_row(
        "SELECT id FROM categories WHERE lower(trim(label)) = lower(trim(?1)) LIMIT 1",
        params![cat_label],
        |r| r.get(0),
      )
      .unwrap_or(-1);

    let category_id = if cat_id > 0 {
      tx.execute("UPDATE categories SET emoji=?1 WHERE id=?2", params![cat_emoji, cat_id])
        .map_err(|e| e.to_string())?;
      cat_id
    } else {
      let pos: i64 = tx
        .query_row("SELECT COALESCE(MAX(position), -1) + 1 FROM categories", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
      tx.execute(
        "INSERT INTO categories (label, emoji, position) VALUES (?1, ?2, ?3)",
        params![cat_label, cat_emoji, pos],
      )
      .map_err(|e| e.to_string())?;
      tx.last_insert_rowid()
    };

    // Upsert produit par (category_id, name)
    let p_id: i64 = tx
      .query_row(
        "SELECT id FROM products WHERE category_id=?1 AND lower(trim(name))=lower(trim(?2)) LIMIT 1",
        params![category_id, p_name],
        |r| r.get(0),
      )
      .unwrap_or(-1);

    if p_id > 0 {
      tx.execute(
        "UPDATE products SET emoji=?1, description=?2, sizes=?3, active=?4 WHERE id=?5",
        params![p_emoji, if p_desc.is_empty() { None::<String> } else { Some(p_desc.to_string()) }, sizes_json, if active { 1 } else { 0 }, p_id],
      )
      .map_err(|e| e.to_string())?;
    } else {
      tx.execute(
        "INSERT INTO products (name, description, emoji, category_id, sizes, active) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
          p_name,
          if p_desc.is_empty() { None::<String> } else { Some(p_desc.to_string()) },
          p_emoji,
          category_id,
          sizes_json,
          if active { 1 } else { 0 }
        ],
      )
      .map_err(|e| e.to_string())?;
    }
  }

  tx.commit().map_err(|e| e.to_string())?;
  Ok(file.to_string_lossy().to_string())
}

