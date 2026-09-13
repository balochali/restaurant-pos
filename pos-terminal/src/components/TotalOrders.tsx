import { useState, useEffect, useMemo, useCallback } from "react";
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import {
    getClosedOrders,
    getOrderItems,
    getTopSellingItems,
    getCategorySales,
    DbOrder,
    DbOrderItem,
    TopSellingItem,
    CategorySalesSummary,
} from "../lib/orderService";
import { formatCurrency } from "../lib/formatCurrency";
import ReceiptModal from "./ReceiptModal";
import {
    IconChart,
    IconReceipt,
    IconCash,
    IconClock,
    IconSearch,
    IconClose,
    IconPrint,
    IconUtensils,
    IconCard,
    IconTakeaway,
    IconDelivery,
    IconTable,
} from "./Icons";

type Period = "today" | "7d" | "30d" | "all";
type ChartTab = "trend" | "hourly" | "topItems" | "categories" | "payment" | "source";
type TrendMetric = "sales" | "orders" | "both";

const PERIOD_LABELS: Record<Period, string> = {
    today: "Today",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    all: "All Time",
};

// High-Contrast, Multi-Color Restaurant POS Palette
const RESTAURANT_COLORS = [
    "#059669", // Emerald Green (Cash / Dine-In / Growth)
    "#E11D48", // Fiery Coral Red (Dinner Rush / Grill / Meat)
    "#D97706", // Amber Gold (Breakfast / Bakery / Tips)
    "#2563EB", // Royal Cobalt Blue (Delivery / Seafood)
    "#7C3AED", // Vivid Purple (Chef Specials / Combos)
    "#0891B2", // Caribbean Cyan (Beverages / Bar)
    "#DB2777", // Hot Pink (Desserts / Ice Cream / Sweets)
    "#EA580C", // Sunset Orange (Takeaway / Fast Food / Snacks)
    "#4F46E5", // Indigo (Card Transactions / Electronic)
    "#16A34A", // Fresh Lime Green (Salads / Healthy)
];

// Meal Period Definitions for Hourly Rush Analysis
interface MealPeriod {
    name: string;
    icon: string;
    hours: [number, number]; // [startHour, endHourInclusive]
    color: string;
    bg: string;
}

const MEAL_PERIODS: MealPeriod[] = [
    { name: "Breakfast", icon: "🌅", hours: [6, 10], color: "#D97706", bg: "#FEF3C7" },
    { name: "Lunch Rush", icon: "☀️", hours: [11, 14], color: "#059669", bg: "#D1FAE5" },
    { name: "Afternoon / Tea", icon: "☕", hours: [15, 17], color: "#0891B2", bg: "#CFFAFE" },
    { name: "Dinner Rush", icon: "🍽️", hours: [18, 21], color: "#E11D48", bg: "#FFE4E6" },
    { name: "Late Night", icon: "🌙", hours: [22, 5], color: "#6366F1", bg: "#E0E7FF" },
];

function getMealPeriodForHour(hour: number): MealPeriod {
    if (hour >= 6 && hour <= 10) return MEAL_PERIODS[0];
    if (hour >= 11 && hour <= 14) return MEAL_PERIODS[1];
    if (hour >= 15 && hour <= 17) return MEAL_PERIODS[2];
    if (hour >= 18 && hour <= 21) return MEAL_PERIODS[3];
    return MEAL_PERIODS[4]; // 22 to 5
}

function startOfLocalDay(daysAgo: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
}

