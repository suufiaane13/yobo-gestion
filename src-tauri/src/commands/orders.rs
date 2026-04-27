use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use crate::db;

fn default_order_qty() -> i64 {
  1
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderItemInput {
  pub emoji: String,
  pub name: String,
  pub size: String,
  /// Prix unitaire (une ligne)
  pub price: f64,
  #[serde(default = "default_order_qty")]
  pub quantity: i64,
  /// Libellé catégorie affiché sur ticket / résumé (ex. PIZZA, PAIN MAISON).
  #[serde(default)]
  pub category_label: Option<String>,
  /// Note optionnelle par article (ex. sans olives).
  #[serde(default)]
  pub line_note: Option<String>,
  /// Supplément gratiné direct (pizza).
  #[serde(default)]
  pub has_gratine: bool,
}

fn format_order_line_compact(i: &OrderItemInput) -> String {
  let sz = if i.size.is_empty() {
    String::new()
  } else {
    format!(" {}", i.size)
  };
  let q = i.quantity.max(1);
  let name_part = match &i.category_label {
    Some(c) if !c.trim().is_empty() => format!("{} · {}", c.trim(), i.name),
    _ => i.name.clone(),
  };
  let with_note = match &i.line_note {
    Some(n) if !n.trim().is_empty() => format!("{} — {}", name_part, n.trim()),
    _ => name_part,
  };
  let with_gratine = if i.has_gratine {
    format!("{} (Gratiné)", with_note)
  } else {
    with_note
  };
  if q > 1 {
    format!("{}{} ×{}", with_gratine, sz, q)
  } else {
    format!("{}{}", with_gratine, sz)
  }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderResponse {
  pub id: i64,
  pub items: String,
  /// Lignes structurées (même schéma que le panier) pour affichage détail / cartes.
  pub item_lines: Vec<OrderItemInput>,
  pub total: f64,
  /// `validated`, `cancelled` ou `modified` (schéma SQLite).
  pub status: String,
  pub cancel_reason: Option<String>,
  pub time: String,
  pub cashier: String,
  pub user_id: i64,
  pub cash_session_id: Option<i64>,
  pub order_type: Option<String>,
  pub order_comment: Option<String>,
  pub customer_phone: Option<String>,
  pub customer_address: Option<String>,
  pub received_amount: Option<f64>,
  pub change_amount: Option<f64>,
}

fn order_response_from_row(row: &Row) -> Result<OrderResponse, String> {
  let id: i64 = row.get(0).map_err(|e| e.to_string())?;
  let items_json: String = row.get(1).map_err(|e| e.to_string())?;
  let total: f64 = row.get(2).map_err(|e| e.to_string())?;
  let status_db: String = row.get(3).map_err(|e| e.to_string())?;
  let time: String = row.get(4).map_err(|e| e.to_string())?;
  let cashier: String = row.get(5).map_err(|e| e.to_string())?;
  let user_id: i64 = row.get(6).map_err(|e| e.to_string())?;
  let cash_session_id: Option<i64> = row.get(7).map_err(|e| e.to_string())?;
  let order_type: Option<String> = row.get(8).ok();
  let cancel_reason: Option<String> = row.get(9).ok();
  let order_comment: Option<String> = row.get(10).ok();
  let customer_phone: Option<String> = row.get(11).ok();
  let customer_address: Option<String> = row.get(12).ok();
  let received_amount: Option<f64> = row.get(13).ok();
  let change_amount: Option<f64> = row.get(14).ok();

  let parsed_items = serde_json::from_str::<Vec<OrderItemInput>>(&items_json).unwrap_or_default();
  let compact_items = if parsed_items.is_empty() {
    "Commande".to_string()
  } else {
    parsed_items
      .iter()
      .map(format_order_line_compact)
      .collect::<Vec<_>>()
      .join(", ")
  };

  Ok(OrderResponse {
    id,
    items: compact_items,
    item_lines: parsed_items,
    total,
    status: status_db,
    cancel_reason,
    time,
    cashier,
    user_id,
    cash_session_id,
    order_type,
    order_comment,
    customer_phone,
    customer_address,
    received_amount,
    change_amount,
  })
}

fn fetch_order_response(conn: &Connection, order_id: i64) -> Result<OrderResponse, String> {
  let mut stmt = conn
    .prepare(
      r#"SELECT o.id, o.items, o.total, o.status, o.created_at, u.name, o.user_id, o.cash_session_id, o.order_type, o.cancel_reason
           , o.order_comment, o.customer_phone, o.customer_address, o.received_amount, o.change_amount
         FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?1"#,
    )
    .map_err(|e| e.to_string())?;
  let mut rows = stmt.query(params![order_id]).map_err(|e| e.to_string())?;
  let row = rows
    .next()
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Commande introuvable.".to_string())?;
  order_response_from_row(&row)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GerantOrdersKpis {
  pub order_count: i64,
  pub revenue_total: f64,
  pub revenue_today: f64,
  /// Semaine civile commençant le lundi (timezone locale SQLite).
  pub revenue_week: f64,
  /// Mois civil en cours (timezone locale SQLite).
  pub revenue_month: f64,
  pub distinct_cashiers: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderPageResponse {
  pub orders: Vec<OrderResponse>,
  pub total: i64,
}

#[tauri::command]
pub fn create_order(
  user_id: i64,
  items: Vec<OrderItemInput>,
  cash_session_id: Option<i64>,
  order_type: Option<String>,
  order_comment: Option<String>,
  customer_phone: Option<String>,
  customer_address: Option<String>,
  received_amount: Option<f64>,
  change_amount: Option<f64>,
) -> Result<OrderResponse, String> {
  if items.is_empty() {
    return Err("Le panier est vide.".to_string());
  }

  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let _user_role: String = conn
    .query_row(
      "SELECT role FROM users WHERE id = ?1 AND active = 1",
      params![user_id],
      |r| r.get(0),
    )
    .map_err(|_| "Utilisateur introuvable.".to_string())?;

  let sid = {
    let id = cash_session_id.ok_or_else(|| {
      "Ouvre la caisse (montant de départ) avant de valider une commande.".to_string()
    })?;
    let ok: Option<i64> = conn
      .query_row(
        "SELECT id FROM cash_sessions WHERE id = ?1 AND closed_at IS NULL",
        params![id],
        |r| r.get(0),
      )
      .optional()
      .map_err(|e| e.to_string())?;
    if ok.is_none() {
      return Err("Session caisse invalide ou fermée. Rouvre la caisse.".to_string());
    }
    Some(id)
  };

  let cash_session_id = sid;

  let total = items
    .iter()
    .map(|i| i.price * (i.quantity.max(1) as f64))
    .sum::<f64>();
  let compact_items = items
    .iter()
    .map(format_order_line_compact)
    .collect::<Vec<_>>()
    .join(", ");
  let items_json = serde_json::to_string(&items).map_err(|e| e.to_string())?;

  let ot = order_type
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
    .unwrap_or_else(|| "sur_place".to_string());
  let oc = order_comment
    .map(|s: String| s.trim().to_string())
    .filter(|s: &String| !s.is_empty());

  let phone = customer_phone
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
    .map(|s| s.chars().take(32).collect::<String>());

  let addr = customer_address
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
    .map(|s| s.chars().take(180).collect::<String>());

  conn.execute(
    "INSERT INTO orders (user_id, items, total, status, cash_session_id, order_type, order_comment, customer_phone, customer_address, received_amount, change_amount) VALUES (?1, ?2, ?3, 'validated', ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
    params![user_id, items_json, total, cash_session_id, ot, oc, phone, addr, received_amount, change_amount],
  )
  .map_err(|e| e.to_string())?;

  let order_id = conn.last_insert_rowid();

  let order_meta = match cash_session_id {
    Some(sid) => format!("order_id={} cash_session_id={}", order_id, sid),
    None => format!("order_id={}", order_id),
  };
  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "order",
    "create",
    Some(&format!("#{} {:.2} MAD", order_id, total)),
    Some(&order_meta),
  );

  let (cashier_name, created_at): (String, String) = conn
    .query_row(
      r#"
      SELECT u.name, o.created_at
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.id = ?1
      "#,
      params![order_id],
      |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|e| e.to_string())?;

  Ok(OrderResponse {
    id: order_id,
    items: compact_items,
    item_lines: items,
    total,
    status: "validated".to_string(),
    cancel_reason: None,
    time: created_at,
    cashier: cashier_name,
    user_id,
    cash_session_id: sid,
    order_type: Some(ot),
    order_comment: oc,
    customer_phone: phone,
    customer_address: addr,
    received_amount,
    change_amount,
  })
}

#[tauri::command]
pub fn list_orders(user_id: i64) -> Result<Vec<OrderResponse>, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let role_norm = crate::authz::active_user_role(&conn, user_id)?;
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide.".to_string());
  }

  let sql = if role_norm == "gerant" {
    r#"
    SELECT o.id, o.items, o.total, o.status, o.created_at, u.name, o.user_id, o.cash_session_id, o.order_type, o.cancel_reason, o.order_comment
         , o.customer_phone, o.customer_address, o.received_amount, o.change_amount
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.id DESC
    "#
  } else {
    // Caissier : uniquement les commandes de la session caisse ouverte (pas de filtre par jour).
    r#"
    SELECT o.id, o.items, o.total, o.status, o.created_at, u.name, o.user_id, o.cash_session_id, o.order_type, o.cancel_reason, o.order_comment
         , o.customer_phone, o.customer_address, o.received_amount, o.change_amount
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.cash_session_id = (
      SELECT s.id FROM cash_sessions s WHERE s.closed_at IS NULL ORDER BY s.id DESC LIMIT 1
    )
    ORDER BY o.id DESC
    "#
  };

  let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
  let rows = stmt.query([]).map_err(|e| e.to_string())?;
  let mut rows = rows;

  let mut out: Vec<OrderResponse> = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    out.push(order_response_from_row(&row)?);
  }

  Ok(out)
}

