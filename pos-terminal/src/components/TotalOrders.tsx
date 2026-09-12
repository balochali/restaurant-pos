import { useState, useEffect, useMemo } from "react";
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
import { getClosedOrders, DbOrder } from "../lib/orderService";
import { formatCurrency } from "../lib/formatCurrency";
import { IconChart, IconReceipt, IconCash, IconClock } from "./Icons";

type Period = "today" | "7d" | "30d" | "all";
type ChartTab = "trend" | "payment" | "source";

const PERIOD_LABELS: Record<Period, string> = {
    today: "Today",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    all: "All Time",
};

// A vibrant, distinct palette for chart series — deliberately more colorful
// than the muted brand tones used elsewhere, since charts are where a bit of
// visual energy helps the data stand out and stay easy to tell apart.
const CHART_COLORS = ["#6C151E", "#0F9D82", "#D97706", "#3B82F6", "#9333EA", "#DB2777", "#059669", "#EA580C"];

// Local (device-time) start-of-day, so "Today" lines up with the till, not UTC.
function startOfLocalDay(daysAgo: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
}

function localDateKey(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-CA"); // YYYY-MM-DD, stable for sorting/grouping
}

function localDateLabel(dateKey: string): string {
    const d = new Date(dateKey + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shortDateLabel(dateKey: string): string {
    const d = new Date(dateKey + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div
            style={{
                background: "#FFFFFF",
                border: "1px solid var(--border-light)",
                borderRadius: "10px",
                padding: "8px 12px",
                boxShadow: "var(--card-shadow-hover)",
                fontSize: "12px",
            }}
        >
            {label && <div style={{ fontWeight: 700, marginBottom: "4px" }}>{label}</div>}
            {payload.map((p: any, i: number) => (
                <div key={i} style={{ color: p.color || p.payload?.fill, fontWeight: 600 }}>
                    {p.name}: {typeof p.value === "number" && p.value > 100 ? formatCurrency(p.value) : p.value}
                </div>
            ))}
        </div>
    );
}

export default function TotalOrders() {
    const [orders, setOrders] = useState<DbOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [period, setPeriod] = useState<Period>("today");
    const [ordersPage, setOrdersPage] = useState(1);
    const [chartTab, setChartTab] = useState<ChartTab>("trend");
    const ORDERS_PER_PAGE = 10;

    const refresh = () => {
        setLoading(true);
        setError("");
        getClosedOrders(1000)
            .then(setOrders)
            .catch((err) => setError(String(err)))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refresh();
    }, []);

    const periodOrders = useMemo(() => {
        if (period === "all") return orders;
        const daysAgo = period === "today" ? 0 : period === "7d" ? 6 : 29;
        const cutoff = startOfLocalDay(daysAgo);
        return orders.filter((o) => new Date(o.created_locally_at) >= cutoff);
    }, [orders, period]);

    // Reset to the first page whenever the selected period changes.
    useEffect(() => {
        setOrdersPage(1);
    }, [period]);

    const stats = useMemo(() => {
        const totalOrders = periodOrders.length;
        const totalSales = periodOrders.reduce((sum, o) => sum + o.total, 0);
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        const byMethod: Record<string, number> = {};
        for (const o of periodOrders) {
            const method = o.payment_method || "OTHER";
            byMethod[method] = (byMethod[method] || 0) + o.total;
        }

        return { totalOrders, totalSales, avgOrderValue, byMethod };
    }, [periodOrders]);

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
            .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest day first
            .map(([dateKey, data]) => ({ dateKey, ...data }));
    }, [periodOrders]);

    // Chronological (oldest → newest) version for charts, with a short label.
    const trendChartData = useMemo(
        () =>
            [...dailyBreakdown]
                .reverse()
                .map((row) => ({ label: shortDateLabel(row.dateKey), sales: row.total, orders: row.count })),
        [dailyBreakdown]
    );

    const paymentChartData = useMemo(
        () => Object.entries(stats.byMethod).map(([method, total]) => ({ name: method, value: total })),
        [stats.byMethod]
    );

    const sourceChartData = useMemo(() => {
        const byName: Record<string, { count: number; total: number }> = {};
        for (const o of periodOrders) {
            const key = o.order_source.replace("_", " ");
            const entry = byName[key] || { count: 0, total: 0 };
            entry.count += 1;
            entry.total += o.total;
            byName[key] = entry;
        }
        return Object.entries(byName).map(([name, d]) => ({ name, value: d.total, orders: d.count }));
    }, [periodOrders]);

    const totalOrderPages = Math.max(1, Math.ceil(periodOrders.length / ORDERS_PER_PAGE));
    const safeOrdersPage = Math.min(ordersPage, totalOrderPages);
    const pagedOrders = periodOrders.slice(
        (safeOrdersPage - 1) * ORDERS_PER_PAGE,
        safeOrdersPage * ORDERS_PER_PAGE
    );

    return (
        <div className="card full-width-card" style={{ padding: "20px" }}>
            <div className="card-header-row" style={{ marginBottom: "16px" }}>
                <div>
                    <h4>Total Orders</h4>
                    <p className="subtitle">Completed sales, broken down by day so you can track daily, weekly, and monthly totals</p>
                </div>

                <div className="filter-controls" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button type="button" className="btn-secondary" onClick={refresh}>
                        Refresh
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                    <button
                        key={p}
                        type="button"
                        className={`sub-nav-tab ${period === p ? "active" : ""}`}
                        onClick={() => setPeriod(p)}
                    >
                        {PERIOD_LABELS[p]}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    <IconChart size={32} color="var(--primary)" />
                    <p style={{ marginTop: "8px" }}>Loading completed orders...</p>
                </div>
            ) : error ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    <p>Failed to load orders: {error}</p>
                </div>
            ) : (
                <>
                    <div className="stats-grid" style={{ marginBottom: "22px" }}>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "rgba(108, 21, 30, 0.08)", color: "var(--primary)" }}>
                                <IconReceipt size={22} color="var(--primary)" />
                            </div>
                            <div>
                                <div className="stat-value">{stats.totalOrders}</div>
                                <div className="stat-label">Completed Orders</div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "rgba(15, 61, 58, 0.08)", color: "var(--secondary)" }}>
                                <IconCash size={22} color="var(--secondary)" />
                            </div>
                            <div>
                                <div className="stat-value" style={{ color: "var(--secondary)" }}>
                                    {formatCurrency(stats.totalSales)}
                                </div>
                                <div className="stat-label">Total Sales — {PERIOD_LABELS[period]}</div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "rgba(108, 21, 30, 0.08)", color: "var(--primary)" }}>
                                <IconChart size={22} color="var(--primary)" />
                            </div>
                            <div>
                                <div className="stat-value">{formatCurrency(stats.avgOrderValue)}</div>
                                <div className="stat-label">Average Order Value</div>
                            </div>
                        </div>
                    </div>

                    {/* Analytics — tabbed, colorful charts */}
                    <div style={{ marginBottom: "24px" }}>
                        <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
                            <button type="button" className={`sub-nav-tab ${chartTab === "trend" ? "active" : ""}`} onClick={() => setChartTab("trend")}>
                                📈 Sales Trend
                            </button>
                            <button type="button" className={`sub-nav-tab ${chartTab === "payment" ? "active" : ""}`} onClick={() => setChartTab("payment")}>
                                💳 Payment Methods
                            </button>
                            <button type="button" className={`sub-nav-tab ${chartTab === "source" ? "active" : ""}`} onClick={() => setChartTab("source")}>
                                🍽️ Order Source
                            </button>
                        </div>

                        <div style={{ border: "1px solid var(--border-light)", borderRadius: "14px", padding: "16px", background: "#FFFFFF" }}>
                            {chartTab === "trend" &&
                                (trendChartData.length === 0 ? (
                                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <p>No completed orders in this period yet.</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border-light)" }} tickLine={false} />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                                                axisLine={false}
                                                tickLine={false}
                                                width={50}
                                                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="sales" name="Sales" radius={[6, 6, 0, 0]}>
                                                {trendChartData.map((_, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ))}

                            {chartTab === "payment" &&
                                (paymentChartData.length === 0 ? (
                                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <p>No completed orders in this period yet.</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={paymentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}>
                                                {paymentChartData.map((_, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ))}

                            {chartTab === "source" &&
                                (sourceChartData.length === 0 ? (
                                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                        <p>No completed orders in this period yet.</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={sourceChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}>
                                                {sourceChartData.map((_, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ))}
                        </div>
                    </div>

                    <h4 style={{ fontSize: "15px", marginBottom: "10px" }}>Daily Breakdown</h4>
                    {dailyBreakdown.length === 0 ? (
                        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
                            <p>No completed orders in this period yet.</p>
                        </div>
                    ) : (
                        <div
                            className="table-responsive"
                            style={{ border: "1px solid var(--border-light)", borderRadius: "14px", overflow: "hidden", marginBottom: "26px" }}
                        >
                            <table className="staff-table" style={{ margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Orders</th>
                                        <th>Sales</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyBreakdown.map((row) => (
                                        <tr key={row.dateKey}>
                                            <td>{localDateLabel(row.dateKey)}</td>
                                            <td>{row.count}</td>
                                            <td style={{ fontWeight: 700 }}>{formatCurrency(row.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                    )}

                    <h4 style={{ fontSize: "15px", marginBottom: "10px" }}>
                        Recent Completed Orders {periodOrders.length > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({periodOrders.length})</span>}
                    </h4>
                    {periodOrders.length === 0 ? (
                        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
                            <p>Nothing here yet.</p>
                        </div>
                    ) : (
                        <>
                            <div
                                className="table-responsive"
                                style={{ border: "1px solid var(--border-light)", borderRadius: "14px", overflow: "hidden" }}
                            >
                                <table className="staff-table" style={{ margin: 0 }}>
                                    <thead>
                                        <tr>
                                            <th>Order</th>
                                            <th>Source</th>
                                            <th>Cashier</th>
                                            <th>Payment</th>
                                            <th>Closed</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedOrders.map((o) => (
                                            <tr key={o.id}>
                                                <td>
                                                    <code style={{ background: "var(--surface-warm)", padding: "2px 6px", borderRadius: "4px", fontSize: "12px" }}>
                                                        #{o.id.slice(0, 8)}
                                                    </code>
                                                    {o.table_number && (
                                                        <span style={{ marginLeft: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                                                            Table {o.table_number}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{o.order_source}</td>
                                                <td>{o.created_by_name || "—"}</td>
                                                <td>{o.payment_method || "—"}</td>
                                                <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                                        <IconClock size={13} />
                                                        <span>{new Date(o.created_locally_at).toLocaleString()}</span>
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{formatCurrency(o.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {totalOrderPages > 1 && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", flexWrap: "wrap", gap: "10px" }}>
                                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                        Showing {(safeOrdersPage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(safeOrdersPage * ORDERS_PER_PAGE, periodOrders.length)} of {periodOrders.length}
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
                                        <span style={{ fontSize: "12px", color: "var(--text-secondary)", padding: "0 4px" }}>
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
        </div>
    );
}