import { useState, useEffect, useMemo, FormEvent } from "react";
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
  deleteModifier,
  getItemModifierIds,
  saveModifiersForMenuItem,
  getComboComponents,
  saveComboComponents,
  isItemInTimeWindow,
  isCategoryInTimeWindow,
} from "../lib/menuService";
import { formatCurrency } from "../lib/formatCurrency";
import { useAuth } from "../store/useAuth";
import {
  IconMenu,
  IconPlus,
  IconEdit,
  IconCheck,
  IconAlert,
  IconSearch,
  IconUtensils,
  IconTrash,
  IconClock,
} from "./Icons";

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

  // ─── T-022 & T-028: CATEGORIES STATE & HANDLERS ──────────────────────────
  const [catName, setCatName] = useState("");
  const [catImage, setCatImage] = useState("");
  const [catIsActive, setCatIsActive] = useState<number>(1);
  const [catFrom, setCatFrom] = useState("");
  const [catUntil, setCatUntil] = useState("");
  const [editingCategory, setEditingCategory] = useState<DbCategory | null>(null);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  const handleCategoryImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Choose an image smaller than 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCatImage(reader.result);
        setError("");
      }
    };
    reader.onerror = () => setError("The selected image could not be read.");
    reader.readAsDataURL(file);
  };

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
          catFrom.trim() || undefined,
          catUntil.trim() || undefined,
          catImage.trim() || undefined,
        );
        setSuccess(`Category "${catName}" updated.`);
      } else {
        const newCat = await createCategory(
          catName,
          currentUser.id,
          catFrom.trim() || undefined,
          catUntil.trim() || undefined,
          catImage.trim() || undefined,
        );
        if (catIsActive === 0) {
          await updateCategory(
            newCat.id,
            newCat.name,
            0,
            currentUser.id,
            catFrom.trim() || undefined,
            catUntil.trim() || undefined,
            catImage.trim() || undefined,
          );
        }
        setSuccess(`Category "${catName}" created.`);
      }
      setIsCatModalOpen(false);
      setCatName("");
      setCatImage("");
      setCatIsActive(1);
      setCatFrom("");
      setCatUntil("");
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
      await updateCategory(
        category.id,
        category.name,
        newStatus,
        currentUser.id,
        category.available_from,
        category.available_until,
        category.image_url,
      );
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

  const openAddCategoryModal = () => {
    setEditingCategory(null);
    setCatName("");
    setCatImage("");
    setCatIsActive(1);
    setCatFrom("");
    setCatUntil("");
    setIsCatModalOpen(true);
  };

  const openEditCategoryModal = (cat: DbCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatImage(cat.image_url || "");
    setCatIsActive(cat.is_active);
    setCatFrom(cat.available_from || "");
    setCatUntil(cat.available_until || "");
    setIsCatModalOpen(true);
  };

  // ─── T-023 & T-027: MENU ITEMS STATE & HANDLERS ───────────────────────────
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState<"ALL" | "IN_STOCK" | "SOLD_OUT">("ALL");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DbMenuItem | null>(null);

  const [itemName, setItemName] = useState("");
  const [itemCatId, setItemCatId] = useState("");
  const [itemPrice, setItemPrice] = useState("450");
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
    setItemPrice("450");
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
  const [newModPrice, setNewModPrice] = useState("50");

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
    setVariants([...variants, { name: "", price: 150 }]);
  };

  const handleRemoveVariantRow = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleSaveVariantsAndModifiers = async () => {
    if (!selectedItemId) return;
    try {
      await saveVariantsForMenuItem(selectedItemId, variants);
      await saveModifiersForMenuItem(selectedItemId, selectedModifierIds, currentUser?.id);
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
      const created = await createModifier(
        newModName,
        parseFloat(newModPrice) || 0,
        currentUser?.id,
      );
      setSuccess(`Modifier "${created.name}" created.`);
      setNewModName("");
      setSelectedModifierIds([...selectedModifierIds, created.id]);
      refreshAllData();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDeleteModifier = async (id: string, name: string) => {
    if (!confirm(`Delete modifier "${name}"?`)) return;
    try {
      await deleteModifier(id, currentUser?.id);
      setSelectedModifierIds(selectedModifierIds.filter((mId) => mId !== id));
      setSuccess(`Modifier "${name}" deleted.`);
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
      await saveComboComponents(selectedComboParentId, comboComponents, currentUser?.id);
      setSuccess("Combo bundle composition saved successfully.");
      refreshAllData();
    } catch (err) {
      setError(String(err));
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  const inStockCount = items.filter((i) => i.is_available === 1).length;
  const soldOutCount = items.filter((i) => i.is_available === 0).length;

  const filteredMenuItems = items.filter((item) => {
    if (selectedCategoryFilter !== "ALL" && item.category_id !== selectedCategoryFilter) {
      return false;
    }
    if (availabilityFilter === "IN_STOCK" && item.is_available !== 1) {
      return false;
    }
    if (availabilityFilter === "SOLD_OUT" && item.is_available !== 0) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q) || false;
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  const groupedMenuItems = useMemo(() => {
    const sortedCategories = [...categories].sort((a, b) => a.display_order - b.display_order);

    if (selectedCategoryFilter !== "ALL") {
      const category = categories.find((c) => c.id === selectedCategoryFilter) ?? null;
      return filteredMenuItems.length > 0 ? [{ category, items: filteredMenuItems }] : [];
    }

    const groups: { category: DbCategory | null; items: DbMenuItem[] }[] = [];

    for (const category of sortedCategories) {
      const categoryItems = filteredMenuItems.filter((item) => item.category_id === category.id);
      if (categoryItems.length > 0) {
        groups.push({ category, items: categoryItems });
      }
    }

    const uncategorized = filteredMenuItems.filter(
      (item) => !categories.some((category) => category.id === item.category_id),
    );
    if (uncategorized.length > 0) {
      groups.push({ category: null, items: uncategorized });
    }

    return groups;
  }, [filteredMenuItems, categories, selectedCategoryFilter]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.display_order - b.display_order),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return sortedCategories;
    const q = categorySearchQuery.toLowerCase().trim();
    return sortedCategories.filter((category) => category.name.toLowerCase().includes(q));
  }, [sortedCategories, categorySearchQuery]);

  const getCategoryItemCount = (categoryId: string) =>
    items.filter((item) => item.category_id === categoryId).length;

  return (
    <div className="card menu-catalog-page">
      <div className="card-header-row" style={{ marginBottom: "16px" }}>
        <div>
          <h4>Menu & Catalog Manager</h4>
          <p className="subtitle">Manage items, categories, variants, add-ons, and combo bundles</p>
        </div>
      </div>

      {/* Metrics Summary Widgets */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(108, 21, 30, 0.08)", color: "var(--primary)" }}>
            <IconUtensils size={22} color="var(--primary)" />
          </div>
          <div>
            <div className="stat-value">{items.length}</div>
            <div className="stat-label">Total Menu Items</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(15, 61, 58, 0.08)", color: "var(--secondary)" }}>
            <IconMenu size={22} color="var(--secondary)" />
          </div>
          <div>
            <div className="stat-value">{categories.length}</div>
            <div className="stat-label">Categories</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(15, 61, 58, 0.08)", color: "var(--secondary)" }}>
            <IconCheck size={22} color="var(--secondary)" />
          </div>
          <div>
            <div className="stat-value" style={{ color: "var(--secondary)" }}>{inStockCount}</div>
            <div className="stat-label">In Stock & Ready</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(108, 21, 30, 0.12)", color: "var(--primary)" }}>
            <IconAlert size={22} color="var(--primary)" />
          </div>
          <div>
            <div className="stat-value" style={{ color: "var(--primary)" }}>{soldOutCount}</div>
            <div className="stat-label">86'd / Sold Out</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="pin-error" onClick={() => setError(null)} style={{ cursor: "pointer", marginBottom: "14px" }}>
          <IconAlert size={16} /> {error} (click to dismiss)
        </div>
      )}
      {success && (
        <div className="success-banner" onClick={() => setSuccess(null)} style={{ cursor: "pointer", marginBottom: "14px" }}>
          <IconCheck size={16} /> {success} (click to dismiss)
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="sub-nav-tabs" style={{ marginBottom: "18px" }}>
        <button
          type="button"
          className={`sub-nav-tab ${activeTab === "items" ? "active" : ""}`}
          onClick={() => setActiveTab("items")}
        >
          <IconUtensils size={15} /> Menu Items
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          <IconMenu size={15} /> Categories
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeTab === "variants_modifiers" ? "active" : ""}`}
          onClick={() => setActiveTab("variants_modifiers")}
        >
          <IconEdit size={15} /> Variants & Add-ons
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeTab === "combos" ? "active" : ""}`}
          onClick={() => setActiveTab("combos")}
        >
          <IconPlus size={15} /> Combo Bundles
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <IconMenu size={32} color="var(--primary)" />
          <p style={{ marginTop: "8px" }}>Loading menu management data...</p>
        </div>
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 1: MENU ITEMS (T-023)                                       */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "items" && (
            <div className="menu-catalog-items">
              <div className="menu-toolbar">
                <div className="menu-search-field">
                  <IconSearch size={18} className="menu-search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search menu items..."
                    aria-label="Search menu items"
                  />
                </div>

                <div className="menu-toolbar-filters">
                  <div className="menu-filter-group">
                    <label htmlFor="menu-category-filter">Category</label>
                    <select
                      id="menu-category-filter"
                      className="menu-filter-select"
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

                  <div className="menu-filter-group">
                    <label htmlFor="menu-stock-filter">Stock Status</label>
                    <select
                      id="menu-stock-filter"
                      className="menu-filter-select"
                      value={availabilityFilter}
                      onChange={(e) => setAvailabilityFilter(e.target.value as "ALL" | "IN_STOCK" | "SOLD_OUT")}
                    >
                      <option value="ALL">All Statuses ({items.length})</option>
                      <option value="IN_STOCK">In Stock Only ({inStockCount})</option>
                      <option value="SOLD_OUT">86'd / Sold Out Only ({soldOutCount})</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary menu-toolbar-add"
                  onClick={openAddItemModal}
                >
                  <IconPlus size={16} /> Add Menu Item
                </button>
              </div>

              {filteredMenuItems.length === 0 ? (
                <div className="menu-empty-state">
                  <IconUtensils size={36} color="var(--text-muted)" />
                  <h5>No menu items found</h5>
                  <p>Try a different search or filter, or add your first item.</p>
                  <button type="button" className="btn-primary" onClick={openAddItemModal}>
                    <IconPlus size={16} /> Add Menu Item
                  </button>
                </div>
              ) : (
                groupedMenuItems.map(({ category, items: categoryItems }) => (
                  <section
                    key={category?.id ?? "uncategorized"}
                    className="menu-category-section"
                  >
                    <div className="menu-category-header">
                      <div>
                        <h5>{category?.name ?? "Uncategorized"}</h5>
                        <p>{categoryItems.length} item{categoryItems.length === 1 ? "" : "s"}</p>
                      </div>
                    </div>

                    <div className="menu-catalog-grid">
                      {categoryItems.map((item) => (
                        <article
                          key={item.id}
                          className={`menu-catalog-card ${item.is_available === 0 ? "item-disabled" : ""}`}
                        >
                          <div className="menu-catalog-image-wrap">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="menu-catalog-image"
                              />
                            ) : (
                              <div className="menu-catalog-image-placeholder">
                                <IconUtensils size={32} color="var(--bordo)" />
                              </div>
                            )}

                            <div className="menu-catalog-badges">
                              {item.is_combo === 1 && <span className="menu-badge menu-badge-combo">Combo</span>}
                              {item.available_from && item.available_until && (
                                <span
                                  className={`menu-badge ${
                                    isItemInTimeWindow(item) ? "menu-badge-open" : "menu-badge-closed"
                                  }`}
                                >
                                  {item.available_from} – {item.available_until}
                                  {!isItemInTimeWindow(item) && " · Closed"}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="menu-catalog-body">
                            <h6 className="menu-catalog-title">{item.name}</h6>
                            <p className="menu-catalog-desc">
                              {item.description || "No description available."}
                            </p>

                            <div className="menu-catalog-pricing">
                              <span className="menu-catalog-price">{formatCurrency(item.base_price)}</span>
                              <span className="menu-catalog-tax">+{(item.tax_rate * 100).toFixed(0)}% tax</span>
                            </div>
                          </div>

                          <div className="menu-catalog-actions">
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
                              <IconEdit size={14} /> Variants
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
                        </article>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 2: CATEGORIES (T-022)                                       */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "categories" && (
            <div className="menu-catalog-categories">
              <div className="menu-toolbar">
                <div className="menu-search-field">
                  <IconSearch size={18} className="menu-search-icon" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Search categories..."
                    aria-label="Search categories"
                  />
                </div>

                <button type="button" className="btn-primary menu-toolbar-add" onClick={openAddCategoryModal}>
                  <IconPlus size={16} /> Add Category
                </button>
              </div>

              {filteredCategories.length === 0 ? (
                <div className="menu-empty-state">
                  <IconMenu size={36} color="var(--text-muted)" />
                  <h5>No categories found</h5>
                  <p>
                    {categories.length === 0
                      ? "Create your first menu category to organize items."
                      : "Try a different search term."}
                  </p>
                  {categories.length === 0 && (
                    <button type="button" className="btn-primary" onClick={openAddCategoryModal}>
                      <IconPlus size={16} /> Add Category
                    </button>
                  )}
                </div>
              ) : (
                <div className="menu-category-list">
                  {filteredCategories.map((cat) => {
                    const catIndex = sortedCategories.findIndex((c) => c.id === cat.id);
                    const itemCount = getCategoryItemCount(cat.id);
                    const coverImage =
                      cat.image_url || items.find((item) => item.category_id === cat.id)?.image_url;

                    return (
                      <article
                        key={cat.id}
                        className={`menu-category-card ${cat.is_active === 0 ? "is-disabled" : ""}`}
                      >
                        <div className="menu-category-card-header">
                          <span className="menu-category-order">#{cat.display_order}</span>
                          <span
                            className={`status-badge ${cat.is_active === 1 ? "active" : "inactive"}`}
                          >
                            {cat.is_active === 1 ? "Active" : "Disabled"}
                          </span>
                        </div>

                        <div className="menu-category-card-body">
                          <div className="menu-category-image" aria-hidden="true">
                            <div className="menu-category-image-fallback">
                              <IconMenu size={28} color="var(--bordo)" />
                            </div>
                            {coverImage && (
                              <img
                                src={coverImage}
                                alt=""
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            )}
                          </div>
                          <div>
                            <h6 className="menu-category-name">{cat.name}</h6>
                            <p className="menu-category-meta">
                              {itemCount} item{itemCount === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>

                        <div className="menu-category-schedule">
                          <IconClock size={14} color="var(--text-muted)" />
                          {cat.available_from && cat.available_until ? (
                            <span
                              className={`menu-badge ${
                                isCategoryInTimeWindow(cat) ? "menu-badge-open" : "menu-badge-closed"
                              }`}
                            >
                              {cat.available_from} – {cat.available_until}
                              {!isCategoryInTimeWindow(cat) && " · Closed"}
                            </span>
                          ) : (
                            <span className="menu-category-schedule-text">Available all day</span>
                          )}
                        </div>

                        <div className="menu-category-card-actions">
                          <div className="menu-category-reorder">
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={catIndex === 0}
                              onClick={() => handleReorderCategory(cat.id, "up")}
                              title="Move up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={catIndex === sortedCategories.length - 1}
                              onClick={() => handleReorderCategory(cat.id, "down")}
                              title="Move down"
                            >
                              ▼
                            </button>
                          </div>

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
                            onClick={() => openEditCategoryModal(cat)}
                          >
                            <IconEdit size={14} /> Edit
                          </button>

                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            onClick={() => handleDeleteCategory(cat.id)}
                          >
                            <IconTrash size={14} /> Delete
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SUB-TAB 3: VARIANTS & MODIFIERS (T-024 & T-025)                     */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "variants_modifiers" && (
            <section className="variants-workspace">
              <div className="variants-item-picker">
                <div>
                  <span className="variants-eyebrow">Configure options for</span>
                  <h5>Choose a menu item</h5>
                  <p>Set sizes, prices, and available add-ons in one place.</p>
                </div>
                <div className="variants-select-wrap">
                  <label htmlFor="variant-menu-item">Menu item</label>
                  <select id="variant-menu-item" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} · {formatCurrency(i.base_price)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="variants-editor-grid">
                <article className="variants-editor-card">
                  <div className="variants-card-heading">
                    <div className="variants-heading-icon"><IconEdit size={20} color="var(--bordo)" /></div>
                    <div>
                      <h5>Sizes & variants</h5>
                      <p>Add choices such as Small, Regular, or Large.</p>
                    </div>
                    <span className="variants-count">{variants.length}</span>
                  </div>

                  {variants.length === 0 ? (
                    <div className="variants-empty">No options added yet. Add a size or other variant below.</div>
                  ) : (
                    <div className="variants-list">
                      {variants.map((v, idx) => (
                        <div key={idx} className="variants-row">
                          <span className="variants-row-number">{idx + 1}</span>
                          <input
                            type="text"
                            aria-label={`Variant ${idx + 1} name`}
                            placeholder="e.g. Large"
                            value={v.name}
                            onChange={(e) => {
                              const updated = [...variants];
                              updated[idx].name = e.target.value;
                              setVariants(updated);
                            }}
                          />
                          <div className="variants-price-input">
                            <span>Rs.</span>
                            <input
                              type="number"
                              step="0.01"
                              aria-label={`Variant ${idx + 1} price`}
                              value={v.price}
                              onChange={(e) => {
                                const updated = [...variants];
                                updated[idx].price = parseFloat(e.target.value) || 0;
                                setVariants(updated);
                              }}
                            />
                          </div>
                          <button type="button" className="variants-remove-button" onClick={() => handleRemoveVariantRow(idx)} aria-label={`Remove ${v.name || "variant"}`}>
                            <IconTrash size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="button" className="variants-add-button" onClick={handleAddVariantRow}>
                    <IconPlus size={17} /> Add variant
                  </button>
                </article>

                <article className="variants-editor-card">
                  <div className="variants-card-heading">
                    <div className="variants-heading-icon"><IconMenu size={20} color="var(--bordo)" /></div>
                    <div>
                      <h5>Add-ons & modifiers</h5>
                      <p>Select the extras a customer can choose.</p>
                    </div>
                    <span className="variants-count">{selectedModifierIds.length} selected</span>
                  </div>

                  <div className="modifier-option-list">
                    {modifiers.map((m) => {
                      const isChecked = selectedModifierIds.includes(m.id);
                      return (
                        <div key={m.id} className={`modifier-option ${isChecked ? "is-selected" : ""}`}>
                          <label>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedModifierIds(
                                  e.target.checked
                                    ? [...selectedModifierIds, m.id]
                                    : selectedModifierIds.filter((id) => id !== m.id),
                                );
                              }}
                            />
                            <span className="modifier-option-check"><IconCheck size={14} color="#FFFFFF" /></span>
                            <span className="modifier-option-name">{m.name}</span>
                            <span className="modifier-option-price">+{formatCurrency(m.price_adjustment)}</span>
                          </label>
                          <button type="button" className="variants-remove-button" onClick={() => handleDeleteModifier(m.id, m.name)} aria-label={`Delete ${m.name}`}>
                            <IconTrash size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={handleCreateNewModifier} className="modifier-create-form">
                    <input type="text" placeholder="New add-on name" value={newModName} onChange={(e) => setNewModName(e.target.value)} />
                    <div className="variants-price-input">
                      <span>Rs.</span>
                      <input type="number" step="0.01" aria-label="New modifier price" value={newModPrice} onChange={(e) => setNewModPrice(e.target.value)} />
                    </div>
                    <button type="submit" className="btn-secondary btn-sm"><IconPlus size={15} /> Create</button>
                  </form>
                </article>
              </div>

              <div className="variants-save-bar">
                <div><strong>Ready to save?</strong><span>Changes apply to the selected menu item only.</span></div>
                <button type="button" className="btn-primary" onClick={handleSaveVariantsAndModifiers}>
                  <IconCheck size={18} /> Save changes
                </button>
              </div>
            </section>
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
                      🎁 {i.name} (Bundled Base Price: {formatCurrency(i.base_price)})
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
                              {i.name} ({formatCurrency(i.base_price)})
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

                {/* Bundled Pricing & Savings Breakdown (FR-2.5) */}
                {selectedComboParentId && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "16px 20px",
                      borderRadius: "14px",
                      background: "#faf7f4",
                      border: "1px solid var(--border-medium)",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "16px",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "500" }}>
                        Sum of Individual Items
                      </div>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          textDecoration:
                            comboComponents.reduce((sum, comp) => {
                              const child = items.find((i) => i.id === comp.child_item_id);
                              return sum + (child ? child.base_price * comp.quantity : 0);
                            }, 0) > (items.find((i) => i.id === selectedComboParentId)?.base_price || 0)
                              ? "line-through"
                              : "none",
                          color: "var(--text-muted)",
                        }}
                      >
                        {formatCurrency(
                          comboComponents.reduce((sum, comp) => {
                            const child = items.find((i) => i.id === comp.child_item_id);
                            return sum + (child ? child.base_price * comp.quantity : 0);
                          }, 0),
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "500" }}>
                        Bundled Combo Package Price
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--accent)" }}>
                        {formatCurrency(items.find((i) => i.id === selectedComboParentId)?.base_price || 0)}
                      </div>
                    </div>

                    {(() => {
                      const parent = items.find((i) => i.id === selectedComboParentId);
                      const indivTotal = comboComponents.reduce((sum, comp) => {
                        const child = items.find((i) => i.id === comp.child_item_id);
                        return sum + (child ? child.base_price * comp.quantity : 0);
                      }, 0);
                      const bPrice = parent ? parent.base_price : 0;
                      const savings = indivTotal - bPrice;
                      const savingsPct = indivTotal > 0 ? (savings / indivTotal) * 100 : 0;

                      if (savings <= 0) return null;

                      return (
                        <div
                          style={{
                            padding: "8px 16px",
                            borderRadius: "20px",
                            background: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                            color: "#047857",
                            fontWeight: "700",
                            fontSize: "13px",
                          }}
                        >
                          🎉 Customer Saves {formatCurrency(savings)} ({savingsPct.toFixed(0)}% OFF)
                        </div>
                      );
                    })()}
                  </div>
                )}
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
                <label>Category Image Link (optional)</label>
                <input
                  type="url"
                  value={catImage}
                  onChange={(e) => setCatImage(e.target.value)}
                  placeholder="https://example.com/drinks.jpg"
                />
                <small className="form-hint">
                  Paste an image link, or upload an image from this computer below.
                </small>
              </div>

              <div className="form-group">
                <label>Upload Category Image (optional)</label>
                <div className="category-image-upload-row">
                  <label className="btn-secondary category-image-upload-button">
                    <IconPlus size={16} /> Choose Image
                    <input type="file" accept="image/*" onChange={handleCategoryImageUpload} />
                  </label>
                  <span className="form-hint">PNG, JPG, or WebP · up to 2 MB</span>
                </div>

                {catImage && (
                  <div className="category-image-preview">
                    <img src={catImage} alt="Selected category preview" />
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setCatImage("")}>
                      Remove image
                    </button>
                  </div>
                )}
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label>Available From Time (optional - e.g. 06:00)</label>
                  <input
                    type="time"
                    value={catFrom}
                    onChange={(e) => setCatFrom(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Available Until Time (optional - e.g. 11:00)</label>
                  <input
                    type="time"
                    value={catUntil}
                    onChange={(e) => setCatUntil(e.target.value)}
                  />
                </div>
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
                  <label>Base Price (Rs.)</label>
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
