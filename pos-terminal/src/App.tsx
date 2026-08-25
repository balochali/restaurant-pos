import { useState } from "react";
import PinLogin from "./components/PinLogin";
import { AuthProvider } from "./store/authContext";
import { useAuth } from "./store/useAuth";
import PermissionGate from "./components/PermissionGate";
import UserManagement from "./components/UserManagement";
import AuditLogViewer from "./components/AuditLogViewer";
import MenuManagement from "./components/MenuManagement";
import { PermissionAction } from "./lib/permissions";
import { logAuditEvent } from "./lib/auditService";
import "./App.css";

type Tab = "terminal" | "menu" | "users" | "audit";

function TerminalContent() {
  const { user, login, logout, switchUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("terminal");
  const [testNotification, setTestNotification] = useState<string | null>(null);

  if (!user) {
    return <PinLogin onLogin={login} />;
  }

  const handleSensitiveActionTest = async (action: PermissionAction, label: string) => {
    if (!user) return;

    await logAuditEvent({
      userId: user.id,
      actionType: action.toUpperCase(),
      entityAffected: "Order #1001",
      reason: `Test sensitive action: ${label}`,
      metadata: { action, performedBy: user.username, role: user.role },
    });

    setTestNotification(`Recorded audit log entry for "${label}"!`);
  };

  const actionsToTest: { action: PermissionAction; label: string }[] = [
    { action: "create_order", label: "Create Order" },
    { action: "process_payment", label: "Process Payment" },
    { action: "apply_discount", label: "Apply Discount" },
    { action: "void_order", label: "Void Order" },
    { action: "manage_menu", label: "Manage Menu" },
    { action: "manage_inventory", label: "Manage Inventory" },
    { action: "view_reports", label: "View Reports" },
    { action: "manage_users", label: "Manage Users" },
  ];

  return (
    <div className="dashboard-container">
      {/* Header Bar */}
      <header className="dashboard-header">
        <div className="user-badge">
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="user-info">
            <h3>{user.name}</h3>
            <span className={`role-pill role-${user.role}`}>{user.role}</span>
          </div>
        </div>

        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={switchUser}>
            🔄 Switch User
          </button>
          <button type="button" className="btn-danger" onClick={logout}>
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          type="button"
          className={`nav-tab ${activeTab === "terminal" ? "active" : ""}`}
          onClick={() => setActiveTab("terminal")}
        >
          🖥️ Terminal Home
        </button>

        <PermissionGate action="manage_menu">
          <button
            type="button"
            className={`nav-tab ${activeTab === "menu" ? "active" : ""}`}
            onClick={() => setActiveTab("menu")}
          >
            📋 Menu Management (FR-2.1→2.5)
          </button>
        </PermissionGate>

        <PermissionGate action="manage_users">
          <button
            type="button"
            className={`nav-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 Staff Accounts (FR-1.3)
          </button>
        </PermissionGate>

        <PermissionGate action="view_reports">
          <button
            type="button"
            className={`nav-tab ${activeTab === "audit" ? "active" : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            📜 Audit Logs (FR-1.4)
          </button>
        </PermissionGate>
      </nav>

      {/* Tab Contents */}
      {activeTab === "menu" && (
        <PermissionGate
          action="manage_menu"
          fallback={
            <div className="card">
              <h4>Access Restricted</h4>
              <p>You need permission to access Menu Management.</p>
            </div>
          }
        >
          <MenuManagement />
        </PermissionGate>
      )}

      {activeTab === "users" && (
        <PermissionGate
          action="manage_users"
          fallback={
            <div className="card">
              <h4>Access Restricted</h4>
              <p>You need ADMIN or MANAGER permission to access User Management.</p>
            </div>
          }
        >
          <UserManagement />
        </PermissionGate>
      )}

      {activeTab === "audit" && (
        <PermissionGate
          action="view_reports"
          fallback={
            <div className="card">
              <h4>Access Restricted</h4>
              <p>You need permission to view audit logs.</p>
            </div>
          }
        >
          <AuditLogViewer />
        </PermissionGate>
      )}

      {activeTab === "terminal" && (
        <main className="dashboard-content">
          {testNotification && (
            <div
              className="success-banner full-width-card"
              onClick={() => setTestNotification(null)}
            >
              ✅ {testNotification} (Click to dismiss)
            </div>
          )}

          <section className="card">
            <h4>Active Staff Profile</h4>
            <p>
              <strong>Name:</strong> {user.name}
            </p>
            <p>
              <strong>Username:</strong> <code>{user.username}</code>
            </p>
            <p>
              <strong>Assigned Role:</strong>{" "}
              <span className={`role-pill role-${user.role}`}>{user.role}</span>
            </p>
            <p>
              <strong>Account ID:</strong> <code style={{ fontSize: "11px" }}>{user.id}</code>
            </p>
          </section>

          <section className="card">
            <h4>Role Permission Matrix & Sensitive Actions (T-019 / T-021)</h4>
            <p className="subtitle" style={{ marginBottom: "16px" }}>
              Clicking an allowed button executes the action and creates a live entry in local{" "}
              <code>audit_log</code>.
            </p>
            <div className="permission-grid">
              {actionsToTest.map(({ action, label }) => (
                <div key={action} className="action-item">
                  <span>{label}</span>
                  <PermissionGate
                    action={action}
                    fallback={
                      <span style={{ color: "#ef4444", fontSize: "13px", fontWeight: "600" }}>
                        🔒 Restricted
                      </span>
                    }
                  >
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                      onClick={() => handleSensitiveActionTest(action, label)}
                    >
                      ⚡ Execute & Log
                    </button>
                  </PermissionGate>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TerminalContent />
    </AuthProvider>
  );
}
