import { getDb } from "./db";
import { logAuditEvent } from "./auditService";

export interface DbCategory {
  id: string;
  name: string;
  display_order: number;
  is_active: number;
  synced_at: string | null;
}

export interface DbMenuItem {
  id: string;
  category_id: string;
  category_name?: string;
  name: string;
  description: string | null;
  base_price: number;
  tax_rate: number;
  is_available: number;
  is_combo: number;
  image_url: string | null;
  available_from: string | null;
  available_until: string | null;
  synced_at: string | null;
}

export interface DbVariant {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  is_active: number;
}

export interface DbModifier {
  id: string;
  name: string;
  price_adjustment: number;
  is_active: number;
  synced_at: string | null;
}

export interface ComboComponent {
  parent_item_id: string;
  child_item_id: string;
  child_name?: string;
  quantity: number;
}

// ─── INITIAL DEMO DATA SEEDING FOR OFFLINE SQLITE ──────────────────────────

export async function ensureInitialMenuData(): Promise<void> {
  const db = await getDb();
  const countResult = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM menu_categories",
  );

  if (countResult[0]?.count > 0) return;

  console.log("[menuService] Seeding initial menu categories & items into local SQLite...");

  // Categories
  const catBurgers = "00000000-0000-0000-0001-000000000001";
  const catDrinks = "00000000-0000-0000-0001-000000000002";
  const catSides = "00000000-0000-0000-0001-000000000003";
  const catDesserts = "00000000-0000-0000-0001-000000000004";

  await db.execute(
    `INSERT INTO menu_categories (id, name, display_order, is_active) VALUES
     (?, 'Burgers', 1, 1),
     (?, 'Drinks', 2, 1),
     (?, 'Sides', 3, 1),
     (?, 'Desserts', 4, 1)`,
    [catBurgers, catDrinks, catSides, catDesserts],
  );

  // Items
  const itemClassic = "00000000-0000-0000-0002-000000000001";
  const itemCheese = "00000000-0000-0000-0002-000000000002";
  const itemCoke = "00000000-0000-0000-0002-000000000004";
  const itemFries = "00000000-0000-0000-0002-000000000007";
  const comboSuper = "00000000-0000-0000-0002-000000000099";

  await db.execute(
    `INSERT INTO menu_items (id, category_id, name, description, base_price, tax_rate, is_available, is_combo) VALUES
     (?, ?, 'Classic Burger', 'Juicy beef patty with lettuce, tomato, and pickles', 8.99, 0.08, 1, 0),
     (?, ?, 'Cheese Burger', 'Classic burger topped with melted cheddar cheese', 9.99, 0.08, 1, 0),
     (?, ?, 'Coca Cola', 'Ice-cold refreshing cola beverage', 2.99, 0.05, 1, 0),
     (?, ?, 'French Fries', 'Golden crispy fries with sea salt', 3.99, 0.08, 1, 0),
     (?, ?, 'Super Combo Meal', 'Classic Burger + French Fries + Coca Cola Bundle', 12.99, 0.08, 1, 1)`,
    [
      itemClassic,
      catBurgers,
      itemCheese,
      catBurgers,
      itemCoke,
      catDrinks,
      itemFries,
      catSides,
      comboSuper,
      catBurgers,
    ],
  );

  // Drink Variants (T-024)
  await db.execute(
    `INSERT INTO item_variants (id, menu_item_id, name, price, is_active) VALUES
     (?, ?, 'Small (12oz)', 1.99, 1),
     (?, ?, 'Medium (16oz)', 2.99, 1),
     (?, ?, 'Large (24oz)', 3.99, 1)`,
    [
      crypto.randomUUID(),
      itemCoke,
      crypto.randomUUID(),
      itemCoke,
      crypto.randomUUID(),
      itemCoke,
    ],
  );

  // Modifiers (T-025)
  const modCheese = "00000000-0000-0000-0004-000000000001";
  const modOnions = "00000000-0000-0000-0004-000000000002";
  const modSauce = "00000000-0000-0000-0004-000000000003";

  await db.execute(
    `INSERT INTO modifiers (id, name, price_adjustment, is_active) VALUES
     (?, 'Extra Cheese', 1.50, 1),
     (?, 'No Onions', 0.00, 1),
     (?, 'Extra Sauce', 0.50, 1)`,
    [modCheese, modOnions, modSauce],
  );

  // Attach Modifiers to Classic Burger
  await db.execute(
    `INSERT INTO menu_item_modifiers (menu_item_id, modifier_id) VALUES
     (?, ?), (?, ?)`,
    [itemClassic, modCheese, itemClassic, modSauce],
  );

  // Combo Components (T-026)
  await db.execute(
    `INSERT INTO combo_items (parent_item_id, child_item_id, quantity) VALUES
     (?, ?, 1), (?, ?, 1), (?, ?, 1)`,
    [comboSuper, itemClassic, comboSuper, itemFries, comboSuper, itemCoke],
  );

  console.log("[menuService] Menu data successfully seeded!");
}

