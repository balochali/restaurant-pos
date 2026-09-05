import { getDb } from "./db";
import { logAuditEvent } from "./auditService";
import { authenticatePin } from "./authService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderSource = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

export type OrderStatus =
  | "OPEN"
  | "SENT_TO_KITCHEN"
  | "IN_PREP"
  | "READY"
  | "SERVED"
  | "CLOSED"
  | "VOIDED";

export type OrderItemStatus = "PENDING" | "SENT" | "IN_PREP" | "READY" | "SERVED" | "VOIDED";

export interface DbTable {
  id: string;
  number: string;
  section: string | null;
  capacity: number;
  status: "FREE" | "OCCUPIED" | "RESERVED" | "NEEDS_CLEANING";
}

export interface DbOrder {
  id: string;
  order_source: OrderSource;
  table_id: string | null;
  table_number?: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  status: OrderStatus;
  notes: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  created_by_id: string;
  created_by_name?: string | null;
  created_locally_at: string;
  item_count?: number;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name?: string;
  variant_id: string | null;
  variant_label?: string | null;
  modifiers: string | null;
  quantity: number;
  unit_price: number;
  notes: string | null;
  status: OrderItemStatus;
}

// ─── T-029: Table / Floor Plan ────────────────────────────────────────────────

export async function getTables(): Promise<DbTable[]> {
  const db = await getDb();
  return db.select<DbTable[]>(
    "SELECT id, number, section, capacity, status FROM tables ORDER BY section ASC, number ASC"
  );
}

export async function updateTableStatus(
  tableId: string,
  status: DbTable["status"]
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tables SET status = ? WHERE id = ?", [status, tableId]);
}

// ─── T-029 + T-031: Create Order (offline UUID) ───────────────────────────────

export async function createOrder(
  source: OrderSource,
  userId: string,
  opts: {
    tableId?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    notes?: string;
  } = {}
): Promise<DbOrder> {
  const db = await getDb();

  // T-031: client-side UUID — offline orders stay unique after sync
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO orders
      (id, order_source, table_id, customer_name, customer_phone, customer_address,
       status, notes, subtotal, discount, tax, total, created_by_id, created_locally_at)
     VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, 0, 0, 0, 0, ?, ?)`,
    [
      id,
      source,
      opts.tableId ?? null,
      opts.customerName ?? null,
      opts.customerPhone ?? null,
      opts.customerAddress ?? null,
      opts.notes ?? null,
      userId,
      now,
    ]
  );

  if (source === "DINE_IN" && opts.tableId) {
    await updateTableStatus(opts.tableId, "OCCUPIED");
  }

  await logAuditEvent({
    userId,
    actionType: "ORDER_CREATE",
    entityAffected: `Order:${id}`,
    reason: `New ${source} order created`,
    metadata: { source, tableId: opts.tableId, customer: opts.customerName },
  });

  return (await getOrderById(id))!;
}

// ─── Order Reads ──────────────────────────────────────────────────────────────

export async function getOrderById(orderId: string): Promise<DbOrder | null> {
  const db = await getDb();
  const rows = await db.select<DbOrder[]>(
    `SELECT o.*, t.number as table_number, u.name as created_by_name
     FROM orders o
     LEFT JOIN tables t ON t.id = o.table_id
     LEFT JOIN users  u ON u.id = o.created_by_id
     WHERE o.id = ?`,
    [orderId]
  );
  return rows[0] ?? null;
}

export async function getOpenOrders(): Promise<DbOrder[]> {
  const db = await getDb();
  return db.select<DbOrder[]>(
    `SELECT o.*, t.number as table_number, u.name as created_by_name,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status != 'VOIDED') as item_count
     FROM orders o
     LEFT JOIN tables t ON t.id = o.table_id
     LEFT JOIN users  u ON u.id = o.created_by_id
     WHERE o.status NOT IN ('CLOSED', 'VOIDED')
     ORDER BY o.created_locally_at DESC`
  );
}

export async function getAllOrders(limit = 50): Promise<DbOrder[]> {
  const db = await getDb();
  return db.select<DbOrder[]>(
    `SELECT o.*, t.number as table_number, u.name as created_by_name
     FROM orders o
     LEFT JOIN tables t ON t.id = o.table_id
     LEFT JOIN users  u ON u.id = o.created_by_id
     ORDER BY o.created_locally_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getOrderItems(orderId: string): Promise<DbOrderItem[]> {
  const db = await getDb();
  return db.select<DbOrderItem[]>(
    `SELECT oi.*, mi.name as item_name, iv.name as variant_label
     FROM order_items oi
     LEFT JOIN menu_items  mi ON mi.id = oi.menu_item_id
     LEFT JOIN item_variants iv ON iv.id = oi.variant_id
     WHERE oi.order_id = ? AND oi.status != 'VOIDED'
     ORDER BY rowid ASC`,
    [orderId]
  );
}

