import { getDb } from "./db";
import { logAuditEvent } from "./auditService";

export interface DbInventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_threshold: number;
  cost_per_unit: number;
  last_updated: string;
  synced_at?: string | null;
}

export async function getInventoryItems(): Promise<DbInventoryItem[]> {
  const db = await getDb();
  return db.select<DbInventoryItem[]>(
    "SELECT * FROM inventory_items ORDER BY name ASC"
  );
}

export async function getLowStockItems(): Promise<DbInventoryItem[]> {
  const db = await getDb();
  return db.select<DbInventoryItem[]>(
    "SELECT * FROM inventory_items WHERE current_stock <= min_threshold ORDER BY current_stock ASC"
  );
}

export async function createInventoryItem(
  item: Omit<DbInventoryItem, "id" | "last_updated" | "synced_at">,
  userId: string
): Promise<DbInventoryItem> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO inventory_items (id, name, category, unit, current_stock, min_threshold, cost_per_unit, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      item.name.trim(),
      item.category.trim() || "General",
      item.unit.trim() || "pcs",
      Number(item.current_stock) || 0,
      Number(item.min_threshold) || 0,
      Number(item.cost_per_unit) || 0,
      now,
    ]
  );

  await logAuditEvent({
    userId,
    actionType: "INVENTORY_ADD",
    entityAffected: "inventory_items",
    metadata: { id, name: item.name, stock: item.current_stock },
  });

  return {
    id,
    name: item.name.trim(),
    category: item.category.trim() || "General",
    unit: item.unit.trim() || "pcs",
    current_stock: Number(item.current_stock) || 0,
    min_threshold: Number(item.min_threshold) || 0,
    cost_per_unit: Number(item.cost_per_unit) || 0,
    last_updated: now,
  };
}

export async function updateInventoryItem(
  id: string,
  updates: Partial<Omit<DbInventoryItem, "id" | "last_updated" | "synced_at">>,
  userId: string
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = await db.select<DbInventoryItem[]>(
    "SELECT * FROM inventory_items WHERE id = ?",
    [id]
  );
  if (!existing || existing.length === 0) {
    throw new Error(`Inventory item ${id} not found.`);
  }

  const current = existing[0];
  const name = updates.name !== undefined ? updates.name.trim() : current.name;
  const category = updates.category !== undefined ? updates.category.trim() : current.category;
  const unit = updates.unit !== undefined ? updates.unit.trim() : current.unit;
  const current_stock = updates.current_stock !== undefined ? Number(updates.current_stock) : current.current_stock;
  const min_threshold = updates.min_threshold !== undefined ? Number(updates.min_threshold) : current.min_threshold;
  const cost_per_unit = updates.cost_per_unit !== undefined ? Number(updates.cost_per_unit) : current.cost_per_unit;

  await db.execute(
    `UPDATE inventory_items 
     SET name = ?, category = ?, unit = ?, current_stock = ?, min_threshold = ?, cost_per_unit = ?, last_updated = ?
     WHERE id = ?`,
    [name, category, unit, current_stock, min_threshold, cost_per_unit, now, id]
  );

  await logAuditEvent({
    userId,
    actionType: "INVENTORY_UPDATE",
    entityAffected: "inventory_items",
    metadata: { id, name, current_stock },
  });
}

export async function adjustStock(
  id: string,
  deltaAmount: number,
  userId: string,
  reason?: string
): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = await db.select<DbInventoryItem[]>(
    "SELECT * FROM inventory_items WHERE id = ?",
    [id]
  );
  if (!existing || existing.length === 0) {
    throw new Error(`Inventory item ${id} not found.`);
  }

  const current = existing[0];
  const newStock = Math.max(0, current.current_stock + deltaAmount);

  await db.execute(
    "UPDATE inventory_items SET current_stock = ?, last_updated = ? WHERE id = ?",
    [newStock, now, id]
  );

  await logAuditEvent({
    userId,
    actionType: "INVENTORY_ADJUST",
    entityAffected: "inventory_items",
    reason,
    metadata: { id, name: current.name, oldStock: current.current_stock, newStock, deltaAmount },
  });

  return newStock;
}

export async function deleteInventoryItem(id: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM inventory_items WHERE id = ?", [id]);
  await logAuditEvent({
    userId,
    actionType: "INVENTORY_DELETE",
    entityAffected: "inventory_items",
    metadata: { id },
  });
}
