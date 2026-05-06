use rusqlite::{params, Connection};

/// Vérifie que le PIN saisi correspond à l’un des comptes **gérant** actifs.
pub fn verify_gerant_pin_authorization(conn: &Connection, pin: &str) -> Result<(), String> {
  let pin_norm = pin.trim();
  if pin_norm.is_empty() {
    return Err("PIN requis.".to_string());
  }

  let mut stmt = conn
    .prepare("SELECT password FROM users WHERE role='gerant' AND active=1")
    .map_err(|e| e.to_string())?;

  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    let password_hash: String = row.get(0).map_err(|e| e.to_string())?;
    if bcrypt::verify(pin_norm, &password_hash).unwrap_or(false) {
      return Ok(());
    }
  }

  Err("PIN Gérant invalide.".to_string())
}

pub fn ensure_active_gerant(conn: &Connection, caller_user_id: i64) -> Result<(), String> {
  let exists: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM users WHERE id = ?1 AND role='gerant' AND active=1",
      params![caller_user_id],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  if exists == 0 {
    return Err("Action réservée au gérant.".to_string());
  }

  Ok(())
}

/// Rôle réel en base pour un utilisateur actif (`gerant` / `caissier`).
pub fn active_user_role(conn: &Connection, user_id: i64) -> Result<String, String> {
  let role: String = conn
    .query_row(
      "SELECT role FROM users WHERE id = ?1 AND active = 1",
      params![user_id],
      |r| r.get(0),
    )
    .map_err(|_| "Utilisateur introuvable ou inactif.".to_string())?;
  Ok(role.trim().to_lowercase())
}
