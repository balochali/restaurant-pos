import Database from "@tauri-apps/plugin-sql";

const DB_PATH = "sqlite:pos.db";

let db: Database | null = null;

/**
 * Returns the singleton database connection, initializing it if needed.
 */
export async function getDb(): Promise<Database> {
  if (db) return db;

  db = await Database.load(DB_PATH);
  await runMigrations(db);

  return db;
}

/**
 * Create local SQLite tables for offline-first operation.
 * These mirror the core entities from the SRS data model.
 */
async function runMigrations(database: Database): Promise<void> {
  // ============================================================
  // ROLES
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS roles (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      synced_at   TEXT
    )
  `);

  // ============================================================
  // USERS
  // Cached locally for offline PIN authentication.
  // PINs must be stored as secure one-way hashes.
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      username    TEXT NOT NULL UNIQUE,
      pin_hash    TEXT NOT NULL,
      role        TEXT NOT NULL,
      is_active   INTEGER NOT NULL DEFAULT 1,
      synced_at   TEXT
    )
  `);

  // ============================================================
  // MENU CATEGORIES
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      display_order   INTEGER NOT NULL DEFAULT 0,
      is_active       INTEGER NOT NULL DEFAULT 1,
      available_from  TEXT,
      available_until TEXT,
      synced_at       TEXT
    )
  `);

  try {
    await database.execute(`ALTER TABLE menu_categories ADD COLUMN available_from TEXT`);
  } catch {}
  try {
    await database.execute(`ALTER TABLE menu_categories ADD COLUMN available_until TEXT`);
  } catch {}

  // ============================================================
  // MENU ITEMS
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id               TEXT PRIMARY KEY,
      category_id      TEXT NOT NULL,
      name             TEXT NOT NULL,
      description      TEXT,
      base_price       REAL NOT NULL,
      tax_rate         REAL NOT NULL DEFAULT 0,
      is_available     INTEGER NOT NULL DEFAULT 1,
      is_combo         INTEGER NOT NULL DEFAULT 0,
      image_url        TEXT,
      available_from   TEXT,
      available_until  TEXT,
      synced_at        TEXT,
      FOREIGN KEY (category_id) REFERENCES menu_categories(id)
    )
  `);

  // Migration helper: add is_combo column if existing table lacks it
  try {
    await database.execute(`ALTER TABLE menu_items ADD COLUMN is_combo INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists
  }

  // ============================================================
  // ITEM VARIANTS
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS item_variants (
      id           TEXT PRIMARY KEY,
      menu_item_id TEXT NOT NULL,
      name         TEXT NOT NULL,
      price        REAL NOT NULL,
      is_active    INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    )
  `);

  // ============================================================
  // MODIFIERS
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS modifiers (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      price_adjustment REAL NOT NULL DEFAULT 0,
      is_active        INTEGER NOT NULL DEFAULT 1,
      synced_at        TEXT
    )
  `);

  // ============================================================
  // MENU ITEM ↔ MODIFIER RELATIONSHIP
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS menu_item_modifiers (
      menu_item_id TEXT NOT NULL,
      modifier_id  TEXT NOT NULL,
      PRIMARY KEY (menu_item_id, modifier_id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
      FOREIGN KEY (modifier_id) REFERENCES modifiers(id)
    )
  `);

  // ============================================================
  // COMBO ITEMS RELATIONSHIP (T-026)
  // Maps a parent combo menu item to child component menu items
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS combo_items (
      parent_item_id TEXT NOT NULL,
      child_item_id  TEXT NOT NULL,
      quantity       INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (parent_item_id, child_item_id),
      FOREIGN KEY (parent_item_id) REFERENCES menu_items(id),
      FOREIGN KEY (child_item_id) REFERENCES menu_items(id)
    )
  `);

  // ============================================================
  // INGREDIENTS / INVENTORY
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      unit              TEXT NOT NULL,
      current_stock     REAL NOT NULL DEFAULT 0,
      reorder_threshold REAL NOT NULL DEFAULT 0,
      synced_at         TEXT
    )
  `);

  // ============================================================
  // MENU ITEM ↔ INGREDIENT RECIPE RELATIONSHIP
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS recipe_links (
      menu_item_id  TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      quantity_used REAL NOT NULL,
      PRIMARY KEY (menu_item_id, ingredient_id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    )
  `);

  // ============================================================
  // TABLES / FLOOR PLAN
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS tables (
      id        TEXT PRIMARY KEY,
      number    TEXT NOT NULL UNIQUE,
      section   TEXT,
      capacity  INTEGER NOT NULL,
      status    TEXT NOT NULL DEFAULT 'FREE',
      synced_at TEXT
    )
  `);

  // ============================================================
  // ORDERS
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id                 TEXT PRIMARY KEY,
      order_source       TEXT NOT NULL,
      table_id           TEXT,
      customer_name      TEXT,
      customer_phone     TEXT,
      customer_address   TEXT,
      status             TEXT NOT NULL DEFAULT 'OPEN',
      notes              TEXT,
      subtotal            REAL NOT NULL DEFAULT 0,
      discount            REAL NOT NULL DEFAULT 0,
      tax                REAL NOT NULL DEFAULT 0,
      total              REAL NOT NULL DEFAULT 0,
      created_by_id      TEXT NOT NULL,
      created_locally_at TEXT NOT NULL,
      synced_at          TEXT,
      FOREIGN KEY (table_id) REFERENCES tables(id),
      FOREIGN KEY (created_by_id) REFERENCES users(id)
    )
  `);

  // ============================================================
  // ORDER ITEMS
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id           TEXT PRIMARY KEY,
      order_id     TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      variant_id   TEXT,
      modifiers    TEXT,
      quantity     INTEGER NOT NULL DEFAULT 1,
      unit_price   REAL NOT NULL,
      notes        TEXT,
      status       TEXT NOT NULL DEFAULT 'PENDING',
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    )
  `);

  // ============================================================
  // PAYMENTS
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id         TEXT PRIMARY KEY,
      order_id   TEXT NOT NULL,
      method     TEXT NOT NULL,
      amount     REAL NOT NULL,
      tip        REAL NOT NULL DEFAULT 0,
      change_due REAL NOT NULL DEFAULT 0,
      status     TEXT NOT NULL DEFAULT 'COMPLETED',
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  // ============================================================
  // AUDIT LOG
  // Records important user actions.
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      action_type     TEXT NOT NULL,
      entity_affected TEXT NOT NULL,
      reason          TEXT,
      metadata        TEXT,
      timestamp       TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Audit log indexes
  await database.execute(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
    ON audit_log(user_id)
  `);

  await database.execute(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
    ON audit_log(timestamp)
  `);

  // ============================================================
  // SYNC QUEUE
  // Records locally created/modified data waiting for sync.
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id          TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      operation   TEXT NOT NULL,
      payload     TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT
    )
  `);

  console.log("[db] SQLite migrations completed successfully");
}
