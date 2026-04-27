use rusqlite::{params, OptionalExtension};
use serde::Serialize;

use crate::db;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashSessionDto {
  pub id: i64,
  pub user_id: i64,
  pub opening_amount: f64,
  pub opened_at: String,
}

/// Sessions fermées (pour filtres historique + ticket réimpression).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashSessionClosedRow {
  pub id: i64,
  pub opened_at: String,
  pub closed_at: String,
  pub opening_amount: f64,
  pub sales_total: f64,
  pub cashier_name: String,
  pub closing_amount: f64,
  pub theoretical: f64,
  pub gap: f64,
  pub comment: Option<String>,
  pub orders_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashSessionCloseDto {
  pub session_id: i64,
  pub opening_amount: f64,
  pub closing_amount: f64,
  pub sales_total: f64,
  pub theoretical: f64,
  pub gap: f64,
  pub orders_count: i64,
  pub closed_at: String,
}

/// Session caisse encore ouverte (carte « session actuelle » dans l’historique gérant).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashSessionOpenHistoriqueRow {
  pub id: i64,
  pub opened_at: String,
  pub opening_amount: f64,
  pub cashier_name: String,
  pub orders_count: i64,
  pub sales_total: f64,
}

fn ensure_db(conn: &rusqlite::Connection) -> Result<(), String> {
  db::ensure_schema(conn)?;
  db::ensure_default_gerant(conn)?;
  db::ensure_default_categories(conn)?;
  Ok(())
}

#[tauri::command]
pub fn cash_session_current(user_id: i64) -> Result<Option<CashSessionDto>, String> {
  let conn = db::open_db_file()?;
  ensure_db(&conn)?;

  let row = conn
    .query_row(
      "SELECT id, opening_amount, opened_at FROM cash_sessions WHERE user_id = ?1 AND closed_at IS NULL ORDER BY id DESC LIMIT 1",
      params![user_id],
      |r| {
        Ok((
          r.get::<_, i64>(0)?,
          r.get::<_, f64>(1)?,
          r.get::<_, String>(2)?,
        ))
      },
    )
    .optional()
    .map_err(|e| e.to_string())?;

  Ok(row.map(|(id, opening_amount, opened_at)| CashSessionDto {
    id,
    user_id,
    opening_amount,
    opened_at,
  }))
}

/// Returns the latest open cash session across ALL users (so gérant can see a caissier's session).
#[tauri::command]
pub fn cash_session_current_any() -> Result<Option<CashSessionDto>, String> {
  let conn = db::open_db_file()?;
  ensure_db(&conn)?;

  let row = conn
    .query_row(
      "SELECT id, user_id, opening_amount, opened_at FROM cash_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1",
      [],
      |r| {
        Ok((
          r.get::<_, i64>(0)?,
          r.get::<_, i64>(1)?,
          r.get::<_, f64>(2)?,
          r.get::<_, String>(3)?,
        ))
      },
    )
    .optional()
    .map_err(|e| e.to_string())?;

  Ok(row.map(|(id, owner_id, opening_amount, opened_at)| CashSessionDto {
    id,
    user_id: owner_id,
    opening_amount,
    opened_at,
  }))
}

#[tauri::command]
pub fn cash_session_start(user_id: i64, opening_amount: f64) -> Result<CashSessionDto, String> {
  if opening_amount < 0.0 || !opening_amount.is_finite() {
    return Err("Montant d'ouverture invalide.".to_string());
  }

  let conn = db::open_db_file()?;
  ensure_db(&conn)?;

  let existing: Option<i64> = conn
    .query_row(
      "SELECT id FROM cash_sessions WHERE closed_at IS NULL LIMIT 1",
      [],
      |r| r.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())?;

  if existing.is_some() {
    return Err("Une caisse est déjà ouverte. Ferme-la avant d'en ouvrir une nouvelle.".to_string());
  }

  conn
    .execute(
      "INSERT INTO cash_sessions (user_id, opening_amount) VALUES (?1, ?2)",
      params![user_id, opening_amount],
    )
    .map_err(|e| e.to_string())?;

  let id = conn.last_insert_rowid();
  let opened_at: String = conn
    .query_row(
      "SELECT opened_at FROM cash_sessions WHERE id = ?1",
      params![id],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "cash",
    "session_open",
    Some(&format!("session #{} · {:.2} MAD départ", id, opening_amount)),
    Some(&format!("session_id={}", id)),
  );

  Ok(CashSessionDto {
    id,
    user_id,
    opening_amount,
    opened_at,
  })
}

