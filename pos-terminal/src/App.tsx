import { ReactNode, useState, useEffect, useCallback } from "react";
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
import TotalOrders from "./components/TotalOrders";
import { can } from "./lib/permissions";
import {
  IconPosTerminal,
  IconTable,
  IconMenu,
  IconUsers,
  IconInventory,
  IconAudit,
  IconChart,
  IconChef,
  IconCrown,
  IconSwitchUser,
  IconLogout,
} from "./components/Icons";
import "./App.css";

type Tab = "cashier_pos" | "tables" | "menu" | "users" | "inventory" | "reports" | "audit";

interface SidebarNavItemProps {
  tab: Tab;
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
  icon: ReactNode;
  label: string;
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function SidebarNavItem({ tab, activeTab, onSelect, icon, label }: SidebarNavItemProps) {
  const isActive = activeTab === tab;

  return (
    <button
      type="button"
      className={`sidebar-nav-item tab-${tab} ${isActive ? "active" : ""}`}
      onClick={() => onSelect(tab)}
      aria-current={isActive ? "page" : undefined}
      title={label}
    >
      <span className="sidebar-nav-icon">{icon}</span>
      <span className="sidebar-nav-label">{label}</span>
    </button>
  );
}

function TerminalContent() {
  const { user, login, logout, switchUser } = useAuth();
  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canTakeOrders = can(user?.role, "create_order");
  const canViewKitchenQueue = can(user?.role, "view_kitchen_queue");
  const showOrdersTab = canTakeOrders || canViewKitchenQueue;

  const [activeTab, setActiveTab] = useState<Tab>("cashier_pos");
  const [selectedTableForOrder, setSelectedTableForOrder] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar when a tab is selected on mobile
  const handleTabSelect = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  }, []);

  // Close sidebar on ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsSidebarOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Prevent body scroll when sidebar drawer is open on mobile
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isSidebarOpen]);

  if (!user) {
    return <PinLogin onLogin={login} />;
  }

  const handleSelectTableFromFloor = (tableId: string) => {
    setSelectedTableForOrder(tableId);
    setActiveTab("cashier_pos");
  };

  // Tabs visible in the bottom nav (most important ones first)
  const bottomNavTabs = [
    ...(showOrdersTab ? [
      { tab: "cashier_pos" as Tab, icon: <IconPosTerminal size={18} color="currentColor" />, label: canTakeOrders ? "Order" : "Kitchen" },
    ] : []),
    ...(canTakeOrders ? [
      { tab: "tables" as Tab, icon: <IconTable size={18} color="currentColor" />, label: "Tables" },
    ] : []),
    ...(isAdminOrManager ? [
      { tab: "menu" as Tab, icon: <IconMenu size={18} color="currentColor" />, label: "Menu" },
    ] : []),
    ...(can(user?.role, "manage_inventory") ? [
      { tab: "inventory" as Tab, icon: <IconInventory size={18} color="currentColor" />, label: "Stock" },
    ] : []),
  ];

  return (
    <div className="dashboard-container">
      {/* Sidebar overlay backdrop (mobile) */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? "open" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      <div className="app-shell">
        <aside className={`app-sidebar ${isSidebarOpen ? "drawer-open" : ""}`} aria-label="Sidebar navigation">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <IconPosTerminal size={22} color="#FFFFFF" />
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">Restaurant POS</span>
              <span className="sidebar-brand-subtitle">Point of Sale</span>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            <div className="sidebar-section">
              <p className="sidebar-section-label">Daily</p>

              {showOrdersTab && (
                <SidebarNavItem
                  tab="cashier_pos"
                  activeTab={activeTab}
                  onSelect={handleTabSelect}
                  label={canTakeOrders ? "Take Order" : "Kitchen Orders"}
                  icon={
                    canTakeOrders ? (
                      <IconPosTerminal
                        size={22}
                        color={activeTab === "cashier_pos" ? "#FFFFFF" : "currentColor"}
                      />
                    ) : (
                      <IconChef
                        size={22}
                        color={activeTab === "cashier_pos" ? "#FFFFFF" : "currentColor"}
                      />
                    )
                  }
                />
              )}

              {canTakeOrders && (
                <SidebarNavItem
                  tab="tables"
                  activeTab={activeTab}
                  onSelect={handleTabSelect}
                  label="Tables"
                  icon={
                    <IconTable size={22} color={activeTab === "tables" ? "#FFFFFF" : "currentColor"} />
                  }
                />
              )}

              <PermissionGate action="manage_menu">
                <SidebarNavItem
                  tab="menu"
                  activeTab={activeTab}
                  onSelect={handleTabSelect}
                  label="Menu"
                  icon={
                    <IconMenu size={22} color={activeTab === "menu" ? "#FFFFFF" : "currentColor"} />
                  }
                />
              </PermissionGate>
            </div>

            <div className="sidebar-section sidebar-section-secondary">
              <p className="sidebar-section-label">Management</p>

              <PermissionGate action="manage_users">
                <SidebarNavItem
                  tab="users"
                  activeTab={activeTab}
                  onSelect={handleTabSelect}
                  label="Staff"
                  icon={
                    <IconUsers size={22} color={activeTab === "users" ? "#FFFFFF" : "currentColor"} />
                  }
                />
              </PermissionGate>

              <PermissionGate action="manage_inventory">
                <SidebarNavItem
                  tab="inventory"
                  activeTab={activeTab}
                  onSelect={handleTabSelect}
                  label="Inventory"
                  icon={
                    <IconInventory
                      size={22}
                      color={activeTab === "inventory" ? "#FFFFFF" : "currentColor"}
                    />
                  }
                />
              </PermissionGate>

              <PermissionGate action="view_reports">
                <SidebarNavItem
                  tab="reports"
                  activeTab={activeTab}
                  onSelect={handleTabSelect}
                  label="Total Orders"
                  icon={
                    <IconChart size={22} color={activeTab === "reports" ? "#FFFFFF" : "currentColor"} />
                  }
                />
              </PermissionGate>

              <PermissionGate action="view_reports">
                <SidebarNavItem
                  tab="audit"
                  activeTab={activeTab}
                  onSelect={handleTabSelect}
                  label="Activity Log"
                  icon={
                    <IconAudit size={22} color={activeTab === "audit" ? "#FFFFFF" : "currentColor"} />
                  }
                />
              </PermissionGate>
            </div>
          </nav>
        </aside>

        <div className="app-main">
          <header className="dashboard-header">
            {/* Left: hamburger (mobile only) + user badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <button
                type="button"
                className="hamburger-btn"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isSidebarOpen}
              >
                <HamburgerIcon />
              </button>
              <div className="user-badge">
                <div className="avatar">{user.name.charAt(0)}</div>
                <div className="user-info">
                  <h3>{user.name}</h3>
                  <span className={`role-pill role-${user.role}`}>
                    {isAdminOrManager && <IconCrown size={12} color="currentColor" />}
                    {user.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="header-actions">
              <button type="button" className="btn-secondary" onClick={switchUser} title="Switch User">
                <IconSwitchUser size={16} />
                Switch
              </button>
              <button type="button" className="btn-danger" onClick={logout} title="Sign Out">
                <IconLogout size={16} />
                Logout
              </button>
            </div>
          </header>

          <main className="app-content">
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

            {activeTab === "reports" && (
              <PermissionGate
                action="view_reports"
                fallback={
                  <div className="card">
                    <h4>Access Restricted</h4>
                    <p>You need permission to view sales reports.</p>
                  </div>
                }
              >
                <TotalOrders />
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
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {bottomNavTabs.map(({ tab, icon, label }) => (
          <button
            key={tab}
            type="button"
            className={`mobile-nav-item tab-${tab} ${activeTab === tab ? "active" : ""}`}
            onClick={() => handleTabSelect(tab)}
            aria-current={activeTab === tab ? "page" : undefined}
          >
            <span className="mobile-nav-icon">{icon}</span>
            {label}
          </button>
        ))}
        {/* More button — opens sidebar drawer for remaining tabs */}
        <button
          type="button"
          className="mobile-nav-item"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="More options"
        >
          <span className="mobile-nav-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="5" r="1" fill="currentColor" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <circle cx="12" cy="19" r="1" fill="currentColor" />
            </svg>
          </span>
          More
        </button>
      </nav>
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
