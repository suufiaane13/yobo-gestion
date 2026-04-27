use rusqlite::params;
use serde::Deserialize;

use crate::{authz, db};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeSelection {
  pub orders: bool,
  pub logs: bool,
  pub cash_sessions: bool,
  pub caissiers: bool,
  /// Supprime le catalogue (catégories + produits) sans reseed.
  pub catalog_delete: bool,
}

#[tauri::command]
pub fn database_purge_operational_data(
  user_id: i64,
  pin: String,
  confirmation_word: String,
) -> Result<(), String> {
  let mut conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;

  let pin_norm = pin.trim();
  if pin_norm.is_empty() {
    return Err("PIN requis.".to_string());
  }

  if confirmation_word.trim() != "supprimer" {
    return Err("Tapez exactement « supprimer » pour confirmer.".to_string());
  }

  let password_hash: String = conn
    .query_row(
      "SELECT password FROM users WHERE id=?1 AND role='gerant' AND active=1 LIMIT 1",
      params![user_id],
      |r| r.get(0),
    )
    .map_err(|_| "Compte gérant introuvable.".to_string())?;

  if !bcrypt::verify(pin_norm, &password_hash).map_err(|e| e.to_string())? {
    return Err("PIN incorrect.".to_string());
  }

  let tx = conn.transaction().map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM orders", []).map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM logs", []).map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM cash_sessions", []).map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM users WHERE role = 'caissier'", [])
    .map_err(|e| e.to_string())?;
  db::reset_catalog_to_seed(&tx).map_err(|e| e.to_string())?;
  tx.commit().map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "settings",
    "database_purge_operational",
    Some("Réinitialisation : commandes, journaux, caisses, caissiers ; menu rétabli au jeu d’usine (seed)."),
    None,
  );

  Ok(())
}

#[tauri::command]
pub fn database_purge_selected_data(
  user_id: i64,
  pin: String,
  confirmation_word: String,
  selection: PurgeSelection,
) -> Result<(), String> {
  let mut conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;

  let pin_norm = pin.trim();
  if pin_norm.is_empty() {
    return Err("PIN requis.".to_string());
  }
  if confirmation_word.trim() != "supprimer" {
    return Err("Tapez exactement « supprimer » pour confirmer.".to_string());
  }

  let password_hash: String = conn
    .query_row(
      "SELECT password FROM users WHERE id=?1 AND role='gerant' AND active=1 LIMIT 1",
      params![user_id],
      |r| r.get(0),
    )
    .map_err(|_| "Compte gérant introuvable.".to_string())?;

  if !bcrypt::verify(pin_norm, &password_hash).map_err(|e| e.to_string())? {
    return Err("PIN incorrect.".to_string());
  }

  if !selection.orders
    && !selection.logs
    && !selection.cash_sessions
    && !selection.caissiers
    && !selection.catalog_delete
  {
    return Err("Sélection vide : choisissez au moins une table à effacer.".to_string());
  }

  let tx = conn.transaction().map_err(|e| e.to_string())?;
  if selection.orders {
    tx.execute("DELETE FROM orders", []).map_err(|e| e.to_string())?;
  }
  if selection.logs {
    tx.execute("DELETE FROM logs", []).map_err(|e| e.to_string())?;
  }
  if selection.cash_sessions {
    tx.execute("DELETE FROM cash_sessions", [])
      .map_err(|e| e.to_string())?;
  }
  if selection.caissiers {
    tx.execute("DELETE FROM users WHERE role = 'caissier'", [])
      .map_err(|e| e.to_string())?;
  }
  if selection.catalog_delete {
    tx.execute("DELETE FROM products", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM categories", []).map_err(|e| e.to_string())?;
    tx.execute(
      "INSERT INTO app_meta (key, value) VALUES ('menu_seed_locked_empty', '1')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [],
    )
    .map_err(|e| e.to_string())?;
    // On laisse `menu_seed_version` tel quel : le lock empêche l'auto-seed.
  }
  tx.commit().map_err(|e| e.to_string())?;

  let mut parts: Vec<&str> = Vec::new();
  if selection.orders {
    parts.push("commandes");
  }
  if selection.logs {
    parts.push("logs");
  }
  if selection.cash_sessions {
    parts.push("sessions caisse");
  }
  if selection.caissiers {
    parts.push("caissiers");
  }
  if selection.catalog_delete {
    parts.push("menu (supprimé)");
  }
  let summary = if parts.is_empty() {
    "Réinitialisation partielle."
  } else {
    // "x, y, z" (simple, lisible sur ticket/logs)
    // On évite les allocations inutiles au-dessus : `parts` contient des &str.
    // Ici on construit la phrase finale.
    // (N.B. les accents ok en UTF-8)
    // Ex: "Réinitialisation : commandes, logs, menu (seed)."
    // (le point final est volontaire)
    ""
  };
  let summary_owned = if summary.is_empty() {
    format!("Réinitialisation : {}.", parts.join(", "))
  } else {
    summary.to_string()
  };

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "settings",
    "database_purge_selected",
    Some(&summary_owned),
    None,
  );

  Ok(())
}
