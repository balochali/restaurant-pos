import { useState, useEffect } from "react";
import { getAuditLogs, AuditLogEntry } from "../lib/auditService";

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
    <div className="card full-width-card">
      <div className="card-header-row">
        <div>
          <h4>Audit Trail Logs (FR-1.4, NFR-3.3)</h4>
          <p className="subtitle">Real-time log of sensitive staff actions and security events</p>
        </div>

        <div className="filter-controls">
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="ALL">All Event Types</option>
            {actionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={refreshAuditLogs}>
            🔄 Refresh Logs
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading audit logs...</p>
      ) : filteredLogs.length === 0 ? (
        <p className="no-logs">No audit log entries found matching filter.</p>
      ) : (
        <div className="table-responsive">
          <table className="audit-table">
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
                  <td className="timestamp-cell">{formatTime(log.timestamp)}</td>
                  <td>
                    <div className="user-cell">
                      <div className="avatar-sm">{(log.user_name || "S").charAt(0)}</div>
                      <div>
                        <div className="staff-name">{log.user_name || "System"}</div>
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
                    <code>{log.entity_affected}</code>
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
