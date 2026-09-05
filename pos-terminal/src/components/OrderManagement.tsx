import { useState, useEffect, useMemo } from "react";
import {
  DbOrder,
  DbOrderItem,
  DbTable,
  OrderSource,
  getTables,
  getOpenOrders,
  getAllOrders,
  getOrderItems,
  createOrder,
  addOrderItem,
  sendToKitchen,
  advanceOrderStatus,
  voidOrder,
  voidOrderItem,
  reopenOrder,
  mergeOrders,
  splitBill,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_FLOW,
  REOPEN_WINDOW_MINUTES,
  processOrderPayment,
} from "../lib/orderService";
import {
  DbCategory,
  DbMenuItem,
  DbVariant,
  DbModifier,
  getCategories,
  getMenuItems,
  getItemVariants,
  getAllModifiers,
  getItemModifierIds,
  isItemInTimeWindow,
} from "../lib/menuService";
import { useAuth } from "../store/useAuth";
import ReceiptModal from "./ReceiptModal";
import { ReceiptData } from "../lib/receiptService";

interface CartDraftItem {
  menuItem: DbMenuItem;
  selectedVariant?: DbVariant;
  selectedModifiers: DbModifier[];
  quantity: number;
  notes: string;
  unitPrice: number;
}

interface OrderManagementProps {
  initialTableId?: string;
  onSwitchToTables?: () => void;
}

