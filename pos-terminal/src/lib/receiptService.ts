import { DbOrder, DbOrderItem } from "./orderService";

export interface ReceiptData {
  order: DbOrder;
  items: DbOrderItem[];
  tableName?: string;
  cashierName: string;
  paymentMethod?: string;
  amountPaid?: number;
  changeDue?: number;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
}

/**
 * Generates clean HTML for a 80mm / thermal Customer Receipt.
 */
export function generateCustomerReceiptHtml(data: ReceiptData): string {
  const {
    order,
    items,
    tableName = order.table_id ? `Table #${order.table_id.slice(0, 4)}` : "Takeaway",
    cashierName,
    paymentMethod = "CASH",
    amountPaid = order.total,
    changeDue = 0,
    restaurantName = "RESTAURANT POS",
    restaurantAddress = "123 Food Street, Downtown",
    restaurantPhone = "+1 (555) 019-2834",
  } = data;

  const dateStr = new Date(order.created_locally_at || Date.now()).toLocaleString();
  const orderShortId = order.id.slice(0, 8).toUpperCase();

  const itemRows = items
    .map((item) => {
      const lineTotal = (item.quantity * item.unit_price).toFixed(2);
      const modNote = item.modifiers ? `<div style="font-size: 11px; color: #555; padding-left: 8px;">+ ${item.modifiers}</div>` : "";
      const note = item.notes ? `<div style="font-size: 11px; font-style: italic; color: #666; padding-left: 8px;">"${item.notes}"</div>` : "";

      return `
        <tr>
          <td style="padding: 4px 0; vertical-align: top;">
            <div><strong>${item.quantity}x</strong> ${item.menu_item_id ? (item as any).name || "Item" : "Item"}</div>
            ${modNote}
            ${note}
          </td>
          <td style="text-align: right; padding: 4px 0; vertical-align: top; white-space: nowrap;">
            $${lineTotal}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="width: 280px; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.35; color: #000; padding: 12px; background: #fff;">
      <div style="text-align: center; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase;">${restaurantName}</h2>
        <div style="font-size: 11px; color: #444; margin-top: 2px;">${restaurantAddress}</div>
        <div style="font-size: 11px; color: #444;">Tel: ${restaurantPhone}</div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 8px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Order: <strong>#${orderShortId}</strong></span>
          <span>${order.order_source}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Location: <strong>${tableName}</strong></span>
          <span>Cashier: ${cashierName}</span>
        </div>
        <div style="color: #666; font-size: 10px; margin-top: 2px;">
          ${dateStr}
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <thead>
          <tr style="border-bottom: 1px solid #ddd; font-size: 11px;">
            <th style="text-align: left; padding-bottom: 4px;">Item Description</th>
            <th style="text-align: right; padding-bottom: 4px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; padding-top: 6px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Subtotal:</span>
          <span>$${order.subtotal.toFixed(2)}</span>
        </div>
        ${
          order.discount > 0
            ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #d00;">
                <span>Discount:</span>
                <span>-$${order.discount.toFixed(2)}</span>
              </div>`
            : ""
        }
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Tax:</span>
          <span>$${order.tax.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
          <span>TOTAL:</span>
          <span>$${order.total.toFixed(2)}</span>
        </div>
      </div>

      <div style="border-top: 1px dashed #000; padding-top: 6px; font-size: 11px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Payment (${paymentMethod}):</span>
          <span>$${Number(amountPaid).toFixed(2)}</span>
        </div>
        ${
          changeDue > 0
            ? `<div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>Change Due:</span>
                <span>$${Number(changeDue).toFixed(2)}</span>
              </div>`
            : ""
        }
      </div>

      <div style="text-align: center; border-top: 1px dashed #000; padding-top: 10px;">
        <div style="font-weight: bold; font-size: 12px;">Thank you for your visit!</div>
        <div style="font-size: 10px; color: #555; margin-top: 2px;">Please retain this receipt for your records.</div>
      </div>
    </div>
  `;
}

/**
 * Generates clean HTML for a Kitchen Order Ticket (KOT).
 */
export function generateKitchenTicketHtml(data: ReceiptData): string {
  const {
    order,
    items,
    tableName = order.table_id ? `Table #${order.table_id.slice(0, 4)}` : "Takeaway",
    cashierName,
  } = data;

  const timeStr = new Date(order.created_locally_at || Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const orderShortId = order.id.slice(0, 8).toUpperCase();

  const itemRows = items
    .map((item) => {
      const modNote = item.modifiers ? `<div style="font-size: 13px; font-weight: bold; color: #111; margin-left: 12px;">⚡ ${item.modifiers}</div>` : "";
      const note = item.notes ? `<div style="font-size: 13px; font-weight: bold; background: #eee; padding: 2px 4px; border-radius: 3px; margin-top: 2px; margin-left: 12px;">NOTE: ${item.notes}</div>` : "";

      return `
        <li style="margin-bottom: 8px; border-bottom: 1px dotted #ccc; padding-bottom: 6px;">
          <div style="display: flex; align-items: baseline; justify-content: space-between;">
            <span style="font-size: 16px; font-weight: 900;">[ ${item.quantity}x ] ${(item as any).name || "Item"}</span>
            <span style="font-size: 11px; text-transform: uppercase; border: 1px solid #000; padding: 1px 4px; border-radius: 2px;">${item.status || "NEW"}</span>
          </div>
          ${modNote}
          ${note}
        </li>
      `;
    })
    .join("");

  return `
    <div style="width: 280px; margin: 0 auto; font-family: monospace; font-size: 13px; line-height: 1.35; color: #000; padding: 12px; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 1px;">🍳 KITCHEN TICKET</h2>
        <div style="font-size: 20px; font-weight: 900; background: #000; color: #fff; padding: 4px; border-radius: 4px; margin: 6px 0;">
          ${tableName.toUpperCase()}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold;">
          <span>ORDER #${orderShortId}</span>
          <span>${order.order_source}</span>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 4px;">
        <span>Server: <strong>${cashierName}</strong></span>
        <span>Time: <strong>${timeStr}</strong></span>
      </div>

      <ul style="list-style: none; padding: 0; margin: 0 0 10px 0;">
        ${itemRows}
      </ul>

      ${
        order.notes
          ? `<div style="border: 2px dashed #000; padding: 6px; font-weight: bold; font-size: 12px; margin-bottom: 8px;">
              ⚠️ ORDER NOTE: ${order.notes}
            </div>`
          : ""
      }

      <div style="text-align: center; border-top: 2px solid #000; padding-top: 6px; font-size: 11px; font-weight: bold;">
        --- END OF KITCHEN TICKET ---
      </div>
    </div>
  `;
}

/**
 * Triggers native browser print for the provided HTML receipt snippet.
 */
export function printReceiptHtml(htmlContent: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error("Failed to access print iframe");
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Receipt</title>
        <style>
          @page { margin: 0; size: auto; }
          body { margin: 0; padding: 10px; background: white; }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() {
              window.parent.document.body.removeChild(window.frameElement);
            }, 1000);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();
}