// ─── T-030: Cart / Line Item Builder ─────────────────────────────────────────

export async function addOrderItem(
  orderId: string,
  menuItemId: string,
  quantity: number,
  unitPrice: number,
  opts: { variantId?: string; modifiers?: string[]; notes?: string } = {}
): Promise<DbOrderItem> {
  const db = await getDb();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO order_items
      (id, order_id, menu_item_id, variant_id, modifiers, quantity, unit_price, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      id,
      orderId,
      menuItemId,
      opts.variantId ?? null,
      opts.modifiers?.length ? JSON.stringify(opts.modifiers) : null,
      quantity,
      unitPrice,
      opts.notes ?? null,
    ]
  );

  await recalcOrderTotals(orderId);

  const rows = await db.select<DbOrderItem[]>(
    `SELECT oi.*, mi.name as item_name FROM order_items oi
     LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.id = ?`,
    [id]
  );
  return rows[0];
}

export async function updateOrderItemQty(
  itemId: string,
  quantity: number,
  orderId: string
): Promise<void> {
  const db = await getDb();
  if (quantity <= 0) {
    await db.execute("UPDATE order_items SET status = 'VOIDED' WHERE id = ?", [itemId]);
  } else {
    await db.execute("UPDATE order_items SET quantity = ? WHERE id = ?", [quantity, itemId]);
  }
  await recalcOrderTotals(orderId);
}

export async function removeOrderItem(itemId: string, orderId: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE order_items SET status = 'VOIDED' WHERE id = ?", [itemId]);
  await recalcOrderTotals(orderId);
}

async function recalcOrderTotals(orderId: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ subtotal: number }[]>(
    `SELECT COALESCE(SUM(quantity * unit_price), 0) as subtotal
     FROM order_items WHERE order_id = ? AND status != 'VOIDED'`,
    [orderId]
  );
  const subtotal = rows[0]?.subtotal ?? 0;
  const TAX_RATE = 0.08;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  await db.execute(
    "UPDATE orders SET subtotal = ?, tax = ?, total = ? WHERE id = ?",
    [subtotal, tax, total, orderId]
  );
}

// ─── T-032: Send to Kitchen ───────────────────────────────────────────────────

export async function sendToKitchen(orderId: string, userId: string): Promise<void> {
  const db = await getDb();

  await db.execute(
    "UPDATE order_items SET status = 'SENT' WHERE order_id = ? AND status = 'PENDING'",
    [orderId]
  );
  await db.execute(
    "UPDATE orders SET status = 'SENT_TO_KITCHEN' WHERE id = ? AND status IN ('OPEN', 'SENT_TO_KITCHEN')",
    [orderId]
  );

  await logAuditEvent({
    userId,
    actionType: "ORDER_SENT_TO_KITCHEN",
    entityAffected: `Order:${orderId}`,
    reason: "Order dispatched to kitchen",
  });
}

// ─── T-033: Order Status State Machine ───────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN:            "Open",
  SENT_TO_KITCHEN: "Sent to Kitchen",
  IN_PREP:         "In Preparation",
  READY:           "Ready to Serve",
  SERVED:          "Served",
  CLOSED:          "Closed",
  VOIDED:          "Voided",
};

