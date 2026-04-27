//! Commandes « journaux » et diagnostic SQLite. L’inventaire des événements écrits via
//! `db::append_log` (et les pistes d’extension) est documenté sur `append_log` dans `db.rs`.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntryDto {
  pub id: i64,
  pub user_id: Option<i64>,
  pub user_name: Option<String>,
  pub action_type: String,
  pub action: String,
  pub description: Option<String>,
  pub meta: Option<String>,
  pub created_at: String,
}

fn ensure_gerant_logs_access(conn: &rusqlite::Connection, user_id: i64) -> Result<(), String> {
  db::ensure_schema(conn)?;
  db::ensure_default_gerant(conn)?;
  db::ensure_default_categories(conn)?;
  crate::authz::ensure_active_gerant(conn, user_id)?;
  Ok(())
}

/// Filtre « contient » insensible à la casse, sans caractères joker SQL.
fn logs_search_where_clause(search_trimmed: &str) -> Option<&'static str> {
  if search_trimmed.is_empty() {
    return None;
  }
  Some(
    " AND (
      instr(lower(l.action_type), ?) > 0
      OR instr(lower(l.action), ?) > 0
      OR instr(lower(COALESCE(l.description, '')), ?) > 0
      OR instr(lower(COALESCE(l.meta, '')), ?) > 0
      OR instr(lower(CAST(l.user_id AS TEXT)), ?) > 0
      OR instr(lower(CAST(l.id AS TEXT)), ?) > 0
      OR instr(lower(COALESCE(u.name, '')), ?) > 0
    )",
  )
}

/// Valeur sûre pour `action_type` (évite injection ; inconnu → pas de filtre).
fn normalized_log_action_type(raw: &Option<String>) -> Option<String> {
  let s = raw.as_ref()?.trim();
  if s.is_empty() {
    return None;
  }
  const ALLOW: &[&str] = &[
    "auth", "order", "cash", "menu", "user", "profile", "settings",
  ];
  if ALLOW.iter().any(|&a| a == s) {
    Some(s.to_string())
  } else {
    None
  }
}

fn row_to_log_dto(row: &rusqlite::Row<'_>) -> Result<LogEntryDto, String> {
  Ok(LogEntryDto {
    id: row.get(0).map_err(|e| e.to_string())?,
    user_id: row.get(1).map_err(|e| e.to_string())?,
    action_type: row.get(2).map_err(|e| e.to_string())?,
    action: row.get(3).map_err(|e| e.to_string())?,
    description: row.get(4).map_err(|e| e.to_string())?,
    meta: row.get(5).map_err(|e| e.to_string())?,
    created_at: row.get(6).map_err(|e| e.to_string())?,
    user_name: row.get(7).map_err(|e| e.to_string())?,
  })
}

