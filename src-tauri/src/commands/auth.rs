use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Serialize)]
pub struct AuthLoginResponse {
  #[serde(rename = "userId")]
  user_id: i64,
  role: String,
  theme: String,
}

#[tauri::command]
pub fn auth_login(
  identifier: Option<String>,
  pin: String,
  role: String,
) -> Result<AuthLoginResponse, String> {
  let role_norm = role.trim().to_lowercase();
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide. Utilise 'gerant' ou 'caissier'.".to_string());
  }

  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let pin = pin.trim().to_string();
  if pin.is_empty() {
    return Err("PIN vide.".to_string());
  }

  if role_norm == "gerant" {
    let name = identifier
      .map(|s| s.trim().to_string())
      .filter(|s| !s.is_empty())
      .ok_or_else(|| "Le gérant doit fournir un nom d'utilisateur.".to_string())?;

    // Comparaison insensible à la casse : le compte démo est « admin » ; Windows peut
    // mettre une majuscule initiale (tactile, saisie automatique) et SQLite `=` est sensible par défaut.
    let row = conn
      .query_row(
        "SELECT id, password, theme FROM users WHERE role=?1 AND active=1 AND lower(name) = lower(?2) LIMIT 1",
        params![role_norm, name],
        |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)),
      )
      .optional()
      .map_err(|e| e.to_string())?;

    let Some((user_id, password_hash, theme)) = row else {
      let _ = db::append_log(
        &conn,
        None,
        "auth",
        "login_failed",
        Some("gérant inconnu ou inactif"),
        Some(&name),
      );
      return Err("Identifiant ou PIN invalide.".to_string());
    };

    if !bcrypt::verify(&pin, &password_hash).map_err(|e| e.to_string())? {
      db::append_log_best_effort(
        &conn,
        Some(user_id),
        "auth",
        "login_failed_pin",
        Some("PIN incorrect"),
        Some(&name),
      );
      return Err("Identifiant ou PIN invalide.".to_string());
    }

    db::append_log_best_effort(
      &conn,
      Some(user_id),
      "auth",
      "login_ok",
      Some("Connexion gérant"),
      Some(&name),
    );
    return Ok(AuthLoginResponse {
      user_id,
      role: role_norm,
      theme,
    });
  }

  // Caissier: nom + PIN obligatoires (même logique que le gérant pour identifier le compte).
  let name = identifier
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
    .ok_or_else(|| "L'utilisateur doit fournir un nom d'utilisateur.".to_string())?;

  let row = conn
    .query_row(
      "SELECT id, password, theme FROM users WHERE role=?1 AND active=1 AND lower(name) = lower(?2) LIMIT 1",
      params![role_norm, name],
      |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)),
    )
    .optional()
    .map_err(|e| e.to_string())?;

  let Some((user_id, password_hash, theme)) = row else {
    db::append_log_best_effort(
      &conn,
      None,
      "auth",
      "login_failed",
      Some("caissier inconnu ou inactif"),
      Some(&name),
    );
    return Err("Identifiant ou PIN invalide.".to_string());
  };

  if !bcrypt::verify(&pin, &password_hash).map_err(|e| e.to_string())? {
    db::append_log_best_effort(
      &conn,
      Some(user_id),
      "auth",
      "login_failed_pin",
      Some("PIN incorrect"),
      Some(&name),
    );
    return Err("Identifiant ou PIN invalide.".to_string());
  }

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "auth",
    "login_ok",
    Some("Connexion caissier"),
    Some(&name),
  );
  Ok(AuthLoginResponse {
    user_id,
    role: role_norm,
    theme,
  })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthLogLogoutInput {
  pub user_id: i64,
  pub role: String,
}

/// Enregistre une déconnexion dans `logs` (appelé par le client avant de vider l’état local).
#[tauri::command]
pub fn auth_log_logout(input: AuthLogLogoutInput) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  let role_norm = input.role.trim().to_lowercase();
  let desc = match role_norm.as_str() {
    "gerant" => "Déconnexion gérant",
    "caissier" => "Déconnexion caissier",
    _ => "Déconnexion",
  };
  db::append_log_best_effort(
    &conn,
    Some(input.user_id),
    "auth",
    "logout",
    Some(desc),
    Some(&format!("role={}", role_norm)),
  );
  Ok(())
}

