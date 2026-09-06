import { useState, useEffect } from "react";
import { getAuditLogs, AuditLogEntry } from "../lib/auditService";
import { IconAudit, IconClock } from "./Icons";

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>("ALL");

  const refreshAuditLogs = () => {
    setLoading(true);
    getAuditLogs(100)
      .then((data) => {
        setLogs(data);
      })
      .catch((err) => {
        console.error("Failed to load audit logs:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isSubscribed = true;

    getAuditLogs(100)
      .then((data) => {
        if (isSubscribed) {
          setLogs(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load audit logs:", err);
        if (isSubscribed) {
          setLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const actionTypes = Array.from(new Set(logs.map((l) => l.action_type)));

  const filteredLogs = logs.filter((log) => {
    if (filterAction === "ALL") return true;
    return log.action_type === filterAction;
  });

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
        " · " +
        d.toLocaleDateString([], { month: "short", day: "numeric" })
      );
    } catch {
      return isoString;
    }
  };

  const getActionClass = (type: string) => {
    if (type.includes("SUCCESS") || type.includes("CREATE") || type.includes("ACTIVATE")) {
      return "badge-success";
    }
    if (type.includes("FAILED") || type.includes("DELETE") || type.includes("DEACTIVATE")) {
      return "badge-danger";
    }
    if (type.includes("VOID") || type.includes("DISCOUNT") || type.includes("OVERRIDE")) {
      return "badge-warning";
    }
    return "badge-info";
  };

  return (
    <div className="card full-width-card" style={{ padding: "20px" }}>
      <div className="card-header-row" style={{ marginBottom: "16px" }}>
        <div>
          <h4>System Audit & Activity Trail</h4>
          <p className="subtitle">Real-time immutable log of all staff actions, payments, and system events</p>
        </div>

        <div className="filter-controls" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="ALL">All Event Types</option>
            {actionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={refreshAuditLogs}>
            Refresh Logs
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <IconAudit size={32} color="var(--primary)" />
          <p style={{ marginTop: "8px" }}>Loading activity logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <IconAudit size={40} color="var(--text-muted)" />
          <p style={{ marginTop: "12px" }}>No events found for the selected filter.</p>
        </div>
      ) : (
        <div className="table-responsive" style={{ border: "1px solid var(--border-light)", borderRadius: "14px", overflow: "hidden" }}>
          <table className="staff-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Staff Member</th>
                <th>Action Event</th>
                <th>Entity Affected</th>
                <th>Reason / Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="timestamp-cell" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <IconClock size={13} />
                      <span>{formatTime(log.timestamp)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="user-cell" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="avatar-sm" style={{ background: "var(--surface-warm)", color: "var(--primary)", fontWeight: "700" }}>
                        {(log.user_name || "S").charAt(0)}
                      </div>
                      <div>
                        <div className="staff-name" style={{ fontWeight: "600" }}>{log.user_name || "System"}</div>
                        {log.user_role && (
                          <span className={`role-pill role-${log.user_role}`}>{log.user_role}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`audit-badge ${getActionClass(log.action_type)}`}>
                      {log.action_type}
                    </span>
                  </td>
                  <td>
                    <code style={{ background: "var(--surface-warm)", padding: "2px 6px", borderRadius: "4px", fontSize: "12px" }}>
                      {log.entity_affected}
                    </code>
                  </td>
                  <td>
                    <div>{log.reason || "—"}</div>
                    {log.metadata && <pre className="metadata-preview">{log.metadata}</pre>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
