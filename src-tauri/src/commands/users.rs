use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaissierDto {
  pub id: i64,
  pub name: String,
  pub role: String,
  pub active: bool,
  pub theme: String,
  pub avatar: Option<String>,
  pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileDto {
  pub id: i64,
  pub name: String,
  pub role: String,
  pub active: bool,
  pub avatar: Option<String>,
  pub created_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCaissierInput {
  pub name: String,
  pub pin: String,
  pub theme: Option<String>,
}

fn ensure_caller_is_gerant(conn: &rusqlite::Connection, caller_role: &str, caller_user_id: i64) -> Result<(), String> {
  let role_norm = caller_role.trim().to_lowercase();
  if role_norm != "gerant" {
    return Err("Action réservée au gérant.".to_string());
  }

  crate::authz::ensure_active_gerant(conn, caller_user_id)
}

#[tauri::command]
pub fn list_caissiers(role: String, user_id: i64) -> Result<Vec<CaissierDto>, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;

  ensure_caller_is_gerant(&conn, &role, user_id)?;

  let mut stmt = conn
    .prepare(
      "SELECT id, name, role, active, theme, created_at, avatar
       FROM users
       WHERE role='caissier'
       ORDER BY active DESC, id DESC",
    )
    .map_err(|e| e.to_string())?;

  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
  let mut out = Vec::new();

  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    out.push(CaissierDto {
      id: row.get(0).map_err(|e| e.to_string())?,
      name: row.get(1).map_err(|e| e.to_string())?,
      role: row.get(2).map_err(|e| e.to_string())?,
      active: row.get::<_, i64>(3).map_err(|e| e.to_string())? == 1,
      theme: row.get(4).map_err(|e| e.to_string())?,
      created_at: row.get(5).map_err(|e| e.to_string())?,
      avatar: row.get(6).ok(),
    })
  }

  Ok(out)
}

#[tauri::command]
pub fn create_caissier(
  role: String,
  user_id: i64,
  input: CreateCaissierInput,
) -> Result<CaissierDto, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;

  ensure_caller_is_gerant(&conn, &role, user_id)?;

  let name = input.name.trim().to_string();
  if name.is_empty() {
    return Err("Nom requis.".to_string());
  }

  let pin = input.pin.trim().to_string();
  if pin.is_empty() {
    return Err("PIN requis.".to_string());
  }

  let theme_norm = input
    .theme
    .unwrap_or_else(|| "dark".to_string())
    .trim()
    .to_lowercase();
  if theme_norm != "dark" && theme_norm != "light" {
    return Err("Theme invalide (utilise 'dark' ou 'light').".to_string());
  }

  let hashed = bcrypt::hash(pin, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;

  conn.execute(
    "INSERT INTO users (name, role, password, active, theme)
     VALUES (?1, 'caissier', ?2, 1, ?3)",
    params![name, hashed, theme_norm],
  )
  .map_err(|e| e.to_string())?;

  let id = conn.last_insert_rowid();

  let dto = conn
    .query_row(
      "SELECT id, name, role, active, theme, created_at, avatar
       FROM users
       WHERE id=?1",
      params![id],
      |r| {
        Ok(CaissierDto {
          id: r.get(0)?,
          name: r.get(1)?,
          role: r.get(2)?,
          active: r.get::<_, i64>(3)? == 1,
          theme: r.get(4)?,
          created_at: r.get(5)?,
          avatar: r.get(6).ok(),
        })
      },
    )
    .map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "user",
    "create_caissier",
    Some(&name),
    Some(&format!("id={}", id)),
  );

  Ok(dto)
}

#[tauri::command]
pub fn set_caissier_active(
  role: String,
  user_id: i64,
  target_user_id: i64,
  active: bool,
) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;

  ensure_caller_is_gerant(&conn, &role, user_id)?;

  let target_name: String = conn
    .query_row(
      "SELECT name FROM users WHERE id = ?1 AND role = 'caissier'",
      params![target_user_id],
      |r| r.get(0),
    )
    .map_err(|_| "Utilisateur introuvable.".to_string())?;

  conn.execute(
    "UPDATE users
     SET active = ?1
     WHERE id = ?2 AND role='caissier'",
    params![if active { 1_i64 } else { 0_i64 }, target_user_id],
  )
  .map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "user",
    "set_caissier_active",
    Some(&target_name),
    Some(&format!("id={} active={}", target_user_id, active)),
  );

  Ok(())
}

#[tauri::command]
pub fn reset_caissier_pin(
  role: String,
  user_id: i64,
  target_user_id: i64,
  pin: String,
) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;

  ensure_caller_is_gerant(&conn, &role, user_id)?;

  let pin_norm = pin.trim().to_string();
  if pin_norm.is_empty() {
    return Err("PIN requis.".to_string());
  }

  // On autorise uniquement les users dont le rôle est caissier.
  // NB: `password` est stocké en bcrypt.
  let hashed = bcrypt::hash(pin_norm, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
  conn.execute(
    "UPDATE users
     SET password = ?1
     WHERE id = ?2 AND role='caissier'",
    params![hashed, target_user_id],
  )
  .map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "user",
    "reset_caissier_pin",
    None,
    Some(&format!("target_id={}", target_user_id)),
  );

  Ok(())
}

