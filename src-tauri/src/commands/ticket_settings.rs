use rusqlite::params;
use serde::Deserialize;

use crate::{authz, db};

const KEY_LABEL: &str = "ticket_shop_label";
const KEY_PHONE: &str = "ticket_shop_phone";
const KEY_DOUBLE_PRINT: &str = "ticket_double_print";
const KEY_GRATINE_PRICE: &str = "gratine_price";
const DEFAULT_LABEL: &str = "YOBO SNACK";
const DEFAULT_GRATINE_PRICE: &str = "5";

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketPublicSettings {
  pub shop_label: String,
  pub shop_phone: String,
  /// Deux boîtes d’impression successives (2ᵉ imprimante ou 2ᵉ copie).
  pub double_print: bool,
  pub gratine_price: f64,
}

fn meta_get(conn: &rusqlite::Connection, key: &str) -> Option<String> {
  conn
    .query_row("SELECT value FROM app_meta WHERE key = ?1", params![key], |r| r.get(0))
    .ok()
}

fn meta_upsert(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
  conn
    .execute(
      "INSERT INTO app_meta (key, value) VALUES (?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params![key, value],
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn get_ticket_public_settings() -> Result<TicketPublicSettings, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;

  let shop_label = meta_get(&conn, KEY_LABEL)
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| DEFAULT_LABEL.to_string());
  let shop_phone = meta_get(&conn, KEY_PHONE).unwrap_or_default();
  let double_print = meta_get(&conn, KEY_DOUBLE_PRINT)
    .map(|s| matches!(s.trim(), "1" | "true" | "yes"))
    .unwrap_or(false);
  let gratine_price = meta_get(&conn, KEY_GRATINE_PRICE)
    .and_then(|s| s.parse::<f64>().ok())
    .unwrap_or_else(|| DEFAULT_GRATINE_PRICE.parse::<f64>().unwrap());

  Ok(TicketPublicSettings {
    shop_label,
    shop_phone,
    double_print,
    gratine_price,
  })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketShopBody {
  pub shop_label: String,
  pub shop_phone: String,
  #[serde(default)]
  pub double_print: bool,
  pub gratine_price: f64,
}

#[tauri::command]
pub fn set_ticket_shop_settings(user_id: i64, body: TicketShopBody) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;

  let label = body.shop_label.trim();
  let label_stored = if label.is_empty() {
    DEFAULT_LABEL.to_string()
  } else {
    label.chars().take(80).collect::<String>()
  };
  let phone = body.shop_phone.trim().chars().take(40).collect::<String>();

  meta_upsert(&conn, KEY_LABEL, &label_stored)?;
  meta_upsert(&conn, KEY_PHONE, &phone)?;
  meta_upsert(
    &conn,
    KEY_DOUBLE_PRINT,
    if body.double_print { "1" } else { "0" },
  )?;
  meta_upsert(&conn, KEY_GRATINE_PRICE, &body.gratine_price.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "settings",
    "ticket_shop",
    Some("En-tête / téléphone / double impression tickets"),
    None,
  );

  Ok(())
}
