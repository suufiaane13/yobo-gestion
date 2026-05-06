use rusqlite::{params, Connection, OptionalExtension};
use serde_json::json;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

const DEFAULT_GERANT_NAME: &str = "admin";
const DEFAULT_GERANT_PIN: &str = "1234";

/// Chemin du fichier SQLite (hors dépôt ; stable pour sauvegarde / restauration).
pub fn sqlite_db_path() -> Result<PathBuf, String> {
  let base = dirs::data_local_dir()
    .ok_or_else(|| "Impossible de determiner le dossier donnees local.".to_string())?;
  let dir = base.join("yobo-gestion");
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir.join("yobo.sqlite"))
}

/// Chemin stable hors du dossier `src-tauri` pour éviter que `tauri dev` ne
/// relance un rebuild à chaque écriture SQLite (le watcher surveille `src-tauri/`).
pub fn open_db_file() -> Result<Connection, String> {
  let path = sqlite_db_path()?;
  let conn = Connection::open(path).map_err(|e| e.to_string())?;
  // Réduit les échecs « database is locked » (accès rapprochés, antivirus) sur Windows.
  conn
    .busy_timeout(Duration::from_secs(8))
    .map_err(|e| e.to_string())?;
  conn
    .pragma_update(None, "journal_mode", "WAL")
    .map_err(|e| e.to_string())?;
  conn
    .execute_batch("PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL; PRAGMA auto_vacuum = INCREMENTAL;")
    .map_err(|e| e.to_string())?;
  // SQLite recommande de lancer PRAGMA optimize régulièrement.
  let _ = conn.execute("PRAGMA optimize;", []);
  Ok(conn)
}

/// Colonnes / index ajoutés après la création initiale des tables.
pub fn migrate_schema(conn: &Connection) -> Result<(), String> {
  let cols: Vec<String> = conn
    .prepare("PRAGMA table_info(orders)")
    .map_err(|e| e.to_string())?
    .query_map([], |row| row.get::<_, String>(1))
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

  if !cols.iter().any(|c| c == "cash_session_id") {
    conn
      .execute(
        "ALTER TABLE orders ADD COLUMN cash_session_id INTEGER REFERENCES cash_sessions(id)",
        [],
      )
      .map_err(|e| e.to_string())?;
  }

  conn
    .execute(
      "CREATE INDEX IF NOT EXISTS idx_orders_cash_session_id ON orders(cash_session_id)",
      [],
    )
    .map_err(|e| e.to_string())?;

  if !cols.iter().any(|c| c == "order_type") {
    conn
      .execute(
        "ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'sur_place'",
        [],
      )
      .map_err(|e| e.to_string())?;
  }

  if !cols.iter().any(|c| c == "order_comment") {
    conn
      .execute("ALTER TABLE orders ADD COLUMN order_comment TEXT", [])
      .map_err(|e| e.to_string())?;
  }

  if !cols.iter().any(|c| c == "customer_phone") {
    conn
      .execute("ALTER TABLE orders ADD COLUMN customer_phone TEXT", [])
      .map_err(|e| e.to_string())?;
  }

  if !cols.iter().any(|c| c == "customer_address") {
    conn
      .execute("ALTER TABLE orders ADD COLUMN customer_address TEXT", [])
      .map_err(|e| e.to_string())?;
  }

  conn
    .execute(
      "CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone)",
      [],
    )
    .map_err(|e| e.to_string())?;

  if !cols.iter().any(|c| c == "received_amount") {
    conn
      .execute("ALTER TABLE orders ADD COLUMN received_amount REAL", [])
      .map_err(|e| e.to_string())?;
  }

  if !cols.iter().any(|c| c == "change_amount") {
    conn
      .execute("ALTER TABLE orders ADD COLUMN change_amount REAL", [])
      .map_err(|e| e.to_string())?;
  }

  // Ajout de la colonne position pour les produits (pour le drag & drop)
  let prod_cols: Vec<String> = conn
    .prepare("PRAGMA table_info(products)")
    .map_err(|e| e.to_string())?
    .query_map([], |row| row.get::<_, String>(1))
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

  if !prod_cols.iter().any(|c| c == "position") {
    conn
      .execute("ALTER TABLE products ADD COLUMN position INTEGER DEFAULT 0", [])
      .map_err(|e| e.to_string())?;
  }

  // Ajout de la colonne avatar pour les utilisateurs
  let user_cols: Vec<String> = conn
    .prepare("PRAGMA table_info(users)")
    .map_err(|e| e.to_string())?
    .query_map([], |row| row.get::<_, String>(1))
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

  if !user_cols.iter().any(|c| c == "avatar") {
    conn
      .execute("ALTER TABLE users ADD COLUMN avatar TEXT", [])
      .map_err(|e| e.to_string())?;
  }

  Ok(())
}

