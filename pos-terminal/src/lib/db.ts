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
  // INGREDIENTS / INVENTORY ITEMS
  // ============================================================

  await database.execute(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      category          TEXT NOT NULL DEFAULT 'General',
      unit              TEXT NOT NULL DEFAULT 'pcs',
      current_stock     REAL NOT NULL DEFAULT 0,
      min_threshold     REAL NOT NULL DEFAULT 5,
      cost_per_unit     REAL NOT NULL DEFAULT 0,
      last_updated      TEXT NOT NULL,
      synced_at         TEXT
    )
  `);

  // Legacy ingredients table backward compatibility
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
      id                 TEXT PRIMARY KEY,
      number             TEXT NOT NULL UNIQUE,
      section            TEXT,
      capacity           INTEGER NOT NULL,
      status             TEXT NOT NULL DEFAULT 'FREE',
      pos_x              INTEGER NOT NULL DEFAULT 0,
      pos_y              INTEGER NOT NULL DEFAULT 0,
      shape              TEXT NOT NULL DEFAULT 'RECTANGLE',
      assigned_waiter_id TEXT,
      synced_at          TEXT
    )
  `);

  try {
    await database.execute(`ALTER TABLE tables ADD COLUMN pos_x INTEGER NOT NULL DEFAULT 0`);
  } catch {}
  try {
    await database.execute(`ALTER TABLE tables ADD COLUMN pos_y INTEGER NOT NULL DEFAULT 0`);
  } catch {}
  try {
    await database.execute(`ALTER TABLE tables ADD COLUMN shape TEXT NOT NULL DEFAULT 'RECTANGLE'`);
  } catch {}
  try {
    await database.execute(`ALTER TABLE tables ADD COLUMN assigned_waiter_id TEXT`);
  } catch {}

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

  // ============================================================
  // INDEXES FOR ORDERS (T-029 / T-033 performance)
  // ============================================================

  await database.execute(`
    CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status)
  `);
  await database.execute(`
    CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id)
  `);
  await database.execute(`
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)
  `);

  // ============================================================
  // SEED: DEMO TABLES (T-029 floor plan)
  // Idempotent — only inserts if tables table is empty.
  // ============================================================

  const tableCount = await database.select<{ c: number }[]> (
    "SELECT COUNT(*) as c FROM tables"
  );

  if (tableCount[0].c === 0) {
    const sections = [
      { number: "T1",  section: "Main Hall",  capacity: 2 },
      { number: "T2",  section: "Main Hall",  capacity: 4 },
      { number: "T3",  section: "Main Hall",  capacity: 4 },
      { number: "T4",  section: "Main Hall",  capacity: 6 },
      { number: "T5",  section: "Main Hall",  capacity: 6 },
      { number: "T6",  section: "Terrace",    capacity: 2 },
      { number: "T7",  section: "Terrace",    capacity: 4 },
      { number: "T8",  section: "Terrace",    capacity: 4 },
      { number: "T9",  section: "Private",    capacity: 8 },
      { number: "T10", section: "Private",    capacity: 10 },
    ];

    for (const t of sections) {
      const tid = crypto.randomUUID();
      await database.execute(
        "INSERT INTO tables (id, number, section, capacity, status) VALUES (?, ?, ?, ?, 'FREE')",
        [tid, t.number, t.section, t.capacity]
      );
    }
    console.log("[db] Seeded 10 demo tables.");
  }

  // ============================================================
  // SEED: DEMO INVENTORY ITEMS
  // Idempotent — only inserts if inventory_items table is empty.
  // ============================================================

  const invCount = await database.select<{ c: number }[]>(
    "SELECT COUNT(*) as c FROM inventory_items"
  );

  if (invCount[0].c === 0) {
    const demoStock = [
      { name: "Burger Buns (Pack)", category: "Bakery", unit: "pack", current_stock: 45, min_threshold: 10, cost_per_unit: 2.5 },
      { name: "Beef Patties (150g)", category: "Meat", unit: "pcs", current_stock: 30, min_threshold: 15, cost_per_unit: 3.2 },
      { name: "Chicken Breast Fillet", category: "Meat", unit: "kg", current_stock: 18, min_threshold: 5, cost_per_unit: 7.0 },
      { name: "Cheddar Cheese Slices", category: "Dairy", unit: "pack", current_stock: 8, min_threshold: 10, cost_per_unit: 4.5 },
      { name: "French Fries (Frozen)", category: "Sides", unit: "kg", current_stock: 25, min_threshold: 8, cost_per_unit: 3.0 },
      { name: "Espresso Coffee Beans", category: "Beverage", unit: "kg", current_stock: 4, min_threshold: 5, cost_per_unit: 14.0 },
      { name: "Full Cream Milk", category: "Dairy", unit: "liters", current_stock: 20, min_threshold: 6, cost_per_unit: 1.8 },
      { name: "Coca Cola Cans (330ml)", category: "Beverage", unit: "cans", current_stock: 60, min_threshold: 24, cost_per_unit: 0.8 },
    ];

    const now = new Date().toISOString();
    for (const item of demoStock) {
      const id = crypto.randomUUID();
      await database.execute(
        `INSERT INTO inventory_items (id, name, category, unit, current_stock, min_threshold, cost_per_unit, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, item.name, item.category, item.unit, item.current_stock, item.min_threshold, item.cost_per_unit, now]
      );
    }
    console.log("[db] Seeded initial inventory items.");
  }

  console.log("[db] SQLite migrations completed successfully");
}
