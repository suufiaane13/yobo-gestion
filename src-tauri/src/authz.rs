use rusqlite::{params, Connection};

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