#[tauri::command]
pub fn logs_list(user_id: i64, limit: Option<i64>) -> Result<Vec<LogEntryDto>, String> {
  let conn = db::open_db_file()?;
  ensure_gerant_logs_access(&conn, user_id)?;

  let lim = limit.unwrap_or(400).clamp(1, 3000);
  let mut stmt = conn
    .prepare(&format!(
      "SELECT l.id, l.user_id, l.action_type, l.action, l.description, l.meta, l.created_at, u.name 
       FROM logs l 
       LEFT JOIN users u ON u.id = l.user_id 
       WHERE 1=1 ORDER BY l.id DESC LIMIT {}",
      lim
    ))
    .map_err(|e| e.to_string())?;

  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
  let mut out = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    out.push(row_to_log_dto(&row)?);
  }
  Ok(out)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogsListPageInput {
  pub user_id: i64,
  pub page: i64,
  pub page_size: i64,
  pub search: Option<String>,
  pub action_type: Option<String>,
  pub start_date: Option<String>,
  pub end_date: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogsListPageResponse {
  pub items: Vec<LogEntryDto>,
  pub total: i64,
}

#[tauri::command]
pub fn logs_list_paged(input: LogsListPageInput) -> Result<LogsListPageResponse, String> {
  let conn = db::open_db_file()?;
  ensure_gerant_logs_access(&conn, input.user_id)?;

  let page_size = input.page_size.clamp(1, 100);
  let page = input.page.max(1);
  let offset = (page - 1) * page_size;

  let q_raw = input.search.unwrap_or_default();
  let needle = q_raw.trim().to_lowercase();
  let frag_search = logs_search_where_clause(&needle).unwrap_or("");
  
  let cat = normalized_log_action_type(&input.action_type);
  let cat_sql = if cat.is_some() { " AND l.action_type = ?" } else { "" };
  
  let s_date = input.start_date.filter(|s| !s.trim().is_empty());
  let start_sql = if s_date.is_some() { " AND l.created_at >= ?" } else { "" };
  
  let e_date = input.end_date.filter(|s| !s.trim().is_empty());
  let end_sql = if e_date.is_some() { " AND l.created_at <= ?" } else { "" };

  // Building params for query
  let mut params: Vec<rusqlite::types::Value> = Vec::new();
  if let Some(ref c) = cat { params.push(c.clone().into()); }
  if let Some(ref s) = s_date { params.push(s.clone().into()); }
  if let Some(ref e) = e_date { params.push(e.clone().into()); }
  if !frag_search.is_empty() {
    for _ in 0..7 { params.push(needle.clone().into()); }
  }

  let where_clause = format!("{}{}{}{}", cat_sql, start_sql, end_sql, frag_search);

  let total: i64 = conn
    .query_row(
      &format!("SELECT COUNT(*) FROM logs l LEFT JOIN users u ON u.id = l.user_id WHERE 1=1{}", where_clause),
      rusqlite::params_from_iter(params.iter()),
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let select_sql = format!(
    "SELECT l.id, l.user_id, l.action_type, l.action, l.description, l.meta, l.created_at, u.name 
     FROM logs l 
     LEFT JOIN users u ON u.id = l.user_id 
     WHERE 1=1{} ORDER BY l.id DESC LIMIT ? OFFSET ?",
    where_clause
  );

  let mut select_params = params;
  select_params.push(page_size.into());
  select_params.push(offset.into());

  let mut stmt = conn.prepare(&select_sql).map_err(|e| e.to_string())?;
  let mut rows = stmt
    .query(rusqlite::params_from_iter(select_params.iter()))
    .map_err(|e| e.to_string())?;

  let mut out = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    out.push(row_to_log_dto(&row)?);
  }

  Ok(LogsListPageResponse { items: out, total })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogsListExportInput {
  pub user_id: i64,
  pub search: Option<String>,
  pub limit: Option<i64>,
  pub action_type: Option<String>,
}

/// Jusqu’à `limit` lignes (défaut 12_000), même filtre recherche que la liste paginée — pour export CSV.
#[tauri::command]
pub fn logs_list_for_export(input: LogsListExportInput) -> Result<Vec<LogEntryDto>, String> {
  let conn = db::open_db_file()?;
  ensure_gerant_logs_access(&conn, input.user_id)?;

  let lim = input.limit.unwrap_or(12_000).clamp(1, 25_000);
  let q_raw = input.search.unwrap_or_default();
  let needle = q_raw.trim().to_lowercase();
  let frag_search = logs_search_where_clause(&needle).unwrap_or("");
  let cat = normalized_log_action_type(&input.action_type);
  let cat_sql = if cat.is_some() {
    " AND l.action_type = ?"
  } else {
    ""
  };

  let select_sql = format!(
    "SELECT l.id, l.user_id, l.action_type, l.action, l.description, l.meta, l.created_at, u.name 
     FROM logs l 
     LEFT JOIN users u ON u.id = l.user_id 
     WHERE 1=1{}{} ORDER BY l.id DESC LIMIT {}",
    cat_sql,
    frag_search,
    lim
  );

  let mut out = Vec::new();
  match (cat.as_ref(), frag_search.is_empty()) {
    (None, true) => {
      let mut stmt = conn.prepare(&select_sql).map_err(|e| e.to_string())?;
      let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
      while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        out.push(row_to_log_dto(&row)?);
      }
    }
    (Some(c), true) => {
      let mut stmt = conn.prepare(&select_sql).map_err(|e| e.to_string())?;
      let mut rows = stmt.query(params![c]).map_err(|e| e.to_string())?;
      while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        out.push(row_to_log_dto(&row)?);
      }
    }
    (None, false) => {
      let mut stmt = conn.prepare(&select_sql).map_err(|e| e.to_string())?;
      let mut rows = stmt
        .query(params![
          &needle, &needle, &needle, &needle, &needle, &needle, &needle,
        ])
        .map_err(|e| e.to_string())?;
      while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        out.push(row_to_log_dto(&row)?);
      }
    }
    (Some(c), false) => {
      let mut stmt = conn.prepare(&select_sql).map_err(|e| e.to_string())?;
      let mut rows = stmt
        .query(params![
          c,
          &needle,
          &needle,
          &needle,
          &needle,
          &needle,
          &needle,
          &needle,
        ])
        .map_err(|e| e.to_string())?;
      while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        out.push(row_to_log_dto(&row)?);
      }
    }
  }

  Ok(out)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableCountRow {
  pub name: String,
  pub count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppMetaRow {
  pub key: String,
  pub value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbDiagnostics {
  pub integrity_ok: bool,
  pub integrity_detail: String,
  pub foreign_key_violations: Vec<String>,
  pub table_counts: Vec<TableCountRow>,
  pub app_meta: Vec<AppMetaRow>,
  pub anomalies: Vec<String>,
  pub sqlite_version: String,
  /// `PRAGMA page_size` × `page_count` (taille approximative du fichier).
  pub db_page_size: i64,
  pub db_page_count: i64,
  pub db_size_bytes: i64,
  pub journal_mode: String,
  pub foreign_keys_enabled: bool,
  pub orders_validated: i64,
  pub orders_cancelled: i64,
  pub orders_modified: i64,
}

#[tauri::command]
pub fn logs_db_diagnostics(user_id: i64) -> Result<DbDiagnostics, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;
  crate::authz::ensure_active_gerant(&conn, user_id)?;

  conn
    .execute_batch("PRAGMA foreign_keys = ON;")
    .map_err(|e| e.to_string())?;

  let sqlite_version: String = conn
    .query_row("SELECT sqlite_version()", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;

  let db_page_size: i64 = conn
    .query_row("PRAGMA page_size", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;
  let db_page_count: i64 = conn
    .query_row("PRAGMA page_count", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;
  let db_size_bytes = db_page_size.saturating_mul(db_page_count);

  let journal_mode: String = conn
    .query_row("PRAGMA journal_mode", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;

  let fk_pragma: i64 = conn
    .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;
  let foreign_keys_enabled = fk_pragma != 0;

  let orders_validated: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM orders WHERE status = 'validated'",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let orders_cancelled: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM orders WHERE status = 'cancelled'",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let orders_modified: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM orders WHERE status = 'modified'",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let mut integrity_detail = String::new();
  let mut integrity_ok = true;
  {
    let mut stmt = conn
      .prepare("PRAGMA integrity_check")
      .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
      let s: String = row.get(0).map_err(|e| e.to_string())?;
      if !integrity_detail.is_empty() {
        integrity_detail.push('\n');
      }
      integrity_detail.push_str(&s);
      if !s.trim().eq_ignore_ascii_case("ok") {
        integrity_ok = false;
      }
    }
  }
  if integrity_detail.is_empty() {
    integrity_detail = "(vide)".to_string();
    integrity_ok = false;
  }

  let mut foreign_key_violations: Vec<String> = Vec::new();
  {
    let mut stmt = conn
      .prepare("PRAGMA foreign_key_check")
      .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
      let t: String = row.get(0).map_err(|e| e.to_string())?;
      let rowid: i64 = row.get(1).map_err(|e| e.to_string())?;
      let parent: String = row.get(2).map_err(|e| e.to_string())?;
      foreign_key_violations.push(format!("table `{}` rowid {} → parent `{}`", t, rowid, parent));
    }
  }

  let tables = [
    "users",
    "categories",
    "products",
    "orders",
    "logs",
    "cash_sessions",
    "app_meta",
  ];
  let mut table_counts: Vec<TableCountRow> = Vec::new();
  for name in tables {
    let count: i64 = conn
      .query_row(&format!("SELECT COUNT(*) FROM {}", name), [], |r| r.get(0))
      .map_err(|e| e.to_string())?;
    table_counts.push(TableCountRow {
      name: name.to_string(),
      count,
    });
  }

  let mut app_meta: Vec<AppMetaRow> = Vec::new();
  {
    let mut stmt = conn
      .prepare("SELECT key, value FROM app_meta ORDER BY key ASC")
      .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
      app_meta.push(AppMetaRow {
        key: row.get(0).map_err(|e| e.to_string())?,
        value: row.get(1).map_err(|e| e.to_string())?,
      });
    }
  }

  let mut anomalies: Vec<String> = Vec::new();

  let orphan_products: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE c.id IS NULL",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  if orphan_products > 0 {
    anomalies.push(format!(
      "{} produit(s) avec category_id inexistant",
      orphan_products
    ));
  }

  let orphan_orders_user: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE u.id IS NULL",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  if orphan_orders_user > 0 {
    anomalies.push(format!(
      "{} commande(s) avec user_id inexistant",
      orphan_orders_user
    ));
  }

  let orphan_orders_session: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM orders o WHERE o.cash_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cash_sessions s WHERE s.id = o.cash_session_id)",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  if orphan_orders_session > 0 {
    anomalies.push(format!(
      "{} commande(s) avec cash_session_id orphelin",
      orphan_orders_session
    ));
  }

  let orphan_cash_user: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM cash_sessions s LEFT JOIN users u ON u.id = s.user_id WHERE u.id IS NULL",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  if orphan_cash_user > 0 {
    anomalies.push(format!(
      "{} session(s) caisse avec user_id inexistant",
      orphan_cash_user
    ));
  }

  let orphan_logs_user: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM logs l WHERE l.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = l.user_id)",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  if orphan_logs_user > 0 {
    anomalies.push(format!(
      "{} ligne(s) de log avec user_id inexistant",
      orphan_logs_user
    ));
  }

  if orders_cancelled > 0 {
    anomalies.push(format!(
      "{} commande(s) au statut « annulée »",
      orders_cancelled
    ));
  }
  if orders_modified > 0 {
    anomalies.push(format!(
      "{} commande(s) au statut « modifiée »",
      orders_modified
    ));
  }

  if !integrity_ok {
    anomalies.insert(0, "PRAGMA integrity_check ≠ ok — base potentiellement corrompue".to_string());
  }
  if !foreign_key_violations.is_empty() {
    anomalies.insert(
      0,
      format!(
        "{} violation(s) de clés étrangères (PRAGMA foreign_key_check)",
        foreign_key_violations.len()
      ),
    );
  }

  if anomalies.is_empty() {
    anomalies.push("Aucune anomalie détectée par les requêtes de contrôle.".to_string());
  }

  Ok(DbDiagnostics {
    integrity_ok,
    integrity_detail,
    foreign_key_violations,
    table_counts,
    app_meta,
    anomalies,
    sqlite_version,
    db_page_size,
    db_page_count,
    db_size_bytes,
    journal_mode,
    foreign_keys_enabled,
    orders_validated,
    orders_cancelled,
    orders_modified,
  })
}
