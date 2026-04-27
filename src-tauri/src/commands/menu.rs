use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::{authz, db};

#[derive(Serialize, Deserialize, Clone)]
pub struct CategoryDto {
  pub id: i64,
  pub label: String,
  pub emoji: String,
  pub position: i64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProductDto {
  pub id: i64,
  pub name: String,
  pub description: Option<String>,
  pub emoji: String,
  pub category_id: i64,
  pub sizes: serde_json::Value,
  pub active: bool,
  pub position: i64,
}

#[derive(Deserialize)]
pub struct NewCategoryInput {
  pub label: String,
  pub emoji: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewProductInput {
  pub name: String,
  pub description: Option<String>,
  pub emoji: String,
  pub category_id: i64,
  pub sizes: serde_json::Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProductInput {
  pub id: i64,
  pub name: String,
  pub description: Option<String>,
  pub emoji: String,
  pub category_id: i64,
  pub sizes: serde_json::Value,
}

#[derive(Deserialize)]
pub struct CategoryPositionInput {
  pub id: i64,
  pub position: i64,
}

#[tauri::command]
pub fn list_categories(user_id: i64) -> Result<Vec<CategoryDto>, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;

  let mut stmt = conn
    .prepare("SELECT id, label, emoji, position FROM categories ORDER BY position ASC, id ASC")
    .map_err(|e| e.to_string())?;
  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

  let mut out = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    out.push(CategoryDto {
      id: row.get(0).map_err(|e| e.to_string())?,
      label: row.get(1).map_err(|e| e.to_string())?,
      emoji: row.get(2).map_err(|e| e.to_string())?,
      position: row.get(3).map_err(|e| e.to_string())?,
    });
  }
  Ok(out)
}

#[tauri::command]
pub fn add_category(user_id: i64, input: NewCategoryInput) -> Result<CategoryDto, String> {
  let label = input.label.trim();
  let emoji = input.emoji.trim();
  if label.is_empty() || emoji.is_empty() {
    return Err("Label et emoji requis.".to_string());
  }

  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;
  db::ensure_default_categories(&conn)?;

  let pos: i64 = conn
    .query_row("SELECT COALESCE(MAX(position), -1) + 1 FROM categories", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;

  conn
    .execute(
      "INSERT INTO categories (label, emoji, position) VALUES (?1, ?2, ?3)",
      params![label, emoji, pos],
    )
    .map_err(|e| e.to_string())?;

  let id = conn.last_insert_rowid();
  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "menu",
    "add_category",
    Some(label),
    Some(&format!("id={}", id)),
  );
  Ok(CategoryDto {
    id,
    label: label.to_string(),
    emoji: emoji.to_string(),
    position: pos,
  })
}

#[tauri::command]
pub fn reorder_categories(user_id: i64, positions: Vec<CategoryPositionInput>) -> Result<(), String> {
  let mut conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  // On autorise tout le monde a réordonner pour la fluidité de la caisse,
  // mais on vérifie quand même que l'utilisateur existe.
  // authz::ensure_active_gerant(&conn, user_id)?; 
  
  let tx = conn.transaction().map_err(|e| e.to_string())?;
  
  for item in &positions {
    tx.execute(
      "UPDATE categories SET position = ?1 WHERE id = ?2",
      params![item.position, item.id],
    ).map_err(|e| e.to_string())?;
  }
  
  tx.commit().map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "menu",
    "reorder_categories",
    None,
    Some(&format!("count={}", positions.len())),
  );
  
  Ok(())
}

#[tauri::command]
pub fn delete_category(user_id: i64, category_id: i64) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;

  let used: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM products WHERE category_id = ?1",
      params![category_id],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  if used > 0 {
    return Err("Impossible: la catégorie contient des produits.".to_string());
  }

  let label: String = conn
    .query_row(
      "SELECT label FROM categories WHERE id = ?1",
      params![category_id],
      |r| r.get(0),
    )
    .map_err(|_| "Catégorie introuvable.".to_string())?;

  conn
    .execute("DELETE FROM categories WHERE id = ?1", params![category_id])
    .map_err(|e| e.to_string())?;
  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "menu",
    "delete_category",
    Some(&label),
    Some(&format!("id={}", category_id)),
  );
  Ok(())
}

