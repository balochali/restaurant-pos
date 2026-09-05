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
    <div className="dashboard-content" style={{ padding: "0 4px" }}>
      {/* Top Banner & Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "16px" }}>
        <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "28px", background: "#f0f4ff", padding: "10px", borderRadius: "8px" }}>📦</div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Items</div>
            <div style={{ fontSize: "22px", fontWeight: "bold" }}>{items.length}</div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            border: lowStockCount > 0 ? "1px solid #ffcc80" : "1px solid var(--border-color)",
            background: lowStockCount > 0 ? "#fff8e1" : "inherit",
          }}
        >
          <div style={{ fontSize: "28px", background: "#ffebee", padding: "10px", borderRadius: "8px" }}>⚠️</div>
          <div>
            <div style={{ fontSize: "12px", color: lowStockCount > 0 ? "#b71c1c" : "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>
              Low Stock Alert
            </div>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: lowStockCount > 0 ? "#c62828" : "inherit" }}>
              {lowStockCount} {lowStockCount === 1 ? "Item" : "Items"}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "28px", background: "#e8f5e9", padding: "10px", borderRadius: "8px" }}>💰</div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>Estimated Stock Value</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#2e7d32" }}>
              ${totalStockValue.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="error-banner" style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}
      {success && (
        <div className="success-banner" style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Controls: Search, Categories, Low-stock toggle, Add button */}
      <div className="card" style={{ padding: "16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "260px" }}>
            <input
              type="text"
              placeholder="🔍 Search inventory item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className={`btn-secondary ${onlyLowStock ? "active" : ""}`}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: onlyLowStock ? "#ff5722" : "inherit",
                color: onlyLowStock ? "#fff" : "inherit",
                border: "1px solid #ccc",
                cursor: "pointer",
                fontWeight: onlyLowStock ? "bold" : "normal",
              }}
              onClick={() => setOnlyLowStock(!onlyLowStock)}
            >
              ⚠️ Low Stock Only ({lowStockCount})
            </button>

            <button
              type="button"
              className="btn-primary"
              style={{ padding: "8px 16px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
              onClick={openAddModal}
            >
              ➕ Add Inventory Item
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
          <button
            type="button"
            className={`btn-secondary ${selectedCategory === "ALL" ? "active" : ""}`}
            style={{
              padding: "4px 12px",
              borderRadius: "16px",
              fontSize: "13px",
              background: selectedCategory === "ALL" ? "var(--primary-color, #e65100)" : "#f0f0f0",
              color: selectedCategory === "ALL" ? "#fff" : "#333",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => setSelectedCategory("ALL")}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`btn-secondary ${selectedCategory === cat ? "active" : ""}`}
              style={{
                padding: "4px 12px",
                borderRadius: "16px",
                fontSize: "13px",
                background: selectedCategory === cat ? "var(--primary-color, #e65100)" : "#f0f0f0",
                color: selectedCategory === cat ? "#fff" : "#333",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Items Table */}
      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>Loading inventory items...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>📦</div>
            <h4>No Inventory Items Found</h4>
            <p style={{ fontSize: "14px", marginTop: "4px" }}>
              {searchQuery || selectedCategory !== "ALL" || onlyLowStock
                ? "Try adjusting your search or category filters."
                : 'Click "+ Add Inventory Item" to start tracking restaurant stock.'}
            </p>
          </div>
        ) : (
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary, #f8f9fa)", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Item Name</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Category</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Unit</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Stock Level</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Min Alert</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Cost / Unit</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Quick Adjust</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isLow = item.current_stock <= item.min_threshold;
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      background: isLow ? "#fffaf0" : "inherit",
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: "bold" }}>
                      {item.name}
                      {isLow && (
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "11px",
                            background: "#ffebee",
                            color: "#c62828",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            border: "1px solid #ffcdd2",
                          }}
                        >
                          ⚠️ LOW STOCK
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className="role-pill" style={{ background: "#eef2ff", color: "#3730a3" }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                      {item.unit}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: "bold",
                          color: isLow ? "#c62828" : "#2e7d32",
                        }}
                      >
                        {item.current_stock}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                      {item.min_threshold} {item.unit}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      ${Number(item.cost_per_unit || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "4px" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                          onClick={() => handleQuickAdjust(item.id, -1, item.name)}
                          title="Deduct 1"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                          onClick={() => handleQuickAdjust(item.id, 1, item.name)}
                          title="Add 1"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                          onClick={() => handleQuickAdjust(item.id, 5, item.name)}
                          title="Add 5"
                        >
                          +5
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                          onClick={() => openEditModal(item)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                          onClick={() => handleDelete(item.id, item.name)}
                        >
                          🗑️
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
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>{editingItem ? "✏️ Edit Inventory Item" : "➕ Add Inventory Item"}</h3>
              <button type="button" className="btn-close" onClick={closeModal}>✕</button>
            </div>

            {formError && <div className="error-banner" style={{ marginBottom: "12px" }}>{formError}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Burger Buns, Milk, Beef Patties"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Meat, Bakery, Dairy"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Unit of Measure</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Current Stock</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={currentStock}
                    onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Min Alert Threshold</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(parseFloat(e.target.value) || 0)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Cost per Unit ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingItem ? "💾 Update Item" : "➕ Add to Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