// ─── T-022: CATEGORY MANAGEMENT ───────────────────────────────────────────

export async function getCategories(): Promise<DbCategory[]> {
  await ensureInitialMenuData();
  const db = await getDb();
  return db.select<DbCategory[]>(
    "SELECT id, name, display_order, is_active, synced_at FROM menu_categories ORDER BY display_order ASC, name ASC",
  );
}

export async function createCategory(name: string, performedByUserId: string): Promise<DbCategory> {
  const db = await getDb();
  const id = crypto.randomUUID();

  // Get max display order
  const maxRes = await db.select<{ maxOrder: number }[]>(
    "SELECT COALESCE(MAX(display_order), 0) as maxOrder FROM menu_categories",
  );
  const nextOrder = (maxRes[0]?.maxOrder || 0) + 1;

  await db.execute(
    "INSERT INTO menu_categories (id, name, display_order, is_active) VALUES (?, ?, ?, 1)",
    [id, name.trim(), nextOrder],
  );

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "CATEGORY_CREATE",
    entityAffected: `Category:${name}`,
    reason: "New menu category created",
  });

  return { id, name: name.trim(), display_order: nextOrder, is_active: 1, synced_at: null };
}

export async function updateCategory(
  id: string,
  name: string,
  isActive: number,
  performedByUserId: string,
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE menu_categories SET name = ?, is_active = ? WHERE id = ?", [
    name.trim(),
    isActive,
    id,
  ]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "CATEGORY_UPDATE",
    entityAffected: `Category:${name}`,
    reason: "Menu category updated",
  });
}

export async function deleteCategory(id: string, performedByUserId: string): Promise<void> {
  const db = await getDb();

  // Check if items exist under this category
  const itemCheck = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?",
    [id],
  );

  if (itemCheck[0]?.count > 0) {
    throw new Error("Cannot delete category containing active menu items. Reassign items first.");
  }

  await db.execute("DELETE FROM menu_categories WHERE id = ?", [id]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "CATEGORY_DELETE",
    entityAffected: `Category:${id}`,
    reason: "Menu category deleted",
  });
}

export async function reorderCategory(
  id: string,
  direction: "up" | "down",
  performedByUserId: string,
): Promise<void> {
  const db = await getDb();

  const categories = await getCategories();

  const index = categories.findIndex((c) => c.id === id);

  if (index === -1) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= categories.length) return;

  const current = categories[index];
  const neighbor = categories[targetIndex];

  await db.execute(
    "UPDATE menu_categories SET display_order = ? WHERE id = ?",
    [neighbor.display_order, current.id],
  );

  await db.execute(
    "UPDATE menu_categories SET display_order = ? WHERE id = ?",
    [current.display_order, neighbor.id],
  );

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "CATEGORY_REORDER",
    entityAffected: `Category:${current.name}`,
    reason: `Category moved ${direction}`,
  });
}

// ─── T-023: MENU ITEM MANAGEMENT ───────────────────────────────────────────

export async function getMenuItems(categoryId?: string): Promise<DbMenuItem[]> {
  await ensureInitialMenuData();
  const db = await getDb();

  let query = `
    SELECT i.id, i.category_id, c.name as category_name, i.name, i.description,
           i.base_price, i.tax_rate, i.is_available, i.is_combo, i.image_url,
           i.available_from, i.available_until, i.synced_at
    FROM menu_items i
    LEFT JOIN menu_categories c ON i.category_id = c.id
  `;

  const params: unknown[] = [];

  if (categoryId && categoryId !== "ALL") {
    query += " WHERE i.category_id = ?";
    params.push(categoryId);
  }

  query += " ORDER BY c.display_order ASC, i.name ASC";

  return db.select<DbMenuItem[]>(query, params);
}

