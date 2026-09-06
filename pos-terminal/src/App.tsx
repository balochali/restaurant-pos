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
import {
  IconPosTerminal,
  IconTable,
  IconMenu,
  IconUsers,
  IconInventory,
  IconAudit,
  IconCrown,
  IconSwitchUser,
  IconLogout,
} from "./components/Icons";
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

  const isAdminTab = ["menu", "users", "inventory", "audit"].includes(activeTab);

  return (
    <div className="dashboard-container">
      {/* Top Luxury Header Bar */}
      <header className="dashboard-header">
        <div className="user-badge">
          <div className="avatar">
            {user.name.charAt(0)}
          </div>
          <div className="user-info">
            <h3>{user.name}</h3>
            <span className={`role-pill role-${user.role}`}>
              {isAdminOrManager && <IconCrown size={12} color="currentColor" />}
              {user.role}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Quick View Mode Switcher for Admins */}
          {isAdminOrManager && (
            <div className="mode-switch-pill">
              <button
                type="button"
                className={`mode-switch-btn ${isAdminTab ? "active" : ""}`}
                onClick={() => setActiveTab("menu")}
              >
                <IconCrown size={14} color={isAdminTab ? "var(--bordo)" : "var(--text-secondary)"} />
                Admin Hub
              </button>
              <button
                type="button"
                className={`mode-switch-btn ${!isAdminTab ? "active" : ""}`}
                onClick={() => setActiveTab("cashier_pos")}
              >
                <IconPosTerminal size={14} color={!isAdminTab ? "var(--bordo)" : "var(--text-secondary)"} />
                Cashier POS
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn-secondary" onClick={switchUser} title="Switch User">
              <IconSwitchUser size={16} />
              Switch
            </button>
            <button type="button" className="btn-danger" onClick={logout} title="Sign Out">
              <IconLogout size={16} />
              Logout
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
          <IconPosTerminal size={18} color={activeTab === "cashier_pos" ? "#FFFFFF" : "currentColor"} />
          POS Register
        </button>

        <button
          type="button"
          className={`nav-tab ${activeTab === "tables" ? "active" : ""}`}
          onClick={() => setActiveTab("tables")}
        >
          <IconTable size={18} color={activeTab === "tables" ? "#FFFFFF" : "currentColor"} />
          Floor Plan
        </button>

        {/* Admin Operations */}
        <PermissionGate action="manage_menu">
          <button
            type="button"
            className={`nav-tab ${activeTab === "menu" ? "active" : ""}`}
            onClick={() => setActiveTab("menu")}
          >
            <IconMenu size={18} color={activeTab === "menu" ? "#FFFFFF" : "currentColor"} />
            Menu & Catalog
          </button>
        </PermissionGate>

        <PermissionGate action="manage_users">
          <button
            type="button"
            className={`nav-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <IconUsers size={18} color={activeTab === "users" ? "#FFFFFF" : "currentColor"} />
            Cashier Management
          </button>
        </PermissionGate>

        <PermissionGate action="manage_inventory">
          <button
            type="button"
            className={`nav-tab ${activeTab === "inventory" ? "active" : ""}`}
            onClick={() => setActiveTab("inventory")}
          >
            <IconInventory size={18} color={activeTab === "inventory" ? "#FFFFFF" : "currentColor"} />
            Inventory Stock
          </button>
        </PermissionGate>

        <PermissionGate action="view_reports">
          <button
            type="button"
            className={`nav-tab ${activeTab === "audit" ? "active" : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            <IconAudit size={18} color={activeTab === "audit" ? "#FFFFFF" : "currentColor"} />
            Audit Logs
          </button>
        </PermissionGate>
      </nav>

      {/* Tab Contents */}
      <main style={{ padding: "20px 28px", minHeight: "calc(100vh - 140px)" }}>
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
