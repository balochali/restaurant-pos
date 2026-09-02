import { getDb } from "./db";
import { logAuditEvent } from "./auditService";
import { DbUser } from "./authService";

export type TableStatus = "FREE" | "OCCUPIED" | "RESERVED" | "NEEDS_CLEANING";
export type TableShape = "RECTANGLE" | "ROUND";

export interface DbFloorTable {
  id: string;
  number: string;
  section: string | null;
  capacity: number;
  status: TableStatus;
  pos_x: number;
  pos_y: number;
  shape: TableShape;
  assigned_waiter_id: string | null;
  assigned_waiter_name?: string | null;
  // Dynamic order information when OCCUPIED
  active_order_id?: string | null;
  active_order_total?: number | null;
  active_order_items_count?: number | null;
  active_order_created_at?: string | null;
  customer_name?: string | null;
}

// ─── T-037 & T-038: Table Management & Live Floor Plan ────────────────────────

export async function getAllFloorTables(): Promise<DbFloorTable[]> {
  const db = await getDb();
  return db.select<DbFloorTable[]>(
    `SELECT
      t.*,
      u.name as assigned_waiter_name,
      o.id as active_order_id,
      o.total as active_order_total,
      o.created_locally_at as active_order_created_at,
      o.customer_name as customer_name,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status != 'VOIDED') as active_order_items_count
     FROM tables t
     LEFT JOIN users u ON u.id = t.assigned_waiter_id
     LEFT JOIN orders o ON o.table_id = t.id AND o.status NOT IN ('CLOSED', 'VOIDED')
     ORDER BY t.section ASC, t.number ASC`
  );
}

export async function createFloorTable(
  number: string,
  capacity: number,
  section: string,
  shape: TableShape = "RECTANGLE",
  posX = 50,
  posY = 50,
  performedByUserId: string
): Promise<DbFloorTable> {
  const db = await getDb();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO tables (id, number, section, capacity, status, pos_x, pos_y, shape)
     VALUES (?, ?, ?, ?, 'FREE', ?, ?, ?)`,
    [id, number.trim(), section.trim() || null, capacity, posX, posY, shape]
  );

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "TABLE_CREATE",
    entityAffected: `Table:${number}`,
    reason: `Created table ${number} in ${section} (${capacity} seats)`,
  });

  return {
    id,
    number: number.trim(),
    section: section.trim() || null,
    capacity,
    status: "FREE",
    pos_x: posX,
    pos_y: posY,
    shape,
    assigned_waiter_id: null,
  };
}

export async function updateFloorTable(
  id: string,
  number: string,
  capacity: number,
  section: string,
  shape: TableShape,
  performedByUserId: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tables
     SET number = ?, capacity = ?, section = ?, shape = ?
     WHERE id = ?`,
    [number.trim(), capacity, section.trim() || null, shape, id]
  );

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "TABLE_UPDATE",
    entityAffected: `Table:${number}`,
    reason: `Updated table details for ${number}`,
  });
}

export async function updateTablePosition(
  id: string,
  posX: number,
  posY: number
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tables SET pos_x = ?, pos_y = ? WHERE id = ?", [
    Math.round(posX),
    Math.round(posY),
    id,
  ]);
}

export async function deleteFloorTable(
  id: string,
  performedByUserId: string
): Promise<void> {
  const db = await getDb();

  // Check if table has active order
  const activeOrders = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status NOT IN ('CLOSED', 'VOIDED')",
    [id]
  );

  if ((activeOrders[0]?.count ?? 0) > 0) {
    throw new Error("Cannot delete a table with an active open order. Please close or void the order first.");
  }

  await db.execute("DELETE FROM tables WHERE id = ?", [id]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "TABLE_DELETE",
    entityAffected: `Table:${id}`,
    reason: "Table removed from floor plan",
  });
}

// ─── T-039: Waiter & Section Assignment ─────────────────────────────────────

export async function getWaitersList(): Promise<DbUser[]> {
  const db = await getDb();
  return db.select<DbUser[]>(
    "SELECT * FROM users WHERE is_active = 1 AND role IN ('WAITER', 'CASHIER', 'MANAGER', 'ADMIN') ORDER BY name ASC"
  );
}

export async function assignWaiterToTable(
  tableId: string,
  waiterId: string | null,
  performedByUserId: string
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tables SET assigned_waiter_id = ? WHERE id = ?", [waiterId, tableId]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "TABLE_STAFF_ASSIGN",
    entityAffected: `Table:${tableId}`,
    reason: waiterId ? `Assigned staff ${waiterId} to table` : "Cleared staff assignment",
  });
}

export async function assignWaiterToSection(
  sectionName: string,
  waiterId: string | null,
  performedByUserId: string
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tables SET assigned_waiter_id = ? WHERE section = ?", [
    waiterId,
    sectionName,
  ]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "SECTION_STAFF_ASSIGN",
    entityAffected: `Section:${sectionName}`,
    reason: waiterId ? `Assigned staff ${waiterId} to all tables in ${sectionName}` : `Cleared staff assignment for ${sectionName}`,
  });
}

// ─── T-040: Table Status Transitions & Lifecycle Hooks ──────────────────────

export async function setTableStatus(
  tableId: string,
  status: TableStatus,
  performedByUserId: string
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tables SET status = ? WHERE id = ?", [status, tableId]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "TABLE_STATUS_CHANGE",
    entityAffected: `Table:${tableId}`,
    reason: `Table status updated to ${status}`,
  });
}

export async function markTableCleaned(
  tableId: string,
  performedByUserId: string
): Promise<void> {
  await setTableStatus(tableId, "FREE", performedByUserId);
}

export async function reserveTable(
  tableId: string,
  performedByUserId: string
): Promise<void> {
  await setTableStatus(tableId, "RESERVED", performedByUserId);
}
