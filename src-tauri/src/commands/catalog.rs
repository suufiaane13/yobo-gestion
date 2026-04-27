use rusqlite::params;
use serde::Serialize;

use crate::db;

#[derive(Serialize)]
pub struct CatalogCategory {
  pub id: i64,
  pub label: String,
  pub emoji: String,
  pub position: i64,
}

#[derive(Serialize)]
pub struct CatalogProduct {
  pub id: i64,
  pub name: String,
  pub emoji: String,
  pub category_id: i64,
  pub sizes: serde_json::Value,
  pub active: bool,
  pub position: i64,
}

#[derive(Serialize)]
pub struct CatalogResponse {
  pub categories: Vec<CatalogCategory>,
  pub products: Vec<CatalogProduct>,
}

#[tauri::command]
pub fn list_catalog() -> Result<CatalogResponse, String> {
  let conn = db::open_db_file()?;
  db::ensure_schema(&conn)?;
  db::ensure_default_gerant(&conn)?;
  db::ensure_default_categories(&conn)?;

  let mut cat_stmt = conn
    .prepare("SELECT id, label, emoji, position FROM categories ORDER BY position ASC, id ASC")
    .map_err(|e| e.to_string())?;
  let mut cat_rows = cat_stmt.query([]).map_err(|e| e.to_string())?;

  let mut categories: Vec<CatalogCategory> = Vec::new();
  while let Some(row) = cat_rows.next().map_err(|e| e.to_string())? {
    categories.push(CatalogCategory {
      id: row.get(0).map_err(|e| e.to_string())?,
      label: row.get(1).map_err(|e| e.to_string())?,
      emoji: row.get(2).map_err(|e| e.to_string())?,
      position: row.get(3).map_err(|e| e.to_string())?,
    });
  }

  let mut prod_stmt = conn
    .prepare(
      "SELECT id, name, emoji, category_id, sizes, active, position FROM products WHERE active = 1 ORDER BY position ASC, id ASC",
    )
    .map_err(|e| e.to_string())?;
  let mut prod_rows = prod_stmt.query(params![]).map_err(|e| e.to_string())?;

  let mut products: Vec<CatalogProduct> = Vec::new();
  while let Some(row) = prod_rows.next().map_err(|e| e.to_string())? {
    let sizes_raw: String = row.get(4).map_err(|e| e.to_string())?;
    let sizes = serde_json::from_str::<serde_json::Value>(&sizes_raw).unwrap_or(serde_json::json!({}));
    let active_int: i64 = row.get(5).map_err(|e| e.to_string())?;

    products.push(CatalogProduct {
      id: row.get(0).map_err(|e| e.to_string())?,
      name: row.get(1).map_err(|e| e.to_string())?,
      emoji: row.get(2).map_err(|e| e.to_string())?,
      category_id: row.get(3).map_err(|e| e.to_string())?,
      sizes,
      active: active_int == 1,
      position: row.get(6).map_err(|e| e.to_string())?,
    });
  }

  Ok(CatalogResponse { categories, products })
}