pub fn ensure_schema(conn: &Connection) -> Result<(), String> {
  conn.execute_batch(
    r#"
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('gerant', 'caissier')),
      password    TEXT NOT NULL,
      active      INTEGER DEFAULT 1,
      theme       TEXT DEFAULT 'dark',
      avatar      TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      label     TEXT NOT NULL UNIQUE,
      emoji     TEXT NOT NULL,
      position  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      emoji       TEXT NOT NULL DEFAULT '🍽️',
      category_id INTEGER NOT NULL REFERENCES categories(id),
      sizes       TEXT NOT NULL,
      active      INTEGER DEFAULT 1,
      position    INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      items         TEXT NOT NULL,
      total         REAL NOT NULL,
      status        TEXT NOT NULL DEFAULT 'validated' CHECK(status IN ('validated','cancelled','modified')),
      cancel_reason TEXT,
      order_comment TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      received_amount REAL,
      change_amount   REAL,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id),
      action_type TEXT NOT NULL,
      action      TEXT NOT NULL,
      description TEXT,
      meta        TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cash_sessions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL REFERENCES users(id),
      opening_amount REAL NOT NULL,
      closing_amount REAL,
      theoretical    REAL,
      gap            REAL,
      comment        TEXT,
      opened_at      TEXT DEFAULT (datetime('now')),
      closed_at      TEXT
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_id ON cash_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON cash_sessions(opened_at);
    "#,
  )
  .map_err(|e| e.to_string())?;

  migrate_schema(conn)
}

pub fn ensure_default_gerant(conn: &Connection) -> Result<(), String> {
  // Permet de démarrer rapidement en développement.
  // En production, il faudra créer les comptes via le module gérant.
  let exists: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM users WHERE role='gerant' AND lower(trim(name)) = lower(trim(?1)) AND active=1",
      params![DEFAULT_GERANT_NAME],
      |row| row.get(0),
    )
    .map_err(|e| e.to_string())?;

  if exists > 0 {
    return Ok(());
  }

  let hashed = bcrypt::hash(DEFAULT_GERANT_PIN, bcrypt::DEFAULT_COST)
    .map_err(|e| e.to_string())?;

  conn.execute(
    "INSERT INTO users (name, role, password, active, theme) VALUES (?1, 'gerant', ?2, 1, 'dark')",
    params![DEFAULT_GERANT_NAME, hashed],
  )
  .map_err(|e| e.to_string())?;

  Ok(())
}

