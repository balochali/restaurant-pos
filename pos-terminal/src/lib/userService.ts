import { getDb } from "./db";
import { DbUser, Role } from "./authService";
import { hashPin } from "./pin";
import { logAuditEvent } from "./auditService";

export interface CreateUserInput {
  name: string;
  username: string;
  pin: string;
  role: Role;
}

export interface UpdateUserInput {
  name: string;
  username: string;
  role: Role;
  is_active: number;
  pin?: string;
}

/**
 * Fetch all staff users from local SQLite.
 */
export async function getAllUsers(): Promise<DbUser[]> {
  const db = await getDb();
  return db.select<DbUser[]>(
    "SELECT id, name, username, pin_hash, role, is_active, synced_at FROM users ORDER BY name ASC",
  );
}

/**
 * Create a new staff account and log audit event.
 */
export async function createStaffUser(
  input: CreateUserInput,
  performedByUserId: string,
): Promise<DbUser> {
  const db = await getDb();

  // Check username uniqueness
  const existing = await db.select<{ id: string }[]>("SELECT id FROM users WHERE username = ?", [
    input.username.trim().toLowerCase(),
  ]);

  if (existing.length > 0) {
    throw new Error(`Username "${input.username}" is already in use.`);
  }

  const id = crypto.randomUUID();
  const pinHash = await hashPin(input.pin);
  const username = input.username.trim().toLowerCase();

  await db.execute(
    `INSERT INTO users (id, name, username, pin_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, input.name.trim(), username, pinHash, input.role],
  );

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "USER_CREATE",
    entityAffected: `User:${input.name} (${input.role})`,
    reason: "New staff member account created",
    metadata: { newUserId: id, role: input.role, username },
  });

  return {
    id,
    name: input.name.trim(),
    username,
    pin_hash: pinHash,
    role: input.role,
    is_active: 1,
    synced_at: null,
  };
}

/**
 * Update staff account details and log audit event.
 */
export async function updateStaffUser(
  id: string,
  input: UpdateUserInput,
  performedByUserId: string,
): Promise<void> {
  const db = await getDb();

  const username = input.username.trim().toLowerCase();

  // Username uniqueness check (excluding self)
  const existing = await db.select<{ id: string }[]>(
    "SELECT id FROM users WHERE username = ? AND id != ?",
    [username, id],
  );

  if (existing.length > 0) {
    throw new Error(`Username "${input.username}" is already in use by another user.`);
  }

  if (input.pin && input.pin.length >= 4) {
    const pinHash = await hashPin(input.pin);
    await db.execute(
      `UPDATE users SET name = ?, username = ?, pin_hash = ?, role = ?, is_active = ? WHERE id = ?`,
      [input.name.trim(), username, pinHash, input.role, input.is_active, id],
    );
  } else {
    await db.execute(
      `UPDATE users SET name = ?, username = ?, role = ?, is_active = ? WHERE id = ?`,
      [input.name.trim(), username, input.role, input.is_active, id],
    );
  }

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "USER_UPDATE",
    entityAffected: `User:${input.name} (${input.role})`,
    reason: "Staff account details updated",
    metadata: { updatedUserId: id, role: input.role, is_active: input.is_active },
  });
}

/**
 * Toggle staff active status (activate / deactivate).
 */
export async function toggleStaffStatus(
  id: string,
  isActive: boolean,
  performedByUserId: string,
): Promise<void> {
  const db = await getDb();
  const newStatus = isActive ? 1 : 0;

  const users = await db.select<DbUser[]>("SELECT name, role FROM users WHERE id = ?", [id]);
  const userName = users[0]?.name || id;

  await db.execute("UPDATE users SET is_active = ? WHERE id = ?", [newStatus, id]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE",
    entityAffected: `User:${userName}`,
    reason: `Staff member ${isActive ? "activated" : "deactivated"}`,
    metadata: { targetUserId: id, is_active: newStatus },
  });
}

/**
 * Delete a staff user account.
 */
export async function deleteStaffUser(id: string, performedByUserId: string): Promise<void> {
  const db = await getDb();

  const users = await db.select<DbUser[]>("SELECT name, role FROM users WHERE id = ?", [id]);
  const userName = users[0]?.name || id;

  await db.execute("DELETE FROM users WHERE id = ?", [id]);

  await logAuditEvent({
    userId: performedByUserId,
    actionType: "USER_DELETE",
    entityAffected: `User:${userName}`,
    reason: "Staff member account deleted",
    metadata: { deletedUserId: id },
  });
}