#[tauri::command]
pub fn orders_gerant_kpis(user_id: i64) -> Result<GerantOrdersKpis, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let role_norm = crate::authz::active_user_role(&conn, user_id)?;
  if role_norm != "gerant" {
    return Err("Rôle invalide.".to_string());
  }

  let order_count: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM orders WHERE status = 'validated'",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let revenue_total: f64 = conn
    .query_row(
      "SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'validated'",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let revenue_today: f64 = conn
    .query_row(
      "SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'validated' AND date(created_at) = date('now', 'localtime')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let revenue_week: f64 = conn
    .query_row(
      r#"SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'validated'
         AND date(created_at, 'localtime') >= date('now', 'localtime', '-' || ((CAST(strftime('%w', 'now', 'localtime') AS INTEGER) + 6) % 7) || ' days')"#,
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let revenue_month: f64 = conn
    .query_row(
      "SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'validated' AND strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let distinct_cashiers: i64 = conn
    .query_row(
      "SELECT COUNT(DISTINCT user_id) FROM orders WHERE status = 'validated'",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  Ok(GerantOrdersKpis {
    order_count,
    revenue_total,
    revenue_today,
    revenue_week,
    revenue_month,
    distinct_cashiers,
  })
}

#[tauri::command]
pub fn list_orders_gerant_page(user_id: i64, limit: i64, offset: i64) -> Result<OrderPageResponse, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let role_norm = crate::authz::active_user_role(&conn, user_id)?;
  if role_norm != "gerant" {
    return Err("Rôle invalide.".to_string());
  }

  if limit < 1 || limit > 500 {
    return Err("Pagination invalide.".to_string());
  }
  if offset < 0 {
    return Err("Pagination invalide.".to_string());
  }

  let total: i64 = conn
    .query_row("SELECT COUNT(*) FROM orders", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;

  let sql = r#"
    SELECT o.id, o.items, o.total, o.status, o.created_at, u.name, o.user_id, o.cash_session_id, o.order_type, o.cancel_reason, o.order_comment
         , o.customer_phone, o.customer_address, o.received_amount, o.change_amount
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.id DESC
    LIMIT ?1 OFFSET ?2
  "#;

  let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
  let mut rows = stmt
    .query(params![limit, offset])
    .map_err(|e| e.to_string())?;

  let mut orders: Vec<OrderResponse> = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    orders.push(order_response_from_row(&row)?);
  }

  Ok(OrderPageResponse { orders, total })
}

#[tauri::command]
pub fn list_orders_gerant_all(user_id: i64) -> Result<Vec<OrderResponse>, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let role_norm = crate::authz::active_user_role(&conn, user_id)?;
  if role_norm != "gerant" {
    return Err("Rôle invalide.".to_string());
  }

  let sql = r#"
    SELECT o.id, o.items, o.total, o.status, o.created_at, u.name, o.user_id, o.cash_session_id, o.order_type, o.cancel_reason, o.order_comment
         , o.customer_phone, o.customer_address, o.received_amount, o.change_amount
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.id DESC
  "#;

  let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

  let mut out: Vec<OrderResponse> = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    out.push(order_response_from_row(&row)?);
  }

  Ok(out)
}



#[tauri::command]
pub fn orders_cancel(user_id: i64, order_id: i64, reason: String) -> Result<OrderResponse, String> {
  let reason = reason.trim().to_string();
  if reason.is_empty() {
    return Err("Indiquez une raison d'annulation.".to_string());
  }

  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let role_norm = crate::authz::active_user_role(&conn, user_id)?;
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide.".to_string());
  }

  let open_sess: Option<(i64, i64)> = conn
    .query_row(
      "SELECT id, user_id FROM cash_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1",
      [],
      |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
    )
    .optional()
    .map_err(|e| e.to_string())?;

  let (open_id, session_owner_id) = open_sess.ok_or_else(|| {
    "Aucune session de caisse ouverte. L'annulation n'est possible que pendant une session ouverte.".to_string()
  })?;

  let (o_status, o_cash_sid, o_order_uid): (String, Option<i64>, i64) = conn
    .query_row(
      "SELECT status, cash_session_id, user_id FROM orders WHERE id = ?1",
      params![order_id],
      |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )
    .map_err(|_| "Commande introuvable.".to_string())?;

  if o_status != "validated" {
    return Err("Cette commande ne peut plus être annulée.".to_string());
  }

  let sid = o_cash_sid.ok_or_else(|| "Commande sans session de caisse.".to_string())?;
  if sid != open_id {
    return Err("Seules les commandes de la session ouverte peuvent être annulées.".to_string());
  }

  if role_norm == "caissier" && session_owner_id != user_id && o_order_uid != user_id {
    return Err(
      "Vous ne pouvez annuler que les commandes de votre session ou celles que vous avez enregistrées.".to_string(),
    );
  }

  let n = conn
    .execute(
      "UPDATE orders SET status = 'cancelled', cancel_reason = ?1, updated_at = datetime('now') WHERE id = ?2 AND status = 'validated'",
      params![reason, order_id],
    )
    .map_err(|e| e.to_string())?;

  if n == 0 {
    return Err("Impossible d'annuler cette commande.".to_string());
  }

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "order",
    "cancel",
    Some(&format!("#{} annulée", order_id)),
    Some(&format!("order_id={} reason={}", order_id, reason)),
  );

  fetch_order_response(&conn, order_id)
}
/// Données complètes pour réimprimer le ticket thermique d’une commande (historique).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderTicketPrintDto {
  pub id: i64,
  pub time: String,
  pub total: f64,
  pub cashier: String,
  pub cash_session_id: Option<i64>,
  pub order_type: Option<String>,
  pub order_comment: Option<String>,
  pub customer_phone: Option<String>,
  pub customer_address: Option<String>,
  pub received_amount: Option<f64>,
  pub change_amount: Option<f64>,
  pub lines: Vec<OrderItemInput>,
}