pub fn ensure_default_categories(conn: &Connection) -> Result<(), String> {
  // Seed du catalogue "usine" (catégories + produits) pour une base neuve
  // ou après reset. Clés `sizes` JSON alignées sur `menuFallback.ts` : S (une taille),
  // L/XL (tacos), P/M/G (pizzas), S+L (eau), etc.
  const MENU_SEED_VERSION: &str = "yobo_menu_v2_2026_05_align_menu_fallback";

  // Si l'utilisateur a explicitement vidé le menu via Profil → suppression ciblée,
  // on n'auto-seed pas tant qu'il n'a pas demandé un reset vers le seed.
  let seed_locked_empty: Option<String> = conn
    .query_row(
      "SELECT value FROM app_meta WHERE key = 'menu_seed_locked_empty'",
      [],
      |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())?;
  if seed_locked_empty.as_deref() == Some("1") {
    return Ok(());
  }

  let seeded_version: Option<String> = conn
    .query_row(
      "SELECT value FROM app_meta WHERE key = 'menu_seed_version'",
      [],
      |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())?;

  if seeded_version.as_deref() == Some(MENU_SEED_VERSION) {
    return Ok(());
  }

  // `rusqlite::Connection::transaction()` demande `&mut Connection`.
  // Ici on reste sur `&Connection` et on utilise une transaction SQL manuelle.
  // En cas d'erreur, on tente un ROLLBACK best-effort.
  conn
    .execute_batch("BEGIN IMMEDIATE")
    .map_err(|e| e.to_string())?;

  let seed_result: Result<(), String> = (|| {
    conn
      .execute("DELETE FROM products", [])
      .map_err(|e| e.to_string())?;
    conn
      .execute("DELETE FROM categories", [])
      .map_err(|e| e.to_string())?;

    let mut cat_ids: HashMap<&'static str, i64> = HashMap::new();

    let mut insert_category = |key: &'static str,
                               label: &'static str,
                               emoji: &'static str,
                               position: i64|
     -> Result<(), String> {
      conn
        .execute(
          "INSERT INTO categories (label, emoji, position) VALUES (?1, ?2, ?3)",
          params![label, emoji, position],
        )
        .map_err(|e| e.to_string())?;
      let id = conn.last_insert_rowid();
      cat_ids.insert(key, id);
      Ok(())
    };

    // Catégories (ordre = onglets caisse)
    insert_category("pain_maison", "PAIN MAISON", "🥪", 0)?;
    insert_category("calzone", "CALZONE", "🥟", 1)?;
    insert_category("tacos", "TACOS", "🌮", 2)?;
    insert_category("panini", "PANINI", "🥪", 3)?;
    insert_category("burger", "BURGER", "🍔", 4)?;
    insert_category("pasticcio", "PASTICCIO", "🍝", 5)?;
    insert_category("sandwichs", "SANDWICHS", "🔥", 6)?;
    insert_category("kids", "KIDS", "👶", 7)?;
    insert_category("pizza", "PIZZA", "🍕", 8)?;
    insert_category("pates", "PÂTES", "🍝", 9)?;
    insert_category("risotto", "RISOTTO", "🍚", 10)?;
    insert_category("entrees", "ENTRÉES", "🥗", 11)?;
    insert_category("plats", "PLATS", "🍽️", 12)?;
    insert_category("crepes", "CRÊPES", "🧇", 13)?;
    insert_category("boissons", "BOISSONS", "🧃", 14)?;
    insert_category("jus_mojito", "JUS & MOJITO", "🥤", 15)?;
    insert_category("supplements", "SUPPLÉMENT", "➕", 16)?;

    let insert_product = |category_key: &'static str,
                          emoji: &'static str,
                          name: &'static str,
                          sizes: serde_json::Value|
     -> Result<(), String> {
      let cat_id = *cat_ids
        .get(category_key)
        .ok_or_else(|| format!("Catégorie seed introuvable: {}", category_key))?;
      let sizes_str = serde_json::to_string(&sizes).map_err(|e| e.to_string())?;
      conn
        .execute(
          "INSERT INTO products (name, description, emoji, category_id, sizes, active) VALUES (?1, NULL, ?2, ?3, ?4, 1)",
          params![name, emoji, cat_id, sizes_str],
        )
        .map_err(|e| e.to_string())?;
      Ok(())
    };

  // 🥪 PAIN MAISON
  insert_product("pain_maison", "🍗", "Poulet Tex-Mex", json!({ "S": 35 }))?;
  insert_product("pain_maison", "🥙", "Marocain", json!({ "S": 37 }))?;
  insert_product("pain_maison", "🦐", "Fruits de Mer", json!({ "S": 40 }))?;
  insert_product("pain_maison", "🥖", "Yobo", json!({ "S": 42 }))?;

  // 🥟 CALZONE
  insert_product("calzone", "🍗", "Poulet", json!({ "S": 35 }))?;
  insert_product("calzone", "🥩", "Viande Hachée", json!({ "S": 40 }))?;
  insert_product("calzone", "🥟", "Mixte", json!({ "S": 40 }))?;
  insert_product("calzone", "🦐", "Fruits de Mer", json!({ "S": 45 }))?;

  // 🌮 TACOS (L / XL)
  insert_product("tacos", "🍗", "Poulet", json!({ "L": 30, "XL": 45 }))?;
  insert_product("tacos", "🍖", "Dinde", json!({ "L": 30, "XL": 45 }))?;
  insert_product("tacos", "🍗", "Nuggets", json!({ "L": 35, "XL": 50 }))?;
  insert_product("tacos", "🌮", "Mixte", json!({ "L": 35, "XL": 50 }))?;
  insert_product("tacos", "🧀", "Cordon Bleu", json!({ "L": 35, "XL": 50 }))?;
  insert_product("tacos", "🥩", "Viande Hachée", json!({ "L": 35, "XL": 50 }))?;
  insert_product("tacos", "🦐", "Fruits de Mer", json!({ "L": 40, "XL": 55 }))?;

  // 🥪 PANINI (aligné menuFallback.ts)
  insert_product("panini", "🍗", "Poulet", json!({ "S": 25 }))?;
  insert_product("panini", "🍖", "Dinde", json!({ "S": 25 }))?;
  insert_product("panini", "🐟", "Thon", json!({ "S": 25 }))?;
  insert_product("panini", "🧀", "4 Fromages", json!({ "S": 25 }))?;
  insert_product("panini", "🥪", "Mixte", json!({ "S": 27 }))?;
  insert_product("panini", "🥩", "Viande Hachée", json!({ "S": 27 }))?;
  insert_product("panini", "🦐", "Fruits de Mer", json!({ "S": 30 }))?;

  // 🍔 BURGER
  insert_product("burger", "🍔", "American Burger", json!({ "S": 30 }))?;
  insert_product("burger", "🍔", "Chicken Burger", json!({ "S": 30 }))?;
  insert_product("burger", "🍔", "Chees Burger", json!({ "S": 30 }))?;
  insert_product("burger", "🍔", "Big Burger", json!({ "S": 37 }))?;
  insert_product("burger", "🍔", "Burger Yobo", json!({ "S": 40 }))?;

  // 🍝 PASTICCIO (aligné menuFallback.ts)
  insert_product("pasticcio", "🍗", "Poulet", json!({ "S": 30 }))?;
  insert_product("pasticcio", "🍖", "Dinde", json!({ "S": 30 }))?;
  insert_product("pasticcio", "🍗", "Nuggets", json!({ "S": 35 }))?;
  insert_product("pasticcio", "🍝", "Mixte", json!({ "S": 35 }))?;
  insert_product("pasticcio", "🥩", "Viande Hachée", json!({ "S": 35 }))?;
  insert_product("pasticcio", "🧀", "Cordon Bleu", json!({ "S": 37 }))?;
  insert_product("pasticcio", "🦐", "Fruits de Mer", json!({ "S": 45 }))?;

  // 🔥 SANDWICHS (aligné menuFallback.ts)
  insert_product("sandwichs", "🥖", "Hollandais", json!({ "S": 12 }))?;
  insert_product("sandwichs", "🍓", "Hollandais Avec fruits", json!({ "S": 15 }))?;
  insert_product("sandwichs", "🍗", "Poulet", json!({ "S": 20 }))?;
  insert_product("sandwichs", "🍖", "Dinde", json!({ "S": 20 }))?;
  insert_product("sandwichs", "🥩", "Viande Hachée", json!({ "S": 20 }))?;
  insert_product("sandwichs", "🥪", "Mixte", json!({ "S": 30 }))?;
  insert_product("sandwichs", "🍗", "Nuggets", json!({ "S": 30 }))?;
  insert_product("sandwichs", "🧀", "Cordon Bleu", json!({ "S": 30 }))?;
  insert_product("sandwichs", "🦐", "Fruits de Mer", json!({ "S": 40 }))?;

  // 👶 KIDS — 30 DH
  insert_product("kids", "👶", "Cheeseburger + Frites + Boisson", json!({ "S": 30 }))?;
  insert_product("kids", "👶", "6 Nuggets + Frites + Boisson", json!({ "S": 30 }))?;
  insert_product("kids", "👶", "Sandwich Poulet Kids + Frites + Boisson", json!({ "S": 30 }))?;

  // 🍕 PIZZA (P / M / G — aligné menuFallback.ts)
  insert_product("pizza", "🍕", "Margherita", json!({ "P": 25, "M": 35, "G": 50 }))?;
  insert_product("pizza", "🍕", "Viande Hachée", json!({ "P": 30, "M": 45, "G": 60 }))?;
  insert_product("pizza", "🍕", "Poulet", json!({ "P": 30, "M": 45, "G": 60 }))?;
  insert_product("pizza", "🍕", "Dinde", json!({ "P": 30, "M": 45, "G": 60 }))?;
  insert_product("pizza", "🍕", "Dinde Fumée", json!({ "P": 35, "M": 45, "G": 60 }))?;
  insert_product("pizza", "🍕", "Thon", json!({ "P": 30, "M": 45, "G": 60 }))?;
  insert_product("pizza", "🦐", "Fruits de Mer", json!({ "P": 40, "M": 55, "G": 75 }))?;
  insert_product("pizza", "🥬", "Végétarienne", json!({ "P": 40, "M": 45, "G": 60 }))?;
  insert_product("pizza", "🍕", "4 Saisons", json!({ "P": 30, "M": 55, "G": 75 }))?;
  insert_product("pizza", "🧀", "4 Fromages", json!({ "P": 35, "M": 45, "G": 65 }))?;
  insert_product("pizza", "🍕", "Mixte", json!({ "P": 40, "M": 50, "G": 65 }))?;
  insert_product("pizza", "🌾", "Fermière", json!({ "P": 40, "M": 50, "G": 65 }))?;
  insert_product("pizza", "🥖", "Yobo", json!({ "P": 40, "M": 50, "G": 70 }))?;

  // 🍝 PÂTES
  insert_product("pates", "🍝", "All'arrabbiata", json!({ "S": 37 }))?;
  insert_product("pates", "🥓", "Carbonara", json!({ "S": 45 }))?;
  insert_product("pates", "🐟", "Thon", json!({ "S": 45 }))?;
  insert_product("pates", "🧄", "Alfredo", json!({ "S": 45 }))?;
  insert_product("pates", "🍅", "Bolognaise", json!({ "S": 48 }))?;
  insert_product("pates", "🧀", "4 Fromages", json!({ "S": 48 }))?;
  insert_product("pates", "🦐", "Fruits de Mer", json!({ "S": 50 }))?;
  insert_product("pates", "⭐", "Trio Yobo", json!({ "S": 60 }))?;

  // 🍚 RISOTTO
  insert_product("risotto", "🍚", "Risotto Végétarien", json!({ "S": 42 }))?;
  insert_product("risotto", "🍗", "Risotto Poulet Champignons", json!({ "S": 45 }))?;
  insert_product("risotto", "🦐", "Risotto Fruits de Mer", json!({ "S": 55 }))?;

  // 🥗 ENTRÉES
  insert_product("entrees", "🥗", "Salade César au poulet", json!({ "S": 37 }))?;
  insert_product("entrees", "🥗", "Salade Marocaine", json!({ "S": 22 }))?;
  insert_product("entrees", "🍆", "Mille-feuille d'aubergine", json!({ "S": 30 }))?;
  insert_product("entrees", "🍄", "Gratin poulet aux champignons", json!({ "S": 35 }))?;
  insert_product("entrees", "🦐", "Gratin fruits de mer", json!({ "S": 40 }))?;
  insert_product("entrees", "🦐", "Crevette pil pil", json!({ "S": 47 }))?;
  insert_product("entrees", "🍗", "Plat nuggets 6 pièces + frites", json!({ "S": 30 }))?;

  // 🍽️ PLATS
  insert_product("plats", "🥩", "Brochettes viande hachée grillées", json!({ "S": 50 }))?;
  insert_product("plats", "🍗", "Brochettes poulet à la coriandre", json!({ "S": 48 }))?;
  insert_product("plats", "🍢", "Brochettes mixtes", json!({ "S": 51 }))?;
  insert_product("plats", "🍄", "Émincé poulet aux champignons", json!({ "S": 50 }))?;
  insert_product("plats", "🍗", "Escalope Milanaise", json!({ "S": 49 }))?;
  insert_product("plats", "🍳", "Tajine viande hachée - œufs", json!({ "S": 37 }))?;

  // 🧇 CRÊPES
  insert_product("crepes", "🧂", "Sucre", json!({ "S": 15 }))?;
  insert_product("crepes", "🍫", "Nutella", json!({ "S": 20 }))?;
  insert_product("crepes", "🧈", "Lotus", json!({ "S": 23 }))?;
  insert_product("crepes", "🍪", "Oreo", json!({ "S": 22 }))?;
  insert_product("crepes", "🍌", "Banane", json!({ "S": 22 }))?;
  insert_product("crepes", "🍫", "Kit Kat", json!({ "S": 22 }))?;
  insert_product("crepes", "🥞", "Mixte", json!({ "S": 25 }))?;
  insert_product("crepes", "🌰", "Kunafa Pistache", json!({ "S": 30 }))?;
  insert_product("crepes", "🥞", "Yobo", json!({ "S": 35 }))?;

  // 🧃 BOISSONS
  insert_product("boissons", "💧", "Eau", json!({ "S": 2, "L": 3 }))?;
  insert_product("boissons", "🥤", "Coca Cola", json!({ "S": 5 }))?;
  insert_product("boissons", "🥤", "Pepsi", json!({ "S": 5 }))?;
  insert_product("boissons", "🥤", "Sprite", json!({ "S": 5 }))?;
  insert_product("boissons", "🥤", "Fanta", json!({ "S": 5 }))?;
  insert_product("boissons", "🥤", "Mirinda", json!({ "S": 7 }))?;
  insert_product("boissons", "🥤", "Oasis", json!({ "S": 10 }))?;
  insert_product("boissons", "🥤", "Rostoy", json!({ "S": 10 }))?;
  insert_product("boissons", "🥤", "Simon", json!({ "S": 10 }))?;
  insert_product("boissons", "⚡", "Red Bull", json!({ "S": 20 }))?;
  insert_product("boissons", "🥤", "LINX", json!({ "S": 10 }))?;
  insert_product("boissons", "🥤", "B52", json!({ "S": 10 }))?;

  // 🥤 JUS & MOJITO
  insert_product("jus_mojito", "🍊", "Jus d'orange", json!({ "S": 12 }))?;
  insert_product("jus_mojito", "🥑", "Jus avocat", json!({ "S": 18 }))?;
  insert_product("jus_mojito", "🍌", "Jus banane", json!({ "S": 12 }))?;
  insert_product("jus_mojito", "🍋", "Jus citron", json!({ "S": 12 }))?;
  insert_product("jus_mojito", "🧃", "Jus mix", json!({ "S": 16 }))?;
  insert_product("jus_mojito", "🌿", "Mojito classique", json!({ "S": 17 }))?;
  insert_product("jus_mojito", "⚡", "Mojito Red Bull", json!({ "S": 28 }))?;

  // ➕ Supplément
  insert_product("supplements", "🍟", "Frites", json!({ "S": 5 }))?;

    conn
      .execute(
        "INSERT INTO app_meta (key, value) VALUES ('menu_seed_version', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![MENU_SEED_VERSION],
      )
      .map_err(|e| e.to_string())?;

    Ok(())
  })();

  match seed_result {
    Ok(()) => {
      conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
      Ok(())
    }
    Err(e) => {
      let _ = conn.execute_batch("ROLLBACK");
      Err(e)
    }
  }
}

