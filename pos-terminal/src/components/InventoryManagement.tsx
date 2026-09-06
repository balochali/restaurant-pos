import { useState, useEffect, useMemo, FormEvent } from "react";
import {
  DbInventoryItem,
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
} from "../lib/inventoryService";
import { useAuth } from "../store/useAuth";
import {
  IconInventory,
  IconAlert,
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconCheck,
  IconClose,
  IconCash,
} from "./Icons";

export default function InventoryManagement() {
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState<DbInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search and Category Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DbInventoryItem | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [unit, setUnit] = useState("pcs");
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minThreshold, setMinThreshold] = useState<number>(5);
  const [costPerUnit, setCostPerUnit] = useState<number>(0);
  const [formError, setFormError] = useState("");

  const refreshItems = async () => {
    try {
      setLoading(true);
      const data = await getInventoryItems();
      setItems(data);
    } catch (err) {
      setError("Failed to load inventory: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshItems();
  }, []);

  const categories = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.category || "General")));
    return list.sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === "ALL" || item.category === selectedCategory;
      const matchesLowStock = !onlyLowStock || item.current_stock <= item.min_threshold;
      return matchesSearch && matchesCat && matchesLowStock;
    });
  }, [items, searchQuery, selectedCategory, onlyLowStock]);

  const lowStockCount = useMemo(() => {
    return items.filter((i) => i.current_stock <= i.min_threshold).length;
  }, [items]);

  const totalStockValue = useMemo(() => {
    return items.reduce((acc, i) => acc + i.current_stock * (i.cost_per_unit || 0), 0);
  }, [items]);

  const openAddModal = () => {
    setEditingItem(null);
    setName("");
    setCategory("General");
    setUnit("pcs");
    setCurrentStock(10);
    setMinThreshold(5);
    setCostPerUnit(0);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: DbInventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setCurrentStock(item.current_stock);
    setMinThreshold(item.min_threshold);
    setCostPerUnit(item.cost_per_unit);
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!name.trim()) {
      setFormError("Item name is required.");
      return;
    }

    try {
      if (editingItem) {
        await updateInventoryItem(
          editingItem.id,
          {
            name,
            category,
            unit,
            current_stock: Number(currentStock),
            min_threshold: Number(minThreshold),
            cost_per_unit: Number(costPerUnit),
          },
          currentUser.id
        );
        setSuccess(`Updated "${name}" successfully.`);
      } else {
        await createInventoryItem(
          {
            name,
            category,
            unit,
            current_stock: Number(currentStock),
            min_threshold: Number(minThreshold),
            cost_per_unit: Number(costPerUnit),
          },
          currentUser.id
        );
        setSuccess(`Added "${name}" to inventory.`);
      }
      closeModal();
      await refreshItems();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setFormError(String(err));
    }
  };

  const handleQuickAdjust = async (id: string, delta: number, itemName: string) => {
    if (!currentUser) return;
    try {
      await adjustStock(id, delta, currentUser.id, "Quick stock adjustment");
      await refreshItems();
    } catch (err) {
      setError(`Failed to adjust stock for ${itemName}: ${String(err)}`);
    }
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (!currentUser) return;
    if (!confirm(`Are you sure you want to delete "${itemName}" from inventory?`)) return;

    try {
      await deleteInventoryItem(id, currentUser.id);
      setSuccess(`Deleted "${itemName}" from inventory.`);
      await refreshItems();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to delete item: " + String(err));
    }
  };

  return (
    <div className="card full-width-card" style={{ padding: "20px" }}>
      <div className="card-header-row" style={{ marginBottom: "16px" }}>
        <div>
          <h4>Inventory & Stock Control</h4>
          <p className="subtitle">Real-time restaurant ingredient tracking, low stock alerts & valuation</p>
        </div>
      </div>

      {/* Top Banner & Stats */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(108, 21, 30, 0.08)", color: "var(--primary)" }}>
            <IconInventory size={22} color="var(--primary)" />
          </div>
          <div>
            <div className="stat-value">{items.length}</div>
            <div className="stat-label">Total Stock Items</div>
          </div>
        </div>

        <div
          className="stat-card"
          style={{
            border: lowStockCount > 0 ? "1px solid rgba(217, 119, 6, 0.4)" : "1px solid var(--border-light)",
            background: lowStockCount > 0 ? "rgba(217, 119, 6, 0.04)" : "var(--card-bg)",
          }}
        >
          <div className="stat-icon" style={{ background: lowStockCount > 0 ? "rgba(217, 119, 6, 0.15)" : "rgba(15, 61, 58, 0.08)", color: lowStockCount > 0 ? "#D97706" : "var(--secondary)" }}>
            <IconAlert size={22} color={lowStockCount > 0 ? "#D97706" : "var(--secondary)"} />
          </div>
          <div>
            <div className="stat-value" style={{ color: lowStockCount > 0 ? "#D97706" : "var(--text-primary)" }}>
              {lowStockCount} {lowStockCount === 1 ? "Item" : "Items"}
            </div>
            <div className="stat-label">Low Stock Alert</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(15, 61, 58, 0.08)", color: "var(--secondary)" }}>
            <IconCash size={22} color="var(--secondary)" />
          </div>
          <div>
            <div className="stat-value" style={{ color: "var(--secondary)" }}>
              ${totalStockValue.toFixed(2)}
            </div>
            <div className="stat-label">Estimated Stock Value</div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="pin-error" style={{ marginBottom: "14px", cursor: "pointer" }} onClick={() => setError(null)}>
          <IconAlert size={16} /> {error} (click to dismiss)
        </div>
      )}
      {success && (
        <div className="success-banner" style={{ marginBottom: "14px", cursor: "pointer" }} onClick={() => setSuccess(null)}>
          <IconCheck size={16} /> {success} (click to dismiss)
        </div>
      )}

      {/* Controls: Search, Categories, Low-stock toggle, Add button */}
      <div style={{ background: "var(--surface-warm)", padding: "16px", borderRadius: "14px", border: "1px solid var(--border-light)", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
            <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
              <IconSearch size={16} />
            </div>
            <input
              type="text"
              placeholder="Search ingredient or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", paddingLeft: "36px" }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className={`btn-secondary ${onlyLowStock ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                borderColor: onlyLowStock ? "var(--primary)" : "var(--border-light)",
                background: onlyLowStock ? "rgba(108, 21, 30, 0.1)" : "var(--card-bg)",
                color: onlyLowStock ? "var(--primary)" : "var(--text-primary)",
                fontWeight: onlyLowStock ? "bold" : "normal",
              }}
              onClick={() => setOnlyLowStock(!onlyLowStock)}
            >
              <IconAlert size={15} color={onlyLowStock ? "var(--primary)" : "currentColor"} />
              Low Stock Only ({lowStockCount})
            </button>

            <button
              type="button"
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
              onClick={openAddModal}
            >
              <IconPlus size={16} /> Add Inventory Item
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
          <button
            type="button"
            className={`sub-nav-tab ${selectedCategory === "ALL" ? "active" : ""}`}
            style={{ padding: "4px 12px", fontSize: "12px" }}
            onClick={() => setSelectedCategory("ALL")}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`sub-nav-tab ${selectedCategory === cat ? "active" : ""}`}
              style={{ padding: "4px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Items Table */}
      <div className="table-responsive" style={{ border: "1px solid var(--border-light)", borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <IconInventory size={32} color="var(--primary)" />
            <p style={{ marginTop: "8px" }}>Loading inventory data...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <IconInventory size={40} color="var(--text-muted)" />
            <h4 style={{ marginTop: "12px" }}>No Inventory Items Found</h4>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              {searchQuery || selectedCategory !== "ALL" || onlyLowStock
                ? "Try adjusting your search query or category filters."
                : 'Click "+ Add Inventory Item" to start tracking restaurant stock.'}
            </p>
          </div>
        ) : (
          <table className="staff-table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Item Name</th>
                <th style={{ textAlign: "left" }}>Category</th>
                <th style={{ textAlign: "center" }}>Unit</th>
                <th style={{ textAlign: "center" }}>Current Stock</th>
                <th style={{ textAlign: "center" }}>Min Alert</th>
                <th style={{ textAlign: "right" }}>Cost / Unit</th>
                <th style={{ textAlign: "center" }}>Quick Stock Adjust</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isLow = item.current_stock <= item.min_threshold;
                return (
                  <tr
                    key={item.id}
                    style={{
                      background: isLow ? "rgba(217, 119, 6, 0.06)" : "inherit",
                    }}
                  >
                    <td style={{ fontWeight: "700" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>{item.name}</span>
                        {isLow && (
                          <span
                            className="status-badge"
                            style={{
                              fontSize: "10px",
                              background: "rgba(217, 119, 6, 0.15)",
                              color: "#B45309",
                              border: "1px solid rgba(217, 119, 6, 0.3)",
                            }}
                          >
                            LOW STOCK
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="role-pill" style={{ background: "var(--cream)", color: "var(--primary)", fontWeight: "600" }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      {item.unit}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: "800",
                          color: isLow ? "#B45309" : "var(--secondary)",
                        }}
                      >
                        {item.current_stock}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      {item.min_threshold} {item.unit}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "600" }}>
                      ${Number(item.cost_per_unit || 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "4px" }}>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                          onClick={() => handleQuickAdjust(item.id, -1, item.name)}
                          title="Deduct 1"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                          onClick={() => handleQuickAdjust(item.id, 1, item.name)}
                          title="Add 1"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                          onClick={() => handleQuickAdjust(item.id, 5, item.name)}
                          title="Add 5"
                        >
                          +5
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="action-buttons" style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => openEditModal(item)}
                          title="Edit Item"
                        >
                          <IconEdit size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          onClick={() => handleDelete(item.id, item.name)}
                          title="Delete Item"
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Inventory Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>{editingItem ? "Edit Inventory Item" : "Add Inventory Item"}</h3>
              <button
                type="button"
                onClick={closeModal}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <IconClose size={20} />
              </button>
            </div>

            {formError && <div className="pin-error" style={{ marginBottom: "12px" }}>{formError}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Burger Buns, Whole Milk, Wagyu Beef"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Meat, Bakery, Dairy"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Unit of Measure</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="grams">Grams (g)</option>
                    <option value="liters">Liters (L)</option>
                    <option value="portions">Portions</option>
                    <option value="pack">Pack / Box</option>
                    <option value="cans">Cans / Bottles</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label>Current Stock</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={currentStock}
                    onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group">
                  <label>Min Alert Threshold</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Cost per Unit ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: "20px" }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <IconCheck size={16} /> {editingItem ? "Update Item" : "Add to Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