function localDateKey(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function localDateLabel(dateKey: string): string {
    const d = new Date(dateKey + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shortDateLabel(dateKey: string): string {
    const d = new Date(dateKey + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatHourLabel(hour: number): string {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div
            style={{
                background: "#1E293B",
                color: "#F8FAFC",
                borderRadius: "12px",
                padding: "10px 14px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
                fontSize: "12px",
                minWidth: "150px",
                border: "1px solid #334155",
            }}
        >
            {label && <div style={{ fontWeight: 800, marginBottom: "6px", color: "#F1F5F9", borderBottom: "1px solid #334155", paddingBottom: "4px" }}>{label}</div>}
            {payload.map((p: any, i: number) => {
                const isCurrency =
                    p.name?.toLowerCase().includes("sales") ||
                    p.name?.toLowerCase().includes("revenue") ||
                    p.dataKey === "sales" ||
                    p.dataKey === "value";
                const seriesColor = p.color || p.payload?.fill || "#38BDF8";
                return (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            margin: "3px 0",
                            fontWeight: 600,
                        }}
                    >
                        <span style={{ color: seriesColor, display: "flex", alignItems: "center", gap: "5px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: seriesColor, display: "inline-block" }} />
                            {p.name}:
                        </span>
                        <span style={{ fontWeight: 800, color: "#FFFFFF" }}>
                            {typeof p.value === "number" && isCurrency ? formatCurrency(p.value) : p.value}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default function TotalOrders() {
    const [orders, setOrders] = useState<DbOrder[]>([]);
    const [topSelling, setTopSelling] = useState<TopSellingItem[]>([]);
    const [categorySales, setCategorySales] = useState<CategorySalesSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [period, setPeriod] = useState<Period>("today");
    const [ordersPage, setOrdersPage] = useState(1);
    const [chartTab, setChartTab] = useState<ChartTab>("trend");
    const [trendMetric, setTrendMetric] = useState<TrendMetric>("both");

    // Search and filters for completed orders table
    const [searchQuery, setSearchQuery] = useState("");
    const [filterSource, setFilterSource] = useState<string>("ALL");
    const [filterPayment, setFilterPayment] = useState<string>("ALL");

    // Order detail & receipt inspection modal
    const [selectedOrder, setSelectedOrder] = useState<DbOrder | null>(null);
    const [selectedOrderItems, setSelectedOrderItems] = useState<DbOrderItem[]>([]);
    const [loadingOrderItems, setLoadingOrderItems] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    const ORDERS_PER_PAGE = 10;

    const refresh = useCallback(() => {
        setLoading(true);
        setError("");

        const daysAgo = period === "today" ? 0 : period === "7d" ? 6 : period === "30d" ? 29 : undefined;
        const cutoffIso = daysAgo !== undefined ? startOfLocalDay(daysAgo).toISOString() : undefined;

        Promise.all([
            getClosedOrders(1000),
            getTopSellingItems(10, cutoffIso).catch(() => []),
            getCategorySales(cutoffIso).catch(() => []),
        ])
            .then(([allOrders, topItems, catSales]) => {
                setOrders(allOrders);
                setTopSelling(topItems);
                setCategorySales(catSales);
            })
            .catch((err) => setError(String(err)))
            .finally(() => setLoading(false));
    }, [period]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const periodOrders = useMemo(() => {
        if (period === "all") return orders;
        const daysAgo = period === "today" ? 0 : period === "7d" ? 6 : 29;
        const cutoff = startOfLocalDay(daysAgo);
        return orders.filter((o) => new Date(o.created_locally_at) >= cutoff);
    }, [orders, period]);

    // Reset pagination on filter / period changes
    useEffect(() => {
        setOrdersPage(1);
    }, [period, searchQuery, filterSource, filterPayment]);

    // Key financial & operational metrics
    const stats = useMemo(() => {
        const totalOrders = periodOrders.length;
        const totalSales = periodOrders.reduce((sum, o) => sum + o.total, 0);
        const totalDiscount = periodOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
        const totalTax = periodOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
        const netSales = periodOrders.reduce((sum, o) => sum + (o.subtotal || o.total), 0);
        const grossSales = totalSales + totalDiscount;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
        const discountRate = grossSales > 0 ? (totalDiscount / grossSales) * 100 : 0;

        const byMethod: Record<string, { total: number; count: number }> = {};
        const bySource: Record<string, { total: number; count: number }> = {};

        for (const o of periodOrders) {
            const method = o.payment_method || "OTHER";
            const curM = byMethod[method] || { total: 0, count: 0 };
            curM.total += o.total;
            curM.count += 1;
            byMethod[method] = curM;

            const source = o.order_source || "DINE_IN";
            const curS = bySource[source] || { total: 0, count: 0 };
            curS.total += o.total;
            curS.count += 1;
            bySource[source] = curS;
        }

        return {
            totalOrders,
            totalSales,
            grossSales,
            netSales,
            totalDiscount,
            totalTax,
            discountRate,
            avgOrderValue,
            byMethod,
            bySource,
        };
    }, [periodOrders]);

    // ─── Hourly Rush Breakdown by Meal Periods ────────────────────────────────
    const hourlyBreakdown = useMemo(() => {
        const hourMap = new Map<number, { hour: number; orders: number; sales: number }>();
        for (let h = 0; h < 24; h++) {
            hourMap.set(h, { hour: h, orders: 0, sales: 0 });
        }

        for (const o of periodOrders) {
            const d = new Date(o.created_locally_at);
            const h = d.getHours();
            const entry = hourMap.get(h) || { hour: h, orders: 0, sales: 0 };
            entry.orders += 1;
            entry.sales += o.total;
            hourMap.set(h, entry);
        }

        const list = Array.from(hourMap.values());
        let peak = list[0];
        for (const entry of list) {
            if (entry.sales > (peak?.sales || 0)) {
                peak = entry;
            }
        }

        const formatted = list.map((item) => {
            const meal = getMealPeriodForHour(item.hour);
            const isPeak = peak && item.hour === peak.hour && item.orders > 0;
            return {
                ...item,
                label: formatHourLabel(item.hour),
                mealName: meal.name,
                mealColor: isPeak ? "#EF4444" : meal.color,
                isPeak,
            };
        });

        return { list: formatted, peak };
    }, [periodOrders]);

    // ─── Daily Breakdown ─────────────────────────────────────────────────────
    const dailyBreakdown = useMemo(() => {
        const groups = new Map<string, { count: number; total: number }>();
        for (const o of periodOrders) {
            const key = localDateKey(o.created_locally_at);
            const entry = groups.get(key) || { count: 0, total: 0 };
            entry.count += 1;
            entry.total += o.total;
            groups.set(key, entry);
        }
        return Array.from(groups.entries())
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .map(([dateKey, data]) => ({ dateKey, ...data }));
    }, [periodOrders]);

    const trendChartData = useMemo(
        () =>
            [...dailyBreakdown]
                .reverse()
                .map((row, idx) => ({
                    label: shortDateLabel(row.dateKey),
                    dateFull: localDateLabel(row.dateKey),
                    sales: row.total,
                    orders: row.count,
                    color: RESTAURANT_COLORS[idx % RESTAURANT_COLORS.length],
                    avgTicket: row.count > 0 ? Math.round(row.total / row.count) : 0,
                })),
        [dailyBreakdown]
    );

    // ─── Payment Methods Chart Data ──────────────────────────────────────────
    const PAYMENT_COLORS: Record<string, string> = {
        CASH: "#059669",    // Emerald Green
        CARD: "#4F46E5",    // Indigo Blue
        DIGITAL: "#0891B2", // Cyan Teal
        OTHER: "#D97706",   // Amber Orange
    };

    const paymentChartData = useMemo(
        () =>
            Object.entries(stats.byMethod).map(([method, data]) => ({
                name: method,
                value: data.total,
                orders: data.count,
                color: PAYMENT_COLORS[method] || "#64748B",
                pct: stats.totalSales > 0 ? Math.round((data.total / stats.totalSales) * 100) : 0,
            })),
        [stats.byMethod, stats.totalSales]
    );

    // ─── Order Source Chart Data ─────────────────────────────────────────────
    const SOURCE_COLORS: Record<string, string> = {
        DINE_IN: "#059669",  // Emerald Green
        TAKEAWAY: "#EA580C", // Tangerine Orange
        DELIVERY: "#2563EB", // Royal Blue
    };

    const sourceChartData = useMemo(
        () =>
            Object.entries(stats.bySource).map(([source, data]) => ({
                name: source.replace("_", " "),
                rawSource: source,
                value: data.total,
                orders: data.count,
                color: SOURCE_COLORS[source] || "#7C3AED",
                avgTicket: data.count > 0 ? data.total / data.count : 0,
                pct: stats.totalSales > 0 ? Math.round((data.total / stats.totalSales) * 100) : 0,
            })),
        [stats.bySource, stats.totalSales]
    );

    // ─── Top Selling Items Chart Data ────────────────────────────────────────
    const topItemsChartData = useMemo(
        () =>
            topSelling.slice(0, 8).map((item, idx) => ({
                name: item.itemName.length > 16 ? item.itemName.slice(0, 15) + "…" : item.itemName,
                fullName: item.itemName,
                category: item.categoryName,
                quantity: item.totalQty,
                sales: item.totalRevenue,
                color: RESTAURANT_COLORS[idx % RESTAURANT_COLORS.length],
            })),
        [topSelling]
    );

    // ─── Category Sales Chart Data ───────────────────────────────────────────
    const categoryChartData = useMemo(
        () =>
            categorySales.map((cat, idx) => ({
                name: cat.categoryName,
                value: cat.totalRevenue,
                quantity: cat.totalQty,
                color: RESTAURANT_COLORS[(idx + 2) % RESTAURANT_COLORS.length],
            })),
        [categorySales]
    );

    // ─── Filtered Recent Orders ──────────────────────────────────────────────
    const filteredOrders = useMemo(() => {
        return periodOrders.filter((o) => {
            if (filterSource !== "ALL" && o.order_source !== filterSource) return false;
            if (filterPayment !== "ALL") {
                const method = o.payment_method || "OTHER";
                if (method !== filterPayment) return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const idMatch = o.id.toLowerCase().includes(q);
                const cashierMatch = (o.created_by_name || "").toLowerCase().includes(q);
                const customerMatch = (o.customer_name || "").toLowerCase().includes(q);
                const phoneMatch = (o.customer_phone || "").toLowerCase().includes(q);
                const tableMatch = o.table_number ? `table ${o.table_number}`.toLowerCase().includes(q) : false;
                if (!idMatch && !cashierMatch && !customerMatch && !phoneMatch && !tableMatch) return false;
            }
            return true;
        });
    }, [periodOrders, filterSource, filterPayment, searchQuery]);

    const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
    const safeOrdersPage = Math.min(ordersPage, totalOrderPages);
    const pagedOrders = filteredOrders.slice(
        (safeOrdersPage - 1) * ORDERS_PER_PAGE,
        safeOrdersPage * ORDERS_PER_PAGE
    );

    const handleInspectOrder = async (order: DbOrder) => {
        setSelectedOrder(order);
        setLoadingOrderItems(true);
        try {
            const items = await getOrderItems(order.id);
            setSelectedOrderItems(items);
        } catch (e) {
            console.error("Failed to load order items:", e);
            setSelectedOrderItems([]);
        } finally {
            setLoadingOrderItems(false);
        }
    };

    const handlePrintSummary = () => {
        const printWin = window.open("", "_blank");
        if (!printWin) return;
        const nowStr = new Date().toLocaleString();
        printWin.document.write(`
            <html>
            <head>
                <title>Restaurant Sales Summary - ${PERIOD_LABELS[period]}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #111; }
                    h2 { margin-bottom: 4px; color: #0F3D3A; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                    th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { font-weight: bold; background: #f8fafc; }
                    .num { text-align: right; font-variant-numeric: tabular-nums; }
                    .summary-box { border: 2px solid #059669; border-radius: 8px; padding: 16px; margin: 16px 0; background: #F0FDF4; }
                </style>
            </head>
            <body>
                <h2>RESTAURANT SALES SUMMARY REPORT</h2>
                <div>Period: <strong>${PERIOD_LABELS[period]}</strong> | Generated: ${nowStr}</div>
                <div class="summary-box">
                    <p><strong>Completed Orders:</strong> ${stats.totalOrders}</p>
                    <p><strong>Total Gross Revenue:</strong> ${formatCurrency(stats.totalSales)}</p>
                    <p><strong>Average Ticket Size:</strong> ${formatCurrency(stats.avgOrderValue)}</p>
                    <p><strong>Tax Collected:</strong> ${formatCurrency(stats.totalTax)}</p>
                    <p><strong>Discounts / Comps:</strong> ${formatCurrency(stats.totalDiscount)} (${stats.discountRate.toFixed(1)}%)</p>
                </div>
                <h3>Daily Breakdown</h3>
                <table>
                    <thead>
                        <tr><th>Date</th><th class="num">Orders</th><th class="num">Total Sales</th></tr>
                    </thead>
                    <tbody>
                        ${dailyBreakdown
                            .map(
                                (r) => `
                            <tr>
                                <td>${localDateLabel(r.dateKey)}</td>
                                <td class="num">${r.count}</td>
                                <td class="num font-bold">${formatCurrency(r.total)}</td>
                            </tr>
                        `
                            )
                            .join("")}
                    </tbody>
                </table>
            </body>
            </html>
        `);
        printWin.document.close();
        printWin.focus();
        printWin.print();
    };

    return (
        <div className="card full-width-card" style={{ padding: "24px" }}>
            {/* Header row */}
            <div className="card-header-row" style={{ marginBottom: "18px" }}>
                <div>
                    <h4 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0, fontSize: "20px" }}>
                        <span style={{ background: "linear-gradient(135deg, #E11D48 0%, #F59E0B 100%)", color: "#FFF", width: "32px", height: "32px", borderRadius: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(225, 29, 72, 0.3)" }}>
                            <IconChart size={18} color="#FFFFFF" />
                        </span>
                        Fast Food Sales & Orders Intelligence
                    </h4>
                    <p className="subtitle" style={{ marginTop: "4px" }}>
                        Counter & drive-thru sales performance, meal rush hours, top menu items, and completed transaction history
                    </p>
                </div>

                <div className="filter-controls" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={handlePrintSummary}
                        style={{ display: "flex", alignItems: "center", gap: "6px" }}
                        title="Print period sales report"
                    >
                        <IconPrint size={16} /> Print Report
                    </button>
                    <button type="button" className="btn-secondary" onClick={refresh}>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Period selector */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                    <button
                        key={p}
                        type="button"
                        className={`sub-nav-tab ${period === p ? "active" : ""}`}
                        onClick={() => setPeriod(p)}
                        style={{
                            fontWeight: period === p ? 700 : 500,
                            borderWidth: "1.5px",
                        }}
                    >
                        {PERIOD_LABELS[p]}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
                    <IconChart size={38} color="#059669" />
                    <p style={{ marginTop: "12px", fontSize: "14px", fontWeight: 600 }}>Loading restaurant analytics...</p>
                </div>
            ) : error ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    <p>Failed to load analytics: {error}</p>
                    <button type="button" className="btn-primary" onClick={refresh} style={{ marginTop: "10px" }}>
                        Try Again
                    </button>
                </div>
            ) : (
                <>
                    {/* High-Contrast Multi-Color Restaurant KPI Grid */}
                    <div className="stats-grid" style={{ marginBottom: "26px" }}>
                        {/* 1. Total Sales (Emerald Green) */}
                        <div
                            className="stat-card"
                            style={{
                                borderLeft: "4px solid #059669",
                                background: "linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)",
                                borderColor: "#A7F3D0",
                            }}
                        >
                            <div
                                className="stat-icon-wrapper"
                                style={{
                                    background: "#DCFCE7",
                                    color: "#059669",
                                    boxShadow: "0 2px 8px rgba(5, 150, 105, 0.2)",
                                }}
                            >
                                <IconCash size={24} color="#059669" />
                            </div>
                            <div>
                                <div className="stat-value" style={{ color: "#047857" }}>
                                    {formatCurrency(stats.totalSales)}
                                </div>
                                <div className="stat-label" style={{ fontWeight: 600 }}>
                                    Total Sales ({PERIOD_LABELS[period]})
                                </div>
                            </div>
                        </div>

                        {/* 2. Completed Orders (Cobalt Blue) */}
                        <div
                            className="stat-card"
                            style={{
                                borderLeft: "4px solid #2563EB",
                                background: "linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 100%)",
                                borderColor: "#BFDBFE",
                            }}
                        >
                            <div
                                className="stat-icon-wrapper"
                                style={{
                                    background: "#DBEAFE",
                                    color: "#2563EB",
                                    boxShadow: "0 2px 8px rgba(37, 99, 235, 0.2)",
                                }}
                            >
                                <IconReceipt size={24} color="#2563EB" />
                            </div>
                            <div>
                                <div className="stat-value" style={{ color: "#1D4ED8" }}>
                                    {stats.totalOrders}
                                </div>
                                <div className="stat-label" style={{ fontWeight: 600 }}>Completed Orders</div>
                            </div>
                        </div>

                        {/* 3. Average Ticket (Amber Gold) */}
                        <div
                            className="stat-card"
                            style={{
                                borderLeft: "4px solid #D97706",
                                background: "linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 100%)",
                                borderColor: "#FDE68A",
                            }}
                        >
                            <div
                                className="stat-icon-wrapper"
                                style={{
                                    background: "#FEF3C7",
                                    color: "#D97706",
                                    boxShadow: "0 2px 8px rgba(217, 119, 6, 0.2)",
                                }}
                            >
                                <IconChart size={24} color="#D97706" />
                            </div>
                            <div>
                                <div className="stat-value" style={{ color: "#B45309" }}>
                                    {formatCurrency(stats.avgOrderValue)}
                                </div>
                                <div className="stat-label" style={{ fontWeight: 600 }}>Avg Ticket Size</div>
                            </div>
                        </div>

                        {/* 4. Peak Rush Hour (Fiery Coral Red) */}
                        <div
                            className="stat-card"
                            style={{
                                borderLeft: "4px solid #E11D48",
                                background: "linear-gradient(135deg, #FFFFFF 0%, #FFF1F2 100%)",
                                borderColor: "#FECDD3",
                            }}
                        >
                            <div
                                className="stat-icon-wrapper"
                                style={{
                                    background: "#FFE4E6",
                                    color: "#E11D48",
                                    boxShadow: "0 2px 8px rgba(225, 29, 72, 0.2)",
                                }}
                            >
                                <IconClock size={24} color="#E11D48" />
                            </div>
                            <div>
                                <div className="stat-value" style={{ fontSize: "18px", color: "#BE123C" }}>
                                    {hourlyBreakdown.peak && hourlyBreakdown.peak.orders > 0
                                        ? `${formatHourLabel(hourlyBreakdown.peak.hour)} - ${formatHourLabel((hourlyBreakdown.peak.hour + 1) % 24)}`
                                        : "—"}
                                </div>
                                <div className="stat-label" style={{ fontWeight: 600 }}>
                                    Busiest Rush Hour{" "}
                                    {hourlyBreakdown.peak && hourlyBreakdown.peak.orders > 0 && (
                                        <span style={{ fontSize: "11px", color: "#BE123C", fontWeight: 700 }}>
                                            🔥 {hourlyBreakdown.peak.orders} orders
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 5. Discounts & Comps (Hot Pink) */}
                        <div
                            className="stat-card"
                            style={{
                                borderLeft: "4px solid #DB2777",
                                background: "linear-gradient(135deg, #FFFFFF 0%, #FDF2F8 100%)",
                                borderColor: "#FBCFE8",
                            }}
                        >
                            <div
                                className="stat-icon-wrapper"
                                style={{
                                    background: "#FCE7F3",
                                    color: "#DB2777",
                                    boxShadow: "0 2px 8px rgba(219, 39, 119, 0.2)",
                                }}
                            >
                                <IconReceipt size={24} color="#DB2777" />
                            </div>
                            <div>
                                <div className="stat-value" style={{ color: "#BE185D" }}>
                                    {formatCurrency(stats.totalDiscount)}
                                </div>
                                <div className="stat-label" style={{ fontWeight: 600 }}>
                                    Discounts & Comps{" "}
                                    {stats.discountRate > 0 && (
                                        <span style={{ fontSize: "11px", color: "#9D174D", fontWeight: 700 }}>
                                            ({stats.discountRate.toFixed(1)}%)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 6. Top Selling Item (Vivid Violet) */}
                        <div
                            className="stat-card"
                            style={{
                                borderLeft: "4px solid #7C3AED",
                                background: "linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)",
                                borderColor: "#DDD6FE",
                            }}
                        >
                            <div
                                className="stat-icon-wrapper"
                                style={{
                                    background: "#EDE9FE",
                                    color: "#7C3AED",
                                    boxShadow: "0 2px 8px rgba(124, 58, 237, 0.2)",
                                }}
                            >
                                <IconUtensils size={24} color="#7C3AED" />
                            </div>
                            <div>
                                <div
                                    className="stat-value"
                                    style={{
                                        fontSize: "16px",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        maxWidth: "160px",
                                        color: "#6D28D9",
                                    }}
                                    title={topSelling[0]?.itemName || "None"}
                                >
                                    {topSelling[0]?.itemName || "—"}
                                </div>
                                <div className="stat-label" style={{ fontWeight: 600 }}>
                                    ⭐ #1 Best Seller {topSelling[0] && `(${topSelling[0].totalQty} sold)`}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Graphical Tabs Bar */}
                    <div style={{ marginBottom: "22px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                <button
                                    type="button"
                                    className={`sub-nav-tab ${chartTab === "trend" ? "active" : ""}`}
                                    onClick={() => setChartTab("trend")}
                                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                                >
                                    <span>📈</span> Sales & Volume Trend
                                </button>
                                <button
                                    type="button"
                                    className={`sub-nav-tab ${chartTab === "hourly" ? "active" : ""}`}
                                    onClick={() => setChartTab("hourly")}
                                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                                >
                                    <span>⏰</span> Meal Rush Hours
                                </button>
                                <button
                                    type="button"
                                    className={`sub-nav-tab ${chartTab === "topItems" ? "active" : ""}`}
                                    onClick={() => setChartTab("topItems")}
                                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                                >
                                    <span>🏆</span> Top Menu Items
                                </button>
                                <button
                                    type="button"
                                    className={`sub-nav-tab ${chartTab === "categories" ? "active" : ""}`}
                                    onClick={() => setChartTab("categories")}
                                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                                >
                                    <span>📂</span> Category Mix
                                </button>
                                <button
                                    type="button"
                                    className={`sub-nav-tab ${chartTab === "payment" ? "active" : ""}`}
                                    onClick={() => setChartTab("payment")}
                                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                                >
                                    <span>💳</span> Payment Methods
                                </button>
                                <button
                                    type="button"
                                    className={`sub-nav-tab ${chartTab === "source" ? "active" : ""}`}
                                    onClick={() => setChartTab("source")}
                                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                                >
                                    <span>🍽️</span> Dining Channels
                                </button>
                            </div>

                            {/* Sub-controls for Trend Tab */}
                            {chartTab === "trend" && (
                                <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                                    <button
                                        type="button"
                                        className="btn-secondary btn-sm"
                                        style={{
                                            background: trendMetric === "sales" ? "#059669" : "transparent",
                                            color: trendMetric === "sales" ? "#FFFFFF" : "#334155",
                                            fontWeight: 700,
                                            borderRadius: "7px",
                                            border: "none",
                                        }}
                                        onClick={() => setTrendMetric("sales")}
                                    >
                                        Sales ($)
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-secondary btn-sm"
                                        style={{
                                            background: trendMetric === "orders" ? "#EA580C" : "transparent",
                                            color: trendMetric === "orders" ? "#FFFFFF" : "#334155",
                                            fontWeight: 700,
                                            borderRadius: "7px",
                                            border: "none",
                                        }}
                                        onClick={() => setTrendMetric("orders")}
                                    >
                                        Tickets (Qty)
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-secondary btn-sm"
                                        style={{
                                            background: trendMetric === "both" ? "#2563EB" : "transparent",
                                            color: trendMetric === "both" ? "#FFFFFF" : "#334155",
                                            fontWeight: 700,
                                            borderRadius: "7px",
                                            border: "none",
                                        }}
                                        onClick={() => setTrendMetric("both")}
                                    >
                                        Dual View
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Chart Canvas Card */}
                        <div
                            style={{
                                border: "1.5px solid #E2E8F0",
                                borderRadius: "18px",
                                padding: "22px",
                                background: "#FFFFFF",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                            }}
                        >
                            {/* TAB 1: Trend Chart */}
                            {chartTab === "trend" && (
                                trendChartData.length === 0 ? (
                                    <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <p>No completed orders in this period yet.</p>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px", fontSize: "13px", color: "var(--text-secondary)", flexWrap: "wrap", gap: "8px" }}>
                                            <span style={{ fontWeight: 600 }}>Daily revenue & ticket progression over {trendChartData.length} day(s)</span>
                                            <div style={{ display: "flex", gap: "12px" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                    <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#059669" }} />
                                                    Revenue: <strong style={{ color: "#047857" }}>{formatCurrency(stats.totalSales)}</strong>
                                                </span>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                    <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#EA580C" }} />
                                                    Volume: <strong style={{ color: "#C2410C" }}>{stats.totalOrders} tickets</strong>
                                                </span>
                                            </div>
                                        </div>
                                        <ResponsiveContainer width="100%" height={320}>
                                            {trendMetric === "sales" ? (
                                                <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }} axisLine={{ stroke: "#CBD5E1" }} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar dataKey="sales" name="Daily Sales" radius={[6, 6, 0, 0]}>
                                                        {trendChartData.map((entry, i) => (
                                                            <Cell key={i} fill={entry.color} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            ) : trendMetric === "orders" ? (
                                                <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }} axisLine={{ stroke: "#CBD5E1" }} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar dataKey="orders" name="Order Tickets" fill="#EA580C" radius={[6, 6, 0, 0]} />
                                                </BarChart>
                                            ) : (
                                                <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }} axisLine={{ stroke: "#CBD5E1" }} tickLine={false} />
                                                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#059669", fontWeight: 600 }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#EA580C", fontWeight: 600 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Legend wrapperStyle={{ paddingTop: "10px" }} />
                                                    <Bar yAxisId="left" dataKey="sales" name="Sales ($)" fill="#059669" radius={[6, 6, 0, 0]} />
                                                    <Bar yAxisId="right" dataKey="orders" name="Tickets (Qty)" fill="#EA580C" radius={[6, 6, 0, 0]} />
                                                </BarChart>
                                            )}
                                        </ResponsiveContainer>
                                    </div>
                                )
                            )}

                            {/* TAB 2: Hourly Rush Hours with Meal Period Color Coding */}
                            {chartTab === "hourly" && (
                                <div>
                                    {/* Meal Period Legend Banner */}
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                            gap: "10px",
                                            marginBottom: "16px",
                                            padding: "10px 14px",
                                            background: "#F8FAFC",
                                            borderRadius: "12px",
                                            border: "1px solid #E2E8F0",
                                        }}
                                    >
                                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Meal Sessions:</span>
                                            {MEAL_PERIODS.map((m) => (
                                                <span
                                                    key={m.name}
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "4px",
                                                        padding: "3px 8px",
                                                        borderRadius: "6px",
                                                        background: m.bg,
                                                        color: m.color,
                                                        fontSize: "11px",
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    <span>{m.icon}</span> {m.name}
                                                </span>
                                            ))}
                                        </div>

                                        {hourlyBreakdown.peak && hourlyBreakdown.peak.orders > 0 && (
                                            <span
                                                style={{
                                                    background: "#FEE2E2",
                                                    color: "#DC2626",
                                                    border: "1px solid #FCA5A5",
                                                    padding: "4px 10px",
                                                    borderRadius: "8px",
                                                    fontSize: "12px",
                                                    fontWeight: 800,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                }}
                                            >
                                                🔥 Peak: {formatHourLabel(hourlyBreakdown.peak.hour)} - {formatHourLabel((hourlyBreakdown.peak.hour + 1) % 24)} ({hourlyBreakdown.peak.orders} orders, {formatCurrency(hourlyBreakdown.peak.sales)})
                                            </span>
                                        )}
                                    </div>

                                    <ResponsiveContainer width="100%" height={320}>
                                        <BarChart data={hourlyBreakdown.list} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }} axisLine={{ stroke: "#CBD5E1" }} tickLine={false} interval={1} />
                                            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="sales" name="Sales ($)" radius={[6, 6, 0, 0]}>
                                                {hourlyBreakdown.list.map((entry, i) => (
                                                    <Cell key={i} fill={entry.mealColor} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* TAB 3: Top Selling Items with High-Contrast Multi-Color */}
                            {chartTab === "topItems" && (
                                topItemsChartData.length === 0 ? (
                                    <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <p>No line item data recorded for this period yet.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", alignItems: "center" }}>
                                        <div>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                                                <h5 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Menu Item Sales Volume</h5>
                                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>By units ordered</span>
                                            </div>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={topItemsChartData} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                                                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#1E293B", fontWeight: 600 }} axisLine={false} tickLine={false} width={90} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar dataKey="quantity" name="Quantity Sold" radius={[0, 6, 6, 0]}>
                                                        {topItemsChartData.map((item, i) => (
                                                            <Cell key={i} fill={item.color} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Multi-Color Ranked Items List */}
                                        <div style={{ borderLeft: "1.5px solid #E2E8F0", paddingLeft: "20px" }}>
                                            <h5 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700 }}>Item Revenue Contributions</h5>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                                                {topSelling.map((item, idx) => {
                                                    const color = RESTAURANT_COLORS[idx % RESTAURANT_COLORS.length];
                                                    return (
                                                        <div
                                                            key={item.itemId || idx}
                                                            style={{
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                alignItems: "center",
                                                                padding: "9px 12px",
                                                                borderRadius: "10px",
                                                                border: `1.5px solid ${color}33`,
                                                                background: `${color}0D`,
                                                                fontSize: "13px",
                                                            }}
                                                        >
                                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                                <span style={{ fontWeight: 800, color, width: "20px", fontSize: "14px" }}>#{idx + 1}</span>
                                                                <div>
                                                                    <div style={{ fontWeight: 700, color: "#1E293B" }}>{item.itemName}</div>
                                                                    <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>{item.categoryName}</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: "right" }}>
                                                                <div style={{ fontWeight: 800, color }}>{formatCurrency(item.totalRevenue)}</div>
                                                                <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>{item.totalQty} sold</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* TAB 4: Category Mix Breakdown */}
                            {chartTab === "categories" && (
                                categoryChartData.length === 0 ? (
                                    <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <p>No category breakdown available for this period.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", alignItems: "center" }}>
                                        <div>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <PieChart>
                                                    <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={4}>
                                                        {categoryChartData.map((cat, i) => (
                                                            <Cell key={i} fill={cat.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Legend verticalAlign="bottom" height={36} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                            <h5 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 700 }}>Category Performance Mix</h5>
                                            {categoryChartData.map((cat, idx) => {
                                                const pct = stats.totalSales > 0 ? Math.round((cat.value / stats.totalSales) * 100) : 0;
                                                return (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            padding: "10px 14px",
                                                            borderRadius: "10px",
                                                            border: `1.5px solid ${cat.color}33`,
                                                            background: `${cat.color}0D`,
                                                        }}
                                                    >
                                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                                            <span style={{ fontWeight: 700, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", color: "#1E293B" }}>
                                                                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: cat.color }} />
                                                                {cat.name}
                                                            </span>
                                                            <span style={{ fontWeight: 800, fontSize: "13px", color: cat.color }}>{formatCurrency(cat.value)}</span>
                                                        </div>
                                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748B", fontWeight: 600 }}>
                                                            <span>{cat.quantity} items served</span>
                                                            <span>{pct}% of revenue</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )
                            )}

                            {/* TAB 5: Payment Channels */}
                            {chartTab === "payment" && (
                                paymentChartData.length === 0 ? (
                                    <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <p>No completed orders in this period yet.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", alignItems: "center" }}>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie data={paymentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={4}>
                                                    {paymentChartData.map((p, i) => (
                                                        <Cell key={i} fill={p.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>

                                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                            <h5 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Settlement Channels</h5>
                                            {paymentChartData.map((p, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        padding: "10px 14px",
                                                        borderRadius: "10px",
                                                        border: `1.5px solid ${p.color}44`,
                                                        background: `${p.color}0D`,
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                        <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: p.color }} />
                                                        <div>
                                                            <strong style={{ fontSize: "13px", color: "#1E293B" }}>{p.name}</strong>
                                                            <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>{p.orders} transactions</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: "right" }}>
                                                        <div style={{ fontWeight: 800, fontSize: "14px", color: p.color }}>{formatCurrency(p.value)}</div>
                                                        <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 700 }}>{p.pct}% share</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}

                            {/* TAB 6: Order Dining Channels */}
                            {chartTab === "source" && (
                                sourceChartData.length === 0 ? (
                                    <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <p>No completed orders in this period yet.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", alignItems: "center" }}>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie data={sourceChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={4}>
                                                    {sourceChartData.map((s, i) => (
                                                        <Cell key={i} fill={s.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>

                                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                            <h5 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Dining Channels Breakdown</h5>
                                            {sourceChartData.map((s, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        padding: "10px 14px",
                                                        borderRadius: "10px",
                                                        border: `1.5px solid ${s.color}44`,
                                                        background: `${s.color}0D`,
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                        <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: s.color }} />
                                                        <div>
                                                            <strong style={{ fontSize: "13px", color: "#1E293B" }}>{s.name}</strong>
                                                            <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>{s.orders} orders</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: "right" }}>
                                                        <div style={{ fontWeight: 800, fontSize: "14px", color: s.color }}>{formatCurrency(s.value)}</div>
                                                        <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 700 }}>
                                                            Avg: {formatCurrency(s.avgTicket)} ({s.pct}%)
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* Daily Breakdown Table */}
                    <div style={{ marginBottom: "30px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <h4 style={{ fontSize: "16px", margin: 0, fontWeight: 700 }}>Daily Performance Ledger</h4>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                                {dailyBreakdown.length} active day(s) in this period
                            </span>
                        </div>

                        {dailyBreakdown.length === 0 ? (
                            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", border: "1px solid #E2E8F0", borderRadius: "12px" }}>
                                <p>No completed orders in this period yet.</p>
                            </div>
                        ) : (
                            <div
                                className="table-responsive"
                                style={{ border: "1.5px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}
                            >
                                <table className="staff-table" style={{ margin: 0 }}>
                                    <thead>
                                        <tr style={{ background: "#F8FAFC" }}>
                                            <th>Date</th>
                                            <th>Orders</th>
                                            <th>Average Ticket</th>
                                            <th style={{ textAlign: "right" }}>Total Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailyBreakdown.map((row, idx) => {
                                            const badgeColor = RESTAURANT_COLORS[idx % RESTAURANT_COLORS.length];
                                            return (
                                                <tr key={row.dateKey}>
                                                    <td style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: badgeColor }} />
                                                        {localDateLabel(row.dateKey)}
                                                    </td>
                                                    <td>
                                                        <span style={{ background: "#F1F5F9", color: "#334155", padding: "2px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "12px" }}>
                                                            {row.count} orders
                                                        </span>
                                                    </td>
                                                    <td style={{ color: "#64748B", fontWeight: 600 }}>
                                                        {row.count > 0 ? formatCurrency(row.total / row.count) : "—"}
                                                    </td>
                                                    <td style={{ fontWeight: 800, color: "#0F766E", textAlign: "right", fontSize: "14px" }}>
                                                        {formatCurrency(row.total)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Filter & Search Bar for Completed Orders */}
                    <div style={{ marginBottom: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                            <h4 style={{ fontSize: "16px", margin: 0, fontWeight: 700 }}>
                                Completed Order Ledger{" "}
                                <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "13px" }}>
                                    ({filteredOrders.length} {filteredOrders.length !== periodOrders.length ? `filtered of ${periodOrders.length}` : "orders"})
                                </span>
                            </h4>

                            {/* Search input */}
                            <div style={{ position: "relative", minWidth: "260px" }}>
                                <input
                                    type="text"
                                    placeholder="Search order ID, cashier, table..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px 8px 34px",
                                        borderRadius: "10px",
                                        border: "1.5px solid #CBD5E1",
                                        fontSize: "13px",
                                    }}
                                />
                                <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#64748B" }}>
                                    <IconSearch size={16} />
                                </span>
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
                                    >
                                        <IconClose size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter pills with High Contrast */}
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
                            <span style={{ fontSize: "12px", color: "#475569", fontWeight: 700 }}>Channel:</span>
                            {[
                                { id: "ALL", label: "All Channels" },
                                { id: "DINE_IN", label: "🍽️ Dine In", color: "#059669" },
                                { id: "TAKEAWAY", label: "🛍️ Takeaway", color: "#EA580C" },
                                { id: "DELIVERY", label: "🛵 Delivery", color: "#2563EB" },
                            ].map((src) => (
                                <button
                                    key={src.id}
                                    type="button"
                                    onClick={() => setFilterSource(src.id)}
                                    className={`sub-nav-tab ${filterSource === src.id ? "active" : ""}`}
                                    style={{
                                        padding: "4px 10px",
                                        fontSize: "12px",
                                        borderRadius: "7px",
                                        fontWeight: filterSource === src.id ? 700 : 500,
                                    }}
                                >
                                    {src.label}
                                </button>
                            ))}

                            <span style={{ fontSize: "12px", color: "#475569", fontWeight: 700, marginLeft: "10px" }}>Payment:</span>
                            {[
                                { id: "ALL", label: "All Types" },
                                { id: "CASH", label: "💵 Cash", color: "#059669" },
                                { id: "CARD", label: "💳 Card", color: "#4F46E5" },
                                { id: "DIGITAL", label: "📱 Digital", color: "#0891B2" },
                                { id: "OTHER", label: "Other" },
                            ].map((pay) => (
                                <button
                                    key={pay.id}
                                    type="button"
                                    onClick={() => setFilterPayment(pay.id)}
                                    className={`sub-nav-tab ${filterPayment === pay.id ? "active" : ""}`}
                                    style={{
                                        padding: "4px 10px",
                                        fontSize: "12px",
                                        borderRadius: "7px",
                                        fontWeight: filterPayment === pay.id ? 700 : 500,
                                    }}
                                >
                                    {pay.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Orders List */}
                    {filteredOrders.length === 0 ? (
                        <div style={{ padding: "36px", textAlign: "center", color: "var(--text-muted)", border: "1.5px solid #E2E8F0", borderRadius: "14px" }}>
                            <p>No orders match the selected filters or search term.</p>
                            {(searchQuery || filterSource !== "ALL" || filterPayment !== "ALL") && (
                                <button
                                    type="button"
                                    className="btn-secondary btn-sm"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setFilterSource("ALL");
                                        setFilterPayment("ALL");
                                    }}
                                    style={{ marginTop: "8px" }}
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div
                                className="table-responsive"
                                style={{ border: "1.5px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}
                            >
                                <table className="staff-table" style={{ margin: 0 }}>
                                    <thead>
                                        <tr style={{ background: "#F8FAFC" }}>
                                            <th>Ticket #</th>
                                            <th>Channel</th>
                                            <th>Staff</th>
                                            <th>Settlement</th>
                                            <th>Closed Time</th>
                                            <th>Grand Total</th>
                                            <th style={{ textAlign: "right" }}>Inspect</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedOrders.map((o) => (
                                            <tr
                                                key={o.id}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => handleInspectOrder(o)}
                                                title="Click to view itemized receipt"
                                            >
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <code style={{ background: "#0F172A", color: "#F8FAFC", padding: "3px 8px", borderRadius: "5px", fontSize: "11px", fontWeight: 800, letterSpacing: "0.5px" }}>
                                                            #{o.id.slice(0, 8).toUpperCase()}
                                                        </code>
                                                        {o.table_number && (
                                                            <span
                                                                style={{
                                                                    background: "#FEF3C7",
                                                                    color: "#92400E",
                                                                    border: "1px solid #FDE68A",
                                                                    padding: "2px 6px",
                                                                    borderRadius: "4px",
                                                                    fontSize: "11px",
                                                                    fontWeight: 800,
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    gap: "3px",
                                                                }}
                                                            >
                                                                <IconTable size={12} color="#92400E" /> Table {o.table_number}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    {o.order_source === "DINE_IN" && (
                                                        <span style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #6EE7B7", padding: "3px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                            <IconUtensils size={12} color="#047857" /> Dine In
                                                        </span>
                                                    )}
                                                    {o.order_source === "TAKEAWAY" && (
                                                        <span style={{ background: "#FFF7ED", color: "#C2410C", border: "1px solid #FDBA74", padding: "3px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                            <IconTakeaway size={12} color="#C2410C" /> Takeaway
                                                        </span>
                                                    )}
                                                    {o.order_source === "DELIVERY" && (
                                                        <span style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #93C5FD", padding: "3px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                            <IconDelivery size={12} color="#1D4ED8" /> Delivery
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{o.created_by_name || "—"}</td>
                                                <td>
                                                    {o.payment_method === "CASH" && (
                                                        <span style={{ background: "#F0FDF4", color: "#15803D", border: "1px solid #86EFAC", padding: "2px 7px", borderRadius: "5px", fontWeight: 700, fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                            <IconCash size={12} color="#15803D" /> CASH
                                                        </span>
                                                    )}
                                                    {o.payment_method === "CARD" && (
                                                        <span style={{ background: "#EEF2FF", color: "#4338CA", border: "1px solid #A5B4FC", padding: "2px 7px", borderRadius: "5px", fontWeight: 700, fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                            <IconCard size={12} color="#4338CA" /> CARD
                                                        </span>
                                                    )}
                                                    {o.payment_method === "DIGITAL" && (
                                                        <span style={{ background: "#ECFEFF", color: "#0E7490", border: "1px solid #67E8F9", padding: "2px 7px", borderRadius: "5px", fontWeight: 700, fontSize: "11px" }}>
                                                            📱 DIGITAL
                                                        </span>
                                                    )}
                                                    {(!o.payment_method || o.payment_method === "OTHER") && (
                                                        <span style={{ background: "#F1F5F9", color: "#475569", padding: "2px 7px", borderRadius: "5px", fontWeight: 600, fontSize: "11px" }}>
                                                            {o.payment_method || "—"}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ color: "#64748B", fontSize: "12px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                                        <IconClock size={13} color="#94A3B8" />
                                                        <span>{new Date(o.created_locally_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 800, fontSize: "14px", color: "#047857" }}>{formatCurrency(o.total)}</td>
                                                <td style={{ textAlign: "right" }}>
                                                    <button
                                                        type="button"
                                                        className="btn-secondary btn-sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleInspectOrder(o);
                                                        }}
                                                        style={{ padding: "3px 8px", fontSize: "11px", fontWeight: 700 }}
                                                    >
                                                        Receipt
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination controls */}
                            {totalOrderPages > 1 && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", flexWrap: "wrap", gap: "10px" }}>
                                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                                        Showing {(safeOrdersPage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(safeOrdersPage * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
                                    </span>
                                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                        <button
                                            type="button"
                                            className="btn-secondary btn-sm"
                                            onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                                            disabled={safeOrdersPage <= 1}
                                        >
                                            ← Prev
                                        </button>
                                        <span style={{ fontSize: "12px", color: "var(--text-secondary)", padding: "0 6px", fontWeight: 700 }}>
                                            Page {safeOrdersPage} of {totalOrderPages}
                                        </span>
                                        <button
                                            type="button"
                                            className="btn-secondary btn-sm"
                                            onClick={() => setOrdersPage((p) => Math.min(totalOrderPages, p + 1))}
                                            disabled={safeOrdersPage >= totalOrderPages}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* ORDER DETAILS INSPECTION MODAL */}
            {selectedOrder && (
                <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
                    <div
                        className="modal-content"
                        style={{ maxWidth: "520px", padding: "24px" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ background: "#059669", color: "#FFF", borderRadius: "6px", padding: "4px 8px", fontSize: "12px", fontWeight: 800 }}>
                                        PAID & CLOSED
                                    </span>
                                    Ticket #{selectedOrder.id.slice(0, 8).toUpperCase()}
                                </h3>
                                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                                    {new Date(selectedOrder.created_locally_at).toLocaleString()}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedOrder(null)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            >
                                <IconClose size={20} />
                            </button>
                        </div>

                        {/* Order Metadata Badges */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px", background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "12px", borderRadius: "10px", fontSize: "12px" }}>
                            <div>
                                <span style={{ color: "#64748B" }}>Channel: </span>
                                <strong>{selectedOrder.order_source.replace("_", " ")}</strong>
                            </div>
                            <div>
                                <span style={{ color: "#64748B" }}>Table: </span>
                                <strong>{selectedOrder.table_number ? `Table #${selectedOrder.table_number}` : "None"}</strong>
                            </div>
                            <div>
                                <span style={{ color: "#64748B" }}>Cashier: </span>
                                <strong>{selectedOrder.created_by_name || "—"}</strong>
                            </div>
                            <div>
                                <span style={{ color: "#64748B" }}>Payment: </span>
                                <strong>{selectedOrder.payment_method || "—"}</strong>
                            </div>
                            {selectedOrder.customer_name && (
                                <div style={{ gridColumn: "span 2" }}>
                                    <span style={{ color: "#64748B" }}>Customer: </span>
                                    <strong>{selectedOrder.customer_name} {selectedOrder.customer_phone ? `(${selectedOrder.customer_phone})` : ""}</strong>
                                </div>
                            )}
                        </div>

                        {/* Line Items */}
                        <h5 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 700 }}>Itemized Bill</h5>
                        {loadingOrderItems ? (
                            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                                Loading order items...
                            </div>
                        ) : selectedOrderItems.length === 0 ? (
                            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)" }}>
                                No items recorded for this order.
                            </div>
                        ) : (
                            <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: "8px", marginBottom: "16px" }}>
                                <table className="staff-table" style={{ margin: 0, fontSize: "12px" }}>
                                    <thead>
                                        <tr style={{ background: "#F8FAFC" }}>
                                            <th>Item</th>
                                            <th style={{ textAlign: "center" }}>Qty</th>
                                            <th style={{ textAlign: "right" }}>Price</th>
                                            <th style={{ textAlign: "right" }}>Line Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrderItems.map((item) => (
                                            <tr key={item.id}>
                                                <td>
                                                    <strong>{item.item_name || "Menu Item"}</strong>
                                                    {item.variant_label && (
                                                        <span style={{ color: "#64748B", marginLeft: "4px" }}>
                                                            ({item.variant_label})
                                                        </span>
                                                    )}
                                                    {item.modifiers && (
                                                        <div style={{ fontSize: "10px", color: "#059669", fontWeight: 600 }}>
                                                            + {item.modifiers}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: "center", fontWeight: 700 }}>{item.quantity}</td>
                                                <td style={{ textAlign: "right" }}>{formatCurrency(item.unit_price)}</td>
                                                <td style={{ textAlign: "right", fontWeight: 800, color: "#0F766E" }}>
                                                    {formatCurrency(item.quantity * item.unit_price)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Financial Totals */}
                        <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "12px", marginBottom: "20px", fontSize: "13px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ color: "#64748B" }}>Subtotal</span>
                                <span style={{ fontWeight: 600 }}>{formatCurrency(selectedOrder.subtotal || selectedOrder.total)}</span>
                            </div>
                            {selectedOrder.discount > 0 && (
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "#DB2777" }}>
                                    <span>Discount</span>
                                    <span style={{ fontWeight: 700 }}>- {formatCurrency(selectedOrder.discount)}</span>
                                </div>
                            )}
                            {selectedOrder.tax > 0 && (
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "#64748B" }}>
                                    <span>Tax</span>
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(selectedOrder.tax)}</span>
                                </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #CBD5E1", fontWeight: 800, fontSize: "16px" }}>
                                <span>Grand Total Paid</span>
                                <span style={{ color: "#059669" }}>{formatCurrency(selectedOrder.total)}</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setSelectedOrder(null)}
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                style={{ display: "flex", alignItems: "center", gap: "6px", background: "#059669" }}
                                onClick={() => setShowReceiptModal(true)}
                            >
                                <IconPrint size={16} /> Thermal Receipt / KOT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Thermal Receipt Preview & Printing Modal */}
            {showReceiptModal && selectedOrder && (
                <ReceiptModal
                    receiptData={{
                        order: selectedOrder,
                        items: selectedOrderItems,
                        tableName: selectedOrder.table_number ? `Table #${selectedOrder.table_number}` : undefined,
                        cashierName: selectedOrder.created_by_name || "Cashier",
                        paymentMethod: selectedOrder.payment_method || "CASH",
                        amountPaid: selectedOrder.total,
                        changeDue: 0,
                    }}
                    onClose={() => setShowReceiptModal(false)}
                />
            )}
        </div>
    );
}