/// Efface le marqueur de version du menu puis réapplique le menu d’usine (seed), comme après une base neuve.
/// Les catégories et produits personnalisés sont remplacés par le jeu seed défini dans [`ensure_default_categories`].
pub fn reset_catalog_to_seed(conn: &Connection) -> Result<(), String> {
  conn
    .execute("DELETE FROM app_meta WHERE key = 'menu_seed_version'", [])
    .map_err(|e| e.to_string())?;
  conn
    .execute("DELETE FROM app_meta WHERE key = 'menu_seed_locked_empty'", [])
    .map_err(|e| e.to_string())?;
  ensure_default_categories(conn)
}

/// Écrit une ligne dans `logs`. Préférer [`append_log_best_effort`] depuis les commandes
/// pour ne pas ignorer silencieusement une erreur SQLite.
///
/// **Événements métier actuels :**
/// - `auth` : `login_failed`, `login_failed_pin`, `login_ok`, `logout`
/// - `order` : `create`
/// - `cash` : `session_open`, `session_close` (meta : `session_id=…`, commandes : `cash_session_id=…`)
/// - `menu` : CRUD catégories / produits, `set_product_active`
/// - `user` : `create_caissier`, `set_caissier_active`, `reset_caissier_pin`
/// - `profile` : `change_pin`, `change_name`
/// - `settings` : `ticket_shop`
pub fn append_log(
  conn: &Connection,
  user_id: Option<i64>,
  action_type: &str,
  action: &str,
  description: Option<&str>,
  meta: Option<&str>,
) -> Result<(), String> {
  conn
    .execute(
      "INSERT INTO logs (user_id, action_type, action, description, meta) VALUES (?1, ?2, ?3, ?4, ?5)",
      params![user_id, action_type, action, description, meta],
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

/// Comme [`append_log`], mais journalise l’erreur sur stderr si l’insert échoue (audit best-effort).
pub fn append_log_best_effort(
  conn: &Connection,
  user_id: Option<i64>,
  action_type: &str,
  action: &str,
  description: Option<&str>,
  meta: Option<&str>,
) {
  if let Err(e) = append_log(conn, user_id, action_type, action, description, meta) {
    eprintln!(
      "[YOBO] append_log failed ({} / {}): {}",
      action_type, action, e
    );
  }
}