export async function createMenuItem(
  input: {
    category_id: string;
    name: string;
    description?: string;
    base_price: number;
    tax_rate: number;
    is_available: number;
    is_combo?: number;
    image_url?: string;
    available_from?: string | null;
    available_until?: string | null;
  },
  performedByUserId: string,
): Promise<DbMenuItem> {
  const db = await getDb();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO menu_items (id, category_id, name, description, base_price, tax_rate, is_available, is_combo, image_url, available_from, available_until)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.category_id,
      input.name.trim(),
      input.description || null,
      input.base_price,
      input.tax_rate,
      input.is_available,
      input.is_combo || 0,
      input.image_url || null,
      input.available_from || null,
      input.available_until || null,
    ],
  );

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "ITEM_CREATE",
    entityAffected: `MenuItem:${input.name}`,
    reason: "New menu item added",
  });

  return {
    id,
    category_id: input.category_id,
    name: input.name.trim(),
    description: input.description || null,
    base_price: input.base_price,
    tax_rate: input.tax_rate,
    is_available: input.is_available,
    is_combo: input.is_combo || 0,
    image_url: input.image_url || null,
    available_from: input.available_from || null,
    available_until: input.available_until || null,
    synced_at: null,
  };
}

export async function updateMenuItem(
  id: string,
  input: {
    category_id: string;
    name: string;
    description?: string;
    base_price: number;
    tax_rate: number;
    is_available: number;
    is_combo?: number;
    image_url?: string;
    available_from?: string | null;
    available_until?: string | null;
  },
  performedByUserId: string,
): Promise<void> {
  const db = await getDb();

  await db.execute(
    `UPDATE menu_items
     SET category_id = ?, name = ?, description = ?, base_price = ?, tax_rate = ?, is_available = ?, is_combo = ?, image_url = ?, available_from = ?, available_until = ?
     WHERE id = ?`,
    [
      input.category_id,
      input.name.trim(),
      input.description || null,
      input.base_price,
      input.tax_rate,
      input.is_available,
      input.is_combo || 0,
      input.image_url || null,
      input.available_from || null,
      input.available_until || null,
      id,
    ],
  );

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "ITEM_UPDATE",
    entityAffected: `MenuItem:${input.name}`,
    reason: "Menu item details updated",
  });
}

/**
 * Checks whether an item's time-based availability window allows ordering at the current time.
 */
export function isItemInTimeWindow(item: DbMenuItem, timeStr?: string): boolean {
  if (!item.available_from || !item.available_until) {
    return true; // No restriction
  }

  const now = timeStr || new Date().toTimeString().slice(0, 5); // "HH:MM"
  const from = item.available_from;
  const until = item.available_until;

  if (from <= until) {
    return now >= from && now <= until;
  } else {
    // Overnight window (e.g. 22:00 to 04:00)
    return now >= from || now <= until;
  }
}

export async function toggleItemAvailability(
  id: string,
  isAvailable: boolean,
  performedByUserId: string,
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE menu_items SET is_available = ? WHERE id = ?", [
    isAvailable ? 1 : 0,
    id,
  ]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "ITEM_TOGGLE_AVAILABILITY",
    entityAffected: `MenuItem:${id}`,
    reason: `Item availability set to ${isAvailable ? "available" : "sold out"}`,
  });
}

export async function deleteMenuItem(id: string, performedByUserId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM item_variants WHERE menu_item_id = ?", [id]);
  await db.execute("DELETE FROM menu_item_modifiers WHERE menu_item_id = ?", [id]);
  await db.execute("DELETE FROM combo_items WHERE parent_item_id = ? OR child_item_id = ?", [
    id,
    id,
  ]);
  await db.execute("DELETE FROM menu_items WHERE id = ?", [id]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "ITEM_DELETE",
    entityAffected: `MenuItem:${id}`,
    reason: "Menu item deleted",
  });
}

// ─── T-024: VARIANT SUPPORT (SIZE/TYPE PRICING) ───────────────────────────

export async function getItemVariants(menuItemId: string): Promise<DbVariant[]> {
  const db = await getDb();
  return db.select<DbVariant[]>(
    "SELECT id, menu_item_id, name, price, is_active FROM item_variants WHERE menu_item_id = ? ORDER BY price ASC",
    [menuItemId],
  );
}

export async function saveVariantsForMenuItem(
  menuItemId: string,
  variants: { name: string; price: number }[],
): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM item_variants WHERE menu_item_id = ?", [menuItemId]);

  for (const v of variants) {
    if (v.name.trim()) {
      await db.execute(
        "INSERT INTO item_variants (id, menu_item_id, name, price, is_active) VALUES (?, ?, ?, ?, 1)",
        [crypto.randomUUID(), menuItemId, v.name.trim(), v.price],
      );
    }
  }
}

// ─── T-025: MODIFIER / ADD-ON SUPPORT ──────────────────────────────────────

export async function getAllModifiers(): Promise<DbModifier[]> {
  await ensureInitialMenuData();
  const db = await getDb();
  return db.select<DbModifier[]>(
    "SELECT id, name, price_adjustment, is_active, synced_at FROM modifiers ORDER BY name ASC",
  );
}