export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  OPEN:            "SENT_TO_KITCHEN",
  SENT_TO_KITCHEN: "IN_PREP",
  IN_PREP:         "READY",
  READY:           "SERVED",
  SERVED:          "CLOSED",
  CLOSED:          null,
  VOIDED:          null,
};

export function getNextStatus(current: OrderStatus): OrderStatus | null {
  return ORDER_STATUS_FLOW[current] ?? null;
}

export async function advanceOrderStatus(orderId: string, userId: string): Promise<OrderStatus | null> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");

  const next = getNextStatus(order.status);
  if (!next) return null;

  const db = await getDb();
  await db.execute("UPDATE orders SET status = ? WHERE id = ?", [next, orderId]);

  if (next === "SERVED" && order.table_id) {
    await updateTableStatus(order.table_id, "NEEDS_CLEANING");
  }

  await logAuditEvent({
    userId,
    actionType: "ORDER_STATUS_CHANGE",
    entityAffected: `Order:${orderId}`,
    reason: `Status: ${order.status} → ${next}`,
  });

  return next;
}

// ─── T-034: Void with Approval Workflow ──────────────────────────────────────

export async function voidOrder(
  orderId: string,
  reason: string,
  approverPin: string,
  requestingUserId: string
): Promise<void> {
  const approver = await authenticatePin(approverPin);
  if (!approver || (approver.role !== "ADMIN" && approver.role !== "MANAGER")) {
    throw new Error("Invalid PIN or insufficient role. Manager/Admin required.");
  }

  const db = await getDb();
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.status === "VOIDED") throw new Error("Order is already voided.");

  await db.execute("UPDATE orders SET status = 'VOIDED' WHERE id = ?", [orderId]);
  await db.execute("UPDATE order_items SET status = 'VOIDED' WHERE order_id = ?", [orderId]);

  if (order.table_id) {
    await updateTableStatus(order.table_id, "FREE");
  }

  await logAuditEvent({
    userId: approver.id,
    actionType: "ORDER_VOID",
    entityAffected: `Order:${orderId}`,
    reason: `Voided by ${approver.name}: ${reason}`,
    metadata: { requestedBy: requestingUserId, approvedBy: approver.id },
  });
}

export async function voidOrderItem(
  itemId: string,
  orderId: string,
  reason: string,
  approverPin: string,
  requestingUserId: string
): Promise<void> {
  const approver = await authenticatePin(approverPin);
  if (!approver || (approver.role !== "ADMIN" && approver.role !== "MANAGER")) {
    throw new Error("Invalid PIN or insufficient role. Manager/Admin required.");
  }

  const db = await getDb();
  await db.execute("UPDATE order_items SET status = 'VOIDED' WHERE id = ?", [itemId]);
  await recalcOrderTotals(orderId);

  await logAuditEvent({
    userId: approver.id,
    actionType: "ORDER_ITEM_VOID",
    entityAffected: `OrderItem:${itemId}`,
    reason: `Item voided by ${approver.name}: ${reason}`,
    metadata: { orderId, requestedBy: requestingUserId },
  });
}

// ─── T-035: Reopen Closed Order ──────────────────────────────────────────────

export const REOPEN_WINDOW_MINUTES = 30;

export async function reopenOrder(orderId: string, userId: string): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.status !== "SERVED" && order.status !== "CLOSED") {
    throw new Error("Only SERVED or CLOSED orders can be reopened.");
  }

  const createdAt = new Date(order.created_locally_at).getTime();
  const minutesElapsed = (Date.now() - createdAt) / 60000;
  if (minutesElapsed > REOPEN_WINDOW_MINUTES) {
    throw new Error(
      `Reopen window expired (${REOPEN_WINDOW_MINUTES} min). Elapsed: ${Math.floor(minutesElapsed)} min.`
    );
  }

  const db = await getDb();
  await db.execute("UPDATE orders SET status = 'OPEN' WHERE id = ?", [orderId]);

  if (order.table_id) {
    await updateTableStatus(order.table_id, "OCCUPIED");
  }

  await logAuditEvent({
    userId,
    actionType: "ORDER_REOPEN",
    entityAffected: `Order:${orderId}`,
    reason: "Order reopened for corrections",
  });
}