#[tauri::command]
pub fn verify_user_pin(role: String, user_id: i64, pin: String) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;

  let role_norm = role.trim().to_lowercase();
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide.".to_string());
  }

  let pin_norm = pin.trim().to_string();
  if pin_norm.is_empty() {
    return Err("PIN requis.".to_string());
  }

  let row = conn
    .query_row(
      "SELECT password, active FROM users WHERE id=?1 AND role=?2 LIMIT 1",
      params![user_id, role_norm],
      |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? == 1)),
    )
    .optional()
    .map_err(|e| e.to_string())?;

  let Some((password_hash, active)) = row else {
    return Err("Compte invalide.".to_string());
  };

  if !active {
    return Err("Compte désactivé.".to_string());
  }

  if !bcrypt::verify(&pin_norm, &password_hash).map_err(|e| e.to_string())? {
    return Err("Ancien PIN invalide.".to_string());
  }

  Ok(())
}

#[tauri::command]
pub fn change_user_password(role: String, user_id: i64, old_pin: String, new_pin: String) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;

  let role_norm = role.trim().to_lowercase();
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide.".to_string());
  }

  let old_norm = old_pin.trim().to_string();
  let new_norm = new_pin.trim().to_string();
  if old_norm.is_empty() {
    return Err("Ancien PIN requis.".to_string());
  }
  if new_norm.is_empty() {
    return Err("Nouveau PIN requis.".to_string());
  }

  let row = conn
    .query_row(
      "SELECT password, active FROM users WHERE id=?1 AND role=?2 LIMIT 1",
      params![user_id, role_norm],
      |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? == 1)),
    )
    .optional()
    .map_err(|e| e.to_string())?;

  let Some((password_hash, active)) = row else {
    return Err("Compte invalide.".to_string());
  };

  if !active {
    return Err("Compte désactivé.".to_string());
  }

  if !bcrypt::verify(&old_norm, &password_hash).map_err(|e| e.to_string())? {
    return Err("Ancien PIN invalide.".to_string());
  }

  let hashed = bcrypt::hash(new_norm, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
  conn.execute(
    "UPDATE users SET password=?1 WHERE id=?2 AND role=?3",
    params![hashed, user_id, role_norm],
  )
  .map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "profile",
    "change_pin",
    Some("PIN modifié"),
    None,
  );

  Ok(())
}

#[tauri::command]
pub fn get_user_profile(role: String, user_id: i64) -> Result<UserProfileDto, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;

  let role_norm = role.trim().to_lowercase();
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide.".to_string());
  }

  let row = conn
    .query_row(
      "SELECT id, name, role, active, created_at, avatar FROM users WHERE id=?1 AND role=?2 LIMIT 1",
      params![user_id, role_norm],
      |r| {
        Ok(UserProfileDto {
          id: r.get(0)?,
          name: r.get(1)?,
          role: r.get(2)?,
          active: r.get::<_, i64>(3)? == 1,
          created_at: r.get(4)?,
          avatar: r.get(5).ok(),
        })
      },
    )
    .map_err(|e| e.to_string())?;

  Ok(row)
}

#[tauri::command]
pub fn change_user_name(role: String, user_id: i64, pin: String, new_name: String) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;

  let role_norm = role.trim().to_lowercase();
  if role_norm != "gerant" {
    return Err("Action réservée au gérant.".to_string());
  }

  let new_name_norm = new_name.trim().to_string();
  if new_name_norm.is_empty() {
    return Err("Nom requis.".to_string());
  }

  let pin_norm = pin.trim().to_string();
  if pin_norm.is_empty() {
    return Err("Ancien PIN requis.".to_string());
  }

  let row = conn
    .query_row(
      "SELECT password, active FROM users WHERE id=?1 AND role=?2 LIMIT 1",
      params![user_id, role_norm],
      |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? == 1)),
    )
    .optional()
    .map_err(|e| e.to_string())?;

  let Some((password_hash, active)) = row else {
    return Err("Compte invalide.".to_string());
  };
  if !active {
    return Err("Compte désactivé.".to_string());
  }

  if !bcrypt::verify(&pin_norm, &password_hash).map_err(|e| e.to_string())? {
    return Err("PIN invalide.".to_string());
  }

  conn.execute(
    "UPDATE users SET name=?1 WHERE id=?2 AND role=?3",
    params![new_name_norm, user_id, role_norm],
  )
  .map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "profile",
    "change_name",
    Some(&new_name_norm),
    None,
  );

  Ok(())
}

#[tauri::command]
pub fn verify_any_gerant_pin(pin: String) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;

  let pin_norm = pin.trim().to_string();
  if pin_norm.is_empty() {
    return Err("PIN requis.".to_string());
  }

  let mut stmt = conn
    .prepare("SELECT password FROM users WHERE role='gerant' AND active=1")
    .map_err(|e| e.to_string())?;

  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
  let mut found_match = false;

  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    let password_hash: String = row.get(0).map_err(|e| e.to_string())?;
    if bcrypt::verify(&pin_norm, &password_hash).unwrap_or(false) {
      found_match = true;
      break;
    }
  }

  if found_match {
    Ok(())
  } else {
    Err("PIN Gérant invalide.".to_string())
  }
}

#[tauri::command]
pub fn update_user_avatar(role: String, user_id: i64, avatar: String) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;

  let role_norm = role.trim().to_lowercase();
  if role_norm != "gerant" && role_norm != "caissier" {
    return Err("Rôle invalide.".to_string());
  }

  conn.execute(
    "UPDATE users SET avatar = ?1 WHERE id = ?2 AND role = ?3",
    params![avatar, user_id, role_norm],
  )
  .map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "profile",
    "change_avatar",
    Some(&avatar),
    None,
  );

  Ok(())
}