export async function createModifier(
  name: string,
  priceAdjustment: number,
  performedByUserId?: string,
): Promise<DbModifier> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    "INSERT INTO modifiers (id, name, price_adjustment, is_active) VALUES (?, ?, ?, 1)",
    [id, name.trim(), priceAdjustment],
  );

  if (performedByUserId) {
    await logAuditEvent({
      userId: performedByUserId,
      actionType: "MODIFIER_CREATE",
      entityAffected: `Modifier:${name}`,
      reason: "New item modifier created",
    });
  }

  return {
    id,
    name: name.trim(),
    price_adjustment: priceAdjustment,
    is_active: 1,
    synced_at: null,
  };
}

export async function updateModifier(
  id: string,
  name: string,
  priceAdjustment: number,
  isActive: number,
  performedByUserId?: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE modifiers SET name = ?, price_adjustment = ?, is_active = ? WHERE id = ?",
    [name.trim(), priceAdjustment, isActive, id],
  );

  if (performedByUserId) {
    await logAuditEvent({
      userId: performedByUserId,
      actionType: "MODIFIER_UPDATE",
      entityAffected: `Modifier:${name}`,
      reason: "Item modifier details updated",
    });
  }
}

export async function deleteModifier(id: string, performedByUserId?: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM menu_item_modifiers WHERE modifier_id = ?", [id]);
  await db.execute("DELETE FROM modifiers WHERE id = ?", [id]);

  if (performedByUserId) {
    await logAuditEvent({
      userId: performedByUserId,
      actionType: "MODIFIER_DELETE",
      entityAffected: `Modifier:${id}`,
      reason: "Item modifier deleted",
    });
  }
}

export async function getItemModifierIds(menuItemId: string): Promise<string[]> {
  const db = await getDb();
  const res = await db.select<{ modifier_id: string }[]>(
    "SELECT modifier_id FROM menu_item_modifiers WHERE menu_item_id = ?",
    [menuItemId],
  );
  return res.map((r) => r.modifier_id);
}

export async function getItemModifiersDetails(menuItemId: string): Promise<DbModifier[]> {
  const db = await getDb();
  return db.select<DbModifier[]>(
    `SELECT m.id, m.name, m.price_adjustment, m.is_active, m.synced_at
     FROM modifiers m
     JOIN menu_item_modifiers mim ON m.id = mim.modifier_id
     WHERE mim.menu_item_id = ? AND m.is_active = 1
     ORDER BY m.name ASC`,
    [menuItemId],
  );
}

export async function saveModifiersForMenuItem(
  menuItemId: string,
  modifierIds: string[],
  performedByUserId?: string,
): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM menu_item_modifiers WHERE menu_item_id = ?", [menuItemId]);

  for (const modId of modifierIds) {
    await db.execute("INSERT INTO menu_item_modifiers (menu_item_id, modifier_id) VALUES (?, ?)", [
      menuItemId,
      modId,
    ]);
  }

  if (performedByUserId) {
    await logAuditEvent({
      userId: performedByUserId,
      actionType: "ITEM_MODIFIERS_SAVE",
      entityAffected: `MenuItem:${menuItemId}`,
      reason: `Updated item modifier links (${modifierIds.length} attached)`,
    });
  }
}

// ─── T-026: COMBO / BUNDLE ITEM BUILDER ────────────────────────────────────

export async function getComboComponents(parentItemId: string): Promise<ComboComponent[]> {
  const db = await getDb();
  return db.select<ComboComponent[]>(
    `SELECT c.parent_item_id, c.child_item_id, m.name as child_name, c.quantity
     FROM combo_items c
     JOIN menu_items m ON c.child_item_id = m.id
     WHERE c.parent_item_id = ?`,
    [parentItemId],
  );
}

export async function saveComboComponents(
  parentItemId: string,
  components: { child_item_id: string; quantity: number }[],
  performedByUserId?: string,
): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM combo_items WHERE parent_item_id = ?", [parentItemId]);

  for (const comp of components) {
    if (comp.child_item_id && comp.quantity > 0) {
      await db.execute(
        "INSERT INTO combo_items (parent_item_id, child_item_id, quantity) VALUES (?, ?, ?)",
        [parentItemId, comp.child_item_id, comp.quantity],
      );
    }
  }

  // Ensure parent item has is_combo = 1
  const isComboFlag = components.length > 0 ? 1 : 0;
  await db.execute("UPDATE menu_items SET is_combo = ? WHERE id = ?", [isComboFlag, parentItemId]);

  if (performedByUserId) {
    await logAuditEvent({
      userId: performedByUserId,
      actionType: "COMBO_SAVE",
      entityAffected: `Combo:${parentItemId}`,
      reason: `Saved combo composition (${components.length} components)`,
    });
  }
}