// ─── T-036: Merge Tables / Split Bill ────────────────────────────────────────

export async function mergeOrders(
  sourceOrderId: string,
  targetOrderId: string,
  userId: string
): Promise<void> {
  const db = await getDb();
  const source = await getOrderById(sourceOrderId);
  const target = await getOrderById(targetOrderId);

  if (!source || !target) throw new Error("One or both orders not found.");
  if (source.status === "VOIDED" || target.status === "VOIDED") {
    throw new Error("Cannot merge voided orders.");
  }

  await db.execute(
    "UPDATE order_items SET order_id = ? WHERE order_id = ?",
    [targetOrderId, sourceOrderId]
  );
  await db.execute("UPDATE orders SET status = 'VOIDED' WHERE id = ?", [sourceOrderId]);

  if (source.table_id && source.table_id !== target.table_id) {
    await updateTableStatus(source.table_id, "FREE");
  }

  await recalcOrderTotals(targetOrderId);

  await logAuditEvent({
    userId,
    actionType: "ORDER_MERGE",
    entityAffected: `Order:${targetOrderId}`,
    reason: `Merged order ${sourceOrderId} into ${targetOrderId}`,
    metadata: { sourceOrderId, targetOrderId },
  });
}

export async function splitBill(
  orderId: string,
  itemIdsForNewBill: string[],
  userId: string
): Promise<string> {
  const db = await getDb();
  const originalOrder = await getOrderById(orderId);
  if (!originalOrder) throw new Error("Order not found.");

  const newOrderId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO orders
      (id, order_source, table_id, customer_name, customer_phone, customer_address,
       status, notes, subtotal, discount, tax, total, created_by_id, created_locally_at)
     VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, 0, 0, 0, 0, ?, ?)`,
    [
      newOrderId,
      originalOrder.order_source,
      originalOrder.table_id,
      originalOrder.customer_name,
      originalOrder.customer_phone,
      originalOrder.customer_address,
      `Split from ${orderId}`,
      userId,
      now,
    ]
  );

  for (const itemId of itemIdsForNewBill) {
    await db.execute(
      "UPDATE order_items SET order_id = ? WHERE id = ?",
      [newOrderId, itemId]
    );
  }

  await recalcOrderTotals(orderId);
  await recalcOrderTotals(newOrderId);

  await logAuditEvent({
    userId,
    actionType: "ORDER_SPLIT",
    entityAffected: `Order:${orderId}`,
    reason: `Bill split — new order: ${newOrderId}`,
    metadata: { originalOrderId: orderId, newOrderId, splitItemCount: itemIdsForNewBill.length },
  });

  return newOrderId;
}

// ─── Payment Processing & Receipt Data ─────────────────────────────────────

export async function processOrderPayment(
  orderId: string,
  method: "CASH" | "CARD" | "DIGITAL" | "OTHER",
  amount: number,
  tip: number,
  changeDue: number,
  userId: string
): Promise<void> {
  const db = await getDb();
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found.");

  const paymentId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO payments (id, order_id, method, amount, tip, change_due, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`,
    [paymentId, orderId, method, amount, tip, changeDue, now]
  );

  // Mark order as CLOSED
  await db.execute("UPDATE orders SET status = 'CLOSED' WHERE id = ?", [orderId]);

  // If order was tied to a table, update table status to NEEDS_CLEANING or FREE
  if (order.table_id) {
    await updateTableStatus(order.table_id, "NEEDS_CLEANING");
  }

  await logAuditEvent({
    userId,
    actionType: "ORDER_PAYMENT",
    entityAffected: `Order:${orderId}`,
    reason: `Payment processed: $${amount} via ${method}`,
    metadata: { paymentId, method, amount, tip, changeDue },
  });
}