#[tauri::command]
pub fn get_order_ticket_for_print(user_id: i64, order_id: i64) -> Result<OrderTicketPrintDto, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let role_norm = crate::authz::active_user_role(&conn, user_id)?;
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide.".to_string());
  }

  let (
    id,
    items_json,
    total,
    time,
    cashier,
    cash_session_id,
    order_type,
    order_comment,
    customer_phone,
    customer_address,
    received_amount,
    change_amount,
    order_owner_id,
    status,
  ): (
    i64,
    String,
    f64,
    String,
    String,
    Option<i64>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<f64>,
    Option<f64>,
    i64,
    String,
  ) = conn
    .query_row(
      r#"
      SELECT o.id, o.items, o.total, o.created_at, u.name, o.cash_session_id, o.order_type, o.order_comment, o.customer_phone, o.customer_address, o.received_amount, o.change_amount, o.user_id, o.status
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.id = ?1
      "#,
      params![order_id],
      |row| {
        Ok((
          row.get(0)?,
          row.get(1)?,
          row.get(2)?,
          row.get(3)?,
          row.get(4)?,
          row.get(5)?,
          row.get(6)?,
          row.get(7)?,
          row.get(8)?,
          row.get(9)?,
          row.get(10)?,
          row.get(11)?,
          row.get(12)?,
          row.get(13)?,
        ))
      },
    )
    .map_err(|_| "Commande introuvable.".to_string())?;

  if status != "validated" {
    return Err("Cette commande ne peut pas être imprimée sur ticket.".to_string());
  }

  if role_norm == "caissier" && order_owner_id != user_id {
    return Err("Accès refusé.".to_string());
  }

  let lines: Vec<OrderItemInput> = serde_json::from_str(&items_json).unwrap_or_default();

  Ok(OrderTicketPrintDto {
    id,
    time,
    total,
    cashier,
    cash_session_id,
    order_type,
    order_comment,
    customer_phone,
    customer_address,
    received_amount,
    change_amount,
    lines,
  })
}

