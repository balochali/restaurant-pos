import { useState, useEffect, FormEvent } from "react";
import {
  DbCategory,
  DbMenuItem,
  DbModifier,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategory,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleItemAvailability,
  getItemVariants,
  saveVariantsForMenuItem,
  getAllModifiers,
  createModifier,
  getItemModifierIds,
  saveModifiersForMenuItem,
  getComboComponents,
  saveComboComponents,
  isItemInTimeWindow,
} from "../lib/menuService";
import { useAuth } from "../store/useAuth";

type MenuTab = "categories" | "items" | "variants_modifiers" | "combos";

export default function MenuManagement() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<MenuTab>("items");

  // Global State
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [items, setItems] = useState<DbMenuItem[]>([]);
  const [modifiers, setModifiers] = useState<DbModifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ─── DATA REFRESH ────────────────────────────────────────────────────────

  const refreshAllData = () => {
    setLoading(true);
    Promise.all([getCategories(), getMenuItems(), getAllModifiers()])
      .then(([catData, itemData, modData]) => {
        setCategories(catData);
        setItems(itemData);
        setModifiers(modData);
      })
      .catch((err) => setError("Failed to load menu data: " + String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([getCategories(), getMenuItems(), getAllModifiers()])
      .then(([catData, itemData, modData]) => {
        if (isMounted) {
          setCategories(catData);
          setItems(itemData);
          setModifiers(modData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError("Failed to load menu data: " + String(err));
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // ─── T-022: CATEGORIES STATE & HANDLERS ──────────────────────────────────
  const [catName, setCatName] = useState("");
  const [catIsActive, setCatIsActive] = useState<number>(1);
  const [editingCategory, setEditingCategory] = useState<DbCategory | null>(null);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !catName.trim()) return;

    try {
      if (editingCategory) {
        await updateCategory(
          editingCategory.id,
          catName,
          catIsActive,
          currentUser.id,
        );
        setSuccess(`Category "${catName}" updated.`);
      } else {
        const newCat = await createCategory(catName, currentUser.id);
        if (catIsActive === 0) {
          await updateCategory(newCat.id, newCat.name, 0, currentUser.id);
        }
        setSuccess(`Category "${catName}" created.`);
      }
      setIsCatModalOpen(false);
      setCatName("");
      setCatIsActive(1);
      setEditingCategory(null);
      refreshAllData();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleToggleCategoryStatus = async (category: DbCategory) => {
    if (!currentUser) return;
    try {
      const newStatus = category.is_active === 1 ? 0 : 1;
      await updateCategory(category.id, category.name, newStatus, currentUser.id);
      setSuccess(`Category "${category.name}" ${newStatus === 1 ? "activated" : "disabled"}.`);
      refreshAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReorderCategory = async (
    id: string,
    dir: "up" | "down",
  ) => {
    if (!currentUser) return;

    try {
      await reorderCategory(id, dir, currentUser.id);

      setSuccess(
        `Category moved ${dir === "up" ? "up" : "down"} successfully.`,
      );

      refreshAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!currentUser) return;
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await deleteCategory(id, currentUser.id);
      setSuccess("Category deleted.");
      refreshAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // ─── T-023: MENU ITEMS STATE & HANDLERS ───────────────────────────────────
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DbMenuItem | null>(null);

  const [itemName, setItemName] = useState("");
  const [itemCatId, setItemCatId] = useState("");
  const [itemPrice, setItemPrice] = useState("8.99");
  const [itemTax, setItemTax] = useState("0.08");
  const [itemDesc, setItemDesc] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [itemAvailable, setItemAvailable] = useState(1);
  const [itemIsCombo, setItemIsCombo] = useState(0);
  const [itemAvailableFrom, setItemAvailableFrom] = useState("");
  const [itemAvailableUntil, setItemAvailableUntil] = useState("");

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setItemImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddItemModal = () => {
    setEditingItem(null);
    setItemName("");
    setItemCatId(categories[0]?.id || "");
    setItemPrice("8.99");
    setItemTax("0.08");
    setItemDesc("");
    setItemImage("");
    setItemAvailable(1);
    setItemIsCombo(0);
    setItemAvailableFrom("");
    setItemAvailableUntil("");
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: DbMenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCatId(item.category_id);
    setItemPrice(item.base_price.toString());
    setItemTax(item.tax_rate.toString());
    setItemDesc(item.description || "");
    setItemImage(item.image_url || "");
    setItemAvailable(item.is_available);
    setItemIsCombo(item.is_combo || 0);
    setItemAvailableFrom(item.available_from || "");
    setItemAvailableUntil(item.available_until || "");
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !itemName.trim() || !itemCatId) return;

    try {
      const payload = {
        category_id: itemCatId,
        name: itemName,
        description: itemDesc,
        base_price: parseFloat(itemPrice) || 0,
        tax_rate: parseFloat(itemTax) || 0,
        is_available: itemAvailable,
        is_combo: itemIsCombo,
        image_url: itemImage.trim() || undefined,
        available_from: itemAvailableFrom.trim() || undefined,
        available_until: itemAvailableUntil.trim() || undefined,
      };

      if (editingItem) {
        await updateMenuItem(editingItem.id, payload, currentUser.id);
        setSuccess(`Item "${itemName}" updated.`);
      } else {
        await createMenuItem(payload, currentUser.id);
        setSuccess(`Item "${itemName}" created.`);
      }
      setIsItemModalOpen(false);
      refreshAllData();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleToggleAvailable = async (item: DbMenuItem) => {
    if (!currentUser) return;
    const newStatus = item.is_available === 1 ? false : true;
    await toggleItemAvailability(item.id, newStatus, currentUser.id);
    refreshAllData();
  };

  const handleDeleteItem = async (item: DbMenuItem) => {
    if (!currentUser) return;
    if (!confirm(`Delete menu item "${item.name}"?`)) return;
    await deleteMenuItem(item.id, currentUser.id);
    setSuccess(`Deleted "${item.name}".`);
    refreshAllData();
  };

  // ─── T-024 & T-025: VARIANTS & MODIFIERS STATE & HANDLERS ──────────────────
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [variants, setVariants] = useState<{ name: string; price: number }[]>([]);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [newModName, setNewModName] = useState("");
  const [newModPrice, setNewModPrice] = useState("1.50");

  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) return;
    let isMounted = true;
    Promise.all([getItemVariants(selectedItemId), getItemModifierIds(selectedItemId)]).then(
      ([varData, modIdData]) => {
        if (isMounted) {
          setVariants(varData.map((v) => ({ name: v.name, price: v.price })));
          setSelectedModifierIds(modIdData);
        }
      },
    );
    return () => {
      isMounted = false;
    };
  }, [selectedItemId]);

  const handleAddVariantRow = () => {
    setVariants([...variants, { name: "", price: 1.0 }]);
  };

  const handleRemoveVariantRow = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleSaveVariantsAndModifiers = async () => {
    if (!selectedItemId) return;
    try {
      await saveVariantsForMenuItem(selectedItemId, variants);
      await saveModifiersForMenuItem(selectedItemId, selectedModifierIds);
      setSuccess("Variants and modifiers updated successfully for selected item.");
      refreshAllData();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleCreateNewModifier = async (e: FormEvent) => {
    e.preventDefault();
    if (!newModName.trim()) return;
    try {
      const created = await createModifier(newModName, parseFloat(newModPrice) || 0);
      setSuccess(`Modifier "${created.name}" created.`);
      setNewModName("");
      setSelectedModifierIds([...selectedModifierIds, created.id]);
      refreshAllData();
    } catch (err) {
      setError(String(err));
    }
  };

  // ─── T-026: COMBO BUILDER STATE & HANDLERS ─────────────────────────────────
  const [selectedComboParentId, setSelectedComboParentId] = useState<string>("");
  const [comboComponents, setComboComponents] = useState<
    { child_item_id: string; quantity: number }[]
  >([]);

  const comboEligibleParents = items;

  useEffect(() => {
    if (comboEligibleParents.length > 0 && !selectedComboParentId) {
      setSelectedComboParentId(comboEligibleParents[0].id);
    }
  }, [comboEligibleParents, selectedComboParentId]);

  useEffect(() => {
    if (!selectedComboParentId) return;
    let isMounted = true;
    getComboComponents(selectedComboParentId).then((comps) => {
      if (isMounted) {
        setComboComponents(
          comps.map((c) => ({ child_item_id: c.child_item_id, quantity: c.quantity })),
        );
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedComboParentId]);

  const handleAddComboComponentRow = () => {
    const firstNonSelf = items.find((i) => i.id !== selectedComboParentId);
    if (!firstNonSelf) return;
    setComboComponents([...comboComponents, { child_item_id: firstNonSelf.id, quantity: 1 }]);
  };

  const handleRemoveComboComponentRow = (index: number) => {
    setComboComponents(comboComponents.filter((_, i) => i !== index));
  };

  const handleSaveCombo = async () => {
    if (!selectedComboParentId) return;
    try {
      await saveComboComponents(selectedComboParentId, comboComponents);
      setSuccess("Combo bundle composition saved successfully.");
      refreshAllData();
    } catch (err) {
      setError(String(err));
    }
  };

  const filteredMenuItems = items.filter((item) => {
    if (selectedCategoryFilter === "ALL") return true;
    return item.category_id === selectedCategoryFilter;
  });

  return (
    <div className="card full-width-card">
      <div className="card-header-row">
        <div>
          <h4>Menu Management System (FR-2.1 → FR-2.5)</h4>
          <p className="subtitle">Categories, Menu Items, Variants, Modifiers, and Combo Builder</p>
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
          className={`sub-nav-tab ${activeTab === "items" ? "active" : ""}`}
          onClick={() => setActiveTab("items")}
        >
          🍔 Menu Items (FR-2.2)
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          📂 Categories (FR-2.1)
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeTab === "variants_modifiers" ? "active" : ""}`}
          onClick={() => setActiveTab("variants_modifiers")}
        >
          📏 Variants & Modifiers (FR-2.3 & 2.4)
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeTab === "combos" ? "active" : ""}`}
          onClick={() => setActiveTab("combos")}
        >
          🎁 Combo Builder (FR-2.5)
        </button>
      </div>

      {loading ? (
        <p>Loading menu management data...</p>
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 1: MENU ITEMS (T-023)                                       */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "items" && (
            <div>
              <div className="card-header-row" style={{ marginTop: "16px" }}>
                <div className="filter-controls">
                  <label style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    Category Filter:
                  </label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  >
                    <option value="ALL">All Categories ({items.length})</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button type="button" className="btn-primary" onClick={openAddItemModal}>
                  + Add Menu Item
                </button>
              </div>

              <div className="menu-items-grid">
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    className={`menu-item-card ${item.is_available === 0 ? "item-disabled" : ""}`}
                  >
                    <div className="item-card-header">
                      <span className="item-category-tag">
                        {item.category_name || "Uncategorized"}
                      </span>
                      {item.is_combo === 1 && <span className="combo-badge">🎁 Combo</span>}
                      {item.available_from && item.available_until && (
                        <span
                          className="combo-badge"
                          style={{
                            backgroundColor: isItemInTimeWindow(item) ? "#059669" : "#d97706",
                          }}
                        >
                          ⏰ {item.available_from} – {item.available_until}
                          {!isItemInTimeWindow(item) && " (Closed)"}
                        </span>
                      )}
                    </div>

                    {item.image_url && (
                      <div style={{ margin: "10px 0", borderRadius: "10px", overflow: "hidden", height: "120px" }}>
                        <img
                          src={item.image_url}
                          alt={item.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    )}

                    <h5 className="item-title">{item.name}</h5>
                    <p className="item-desc">{item.description || "No description available."}</p>

                    <div className="item-pricing">
                      <span className="base-price">${item.base_price.toFixed(2)}</span>
                      <span className="tax-tag">+{(item.tax_rate * 100).toFixed(0)}% Tax</span>
                    </div>

                    <div className="item-actions">
                      <button
                        type="button"
                        className={`btn-sm ${item.is_available === 1 ? "btn-success" : "btn-warning"}`}
                        onClick={() => handleToggleAvailable(item)}
                      >
                        {item.is_available === 1 ? "In Stock" : "Sold Out"}
                      </button>

                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setActiveTab("variants_modifiers");
                        }}
                      >
                        📏 Variants
                      </button>

                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => openEditItemModal(item)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => handleDeleteItem(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 2: CATEGORIES (T-022)                                       */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "categories" && (
            <div>
              <div className="card-header-row" style={{ marginTop: "16px" }}>
                <h5>Menu Categories ({categories.length})</h5>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setEditingCategory(null);
                    setCatName("");
                    setCatIsActive(1);
                    setIsCatModalOpen(true);
                  }}
                >
                  + Add Category
                </button>
              </div>

              <div className="table-responsive">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Display Order</th>
                      <th>Category Name</th>
                      <th>Status</th>
                      <th>Reorder</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat, idx) => (
                      <tr key={cat.id}>
                        <td>
                          <code>#{cat.display_order}</code>
                        </td>
                        <td>
                          <strong>{cat.name}</strong>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${cat.is_active === 1 ? "active" : "inactive"}`}
                          >
                            {cat.is_active === 1 ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={idx === 0}
                              onClick={() => handleReorderCategory(cat.id, "up")}
                            >
                              ▲ Up
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={idx === categories.length - 1}
                              onClick={() => handleReorderCategory(cat.id, "down")}
                            >
                              ▼ Down
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className={`btn-sm ${cat.is_active === 1 ? "btn-warning" : "btn-success"}`}
                              onClick={() => handleToggleCategoryStatus(cat)}
                            >
                              {cat.is_active === 1 ? "Disable" : "Activate"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => {
                                setEditingCategory(cat);
                                setCatName(cat.name);
                                setCatIsActive(cat.is_active);
                                setIsCatModalOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              onClick={() => handleDeleteCategory(cat.id)}
                            >
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

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 3: VARIANTS & MODIFIERS (T-024 & T-025)                     */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "variants_modifiers" && (
            <div className="variants-modifiers-section">
              <div className="form-group" style={{ maxWidth: "400px", marginTop: "16px" }}>
                <label>Select Target Menu Item:</label>
                <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (${i.base_price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="two-column-layout">
                {/* Variants Column (T-024) */}
                <div className="sub-card">
                  <h5>📏 Item Variants (Sizes / Options - T-024)</h5>
                  <p className="subtitle">e.g. Small ($1.99), Medium ($2.99), Large ($3.99)</p>

                  <div className="variant-list">
                    {variants.map((v, idx) => (
                      <div key={idx} className="variant-row">
                        <input
                          type="text"
                          placeholder="Variant Name (e.g. Small)"
                          value={v.name}
                          onChange={(e) => {
                            const updated = [...variants];
                            updated[idx].name = e.target.value;
                            setVariants(updated);
                          }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={v.price}
                          onChange={(e) => {
                            const updated = [...variants];
                            updated[idx].price = parseFloat(e.target.value) || 0;
                            setVariants(updated);
                          }}
                        />
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          onClick={() => handleRemoveVariantRow(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    style={{ marginTop: "12px" }}
                    onClick={handleAddVariantRow}
                  >
                    + Add Variant Option
                  </button>
                </div>

                {/* Modifiers Column (T-025) */}
                <div className="sub-card">
                  <h5>🧂 Attach Modifiers & Add-ons (T-025)</h5>
                  <p className="subtitle">Check modifiers available for this item</p>

                  <div className="modifier-checklist">
                    {modifiers.map((m) => {
                      const isChecked = selectedModifierIds.includes(m.id);
                      return (
                        <label key={m.id} className="modifier-checkbox-label">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedModifierIds([...selectedModifierIds, m.id]);
                              } else {
                                setSelectedModifierIds(
                                  selectedModifierIds.filter((id) => id !== m.id),
                                );
                              }
                            }}
                          />
                          <span>
                            {m.name}{" "}
                            <strong style={{ color: "#818cf8" }}>
                              (+${m.price_adjustment.toFixed(2)})
                            </strong>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Create New Modifier inline */}
                  <form onSubmit={handleCreateNewModifier} className="inline-modifier-form">
                    <input
                      type="text"
                      placeholder="New modifier (e.g. Extra Jalapenos)"
                      value={newModName}
                      onChange={(e) => setNewModName(e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="+$"
                      value={newModPrice}
                      style={{ width: "80px" }}
                      onChange={(e) => setNewModPrice(e.target.value)}
                    />
                    <button type="submit" className="btn-secondary btn-sm">
                      + Create Modifier
                    </button>
                  </form>
                </div>
              </div>

              <div style={{ marginTop: "24px" }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveVariantsAndModifiers}
                >
                  💾 Save Variants & Modifiers for Selected Item
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 4: COMBO BUILDER (T-026)                                   */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "combos" && (
            <div className="combo-builder-section">
              <div className="form-group" style={{ maxWidth: "400px", marginTop: "16px" }}>
                <label>Select Parent Bundle/Combo Item:</label>
                <select
                  value={selectedComboParentId}
                  onChange={(e) => setSelectedComboParentId(e.target.value)}
                >
                  {comboEligibleParents.map((i) => (
                    <option key={i.id} value={i.id}>
                      🎁 {i.name} (Bundled Base Price: ${i.base_price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sub-card">
                <h5>Compose Combo Components</h5>
                <p className="subtitle">
                  Select the individual menu items and quantities included in this bundle
                </p>

                <div className="combo-components-list">
                  {comboComponents.map((comp, idx) => (
                    <div key={idx} className="variant-row">
                      <select
                        value={comp.child_item_id}
                        onChange={(e) => {
                          const updated = [...comboComponents];
                          updated[idx].child_item_id = e.target.value;
                          setComboComponents(updated);
                        }}
                      >
                        {items
                          .filter((i) => i.id !== selectedComboParentId)
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} (${i.base_price.toFixed(2)})
                            </option>
                          ))}
                      </select>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px" }}>Qty:</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={comp.quantity}
                          style={{ width: "70px" }}
                          onChange={(e) => {
                            const updated = [...comboComponents];
                            updated[idx].quantity = parseInt(e.target.value) || 1;
                            setComboComponents(updated);
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => handleRemoveComboComponentRow(idx)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{ marginTop: "12px" }}
                  onClick={handleAddComboComponentRow}
                >
                  + Add Component Item to Combo
                </button>
              </div>

              <div style={{ marginTop: "24px" }}>
                <button type="button" className="btn-primary" onClick={handleSaveCombo}>
                  💾 Save Combo Bundle Composition
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Dialog for Category Add/Edit */}
      {isCatModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>{editingCategory ? "Edit Category" : "Add Menu Category"}</h3>
            <form onSubmit={handleAddCategory}>
              <div className="form-group">
                <label>Category Name</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Appetizers"
                  required
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={catIsActive}
                  onChange={(e) => setCatIsActive(parseInt(e.target.value))}
                >
                  <option value={1}>Active</option>
                  <option value={0}>Disabled</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCatModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog for Menu Item Add/Edit */}
      {isItemModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</h3>
            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label>Item Name</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Deluxe Cheeseburger"
                  required
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select value={itemCatId} onChange={(e) => setItemCatId(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label>Base Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Tax Rate (e.g. 0.08 for 8%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemTax}
                    onChange={(e) => setItemTax(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Brief ingredients or item summary"
                />
              </div>

              <div className="form-group">
                <label>Item Image (URL or Local File Upload)</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={itemImage}
                    onChange={(e) => setItemImage(e.target.value)}
                    placeholder="https://... or upload local file"
                    style={{ flex: 1 }}
                  />
                  <label
                    className="btn-secondary btn-sm"
                    style={{ cursor: "pointer", margin: 0, padding: "8px 12px", whiteSpace: "nowrap" }}
                  >
                    📁 Upload File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                {itemImage && (
                  <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <img
                      src={itemImage}
                      alt="Preview"
                      style={{
                        width: "50px",
                        height: "50px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid var(--border-medium)",
                      }}
                    />
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                      onClick={() => setItemImage("")}
                    >
                      Clear Image
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label>Available From Time (optional)</label>
                  <input
                    type="time"
                    value={itemAvailableFrom}
                    onChange={(e) => setItemAvailableFrom(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Available Until Time (optional)</label>
                  <input
                    type="time"
                    value={itemAvailableUntil}
                    onChange={(e) => setItemAvailableUntil(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "20px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={itemAvailable === 1}
                    onChange={(e) => setItemAvailable(e.target.checked ? 1 : 0)}
                  />
                  In Stock & Available
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={itemIsCombo === 1}
                    onChange={(e) => setItemIsCombo(e.target.checked ? 1 : 0)}
                  />
                  Is Combo Bundle Item
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsItemModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingItem ? "Save Changes" : "Create Menu Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
