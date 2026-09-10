/**
 * Format amounts in Pakistani Rupees (PKR).
 */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "Rs. 0";
  }

  const sign = amount < 0 ? "-" : "";
  const formatted = Math.abs(amount).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return `${sign}Rs. ${formatted}`;
}

export const CURRENCY_LABEL = "Rs.";
