import { useState, useEffect, useMemo, useRef } from "react";
import {
  DbFloorTable,
  TableStatus,
  TableShape,
  getAllFloorTables,
  createFloorTable,
  updateFloorTable,
  deleteFloorTable,
  updateTablePosition,
  getWaitersList,
  assignWaiterToTable,
  assignWaiterToSection,
  setTableStatus,
  markTableCleaned,
  reserveTable,
} from "../lib/tableService";
import { DbUser } from "../lib/authService";
import { useAuth } from "../store/useAuth";

export default function TableManagement() {
  const { user: currentUser } = useAuth();

  // Navigation Subtabs
  const [activeSubtab, setActiveSubtab] = useState<"live_floor" | "layout_builder" | "staff_assignment">("live_floor");

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Core Data
  const [tables, setTables] = useState<DbFloorTable[]>([]);
  const [waiters, setWaiters] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Section Filter
  const [selectedSection, setSelectedSection] = useState<string>("ALL");

  // Selected Table Action Drawer / Modal
  const [selectedTable, setSelectedTable] = useState<DbFloorTable | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  // T-037: Layout Builder State
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<DbFloorTable | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [tableCapacity, setTableCapacity] = useState<number>(4);
  const [tableSection, setTableSection] = useState("Main Hall");
  const [tableShape, setTableShape] = useState<TableShape>("RECTANGLE");

  // Dragging State on Canvas
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // T-039: Section-wide Assignment State
  const [batchSection, setBatchSection] = useState("Main Hall");
  const [batchWaiterId, setBatchWaiterId] = useState("");

  const refreshData = async () => {
    try {
      const [floorTables, staff] = await Promise.all([getAllFloorTables(), getWaitersList()]);
      setTables(floorTables);
      setWaiters(staff);
    } catch (err) {
      console.error("Failed to load table data", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    // Poll for live table status updates every 15 seconds
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Distinct Sections List
  const sections = useMemo(() => {
    const list = Array.from(new Set(tables.map((t) => t.section || "General")));
    return list.sort();
  }, [tables]);

  // Filtered Tables
  const filteredTables = useMemo(() => {
    if (selectedSection === "ALL") return tables;
    return tables.filter((t) => (t.section || "General") === selectedSection);
  }, [tables, selectedSection]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = tables.length;
    const free = tables.filter((t) => t.status === "FREE").length;
    const occupied = tables.filter((t) => t.status === "OCCUPIED").length;
    const needsCleaning = tables.filter((t) => t.status === "NEEDS_CLEANING").length;
    const reserved = tables.filter((t) => t.status === "RESERVED").length;
    return { total, free, occupied, needsCleaning, reserved };
  }, [tables]);

  // ─── T-040: Status Actions ──────────────────────────────────────────────────
  const handleMarkCleaned = async (tableId: string) => {
    if (!currentUser) return;
    try {
      await markTableCleaned(tableId, currentUser.id);
      setSuccess("Table marked as Clean & Ready! ✨");
      refreshData();
      setIsActionModalOpen(false);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleManualStatusChange = async (tableId: string, status: TableStatus) => {
    if (!currentUser) return;
    try {
      await setTableStatus(tableId, status, currentUser.id);
      setSuccess(`Table status updated to ${status}.`);
      refreshData();
      setIsActionModalOpen(false);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleReserve = async (tableId: string) => {
    if (!currentUser) return;
    try {
      await reserveTable(tableId, currentUser.id);
      setSuccess("Table marked as Reserved. 🔵");
      refreshData();
      setIsActionModalOpen(false);
    } catch (err) {
      setError(String(err));
    }
  };

  // ─── T-037: Layout Builder Handlers ─────────────────────────────────────────
  const openAddTableModal = () => {
    setEditingTable(null);
    setTableNumber(`T${tables.length + 1}`);
    setTableCapacity(4);
    setTableSection(sections[0] || "Main Hall");
    setTableShape("RECTANGLE");
    setIsAddEditModalOpen(true);
  };

  const openEditTableModal = (tbl: DbFloorTable) => {
    setEditingTable(tbl);
    setTableNumber(tbl.number);
    setTableCapacity(tbl.capacity);
    setTableSection(tbl.section || "Main Hall");
    setTableShape(tbl.shape || "RECTANGLE");
    setIsAddEditModalOpen(true);
  };

  const handleSaveTableForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !tableNumber.trim()) return;

    try {
      if (editingTable) {
        await updateFloorTable(
          editingTable.id,
          tableNumber,
          tableCapacity,
          tableSection,
          tableShape,
          currentUser.id
        );
        setSuccess(`Table ${tableNumber} updated successfully.`);
      } else {
        // Find default open position on canvas
        const nextX = (tables.length % 5) * 130 + 30;
        const nextY = Math.floor(tables.length / 5) * 130 + 30;
        await createFloorTable(
          tableNumber,
          tableCapacity,
          tableSection,
          tableShape,
          nextX,
          nextY,
          currentUser.id
        );
        setSuccess(`Table ${tableNumber} created on floor plan.`);
      }
      setIsAddEditModalOpen(false);
      refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteTable = async (tbl: DbFloorTable) => {
    if (!currentUser) return;
    if (!confirm(`Are you sure you want to delete Table ${tbl.number}?`)) return;

    try {
      await deleteFloorTable(tbl.id, currentUser.id);
      setSuccess(`Table ${tbl.number} deleted.`);
      refreshData();
      setIsActionModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // ─── Interactive Drag & Drop on Canvas (T-037) ─────────────────────────────
  const handleMouseDownTable = (e: React.MouseEvent, tbl: DbFloorTable) => {
    if (activeSubtab !== "layout_builder") return;
    e.preventDefault();
    setDraggingTableId(tbl.id);
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      setDragOffset({
        x: e.clientX - canvasRect.left - (tbl.pos_x || 0),
        y: e.clientY - canvasRect.top - (tbl.pos_y || 0),
      });
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!draggingTableId || activeSubtab !== "layout_builder") return;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      const newX = Math.max(10, Math.min(canvasRect.width - 120, e.clientX - canvasRect.left - dragOffset.x));
      const newY = Math.max(10, Math.min(canvasRect.height - 120, e.clientY - canvasRect.top - dragOffset.y));

      setTables((prev) =>
        prev.map((t) => (t.id === draggingTableId ? { ...t, pos_x: newX, pos_y: newY } : t))
      );
    }
  };

  const handleMouseUpCanvas = async () => {
    if (!draggingTableId || activeSubtab !== "layout_builder") return;
    const tbl = tables.find((t) => t.id === draggingTableId);
    if (tbl) {
      try {
        await updateTablePosition(tbl.id, tbl.pos_x || 0, tbl.pos_y || 0);
      } catch (err) {
        console.error("Failed to save table position", err);
      }
    }
    setDraggingTableId(null);
  };

  // ─── T-039: Staff Assignment Handlers ──────────────────────────────────────
  const handleAssignWaiterIndividual = async (tableId: string, waiterId: string) => {
    if (!currentUser) return;
    try {
      await assignWaiterToTable(tableId, waiterId || null, currentUser.id);
      setSuccess("Assigned staff to table.");
      refreshData();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleAssignWaiterBatchSection = async () => {
    if (!currentUser || !batchSection) return;
    try {
      await assignWaiterToSection(batchSection, batchWaiterId || null, currentUser.id);
      setSuccess(`Assigned staff to all tables in "${batchSection}".`);
      refreshData();
    } catch (err) {
      setError(String(err));
    }
  };

  // Helper for seated duration
  const getSeatedDuration = (createdAt?: string | null) => {
    if (!createdAt) return "";
    const min = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return `${min}m seated`;
  };

  if (loading) {
    return (
      <div className="card full-width-card">
        <p style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
          ⏳ Loading Floor Plan & Tables...
        </p>
      </div>
    );
  }

  return (
    <div className="card full-width-card">
      <div className="card-header-row">
        <div>
          <h4>Table & Floor Management System</h4>
          <p className="subtitle">Live interactive floor plan, layout editor, waiter assignments & table lifecycle</p>
        </div>
      </div>

      {/* Metrics Header Bar */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🪑</div>
          <div>
            <div className="stat-value">{metrics.total}</div>
            <div className="stat-label">Total Tables</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: "#1a7a4a" }}>🟢</div>
          <div>
            <div className="stat-value" style={{ color: "#1a7a4a" }}>{metrics.free}</div>
            <div className="stat-label">Free / Available</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: "#c0392b" }}>🔴</div>
          <div>
            <div className="stat-value" style={{ color: "#c0392b" }}>{metrics.occupied}</div>
            <div className="stat-label">Occupied</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: "#d97706" }}>🟡</div>
          <div>
            <div className="stat-value" style={{ color: "#d97706" }}>{metrics.needsCleaning}</div>
            <div className="stat-label">Needs Cleaning</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: "#1d4ed8" }}>🔵</div>
          <div>
            <div className="stat-value" style={{ color: "#1d4ed8" }}>{metrics.reserved}</div>
            <div className="stat-label">Reserved</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="pin-error" onClick={() => setError(null)}>
          {error} (click to dismiss)
        </div>
      )}
      {success && (
        <div className="success-banner" onClick={() => setSuccess(null)}>
          ✅ {success} (click to dismiss)
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="sub-nav-tabs">
        <button
          type="button"
          className={`sub-nav-tab ${activeSubtab === "live_floor" ? "active" : ""}`}
          onClick={() => setActiveSubtab("live_floor")}
        >
          🗺️ Live Floor Plan
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeSubtab === "layout_builder" ? "active" : ""}`}
          onClick={() => setActiveSubtab("layout_builder")}
        >
          ✏️ Floor Plan Builder & Editor
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeSubtab === "staff_assignment" ? "active" : ""}`}
          onClick={() => setActiveSubtab("staff_assignment")}
        >
          👥 Waiter & Section Assignment
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 1: LIVE FLOOR PLAN VIEW (T-038, T-040)                          */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubtab === "live_floor" && (
        <div>
          {/* Section Filter Pills */}
          <div className="card-header-row" style={{ marginTop: "14px", marginBottom: "16px" }}>
            <div className="filter-controls">
              <label style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Section:</label>
              <button
                type="button"
                className={`sub-nav-tab ${selectedSection === "ALL" ? "active" : ""}`}
                style={{ padding: "5px 12px", fontSize: "12px" }}
                onClick={() => setSelectedSection("ALL")}
              >
                All Sections ({tables.length})
              </button>
              {sections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`sub-nav-tab ${selectedSection === sec ? "active" : ""}`}
                  style={{ padding: "5px 12px", fontSize: "12px" }}
                  onClick={() => setSelectedSection(sec)}
                >
                  {sec} ({tables.filter((t) => (t.section || "General") === sec).length})
                </button>
              ))}
            </div>

            <button type="button" className="btn-secondary" onClick={refreshData}>
              🔄 Refresh Status
            </button>
          </div>

          {/* Interactive Live Floor Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "16px" }}>
            {filteredTables.map((tbl) => {
              const isFree = tbl.status === "FREE";
              const isOccupied = tbl.status === "OCCUPIED";
              const isCleaning = tbl.status === "NEEDS_CLEANING";
              const isReserved = tbl.status === "RESERVED";

              const borderColor = isFree
                ? "#1a7a4a"
                : isOccupied
                ? "#c0392b"
                : isCleaning
                ? "#d97706"
                : "#1d4ed8";

              const bgColor = isFree
                ? "#f0fdf4"
                : isOccupied
                ? "#fff1f0"
                : isCleaning
                ? "#fffbeb"
                : "#eff6ff";

              return (
                <div
                  key={tbl.id}
                  onClick={() => {
                    setSelectedTable(tbl);
                    setIsActionModalOpen(true);
                  }}
                  style={{
                    background: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: tbl.shape === "ROUND" ? "28px" : "16px",
                    padding: "16px",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                  className="floor-table-card"
                >
                  <div>
                    {/* Header Row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "800", fontSize: "18px", color: "var(--text-primary)" }}>
                        {tbl.number}
                      </span>
                      <span
                        className="status-badge"
                        style={{
                          fontSize: "10px",
                          background: isFree
                            ? "#edfaf4"
                            : isOccupied
                            ? "#fff1f0"
                            : isCleaning
                            ? "#fef3c7"
                            : "#dbeafe",
                          color: borderColor,
                        }}
                      >
                        {tbl.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* Subtitle / Section & Capacity */}
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                      📍 {tbl.section || "Main"} · 👥 {tbl.capacity} seats
                    </div>

                    {/* Live Seated Order Preview */}
                    {isOccupied && (
                      <div
                        style={{
                          background: "var(--card-bg)",
                          padding: "8px 10px",
                          borderRadius: "10px",
                          fontSize: "12px",
                          marginBottom: "8px",
                          border: "1px solid var(--border-light)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                          <span>Bill: ${(tbl.active_order_total || 0).toFixed(2)}</span>
                          <span style={{ color: "#c0392b" }}>
                            {getSeatedDuration(tbl.active_order_created_at)}
                          </span>
                        </div>
                        {tbl.customer_name && (
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                            Guest: {tbl.customer_name}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Needs Cleaning Prompt */}
                    {isCleaning && (
                      <div style={{ fontSize: "12px", color: "#b45309", fontStyle: "italic", marginBottom: "8px" }}>
                        ⚠️ Needs busing & wipe down
                      </div>
                    )}

                    {/* Assigned Waiter */}
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Server: <strong>{tbl.assigned_waiter_name || "Unassigned"}</strong>
                    </div>
                  </div>

                  {/* One-Tap Action Buttons */}
                  <div style={{ marginTop: "12px", display: "flex", gap: "6px" }}>
                    {isCleaning && (
                      <button
                        type="button"
                        className="btn-success btn-sm"
                        style={{ width: "100%", padding: "6px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkCleaned(tbl.id);
                        }}
                      >
                        ✨ Mark Cleaned
                      </button>
                    )}
                    {isFree && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        style={{ width: "100%", padding: "5px", fontSize: "11px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReserve(tbl.id);
                        }}
                      >
                        🔵 Reserve
                      </button>
                    )}
                    {isReserved && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        style={{ width: "100%", padding: "5px", fontSize: "11px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManualStatusChange(tbl.id, "FREE");
                        }}
                      >
                        🔓 Un-reserve
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 2: FLOOR PLAN BUILDER & 2D CANVAS (T-037)                       */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubtab === "layout_builder" && (
        <div style={{ marginTop: "14px" }}>
          <div className="card-header-row" style={{ marginBottom: "12px" }}>
            <div>
              <h5>Floor Plan Layout Canvas (Drag & Drop)</h5>
              <p className="subtitle">Drag tables to position them on the 2D floor plan. Positions are saved automatically.</p>
            </div>
            <button type="button" className="btn-primary" onClick={openAddTableModal}>
              + Add New Table
            </button>
          </div>

          {/* Interactive 2D Drag-and-Drop Canvas */}
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMoveCanvas}
            onMouseUp={handleMouseUpCanvas}
            style={{
              position: "relative",
              width: "100%",
              height: "560px",
              background: "#faf6f0",
              backgroundImage: "radial-gradient(#d6c8b8 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              border: "2px dashed var(--border-medium)",
              borderRadius: "18px",
              overflow: "hidden",
              userSelect: "none",
            }}
          >
            {tables.map((tbl) => {
              const isRound = tbl.shape === "ROUND";
              const isSelectedForDrag = draggingTableId === tbl.id;
              return (
                <div
                  key={tbl.id}
                  onMouseDown={(e) => handleMouseDownTable(e, tbl)}
                  style={{
                    position: "absolute",
                    left: `${tbl.pos_x || 40}px`,
                    top: `${tbl.pos_y || 40}px`,
                    width: isRound ? "100px" : "110px",
                    height: isRound ? "100px" : "80px",
                    borderRadius: isRound ? "50%" : "12px",
                    background: "var(--card-bg)",
                    border: isSelectedForDrag ? "2px solid var(--accent)" : "1.5px solid var(--border-medium)",
                    boxShadow: isSelectedForDrag
                      ? "0 10px 25px rgba(194, 105, 58, 0.35)"
                      : "0 2px 8px rgba(0,0,0,0.08)",
                    cursor: "grab",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "8px",
                    textAlign: "center",
                    zIndex: isSelectedForDrag ? 10 : 1,
                    transition: isSelectedForDrag ? "none" : "box-shadow 0.15s ease",
                  }}
                >
                  <strong style={{ fontSize: "15px", color: "var(--text-primary)" }}>{tbl.number}</strong>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>👥 {tbl.capacity}p</span>
                  <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                    <button
                      type="button"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", padding: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditTableModal(tbl);
                      }}
                      title="Edit Table"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", padding: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(tbl);
                      }}
                      title="Delete Table"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table List Table */}
          <div className="table-responsive" style={{ marginTop: "24px" }}>
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Table #</th>
                  <th>Section</th>
                  <th>Capacity</th>
                  <th>Shape</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((tbl) => (
                  <tr key={tbl.id}>
                    <td>
                      <strong>{tbl.number}</strong>
                    </td>
                    <td>{tbl.section || "General"}</td>
                    <td>{tbl.capacity} Seats</td>
                    <td>{tbl.shape}</td>
                    <td>
                      <span className="status-badge active">{tbl.status}</span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => openEditTableModal(tbl)}>
                          Edit
                        </button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => handleDeleteTable(tbl)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 3: WAITER & SECTION ASSIGNMENT (T-039)                          */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubtab === "staff_assignment" && (
        <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Section-Wide Quick Assignment */}
          <div className="sub-card">
            <h5>⚡ Quick Section Staff Assignment</h5>
            <p className="subtitle" style={{ marginBottom: "16px" }}>
              Assign a staff member / server to all tables located in a chosen section for this shift.
            </p>

            <div className="form-group">
              <label>Choose Section</label>
              <select value={batchSection} onChange={(e) => setBatchSection(e.target.value)}>
                {sections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec} ({tables.filter((t) => (t.section || "General") === sec).length} tables)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Assign Server / Staff</label>
              <select value={batchWaiterId} onChange={(e) => setBatchWaiterId(e.target.value)}>
                <option value="">Unassign / Clear Server</option>
                {waiters.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%", marginTop: "8px" }}
              onClick={handleAssignWaiterBatchSection}
            >
              Apply to All Tables in {batchSection}
            </button>
          </div>

          {/* Individual Table Assignment List */}
          <div className="sub-card">
            <h5>📋 Individual Table Assignments</h5>
            <p className="subtitle" style={{ marginBottom: "16px" }}>
              Set individual table servers.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "380px", overflowY: "auto" }}>
              {tables.map((tbl) => (
                <div
                  key={tbl.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "var(--card-bg)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "10px",
                  }}
                >
                  <div>
                    <strong>{tbl.number}</strong>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "6px" }}>
                      ({tbl.section || "Main"})
                    </span>
                  </div>

                  <select
                    value={tbl.assigned_waiter_id || ""}
                    onChange={(e) => handleAssignWaiterIndividual(tbl.id, e.target.value)}
                    style={{ padding: "4px 8px", fontSize: "12px", width: "160px" }}
                  >
                    <option value="">Unassigned</option>
                    {waiters.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: ADD / EDIT TABLE (T-037)                                       */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isAddEditModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "420px" }}>
            <h3>{editingTable ? `Edit Table ${editingTable.number}` : "Add New Table"}</h3>
            <form onSubmit={handleSaveTableForm}>
              <div className="form-group">
                <label>Table Number / Name</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. T1, Bar-1, Patio-A"
                  required
                />
              </div>

              <div className="form-group">
                <label>Seating Capacity</label>
                <select value={tableCapacity} onChange={(e) => setTableCapacity(parseInt(e.target.value))}>
                  <option value={2}>2 Guests</option>
                  <option value={4}>4 Guests</option>
                  <option value={6}>6 Guests</option>
                  <option value={8}>8 Guests</option>
                  <option value={10}>10 Guests</option>
                  <option value={12}>12+ Guests</option>
                </select>
              </div>

              <div className="form-group">
                <label>Section Area</label>
                <input
                  type="text"
                  value={tableSection}
                  onChange={(e) => setTableSection(e.target.value)}
                  placeholder="e.g. Main Hall, Terrace, Bar"
                  required
                />
              </div>

              <div className="form-group">
                <label>Table Shape</label>
                <select value={tableShape} onChange={(e) => setTableShape(e.target.value as TableShape)}>
                  <option value="RECTANGLE">Rectangle / Square</option>
                  <option value="ROUND">Round</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsAddEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: TABLE ACTION DRAWER / QUICK CONTROLS (T-038 & T-040)           */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isActionModalOpen && selectedTable && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "460px" }}>
            <h3>Table {selectedTable.number} Controls</h3>
            <p className="subtitle" style={{ marginBottom: "16px" }}>
              {selectedTable.section || "Main"} · {selectedTable.capacity} Seats ·{" "}
              Status: <strong style={{ color: "var(--accent)" }}>{selectedTable.status.replace("_", " ")}</strong>
            </p>

            {/* Active Order Details */}
            {selectedTable.status === "OCCUPIED" && (
              <div style={{ background: "#faf7f4", padding: "12px", borderRadius: "12px", marginBottom: "16px" }}>
                <h5 style={{ margin: "0 0 6px" }}>Current Seated Order</h5>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span>Order Total:</span>
                  <strong>${(selectedTable.active_order_total || 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginTop: "4px" }}>
                  <span>Seated Since:</span>
                  <span>{new Date(selectedTable.active_order_created_at || "").toLocaleTimeString()}</span>
                </div>
                {selectedTable.customer_name && (
                  <div style={{ fontSize: "13px", marginTop: "4px" }}>
                    Guest: <strong>{selectedTable.customer_name}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Manual Status Overrides */}
            <div className="form-group">
              <label>Set Table Status</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-success btn-sm"
                  onClick={() => handleManualStatusChange(selectedTable.id, "FREE")}
                >
                  🟢 Mark Free
                </button>
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  onClick={() => handleManualStatusChange(selectedTable.id, "OCCUPIED")}
                >
                  🔴 Mark Occupied
                </button>
                <button
                  type="button"
                  className="btn-warning btn-sm"
                  onClick={() => handleManualStatusChange(selectedTable.id, "NEEDS_CLEANING")}
                >
                  🟡 Needs Cleaning
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => handleManualStatusChange(selectedTable.id, "RESERVED")}
                >
                  🔵 Reserved
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setIsActionModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
