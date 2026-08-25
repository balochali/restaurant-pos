import { getDb } from "./db";

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  action_type: string;
  entity_affected: string;
  reason?: string | null;
  metadata?: string | null;
  timestamp: string;
}

/**
 * Log a sensitive system action or user event into local SQLite audit_log table.
 */
export async function logAuditEvent(params: {
  userId: string;
  actionType: string;
  entityAffected: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await getDb();
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const metadataString = params.metadata ? JSON.stringify(params.metadata) : null;

    await db.execute(
      `INSERT INTO audit_log (id, user_id, action_type, entity_affected, reason, metadata, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.userId,
        params.actionType,
        params.entityAffected,
        params.reason || null,
        metadataString,
        timestamp,
      ],
    );

    console.log(
      `[Audit] ${params.actionType} on ${params.entityAffected} by user ${params.userId}`,
    );
  } catch (error) {
    console.error("[Audit] Failed to record audit log entry:", error);
  }
}

/**
 * Fetch recent audit logs from local SQLite joined with staff user details.
 */
export async function getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  try {
    const db = await getDb();

    const logs = await db.select<AuditLogEntry[]>(
      `SELECT a.id, a.user_id, u.name as user_name, u.role as user_role,
              a.action_type, a.entity_affected, a.reason, a.metadata, a.timestamp
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.timestamp DESC
       LIMIT ?`,
      [limit],
    );

    return logs;
  } catch (error) {
    console.error("[Audit] Failed to fetch audit logs:", error);
    return [];
  }
}