export default function OrderManagement({ initialTableId, onSwitchToTables }: OrderManagementProps = {}) {
  const { user: currentUser } = useAuth();

  // Navigation Subtabs
  const [activeSubtab, setActiveSubtab] = useState<"new_order" | "active_orders" | "table_operations">("new_order");

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Global Data
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [tables, setTables] = useState<DbTable[]>([]);
  const [openOrders, setOpenOrders] = useState<DbOrder[]>([]);
  const [allRecentOrders, setAllRecentOrders] = useState<DbOrder[]>([]);
  const [allModifiers, setAllModifiers] = useState<DbModifier[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── T-029: New Order Creation State ──────────────────────────────────────
  const [orderSource, setOrderSource] = useState<OrderSource>("DINE_IN");
  const [selectedTableId, setSelectedTableId] = useState<string>(initialTableId || "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // ─── T-030: Menu Browsing & Cart State ─────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [cart, setCart] = useState<CartDraftItem[]>([]);

  // Item Customization Modal (Variants / Modifiers)
  const [customizingItem, setCustomizingItem] = useState<DbMenuItem | null>(null);
  const [itemVariants, setItemVariants] = useState<DbVariant[]>([]);
  const [itemModifierOptions, setItemModifierOptions] = useState<DbModifier[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedModIds, setSelectedModIds] = useState<string[]>([]);
  const [customItemQty, setCustomItemQty] = useState<number>(1);
  const [customItemNotes, setCustomItemNotes] = useState("");

  // ─── T-033: Active Orders Management State ─────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<DbOrder | null>(null);
  const [orderDetailsItems, setOrderDetailsItems] = useState<DbOrderItem[]>([]);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // ─── Receipt Modal State ───────────────────────────────────────────────────
  const [receiptModalData, setReceiptModalData] = useState<ReceiptData | null>(null);
  const [receiptModalType, setReceiptModalType] = useState<"CUSTOMER" | "KITCHEN">("CUSTOMER");

  // ─── Payment & Checkout Modal State ────────────────────────────────────────
  const [paymentModalOrder, setPaymentModalOrder] = useState<DbOrder | null>(null);
  const [paymentModalItems, setPaymentModalItems] = useState<DbOrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "DIGITAL" | "OTHER">("CASH");
  const [paymentTendered, setPaymentTendered] = useState<number>(0);
  const [paymentTip, setPaymentTip] = useState<number>(0);
  const [paymentError, setPaymentError] = useState("");

  // ─── T-034: Void Modal State ───────────────────────────────────────────────
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ type: "ORDER" | "ITEM"; orderId: string; itemId?: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [approverPin, setApproverPin] = useState("");
  const [voidError, setVoidError] = useState("");

  // ─── T-036: Merge & Split State ────────────────────────────────────────────
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [splitOrderId, setSplitOrderId] = useState("");
  const [splitOrderItemsList, setSplitOrderItemsList] = useState<DbOrderItem[]>([]);
  const [selectedItemIdsForSplit, setSelectedItemIdsForSplit] = useState<string[]>([]);

  // ─── Data Loading ──────────────────────────────────────────────────────────
  const refreshData = async () => {
    try {
      const [cats, items, tbls, oOrders, allOrd, mods] = await Promise.all([
        getCategories(),
        getMenuItems(),
        getTables(),
        getOpenOrders(),
        getAllOrders(40),
        getAllModifiers(),
      ]);
      setCategories(cats);
      setMenuItems(items);
      setTables(tbls);
      setOpenOrders(oOrders);
      setAllRecentOrders(allOrd);
      setAllModifiers(mods);
    } catch (err) {
      console.error("Failed to load order data", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // ─── Filtered Menu Items for Ordering ───────────────────────────────────────
  const availableMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (item.is_available === 0) return false;
      if (!isItemInTimeWindow(item)) return false;
      if (selectedCategory !== "ALL" && item.category_id !== selectedCategory) return false;
      if (menuSearchQuery.trim()) {
        const q = menuSearchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [menuItems, selectedCategory, menuSearchQuery]);

  // ─── T-030: Add Item to Cart / Customize ───────────────────────────────────
  const handleItemClick = async (item: DbMenuItem) => {
    try {
      const variants = await getItemVariants(item.id);
      const modIds = await getItemModifierIds(item.id);
      const availableMods = allModifiers.filter((m) => modIds.includes(m.id));

      if (variants.length > 0 || availableMods.length > 0) {
        // Open customization modal
        setCustomizingItem(item);
        setItemVariants(variants);
        setItemModifierOptions(availableMods);
        setSelectedVariantId(variants.length > 0 ? variants[0].id : "");
        setSelectedModIds([]);
        setCustomItemQty(1);
        setCustomItemNotes("");
      } else {
        // Direct add to cart
        addToCartDirect(item);
      }
    } catch (err) {
      setError("Error customizing item: " + String(err));
    }
  };

  const addToCartDirect = (item: DbMenuItem) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (c) => c.menuItem.id === item.id && !c.selectedVariant && c.selectedModifiers.length === 0 && !c.notes
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          menuItem: item,
          quantity: 1,
          notes: "",
          unitPrice: item.base_price,
          selectedModifiers: [],
        },
      ];
    });
  };

  const handleAddCustomizedToCart = () => {
    if (!customizingItem) return;

    let price = customizingItem.base_price;
    let selectedVar: DbVariant | undefined;

    if (selectedVariantId) {
      selectedVar = itemVariants.find((v) => v.id === selectedVariantId);
      if (selectedVar) price = selectedVar.price;
    }

    const chosenMods = itemModifierOptions.filter((m) => selectedModIds.includes(m.id));
    const modsPrice = chosenMods.reduce((acc, m) => acc + m.price_adjustment, 0);
    const finalUnitPrice = price + modsPrice;

    setCart((prev) => [
      ...prev,
      {
        menuItem: customizingItem,
        selectedVariant: selectedVar,
        selectedModifiers: chosenMods,
        quantity: customItemQty,
        notes: customItemNotes.trim(),
        unitPrice: finalUnitPrice,
      },
    ]);

    setCustomizingItem(null);
  };

  const updateCartItemQty = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index].quantity = newQty;
      return updated;
    });
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedTableId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setOrderNotes("");
  };

  // ─── Cart Totals ───────────────────────────────────────────────────────────
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  }, [cart]);
  const cartTax = useMemo(() => cartSubtotal * 0.08, [cartSubtotal]);
  const cartTotal = useMemo(() => cartSubtotal + cartTax, [cartSubtotal, cartTax]);

  // ─── T-029 / T-031 / T-032: Place Order ────────────────────────────────────
  const handlePlaceOrder = async (sendDirectToKitchen = false, printAfter?: "CUSTOMER" | "KITCHEN") => {
    if (!currentUser) return;
    if (cart.length === 0) {
      setError("Please add at least one item to the cart.");
      return;
    }

    if (orderSource === "DINE_IN" && !selectedTableId) {
      setError("Please select a table for Dine-In orders.");
      return;
    }

    try {
      const newOrder = await createOrder(orderSource, currentUser.id, {
        tableId: orderSource === "DINE_IN" ? selectedTableId : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: orderSource === "DELIVERY" ? customerAddress.trim() : undefined,
        notes: orderNotes.trim() || undefined,
      });

      const insertedItems: DbOrderItem[] = [];
      // Insert all cart items
      for (const item of cart) {
        const added = await addOrderItem(newOrder.id, item.menuItem.id, item.quantity, item.unitPrice, {
          variantId: item.selectedVariant?.id,
          modifiers: item.selectedModifiers.map((m) => m.name),
          notes: item.notes || undefined,
        });
        insertedItems.push(added);
      }

      if (sendDirectToKitchen) {
        await sendToKitchen(newOrder.id, currentUser.id);
        setSuccess(`Order #${newOrder.id.slice(0, 8)} placed and sent to Kitchen! 👨‍🍳`);
      } else {
        setSuccess(`Order #${newOrder.id.slice(0, 8)} saved successfully! ✅`);
      }

      // If user requested instant printing
      if (printAfter) {
        const tableName = newOrder.table_id ? `Table #${tables.find((t) => t.id === newOrder.table_id)?.number || newOrder.table_id}` : "Takeaway";
        setReceiptModalData({
          order: newOrder,
          items: insertedItems.map((i, idx) => ({ ...i, name: cart[idx]?.menuItem.name || "Item" })),
          tableName,
          cashierName: currentUser.name,
        });
        setReceiptModalType(printAfter);
      }

      clearCart();
      refreshData();
      setActiveSubtab("active_orders");
    } catch (err) {
      setError("Failed to create order: " + String(err));
    }
  };

  // ─── Receipt Printing Helpers ──────────────────────────────────────────────
  const handlePrintCustomerReceipt = async (order: DbOrder) => {
    try {
      const items = await getOrderItems(order.id);
      const tableName = order.table_number ? `Table #${order.table_number}` : order.table_id ? `Table #${order.table_id}` : "Takeaway";
      setReceiptModalData({
        order,
        items,
        tableName,
        cashierName: order.created_by_name || currentUser?.name || "Cashier",
        paymentMethod: "PAID",
        amountPaid: order.total,
        changeDue: 0,
      });
      setReceiptModalType("CUSTOMER");
    } catch (err) {
      setError("Failed to load receipt items: " + String(err));
    }
  };

  const handlePrintKitchenTicket = async (order: DbOrder) => {
    try {
      const items = await getOrderItems(order.id);
      const tableName = order.table_number ? `Table #${order.table_number}` : order.table_id ? `Table #${order.table_id}` : "Takeaway";
      setReceiptModalData({
        order,
        items,
        tableName,
        cashierName: order.created_by_name || currentUser?.name || "Cashier",
      });
      setReceiptModalType("KITCHEN");
    } catch (err) {
      setError("Failed to load kitchen ticket items: " + String(err));
    }
  };

  // ─── Payment Checkout Modal Helpers ────────────────────────────────────────
  const handleOpenPayment = async (order: DbOrder) => {
    try {
      const items = await getOrderItems(order.id);
      setPaymentModalOrder(order);
      setPaymentModalItems(items);
      setPaymentMethod("CASH");
      setPaymentTendered(order.total);
      setPaymentTip(0);
      setPaymentError("");
    } catch (err) {
      setError("Failed to prepare payment checkout: " + String(err));
    }
  };

  const handleProcessPaymentSubmit = async () => {
    if (!currentUser || !paymentModalOrder) return;
    if (paymentTendered < paymentModalOrder.total) {
      setPaymentError(`Tendered amount must be at least $${paymentModalOrder.total.toFixed(2)}.`);
      return;
    }

    try {
      const changeDue = Math.max(0, paymentTendered - paymentModalOrder.total);
      await processOrderPayment(
        paymentModalOrder.id,
        paymentMethod,
        paymentTendered,
        paymentTip,
        changeDue,
        currentUser.id
      );

      const paidOrder = { ...paymentModalOrder, status: "CLOSED" as any };
      const tableName = paidOrder.table_number ? `Table #${paidOrder.table_number}` : paidOrder.table_id ? `Table #${paidOrder.table_id}` : "Takeaway";

      // Close payment modal and open receipt modal!
      setPaymentModalOrder(null);
      setReceiptModalData({
        order: paidOrder,
        items: paymentModalItems,
        tableName,
        cashierName: currentUser.name,
        paymentMethod,
        amountPaid: paymentTendered,
        changeDue,
      });
      setReceiptModalType("CUSTOMER");

      setSuccess(`Payment for Order #${paidOrder.id.slice(0, 8)} completed successfully! 💳`);
      refreshData();
    } catch (err) {
      setPaymentError(String(err));
    }
  };

  // ─── T-032 & T-033: Active Orders Operations ──────────────────────────────
  const handleAdvanceStatus = async (order: DbOrder) => {
    if (!currentUser) return;
    try {
      const next = await advanceOrderStatus(order.id, currentUser.id);
      if (next) {
        setSuccess(`Order #${order.id.slice(0, 8)} status advanced to ${ORDER_STATUS_LABELS[next]}.`);
        refreshData();
      }
    } catch (err) {
      setError("Failed to advance order: " + String(err));
    }
  };

  const handleSendToKitchen = async (orderId: string) => {
    if (!currentUser) return;
    try {
      await sendToKitchen(orderId, currentUser.id);
      setSuccess(`Order #${orderId.slice(0, 8)} dispatched to Kitchen.`);
      refreshData();
    } catch (err) {
      setError("Failed to send order to kitchen: " + String(err));
    }
  };

  const handleOpenOrderDetails = async (order: DbOrder) => {
    try {
      const items = await getOrderItems(order.id);
      setSelectedOrderDetails(order);
      setOrderDetailsItems(items);
      setIsDetailsModalOpen(true);
    } catch (err) {
      setError("Failed to fetch order items: " + String(err));
    }
  };

  // ─── T-034: Void Workflow ──────────────────────────────────────────────────
  const openVoidOrderDialog = (orderId: string) => {
    setVoidTarget({ type: "ORDER", orderId });
    setVoidReason("");
    setApproverPin("");
    setVoidError("");
    setVoidModalOpen(true);
  };

  const openVoidItemDialog = (orderId: string, itemId: string) => {
    setVoidTarget({ type: "ITEM", orderId, itemId });
    setVoidReason("");
    setApproverPin("");
    setVoidError("");
    setVoidModalOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!currentUser || !voidTarget) return;
    if (!approverPin.trim() || approverPin.length < 4) {
      setVoidError("Please enter a valid 4-digit Manager/Admin PIN.");
      return;
    }
    if (!voidReason.trim()) {
      setVoidError("Please enter a reason for the void.");
      return;
    }

    try {
      if (voidTarget.type === "ORDER") {
        await voidOrder(voidTarget.orderId, voidReason.trim(), approverPin, currentUser.id);
        setSuccess(`Order #${voidTarget.orderId.slice(0, 8)} voided.`);
      } else if (voidTarget.type === "ITEM" && voidTarget.itemId) {
        await voidOrderItem(voidTarget.itemId, voidTarget.orderId, voidReason.trim(), approverPin, currentUser.id);
        setSuccess("Item voided from order.");
        if (selectedOrderDetails) {
          const updatedItems = await getOrderItems(selectedOrderDetails.id);
          setOrderDetailsItems(updatedItems);
        }
      }
      setVoidModalOpen(false);
      setIsDetailsModalOpen(false);
      refreshData();
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : String(err));
    }
  };

  // ─── T-035: Reopen Closed Order ────────────────────────────────────────────
  const handleReopenOrder = async (orderId: string) => {
    if (!currentUser) return;
    try {
      await reopenOrder(orderId, currentUser.id);
      setSuccess(`Order #${orderId.slice(0, 8)} reopened for editing.`);
      refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // ─── T-036: Merge & Split Bill Operations ──────────────────────────────────
  const handleMergeOrders = async () => {
    if (!currentUser || !mergeSourceId || !mergeTargetId) {
      setError("Please select both a Source and Target order to merge.");
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      setError("Source and Target orders must be different.");
      return;
    }

    try {
      await mergeOrders(mergeSourceId, mergeTargetId, currentUser.id);
      setSuccess("Orders merged successfully.");
      setMergeSourceId("");
      setMergeTargetId("");
      refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSelectOrderForSplit = async (orderId: string) => {
    setSplitOrderId(orderId);
    setSelectedItemIdsForSplit([]);
    if (!orderId) {
      setSplitOrderItemsList([]);
      return;
    }
    try {
      const items = await getOrderItems(orderId);
      setSplitOrderItemsList(items);
    } catch (err) {
      setError("Failed to load order items: " + String(err));
    }
  };

  const toggleSplitItemSelection = (itemId: string) => {
    setSelectedItemIdsForSplit((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleExecuteSplitBill = async () => {
    if (!currentUser || !splitOrderId || selectedItemIdsForSplit.length === 0) {
      setError("Please select at least one item to split onto a new bill.");
      return;
    }
    if (selectedItemIdsForSplit.length === splitOrderItemsList.length) {
      setError("Cannot split all items — at least one item must remain on the original bill.");
      return;
    }

    try {
      const newOrderId = await splitBill(splitOrderId, selectedItemIdsForSplit, currentUser.id);
      setSuccess(`Bill split successfully! New sub-order created: #${newOrderId.slice(0, 8)}`);
      setSplitOrderId("");
      setSplitOrderItemsList([]);
      setSelectedItemIdsForSplit([]);
      refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // ─── Filtered Active Orders List ───────────────────────────────────────────
  const filteredActiveOrders = useMemo(() => {
    if (statusFilter === "ALL") return openOrders;
    return openOrders.filter((o) => o.status === statusFilter);
  }, [openOrders, statusFilter]);

  if (loading) {
    return (
      <div className="card full-width-card">
        <p style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
          ⏳ Loading Order Management System...
        </p>
      </div>
    );
  }

  return (
    <div className="card full-width-card">
      <div className="card-header-row">
        <div>
          <h4>Order Management System</h4>
          <p className="subtitle">Create orders, send to kitchen, track lifecycle, and table operations</p>
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

      {/* Subtabs Navigation */}
      <div className="sub-nav-tabs">
        <button
          type="button"
          className={`sub-nav-tab ${activeSubtab === "new_order" ? "active" : ""}`}
          onClick={() => setActiveSubtab("new_order")}
        >
          ➕ New Order & Cart
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeSubtab === "active_orders" ? "active" : ""}`}
          onClick={() => setActiveSubtab("active_orders")}
        >
          📋 Active Orders ({openOrders.length})
        </button>
        <button
          type="button"
          className={`sub-nav-tab ${activeSubtab === "table_operations" ? "active" : ""}`}
          onClick={() => setActiveSubtab("table_operations")}
        >
          🔀 Table & Bill Operations
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUBTAB 1: NEW ORDER & CART BUILDER (T-029, T-030, T-031, T-032)         */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubtab === "new_order" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", marginTop: "16px" }}>
          {/* LEFT: Order Type + Table Selection + Menu Browser */}
          <div>
            {/* Step 1: Order Type Selector */}
            <div className="sub-card" style={{ marginBottom: "16px" }}>
              <h5 style={{ marginBottom: "12px" }}>1. Select Order Type</h5>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`btn-secondary ${orderSource === "DINE_IN" ? "btn-primary" : ""}`}
                  onClick={() => setOrderSource("DINE_IN")}
                >
                  🪑 Dine-In
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${orderSource === "TAKEAWAY" ? "btn-primary" : ""}`}
                  onClick={() => setOrderSource("TAKEAWAY")}
                >
                  🥡 Takeaway
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${orderSource === "DELIVERY" ? "btn-primary" : ""}`}
                  onClick={() => setOrderSource("DELIVERY")}
                >
                  🛵 Delivery
                </button>
              </div>

              {/* Dine-In Floor Plan */}
              {orderSource === "DINE_IN" && (
                <div style={{ marginTop: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "600" }}>
                      Select Table: {selectedTableId ? `Table ${tables.find((t) => t.id === selectedTableId)?.number}` : "None Selected"}
                    </label>
                    {onSwitchToTables && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        style={{ fontSize: "11px", padding: "3px 8px" }}
                        onClick={onSwitchToTables}
                      >
                        🗺️ View Full Floor Map
                      </button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "8px" }}>
                    {tables.map((tbl) => {
                      const isSelected = selectedTableId === tbl.id;
                      const isFree = tbl.status === "FREE";
                      return (
                        <div
                          key={tbl.id}
                          onClick={() => setSelectedTableId(tbl.id)}
                          style={{
                            padding: "10px 8px",
                            textAlign: "center",
                            borderRadius: "12px",
                            border: isSelected ? "2px solid var(--accent)" : "1.5px solid var(--border-light)",
                            background: isSelected
                              ? "var(--accent-light)"
                              : isFree
                              ? "#edfaf4"
                              : "#fff1f0",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ fontWeight: "800", fontSize: "15px", color: isSelected ? "var(--accent-dark)" : "var(--text-primary)" }}>
                            {tbl.number}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                            👥 {tbl.capacity}p
                          </div>
                          <div style={{ fontSize: "10px", fontWeight: "700", marginTop: "4px", color: isFree ? "#1a7a4a" : "#c0392b" }}>
                            {tbl.status}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Takeaway / Delivery Customer Info */}
              {(orderSource === "TAKEAWAY" || orderSource === "DELIVERY") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "14px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Customer Name</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Alex Smith"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Phone Number</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 555-0199"
                    />
                  </div>
                  {orderSource === "DELIVERY" && (
                    <div className="form-group" style={{ gridColumn: "1 / -1", margin: 0 }}>
                      <label>Delivery Address</label>
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="e.g. 123 Main St, Apt 4B"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Menu Browsing & Search */}
            <div className="sub-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
                <h5>2. Add Menu Items to Order</h5>
                <input
                  type="text"
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  placeholder="🔍 Search menu..."
                  style={{
                    padding: "7px 12px",
                    borderRadius: "10px",
                    border: "1.5px solid var(--border-medium)",
                    fontSize: "13px",
                    width: "200px",
                  }}
                />
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "8px", marginBottom: "12px" }}>
                <button
                  type="button"
                  className={`sub-nav-tab ${selectedCategory === "ALL" ? "active" : ""}`}
                  style={{ padding: "5px 12px", fontSize: "12px" }}
                  onClick={() => setSelectedCategory("ALL")}
                >
                  All ({menuItems.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`sub-nav-tab ${selectedCategory === cat.id ? "active" : ""}`}
                    style={{ padding: "5px 12px", fontSize: "12px" }}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Menu Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "12px" }}>
                {availableMenuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    style={{
                      padding: "12px",
                      borderRadius: "14px",
                      background: "var(--card-bg)",
                      border: "1.5px solid var(--border-light)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                    className="menu-item-tile"
                  >
                    <div>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "8px", marginBottom: "8px" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "60px",
                            background: "#f7f3ef",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "24px",
                            marginBottom: "8px",
                          }}
                        >
                          🍔
                        </div>
                      )}
                      <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)", marginBottom: "4px" }}>
                        {item.name}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.3", marginBottom: "6px" }}>
                          {item.description.slice(0, 45)}...
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                      <span style={{ fontWeight: "800", color: "var(--accent)", fontSize: "14px" }}>
                        ${item.base_price.toFixed(2)}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--accent-dark)", fontWeight: "600" }}>
                        + Add
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Live Cart Sidebar */}
          <div
            style={{
              background: "#faf7f4",
              border: "1.5px solid var(--border-light)",
              borderRadius: "18px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "fit-content",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h5 style={{ margin: 0 }}>🛒 Current Cart</h5>
                {cart.length > 0 && (
                  <button type="button" style={{ background: "none", border: "none", color: "#c0392b", fontSize: "12px", cursor: "pointer" }} onClick={clearCart}>
                    Clear
                  </button>
                )}
              </div>

              {/* Order Meta Pill */}
              <div style={{ padding: "8px 12px", background: "#f0ebe3", borderRadius: "10px", fontSize: "12px", marginBottom: "14px" }}>
                <strong>Source:</strong> {orderSource.replace("_", " ")}{" "}
                {orderSource === "DINE_IN" && selectedTableId && (
                  <span>· Table {tables.find((t) => t.id === selectedTableId)?.number}</span>
                )}
              </div>

              {/* Cart Items List */}
              {cart.length === 0 ? (
                <div style={{ padding: "32px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  Cart is empty. Tap menu items to add them.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "320px", overflowY: "auto", paddingRight: "4px" }}>
                  {cart.map((cItem, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px",
                        background: "var(--card-bg)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong style={{ fontSize: "13px" }}>{cItem.menuItem.name}</strong>
                          {cItem.selectedVariant && (
                            <div style={{ fontSize: "11px", color: "var(--accent-dark)" }}>
                              Option: {cItem.selectedVariant.name}
                            </div>
                          )}
                          {cItem.selectedModifiers.length > 0 && (
                            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                              + {cItem.selectedModifiers.map((m) => m.name).join(", ")}
                            </div>
                          )}
                          {cItem.notes && (
                            <div style={{ fontSize: "11px", fontStyle: "italic", color: "var(--text-muted)" }}>
                              Note: "{cItem.notes}"
                            </div>
                          )}
                        </div>
                        <span style={{ fontWeight: "700", fontSize: "13px" }}>
                          ${(cItem.unitPrice * cItem.quantity).toFixed(2)}
                        </span>
                      </div>

                      {/* Qty Stepper */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: "2px 8px", fontSize: "12px", borderRadius: "6px" }}
                            onClick={() => updateCartItemQty(idx, -1)}
                          >
                            -
                          </button>
                          <span style={{ fontWeight: "700", fontSize: "13px", minWidth: "20px", textAlign: "center" }}>
                            {cItem.quantity}
                          </span>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: "2px 8px", fontSize: "12px", borderRadius: "6px" }}
                            onClick={() => updateCartItemQty(idx, 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "14px" }}
                          onClick={() => removeCartItem(idx)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Summary & Place Buttons */}
            <div style={{ marginTop: "16px", borderTop: "1.5px solid var(--border-medium)", paddingTop: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span>Subtotal</span>
                <strong>${cartSubtotal.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px", color: "var(--text-secondary)" }}>
                <span>Est. Tax (8%)</span>
                <span>${cartTax.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: "800", color: "var(--accent-dark)", marginBottom: "14px" }}>
                <span>Total</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: "100%", padding: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  disabled={cart.length === 0}
                  onClick={() => handlePlaceOrder(true, "KITCHEN")}
                >
                  👨‍🍳 Send to Kitchen & Print KOT
                </button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "9px 6px", fontSize: "12px", fontWeight: "600" }}
                    disabled={cart.length === 0}
                    onClick={() => handlePlaceOrder(false, "CUSTOMER")}
                  >
                    🧾 Place & Receipt
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "9px 6px", fontSize: "12px" }}
                    disabled={cart.length === 0}
                    onClick={() => handlePlaceOrder(false)}
                  >
                    💾 Save Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUBTAB 2: ACTIVE ORDERS & STATE MACHINE (T-033, T-034)                   */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubtab === "active_orders" && (
        <div style={{ marginTop: "16px" }}>
          {/* Status Filter Bar */}
          <div className="card-header-row" style={{ marginBottom: "14px" }}>
            <div className="filter-controls">
              <label style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Filter Status:</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All Active ({openOrders.length})</option>
                <option value="OPEN">Open</option>
                <option value="SENT_TO_KITCHEN">Sent to Kitchen</option>
                <option value="IN_PREP">In Preparation</option>
                <option value="READY">Ready to Serve</option>
                <option value="SERVED">Served</option>
              </select>
            </div>
            <button type="button" className="btn-secondary" onClick={refreshData}>
              🔄 Refresh List
            </button>
          </div>

          {filteredActiveOrders.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
              📭 No active orders found matching this filter.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Type / Table</th>
                    <th>Customer / Staff</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActiveOrders.map((ord) => {
                    const nextStatus = ORDER_STATUS_FLOW[ord.status];
                    return (
                      <tr key={ord.id}>
                        <td>
                          <code>#{ord.id.slice(0, 8)}</code>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {new Date(ord.created_locally_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td>
                          <strong>{ord.order_source.replace("_", " ")}</strong>
                          {ord.table_number && (
                            <span style={{ marginLeft: "6px" }} className="combo-badge">
                              Table {ord.table_number}
                            </span>
                          )}
                        </td>
                        <td>
                          <div>{ord.customer_name || "Guest"}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>By: {ord.created_by_name || "Staff"}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight: "700" }}>{ord.item_count ?? 0}</span> items
                        </td>
                        <td>
                          <strong style={{ color: "var(--accent)" }}>${ord.total.toFixed(2)}</strong>
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{
                              background:
                                ord.status === "OPEN"
                                  ? "#eff6ff"
                                  : ord.status === "SENT_TO_KITCHEN"
                                  ? "#fff8e1"
                                  : ord.status === "IN_PREP"
                                  ? "#fef3c7"
                                  : ord.status === "READY"
                                  ? "#edfaf4"
                                  : "#f3f0ff",
                              color:
                                ord.status === "OPEN"
                                  ? "#1d4ed8"
                                  : ord.status === "SENT_TO_KITCHEN"
                                  ? "#b45309"
                                  : ord.status === "IN_PREP"
                                  ? "#d97706"
                                  : ord.status === "READY"
                                  ? "#059669"
                                  : "#6d28d9",
                            }}
                          >
                            {ORDER_STATUS_LABELS[ord.status]}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons" style={{ flexWrap: "wrap", gap: "4px" }}>
                            {/* Fast Checkout / Pay */}
                            <button
                              type="button"
                              className="btn-success btn-sm"
                              style={{ fontWeight: "bold" }}
                              onClick={() => handleOpenPayment(ord)}
                              title="Process Payment & Close"
                            >
                              💵 Pay
                            </button>

                            {/* Print KOT */}
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => handlePrintKitchenTicket(ord)}
                              title="Print Kitchen Order Ticket"
                            >
                              🍳 KOT
                            </button>

                            {/* Print Customer Receipt */}
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => handlePrintCustomerReceipt(ord)}
                              title="Print Customer Receipt"
                            >
                              🧾 Receipt
                            </button>

                            {ord.status === "OPEN" && (
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                onClick={() => handleSendToKitchen(ord.id)}
                                title="Send order items to kitchen"
                              >
                                👨‍🍳 Send
                              </button>
                            )}

                            {nextStatus && (
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() => handleAdvanceStatus(ord)}
                              >
                                ➡️ {ORDER_STATUS_LABELS[nextStatus]}
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => handleOpenOrderDetails(ord)}
                            >
                              👁️ Items
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              onClick={() => openVoidOrderDialog(ord.id)}
                            >
                              🚫
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SUBTAB 3: TABLE & BILL OPERATIONS (T-035, T-036)                         */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeSubtab === "table_operations" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "16px" }}>
          {/* T-036: Merge Orders */}
          <div className="sub-card">
            <h5>🔀 Merge Two Table Orders (T-036)</h5>
            <p className="subtitle" style={{ marginBottom: "14px" }}>
              Combine items from a source order into a target order. Source table will be freed.
            </p>

            <div className="form-group">
              <label>Source Order (will be merged & closed)</label>
              <select value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)}>
                <option value="">Select source order...</option>
                {openOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id.slice(0, 8)} - {o.order_source} {o.table_number ? `(Table ${o.table_number})` : ""} - ${o.total.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Target Order (will receive all items)</label>
              <select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
                <option value="">Select target order...</option>
                {openOrders
                  .filter((o) => o.id !== mergeSourceId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.id.slice(0, 8)} - {o.order_source} {o.table_number ? `(Table ${o.table_number})` : ""} - ${o.total.toFixed(2)}
                    </option>
                  ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%", marginTop: "8px" }}
              disabled={!mergeSourceId || !mergeTargetId}
              onClick={handleMergeOrders}
            >
              Merge Orders
            </button>
          </div>

          {/* T-036: Split Bill */}
          <div className="sub-card">
            <h5>✂️ Split Bill / Sub-Bill (T-036)</h5>
            <p className="subtitle" style={{ marginBottom: "14px" }}>
              Select items from an active order to branch off onto a separate new bill.
            </p>

            <div className="form-group">
              <label>Select Order to Split</label>
              <select value={splitOrderId} onChange={(e) => handleSelectOrderForSplit(e.target.value)}>
                <option value="">Select order...</option>
                {openOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id.slice(0, 8)} - {o.order_source} {o.table_number ? `(Table ${o.table_number})` : ""} - ${o.total.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {splitOrderItemsList.length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "6px" }}>
                  Select items to move to NEW bill:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                  {splitOrderItemsList.map((item) => {
                    const isChecked = selectedItemIdsForSplit.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: isChecked ? "var(--accent-light)" : "var(--card-bg)",
                          border: isChecked ? "1px solid var(--accent)" : "1px solid var(--border-light)",
                          borderRadius: "8px",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSplitItemSelection(item.id)}
                          />
                          <span>
                            <strong>{item.quantity}x</strong> {item.item_name}
                          </span>
                        </div>
                        <span style={{ fontWeight: "700" }}>${(item.unit_price * item.quantity).toFixed(2)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%", marginTop: "8px" }}
              disabled={selectedItemIdsForSplit.length === 0}
              onClick={handleExecuteSplitBill}
            >
              Create Split Sub-Bill ({selectedItemIdsForSplit.length} items)
            </button>
          </div>

          {/* T-035: Reopen Closed Order within 30-min window */}
          <div className="sub-card" style={{ gridColumn: "1 / -1" }}>
            <h5>🔓 Reopen Closed / Served Order (T-035)</h5>
            <p className="subtitle" style={{ marginBottom: "14px" }}>
              Orders completed within the last {REOPEN_WINDOW_MINUTES} minutes can be reopened for corrections.
            </p>

            <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Type</th>
                    <th>Closed At</th>
                    <th>Elapsed</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allRecentOrders
                    .filter((o) => o.status === "SERVED" || o.status === "CLOSED")
                    .slice(0, 10)
                    .map((ord) => {
                      const elapsedMin = Math.floor((Date.now() - new Date(ord.created_locally_at).getTime()) / 60000);
                      const isExpired = elapsedMin > REOPEN_WINDOW_MINUTES;
                      return (
                        <tr key={ord.id}>
                          <td>
                            <code>#{ord.id.slice(0, 8)}</code>
                          </td>
                          <td>{ord.order_source}</td>
                          <td>{new Date(ord.created_locally_at).toLocaleTimeString()}</td>
                          <td>
                            <span style={{ color: isExpired ? "#c0392b" : "#059669", fontWeight: "700" }}>
                              {elapsedMin} min ago
                            </span>
                          </td>
                          <td>${ord.total.toFixed(2)}</td>
                          <td>
                            <span className="status-badge inactive">{ord.status}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={isExpired}
                              onClick={() => handleReopenOrder(ord.id)}
                            >
                              {isExpired ? "🔒 Window Expired" : "🔓 Reopen Order"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: ITEM CUSTOMIZATION (Variants / Modifiers / Notes)               */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {customizingItem && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "460px" }}>
            <h3>Customize {customizingItem.name}</h3>

            {/* Variant Options */}
            {itemVariants.length > 0 && (
              <div className="form-group">
                <label>Select Size / Option</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {itemVariants.map((v) => (
                    <label
                      key={v.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        border: selectedVariantId === v.id ? "2px solid var(--accent)" : "1.5px solid var(--border-light)",
                        borderRadius: "10px",
                        background: selectedVariantId === v.id ? "var(--accent-light)" : "var(--card-bg)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="radio"
                          name="variant"
                          checked={selectedVariantId === v.id}
                          onChange={() => setSelectedVariantId(v.id)}
                        />
                        <strong>{v.name}</strong>
                      </div>
                      <span style={{ fontWeight: "700", color: "var(--accent)" }}>${v.price.toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Modifiers / Add-ons */}
            {itemModifierOptions.length > 0 && (
              <div className="form-group">
                <label>Add-ons & Modifiers</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {itemModifierOptions.map((mod) => {
                    const isChecked = selectedModIds.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          border: isChecked ? "1.5px solid var(--accent)" : "1.5px solid var(--border-light)",
                          borderRadius: "10px",
                          background: isChecked ? "var(--accent-light)" : "var(--card-bg)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedModIds((prev) =>
                                prev.includes(mod.id) ? prev.filter((id) => id !== mod.id) : [...prev, mod.id]
                              );
                            }}
                          />
                          <span>{mod.name}</span>
                        </div>
                        <span style={{ fontWeight: "600", color: "var(--text-secondary)" }}>
                          +${mod.price_adjustment.toFixed(2)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Instructions */}
            <div className="form-group">
              <label>Special Instructions (optional)</label>
              <input
                type="text"
                value={customItemNotes}
                onChange={(e) => setCustomItemNotes(e.target.value)}
                placeholder="e.g. Extra crispy, no onions"
              />
            </div>

            {/* Quantity */}
            <div className="form-group">
              <label>Quantity</label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCustomItemQty((q) => Math.max(1, q - 1))}
                >
                  -
                </button>
                <span style={{ fontWeight: "800", fontSize: "16px" }}>{customItemQty}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCustomItemQty((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setCustomizingItem(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleAddCustomizedToCart}>
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: ORDER ITEMS DETAILS & LINE ITEM VOID (T-034)                   */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isDetailsModalOpen && selectedOrderDetails && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "560px" }}>
            <h3>Order Details #{selectedOrderDetails.id.slice(0, 8)}</h3>
            <p className="subtitle" style={{ marginBottom: "14px" }}>
              {selectedOrderDetails.order_source} {selectedOrderDetails.table_number ? `(Table ${selectedOrderDetails.table_number})` : ""} ·{" "}
              Status: <strong style={{ color: "var(--accent)" }}>{ORDER_STATUS_LABELS[selectedOrderDetails.status]}</strong>
            </p>

            <div className="table-responsive" style={{ maxHeight: "260px", overflowY: "auto" }}>
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orderDetailsItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.item_name}</strong>
                        {item.variant_label && <div style={{ fontSize: "11px", color: "var(--accent)" }}>{item.variant_label}</div>}
                        {item.modifiers && (
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            {JSON.parse(item.modifiers).join(", ")}
                          </div>
                        )}
                        {item.notes && <div style={{ fontSize: "11px", fontStyle: "italic" }}>"{item.notes}"</div>}
                      </td>
                      <td>{item.quantity}</td>
                      <td>${(item.unit_price * item.quantity).toFixed(2)}</td>
                      <td>
                        <span className="status-badge active" style={{ fontSize: "10px" }}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          onClick={() => openVoidItemDialog(selectedOrderDetails.id, item.id)}
                        >
                          Void Item
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginTop: "16px", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
              <div style={{ fontSize: "16px" }}>
                <strong>Total: ${selectedOrderDetails.total.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    handlePrintKitchenTicket(selectedOrderDetails);
                  }}
                >
                  🍳 Print KOT
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    handlePrintCustomerReceipt(selectedOrderDetails);
                  }}
                >
                  🧾 Print Receipt
                </button>
                {selectedOrderDetails.status !== "CLOSED" && (
                  <button
                    type="button"
                    className="btn-success btn-sm"
                    style={{ fontWeight: "bold" }}
                    onClick={() => {
                      const ord = selectedOrderDetails;
                      setIsDetailsModalOpen(false);
                      handleOpenPayment(ord);
                    }}
                  >
                    💵 Pay & Close
                  </button>
                )}
                <button type="button" className="btn-secondary btn-sm" onClick={() => setIsDetailsModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: MANAGER PIN VOID APPROVAL (T-034)                               */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {voidModalOpen && voidTarget && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "420px" }}>
            <h3 style={{ color: "#c0392b" }}>🔒 Manager PIN Approval Required</h3>
            <p className="subtitle" style={{ marginBottom: "16px" }}>
              Voiding a {voidTarget.type === "ORDER" ? "whole order" : "line item"} requires Manager or Admin authorization.
            </p>

            {voidError && (
              <div className="pin-error" style={{ marginBottom: "12px" }}>
                {voidError}
              </div>
            )}

            <div className="form-group">
              <label>Reason for Void</label>
              <select value={voidReason} onChange={(e) => setVoidReason(e.target.value)}>
                <option value="">Select reason...</option>
                <option value="Customer changed mind">Customer changed mind</option>
                <option value="Wrong item rung up">Wrong item rung up</option>
                <option value="Kitchen error / Remake">Kitchen error / Remake</option>
                <option value="Quality complaint">Quality complaint</option>
                <option value="Other / Management override">Other / Management override</option>
              </select>
            </div>

            <div className="form-group">
              <label>Manager / Admin PIN</label>
              <input
                type="password"
                maxLength={8}
                value={approverPin}
                onChange={(e) => setApproverPin(e.target.value)}
                placeholder="Enter 4-digit PIN"
                autoFocus
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setVoidModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={handleConfirmVoid}>
                Authorize & Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: PAYMENT & FAST CHECKOUT MODAL                                  */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {paymentModalOrder && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "460px" }}>
            <h3>💵 Checkout & Payment</h3>
            <p className="subtitle" style={{ marginBottom: "14px" }}>
              Order #{paymentModalOrder.id.slice(0, 8)} · {paymentModalOrder.order_source}{" "}
              {paymentModalOrder.table_number ? `(Table ${paymentModalOrder.table_number})` : ""}
            </p>

            {paymentError && (
              <div className="pin-error" style={{ marginBottom: "12px" }}>
                {paymentError}
              </div>
            )}

            <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "4px" }}>
                <span>Bill Total Due:</span>
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "var(--accent)" }}>
                  ${paymentModalOrder.total.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Payment Method</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  className={`btn-secondary ${paymentMethod === "CASH" ? "btn-primary" : ""}`}
                  style={{ padding: "10px", fontWeight: paymentMethod === "CASH" ? "bold" : "normal" }}
                  onClick={() => setPaymentMethod("CASH")}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${paymentMethod === "CARD" ? "btn-primary" : ""}`}
                  style={{ padding: "10px", fontWeight: paymentMethod === "CARD" ? "bold" : "normal" }}
                  onClick={() => setPaymentMethod("CARD")}
                >
                  💳 Card
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${paymentMethod === "DIGITAL" ? "btn-primary" : ""}`}
                  style={{ padding: "10px", fontWeight: paymentMethod === "DIGITAL" ? "bold" : "normal" }}
                  onClick={() => setPaymentMethod("DIGITAL")}
                >
                  📱 Digital / QR
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Amount Tendered ($)</label>
              <input
                type="number"
                step="any"
                min={paymentModalOrder.total}
                value={paymentTendered}
                onChange={(e) => setPaymentTendered(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "10px", fontSize: "16px", borderRadius: "6px", border: "1px solid #ccc" }}
                autoFocus
              />
              <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setPaymentTendered(paymentModalOrder.total)}
                >
                  Exact (${paymentModalOrder.total.toFixed(2)})
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setPaymentTendered(Math.ceil(paymentModalOrder.total / 10) * 10)}
                >
                  Round $10
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setPaymentTendered(Math.ceil(paymentModalOrder.total / 50) * 50 || 50)}
                >
                  $50
                </button>
              </div>
            </div>

            {/* Change Due Display */}
            <div
              style={{
                background: paymentTendered >= paymentModalOrder.total ? "#e8f5e9" : "#fff3e0",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: "bold" }}>Change Due:</span>
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: paymentTendered >= paymentModalOrder.total ? "#2e7d32" : "#e65100",
                }}
              >
                ${Math.max(0, paymentTendered - paymentModalOrder.total).toFixed(2)}
              </span>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setPaymentModalOrder(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-success"
                style={{ padding: "10px 20px", fontWeight: "bold" }}
                onClick={handleProcessPaymentSubmit}
              >
                ✅ Complete & Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 5: REUSABLE PRINTABLE RECEIPT MODAL                               */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {receiptModalData && (
        <ReceiptModal
          receiptData={receiptModalData}
          initialType={receiptModalType}
          onClose={() => setReceiptModalData(null)}
        />
      )}
    </div>
  );
}
