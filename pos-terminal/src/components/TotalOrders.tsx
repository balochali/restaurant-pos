import { useState, useEffect, useMemo } from "react";
import { getClosedOrders, DbOrder } from "../lib/orderService";
import { formatCurrency } from "../lib/formatCurrency";
import { IconChart, IconReceipt, IconCash, IconClock } from "./Icons";

type Period = "today" | "7d" | "30d" | "all";

const PERIOD_LABELS: Record<Period, string> = {
    today: "Today",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    all: "All Time",
};

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

function formatCompact(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return Math.round(n).toString();
}

interface DailyBreakdownRow {
    dateKey: string;
    count: number;
    total: number;
}

// A small dependency-free bar chart — this page only ever needs one simple
// chart, so pulling in a full charting library isn't worth the bundle size.
function DailySalesChart({ data }: { data: DailyBreakdownRow[] }) {
    if (data.length === 0) return null;

    const chronological = [...data].reverse();
    const maxTotal = Math.max(...chronological.map((d) => d.total), 1);
    const barCount = chronological.length;
    const slotWidth = 56;
    const chartWidth = Math.max(barCount * slotWidth, 280);
    const barAreaHeight = 130;
    const chartHeight = barAreaHeight + 46;
    const barWidth = Math.min(34, slotWidth * 0.55);

    return (
        <div
            style={{
                overflowX: "auto",
                marginBottom: "18px",
                border: "1px solid var(--border-light)",
                borderRadius: "14px",
                padding: "16px 10px 8px",
            }}
        >
            <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ display: "block" }}>
                {chronological.map((d, i) => {
                    const barHeight = Math.max(4, (d.total / maxTotal) * barAreaHeight);
                    const x = i * slotWidth + (slotWidth - barWidth) / 2;
                    const y = barAreaHeight - barHeight + 22;
                    return (
                        <g key={d.dateKey}>
                            <title>
                                {localDateLabel(d.dateKey)}: {formatCurrency(d.total)} · {d.count} order{d.count === 1 ? "" : "s"}
                            </title>
                            <rect x={x} y={y} width={barWidth} height={barHeight} rx={5} fill="var(--secondary)" />
                            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-secondary)">
                                {formatCompact(d.total)}
                            </text>
                            <text x={x + barWidth / 2} y={barAreaHeight + 38} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                                {shortDateLabel(d.dateKey)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

export default function TotalOrders() {
    const [orders, setOrders] = useState<DbOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [period, setPeriod] = useState<Period>("today");
    const [ordersPage, setOrdersPage] = useState(1);
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

                    {Object.keys(stats.byMethod).length > 0 && (
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "22px" }}>
                            {Object.entries(stats.byMethod).map(([method, total]) => (
                                <span key={method} className="audit-badge badge-info" style={{ fontSize: "12px" }}>
                                    {method}: {formatCurrency(total)}
                                </span>
                            ))}
                        </div>
                    )}

                    <h4 style={{ fontSize: "15px", marginBottom: "10px" }}>Daily Breakdown</h4>
                    {dailyBreakdown.length === 0 ? (
                        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
                            <p>No completed orders in this period yet.</p>
                        </div>
                    ) : (
                        <>
                            <DailySalesChart data={dailyBreakdown} />
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
                        </>
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