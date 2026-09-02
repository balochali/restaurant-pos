import { useState } from "react";
import PinLogin from "./components/PinLogin";
import { AuthProvider } from "./store/authContext";
import { useAuth } from "./store/useAuth";
import PermissionGate from "./components/PermissionGate";
import UserManagement from "./components/UserManagement";
import AuditLogViewer from "./components/AuditLogViewer";
import MenuManagement from "./components/MenuManagement";
import OrderManagement from "./components/OrderManagement";
import TableManagement from "./components/TableManagement";
import { PermissionAction } from "./lib/permissions";
import "./App.css";

type Tab = "terminal" | "orders" | "tables" | "menu" | "users" | "audit";

function TerminalContent() {
  const { user, login, logout, switchUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("terminal");

  if (!user) {
    return <PinLogin onLogin={login} />;
  }

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

        <PermissionGate action="create_order">
          <button
            type="button"
            className={`nav-tab ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            🛒 Orders
          </button>
        </PermissionGate>

        <button
          type="button"
          className={`nav-tab ${activeTab === "tables" ? "active" : ""}`}
          onClick={() => setActiveTab("tables")}
        >
          🪑 Floor Plan
        </button>

        <PermissionGate action="manage_menu">
          <button
            type="button"
            className={`nav-tab ${activeTab === "menu" ? "active" : ""}`}
            onClick={() => setActiveTab("menu")}
          >
            📋 Menu Manager
          </button>
        </PermissionGate>

        <PermissionGate action="manage_users">
          <button
            type="button"
            className={`nav-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 Staff Accounts
          </button>
        </PermissionGate>

        <PermissionGate action="view_reports">
          <button
            type="button"
            className={`nav-tab ${activeTab === "audit" ? "active" : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            📜 Activity Logs
          </button>
        </PermissionGate>
      </nav>

      {/* Tab Contents */}
      {activeTab === "orders" && (
        <PermissionGate
          action="create_order"
          fallback={
            <div className="card">
              <h4>Access Restricted</h4>
              <p>You need permission to access Order Management.</p>
            </div>
          }
        >
          <OrderManagement />
        </PermissionGate>
      )}

      {activeTab === "tables" && <TableManagement />}

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

          {/* Welcome Card */}
          <section className="card full-width-card" style={{ background: "linear-gradient(135deg, #fff8f3 0%, #fdf3ec 100%)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h4 style={{ fontSize: "22px", marginBottom: "6px" }}>
                  👋 Welcome back, {user.name.split(" ")[0]}!
                </h4>
                <p className="subtitle" style={{ fontSize: "14px" }}>
                  You're signed in as <strong>{user.username}</strong> with{" "}
                  <span className={`role-pill role-${user.role}`}>{user.role}</span>{" "}
                  access. Use the menu above to navigate.
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Account ID</div>
                <code style={{ fontSize: "11px", color: "var(--text-secondary)", wordBreak: "break-all" }}>{user.id.slice(0, 18)}…</code>
              </div>
            </div>
          </section>

          {/* Quick Navigation */}
          <section className="card full-width-card">
            <h4 style={{ marginBottom: "16px" }}>Quick Navigation</h4>
            <div className="quick-link-grid">
              <PermissionGate action="create_order">
                <button type="button" className="quick-link-card" onClick={() => setActiveTab("orders")}>
                  <span className="quick-link-icon">🛒</span>
                  <div className="quick-link-text">
                    <strong>New Order & Cart</strong>
                    <small>Create orders, items & kitchen dispatch</small>
                  </div>
                </button>
              </PermissionGate>
              <button type="button" className="quick-link-card" onClick={() => setActiveTab("tables")}>
                <span className="quick-link-icon">🪑</span>
                <div className="quick-link-text">
                  <strong>Floor Plan & Tables</strong>
                  <small>Live table map, builder & staff assignments</small>
                </div>
              </button>
              <PermissionGate action="manage_menu">
                <button type="button" className="quick-link-card" onClick={() => setActiveTab("menu")}>
                  <span className="quick-link-icon">📋</span>
                  <div className="quick-link-text">
                    <strong>Menu Manager</strong>
                    <small>Items, categories, combos & variants</small>
                  </div>
                </button>
              </PermissionGate>
              <PermissionGate action="manage_users">
                <button type="button" className="quick-link-card" onClick={() => setActiveTab("users")}>
                  <span className="quick-link-icon">👥</span>
                  <div className="quick-link-text">
                    <strong>Staff Accounts</strong>
                    <small>Add or manage team members</small>
                  </div>
                </button>
              </PermissionGate>
              <PermissionGate action="view_reports">
                <button type="button" className="quick-link-card" onClick={() => setActiveTab("audit")}>
                  <span className="quick-link-icon">📜</span>
                  <div className="quick-link-text">
                    <strong>Activity Logs</strong>
                    <small>Review all system events</small>
                  </div>
                </button>
              </PermissionGate>
            </div>
          </section>

          {/* Permissions Summary */}
          <section className="card full-width-card">
            <h4 style={{ marginBottom: "4px" }}>Your Permissions</h4>
            <p className="subtitle" style={{ marginBottom: "16px" }}>
              Actions available to your <span className={`role-pill role-${user.role}`}>{user.role}</span> role.
            </p>
            <div className="permission-grid">
              {actionsToTest.map(({ action, label }) => (
                <div key={action} className="action-item">
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>{label}</span>
                  <PermissionGate
                    action={action}
                    fallback={
                      <span style={{ color: "#9ca3af", fontSize: "13px" }}>
                        🔒 Not allowed
                      </span>
                    }
                  >
                    <button
                      type="button"
                      className="btn-success btn-sm"
                      style={{ cursor: "default" }}
                    >
                      ✓ Allowed
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
