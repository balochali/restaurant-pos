import { getDb } from "./db";
import { hashPin, verifyPin } from "./pin";
import { logAuditEvent } from "./auditService";

export type Role = "ADMIN" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN_STAFF";

export interface DbUser {
  id: string;
  name: string;
  username: string;
  pin_hash: string;
  role: Role;
  is_active: number;
  synced_at: string | null;
}

/**
 * Creates the initial local users on first installation.
 *
 * These users are intended for local/offline terminal authentication.
 * PINs are stored only as bcrypt hashes.
 */
export async function ensureInitialUsers(): Promise<void> {
  const db = await getDb();

  const countResult = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM users");

  if ((countResult[0]?.count ?? 0) > 0) {
    return;
  }

  console.log("[authService] Seeding default local SQLite users...");

  const adminHash = await hashPin("1234");
  const cashierHash = await hashPin("2222");
  const waiterHash = await hashPin("3333");

  await db.execute(
    `INSERT INTO users
      (id, name, username, pin_hash, role, is_active)
     VALUES
      ('00000000-0000-0000-0000-000000000001', 'Admin User', 'admin', ?, 'ADMIN', 1),
      ('00000000-0000-0000-0000-000000000002', 'Sarah Cashier', 'cashier1', ?, 'CASHIER', 1),
      ('00000000-0000-0000-0000-000000000003', 'John Waiter', 'waiter1', ?, 'WAITER', 1)`,
    [adminHash, cashierHash, waiterHash],
  );

  console.log("[authService] Default local users seeded successfully.");
}

/**
 * Authenticates a staff member by verifying the supplied PIN
 * against bcrypt hashes stored in the local SQLite users table.
 *
 * Authentication works offline because it does not require
 * PostgreSQL or the backend server.
 */
export async function authenticatePin(pin: string): Promise<DbUser | null> {
  if (!pin || pin.length < 4) {
    return null;
  }

  await ensureInitialUsers();

  const db = await getDb();

  const users = await db.select<DbUser[]>(
    `SELECT
      id,
      name,
      username,
      pin_hash,
      role,
      is_active,
      synced_at
     FROM users
     WHERE is_active = 1`,
  );

  for (const user of users) {
    const isValid = await verifyPin(pin, user.pin_hash);

    if (isValid) {
      await logAuditEvent({
        userId: user.id,
        actionType: "LOGIN_SUCCESS",
        entityAffected: "Terminal Session",
        reason: "PIN authentication successful",
        metadata: {
          role: user.role,
          username: user.username,
        },
      });

      return user;
    }
  }

  await logAuditEvent({
    userId: "00000000-0000-0000-0000-000000000001",
    actionType: "LOGIN_FAILED",
    entityAffected: "Terminal Session",
    reason: "Invalid PIN entered",
  });

  return null;
}