/// Lignes d’une commande pour réimpression ticket session (historique).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderTicketDetail {
  pub id: i64,
  pub time: String,
  pub total: f64,
  pub cashier: String,
  pub received_amount: Option<f64>,
  pub change_amount: Option<f64>,
  pub lines: Vec<OrderItemInput>,
}

#[tauri::command]
pub fn orders_list_for_session_ticket(
  user_id: i64,
  cash_session_id: i64,
) -> Result<Vec<OrderTicketDetail>, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let role_norm = crate::authz::active_user_role(&conn, user_id)?;
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide.".to_string());
  }

  let owner: i64 = conn
    .query_row(
      "SELECT user_id FROM cash_sessions WHERE id = ?1",
      params![cash_session_id],
      |r| r.get(0),
    )
    .map_err(|_| "Session introuvable.".to_string())?;

  if role_norm == "caissier" && owner != user_id {
    return Err("Accès refusé.".to_string());
  }

  let mut stmt = conn
    .prepare(
      "SELECT o.id, o.items, o.total, o.created_at, u.name, o.received_amount, o.change_amount
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.cash_session_id = ?1 AND o.status = 'validated'
       ORDER BY o.id ASC",
    )
    .map_err(|e| e.to_string())?;

  let mut rows = stmt.query(params![cash_session_id]).map_err(|e| e.to_string())?;
  let mut out: Vec<OrderTicketDetail> = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    let id: i64 = row.get(0).map_err(|e| e.to_string())?;
    let items_json: String = row.get(1).map_err(|e| e.to_string())?;
    let total: f64 = row.get(2).map_err(|e| e.to_string())?;
    let time: String = row.get(3).map_err(|e| e.to_string())?;
    let cashier: String = row.get(4).map_err(|e| e.to_string())?;
    let lines: Vec<OrderItemInput> = serde_json::from_str(&items_json).unwrap_or_default();
    out.push(OrderTicketDetail {
      id,
      time,
      total,
      cashier,
      received_amount: row.get(5).ok(),
      change_amount: row.get(6).ok(),
      lines,
    });
  }

  Ok(out)
}