#[tauri::command]
pub fn cash_session_close(
  user_id: i64,
  closing_amount: f64,
  comment: Option<String>,
) -> Result<CashSessionCloseDto, String> {
  if closing_amount < 0.0 || !closing_amount.is_finite() {
    return Err("Montant de fermeture invalide.".to_string());
  }

  let conn = db::open_db_file()?;
  ensure_db(&conn)?;

  let session_id: i64 = conn
    .query_row(
      "SELECT id FROM cash_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1",
      [],
      |r| r.get(0),
    )
    .map_err(|_| "Aucune caisse ouverte.".to_string())?;

  let opening_amount: f64 = conn
    .query_row(
      "SELECT opening_amount FROM cash_sessions WHERE id = ?1",
      params![session_id],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let sales_total: f64 = conn
    .query_row(
      "SELECT COALESCE(SUM(total), 0) FROM orders WHERE cash_session_id = ?1 AND status = 'validated'",
      params![session_id],
      |r| r.get::<_, f64>(0),
    )
    .map_err(|e| e.to_string())?;

  let orders_count: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM orders WHERE cash_session_id = ?1 AND status = 'validated'",
      params![session_id],
      |r| r.get::<_, i64>(0),
    )
    .map_err(|e| e.to_string())?;

  let theoretical = opening_amount + sales_total;
  let gap = closing_amount - theoretical;

  let cmt = comment
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty());

  conn
    .execute(
      "UPDATE cash_sessions SET closing_amount = ?1, theoretical = ?2, gap = ?3, comment = ?4, closed_at = datetime('now') WHERE id = ?5",
      params![closing_amount, theoretical, gap, cmt, session_id],
    )
    .map_err(|e| e.to_string())?;

  let closed_at: String = conn
    .query_row(
      "SELECT closed_at FROM cash_sessions WHERE id = ?1",
      params![session_id],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "cash",
    "session_close",
    Some(&format!(
      "session #{} · {:.2} MAD comptés · écart {:.2}",
      session_id, closing_amount, gap
    )),
    Some(&format!("session_id={}", session_id)),
  );

  Ok(CashSessionCloseDto {
    session_id,
    opening_amount,
    closing_amount,
    sales_total,
    theoretical,
    gap,
    orders_count,
    closed_at,
  })
}

#[tauri::command]
pub fn cash_sessions_list_closed(user_id: i64) -> Result<Vec<CashSessionClosedRow>, String> {
  let conn = db::open_db_file()?;
  ensure_db(&conn)?;

  let role_norm = crate::authz::active_user_role(&conn, user_id)?;
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide.".to_string());
  }

  let sql = if role_norm == "gerant" {
    r#"
    SELECT s.id, s.opened_at, s.closed_at, s.opening_amount,
           (COALESCE(s.theoretical, 0) - s.opening_amount), u.name,
           COALESCE(s.closing_amount, 0), COALESCE(s.theoretical, 0), COALESCE(s.gap, 0),
           s.comment,
           (SELECT COUNT(*) FROM orders o WHERE o.cash_session_id = s.id AND o.status = 'validated')
    FROM cash_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.closed_at IS NOT NULL
    ORDER BY s.closed_at DESC
    LIMIT 80
    "#
  } else {
    r#"
    SELECT s.id, s.opened_at, s.closed_at, s.opening_amount,
           (COALESCE(s.theoretical, 0) - s.opening_amount), u.name,
           COALESCE(s.closing_amount, 0), COALESCE(s.theoretical, 0), COALESCE(s.gap, 0),
           s.comment,
           (SELECT COUNT(*) FROM orders o WHERE o.cash_session_id = s.id AND o.status = 'validated')
    FROM cash_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.closed_at IS NOT NULL AND s.user_id = ?1
    ORDER BY s.closed_at DESC
    LIMIT 7
    "#
  };

  let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
  let mut rows = if role_norm == "gerant" {
    stmt.query([]).map_err(|e| e.to_string())?
  } else {
    stmt.query(params![user_id]).map_err(|e| e.to_string())?
  };

  let mut out = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    out.push(CashSessionClosedRow {
      id: row.get(0).map_err(|e| e.to_string())?,
      opened_at: row.get(1).map_err(|e| e.to_string())?,
      closed_at: row.get(2).map_err(|e| e.to_string())?,
      opening_amount: row.get(3).map_err(|e| e.to_string())?,
      sales_total: row.get(4).map_err(|e| e.to_string())?,
      cashier_name: row.get(5).map_err(|e| e.to_string())?,
      closing_amount: row.get(6).map_err(|e| e.to_string())?,
      theoretical: row.get(7).map_err(|e| e.to_string())?,
      gap: row.get(8).map_err(|e| e.to_string())?,
      comment: row.get(9).map_err(|e| e.to_string())?,
      orders_count: row.get(10).map_err(|e| e.to_string())?,
    });
  }

  Ok(out)
}

#[tauri::command]
pub fn cash_session_open_for_historique(user_id: i64) -> Result<Option<CashSessionOpenHistoriqueRow>, String> {
  let conn = db::open_db_file()?;
  ensure_db(&conn)?;

  let role_norm = crate::authz::active_user_role(&conn, user_id)?;
  if role_norm != "gerant" {
    return Err("Rôle invalide.".to_string());
  }

  let row: Option<(i64, String, f64, String, i64, f64)> = conn
    .query_row(
      r#"
      SELECT s.id, s.opened_at, s.opening_amount, u.name,
        (SELECT COUNT(*) FROM orders o WHERE o.cash_session_id = s.id AND o.status = 'validated'),
        (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.cash_session_id = s.id AND o.status = 'validated')
      FROM cash_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.closed_at IS NULL
      ORDER BY s.id DESC
      LIMIT 1
      "#,
      [],
      |r| {
        Ok((
          r.get(0)?,
          r.get(1)?,
          r.get(2)?,
          r.get(3)?,
          r.get(4)?,
          r.get(5)?,
        ))
      },
    )
    .optional()
    .map_err(|e| e.to_string())?;

  Ok(row.map(
    |(id, opened_at, opening_amount, cashier_name, orders_count, sales_total)| CashSessionOpenHistoriqueRow {
      id,
      opened_at,
      opening_amount,
      cashier_name,
      orders_count,
      sales_total,
    },
  ))
}