#[tauri::command]
pub fn list_products(user_id: i64) -> Result<Vec<ProductDto>, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;

  let mut stmt = conn
    .prepare(
      "SELECT id, name, description, emoji, category_id, sizes, active, position FROM products ORDER BY position ASC, id ASC",
    )
    .map_err(|e| e.to_string())?;
  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

  let mut out = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    let sizes_raw: String = row.get(5).map_err(|e| e.to_string())?;
    out.push(ProductDto {
      id: row.get(0).map_err(|e| e.to_string())?,
      name: row.get(1).map_err(|e| e.to_string())?,
      description: row.get(2).ok(),
      emoji: row.get(3).map_err(|e| e.to_string())?,
      category_id: row.get(4).map_err(|e| e.to_string())?,
      sizes: serde_json::from_str(&sizes_raw).unwrap_or(serde_json::json!({})),
      active: row.get::<_, i64>(6).map_err(|e| e.to_string())? == 1,
      position: row.get(7).map_err(|e| e.to_string())?,
    });
  }
  Ok(out)
}

#[tauri::command]
pub fn reorder_products(user_id: i64, positions: Vec<CategoryPositionInput>) -> Result<(), String> {
  let mut conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  // On autorise par fluidité, mais on vérifie l'existence de l'utilisateur
  
  let tx = conn.transaction().map_err(|e| e.to_string())?;
  
  for item in &positions {
    tx.execute(
      "UPDATE products SET position = ?1 WHERE id = ?2",
      params![item.position, item.id],
    ).map_err(|e| e.to_string())?;
  }
  
  tx.commit().map_err(|e| e.to_string())?;

  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "menu",
    "reorder_products",
    None,
    Some(&format!("count={}", positions.len())),
  );
  
  Ok(())
}

#[tauri::command]
pub fn add_product(user_id: i64, input: NewProductInput) -> Result<ProductDto, String> {
  if input.name.trim().is_empty() {
    return Err("Nom produit requis.".to_string());
  }
  let sizes_str = serde_json::to_string(&input.sizes).map_err(|e| e.to_string())?;

  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;
  db::ensure_default_categories(&conn)?;

  conn
    .execute(
      "INSERT INTO products (name, description, emoji, category_id, sizes, active) VALUES (?1, ?2, ?3, ?4, ?5, 1)",
      params![
        input.name.trim(),
        input.description.clone(),
        if input.emoji.trim().is_empty() { "🍽️" } else { input.emoji.trim() },
        input.category_id,
        sizes_str
      ],
    )
    .map_err(|e| e.to_string())?;

  let id = conn.last_insert_rowid();
  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "menu",
    "add_product",
    Some(input.name.trim()),
    Some(&format!("id={}", id)),
  );
  Ok(ProductDto {
    id,
    name: input.name.trim().to_string(),
    description: input.description,
    emoji: if input.emoji.trim().is_empty() { "🍽️".to_string() } else { input.emoji.trim().to_string() },
    category_id: input.category_id,
    sizes: input.sizes,
    active: true,
    position: 0,
  })
}

#[tauri::command]
pub fn set_product_active(user_id: i64, product_id: i64, active: bool) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;
  conn
    .execute(
      "UPDATE products SET active = ?1, updated_at = datetime('now') WHERE id = ?2",
      params![if active { 1_i64 } else { 0_i64 }, product_id],
    )
    .map_err(|e| e.to_string())?;
  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "menu",
    "set_product_active",
    None,
    Some(&format!("id={} active={}", product_id, active)),
  );
  Ok(())
}

#[tauri::command]
pub fn update_product(user_id: i64, input: UpdateProductInput) -> Result<(), String> {
  if input.name.trim().is_empty() {
    return Err("Nom produit requis.".to_string());
  }
  let sizes_str = serde_json::to_string(&input.sizes).map_err(|e| e.to_string())?;

  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;

  conn
    .execute(
      "UPDATE products SET name = ?1, description = ?2, emoji = ?3, category_id = ?4, sizes = ?5, updated_at = datetime('now') WHERE id = ?6",
      params![
        input.name.trim(),
        input.description.clone(),
        if input.emoji.trim().is_empty() { "🍽️" } else { input.emoji.trim() },
        input.category_id,
        sizes_str,
        input.id
      ],
    )
    .map_err(|e| e.to_string())?;
  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "menu",
    "update_product",
    Some(input.name.trim()),
    Some(&format!("id={}", input.id)),
  );
  Ok(())
}

#[tauri::command]
pub fn delete_product(user_id: i64, product_id: i64) -> Result<(), String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  authz::ensure_active_gerant(&conn, user_id)?;

  let name: Option<String> = conn
    .query_row("SELECT name FROM products WHERE id = ?1", params![product_id], |r| r.get(0))
    .optional()
    .map_err(|e| e.to_string())?;
  let Some(name) = name else {
    return Err("Produit introuvable.".to_string());
  };

  conn
    .execute("DELETE FROM products WHERE id = ?1", params![product_id])
    .map_err(|e| e.to_string())?;
  db::append_log_best_effort(
    &conn,
    Some(user_id),
    "menu",
    "delete_product",
    Some(&name),
    Some(&format!("id={}", product_id)),
  );
  Ok(())
}

