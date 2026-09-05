import { useState } from "react";
import PinLogin from "./components/PinLogin";
import { AuthProvider } from "./store/authContext";
import { useAuth } from "./store/useAuth";
import PermissionGate from "./components/PermissionGate";
import UserManagement from "./components/UserManagement";
import InventoryManagement from "./components/InventoryManagement";
import AuditLogViewer from "./components/AuditLogViewer";
import MenuManagement from "./components/MenuManagement";
import OrderManagement from "./components/OrderManagement";
import TableManagement from "./components/TableManagement";
import "./App.css";

type Tab = "cashier_pos" | "tables" | "menu" | "users" | "inventory" | "audit";

function TerminalContent() {
  const { user, login, logout, switchUser } = useAuth();
  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  
  const [activeTab, setActiveTab] = useState<Tab>(isAdminOrManager ? "menu" : "cashier_pos");
  const [selectedTableForOrder, setSelectedTableForOrder] = useState<string>("");

  if (!user) {
    return <PinLogin onLogin={login} />;
  }

  const handleSelectTableFromFloor = (tableId: string) => {
    setSelectedTableForOrder(tableId);
    setActiveTab("cashier_pos");
  };

  return (
    <div className="dashboard-container">
      {/* Top Header Bar */}
      <header className="dashboard-header">
        <div className="user-badge">
          <div className="avatar" style={{ background: isAdminOrManager ? "var(--primary-color, #e65100)" : "#1d4ed8" }}>
            {user.name.charAt(0)}
          </div>
          <div className="user-info">
            <h3 style={{ margin: 0, fontSize: "16px" }}>{user.name}</h3>
            <span className={`role-pill role-${user.role}`}>{user.role}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Quick View Mode Indicator for Admins */}
          {isAdminOrManager && (
            <div style={{ display: "flex", background: "#f0f0f0", padding: "3px", borderRadius: "8px" }}>
              <button
                type="button"
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: ["menu", "users", "inventory", "audit"].includes(activeTab) ? "bold" : "normal",
                  background: ["menu", "users", "inventory", "audit"].includes(activeTab) ? "#fff" : "transparent",
                  color: ["menu", "users", "inventory", "audit"].includes(activeTab) ? "#000" : "#666",
                  border: "none",
                  borderRadius: "6px",
                  boxShadow: ["menu", "users", "inventory", "audit"].includes(activeTab) ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                }}
                onClick={() => setActiveTab("menu")}
              >
                👑 Admin View
              </button>
              <button
                type="button"
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: ["cashier_pos", "tables"].includes(activeTab) ? "bold" : "normal",
                  background: ["cashier_pos", "tables"].includes(activeTab) ? "#fff" : "transparent",
                  color: ["cashier_pos", "tables"].includes(activeTab) ? "#000" : "#666",
                  border: "none",
                  borderRadius: "6px",
                  boxShadow: ["cashier_pos", "tables"].includes(activeTab) ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                }}
                onClick={() => setActiveTab("cashier_pos")}
              >
                🛒 Cashier View
              </button>
            </div>
          )}

          <div className="header-actions">
            <button type="button" className="btn-secondary" onClick={switchUser} title="Switch Cashier / User">
              🔄 Switch User
            </button>
            <button type="button" className="btn-danger" onClick={logout} title="Sign Out">
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <nav className="nav-tabs">
        {/* Cashier Operations */}
        <button
          type="button"
          className={`nav-tab ${activeTab === "cashier_pos" ? "active" : ""}`}
          onClick={() => setActiveTab("cashier_pos")}
        >
          🛒 POS Terminal
        </button>

        <button
          type="button"
          className={`nav-tab ${activeTab === "tables" ? "active" : ""}`}
          onClick={() => setActiveTab("tables")}
        >
          🪑 Floor Plan & Tables
        </button>

        {/* Admin Operations */}
        <PermissionGate action="manage_menu">
          <button
            type="button"
            className={`nav-tab ${activeTab === "menu" ? "active" : ""}`}
            onClick={() => setActiveTab("menu")}
          >
            📋 Menu & Categories
          </button>
        </PermissionGate>

        <PermissionGate action="manage_users">
          <button
            type="button"
            className={`nav-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 Cashier Management
          </button>
        </PermissionGate>

        <PermissionGate action="manage_inventory">
          <button
            type="button"
            className={`nav-tab ${activeTab === "inventory" ? "active" : ""}`}
            onClick={() => setActiveTab("inventory")}
          >
            📦 Inventory
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
      <main style={{ minHeight: "calc(100vh - 140px)" }}>
        {activeTab === "cashier_pos" && (
          <OrderManagement
            initialTableId={selectedTableForOrder}
            onSwitchToTables={() => setActiveTab("tables")}
          />
        )}

        {activeTab === "tables" && (
          <TableManagement onSelectTable={handleSelectTableFromFloor} />
        )}

        {activeTab === "menu" && (
          <PermissionGate
            action="manage_menu"
            fallback={
              <div className="card">
                <h4>Access Restricted</h4>
                <p>You need Admin/Manager permissions to access Menu Management.</p>
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
                <p>You need Admin permissions to manage Cashiers and Staff.</p>
              </div>
            }
          >
            <UserManagement />
          </PermissionGate>
        )}

        {activeTab === "inventory" && (
          <PermissionGate
            action="manage_inventory"
            fallback={
              <div className="card">
                <h4>Access Restricted</h4>
                <p>You need Admin permissions to access Inventory Management.</p>
              </div>
            }
          >
            <InventoryManagement />
          </PermissionGate>
        )}

        {activeTab === "audit" && (
          <PermissionGate
            action="view_reports"
            fallback={
              <div className="card">
                <h4>Access Restricted</h4>
                <p>You need permission to view activity and audit logs.</p>
              </div>
            }
          >
            <AuditLogViewer />
          </PermissionGate>
        )}
      </main>
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
