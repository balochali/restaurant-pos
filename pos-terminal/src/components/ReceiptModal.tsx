import { useState } from "react";
import {
  ReceiptData,
  generateCustomerReceiptHtml,
  generateKitchenTicketHtml,
  printReceiptHtml,
} from "../lib/receiptService";

interface ReceiptModalProps {
  receiptData: ReceiptData;
  initialType?: "CUSTOMER" | "KITCHEN";
  onClose: () => void;
}

export default function ReceiptModal({
  receiptData,
  initialType = "CUSTOMER",
  onClose,
}: ReceiptModalProps) {
  const [receiptType, setReceiptType] = useState<"CUSTOMER" | "KITCHEN">(initialType);

  const customerHtml = generateCustomerReceiptHtml(receiptData);
  const kitchenHtml = generateKitchenTicketHtml(receiptData);

  const activeHtml = receiptType === "CUSTOMER" ? customerHtml : kitchenHtml;

  const handlePrint = () => {
    printReceiptHtml(activeHtml);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "420px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "18px" }}>
            {receiptType === "CUSTOMER" ? "🧾 Customer Receipt" : "🍳 Kitchen Ticket (KOT)"}
          </h3>
          <button type="button" className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Receipt Type Switcher */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            type="button"
            className={`btn-secondary ${receiptType === "CUSTOMER" ? "active-tab-btn" : ""}`}
            style={{
              flex: 1,
              padding: "8px",
              fontWeight: receiptType === "CUSTOMER" ? "bold" : "normal",
              backgroundColor: receiptType === "CUSTOMER" ? "var(--primary-color, #e65100)" : "var(--bg-secondary, #f0f0f0)",
              color: receiptType === "CUSTOMER" ? "#fff" : "inherit",
              border: "1px solid #ccc",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={() => setReceiptType("CUSTOMER")}
          >
            🧾 Customer Receipt
          </button>
          <button
            type="button"
            className={`btn-secondary ${receiptType === "KITCHEN" ? "active-tab-btn" : ""}`}
            style={{
              flex: 1,
              padding: "8px",
              fontWeight: receiptType === "KITCHEN" ? "bold" : "normal",
              backgroundColor: receiptType === "KITCHEN" ? "var(--primary-color, #e65100)" : "var(--bg-secondary, #f0f0f0)",
              color: receiptType === "KITCHEN" ? "#fff" : "inherit",
              border: "1px solid #ccc",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={() => setReceiptType("KITCHEN")}
          >
            🍳 Kitchen Ticket (KOT)
          </button>
        </div>

        {/* Receipt Thermal Paper Preview */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #ddd",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            borderRadius: "6px",
            padding: "8px",
            maxHeight: "380px",
            overflowY: "auto",
            marginBottom: "16px",
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: activeHtml }} />
        </div>

        {/* Modal Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="btn-primary"
            style={{
              flex: 2,
              padding: "12px",
              fontSize: "15px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              backgroundColor: "var(--primary-color, #e65100)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={handlePrint}
          >
            🖨️ Print {receiptType === "CUSTOMER" ? "Receipt" : "Kitchen Ticket"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
