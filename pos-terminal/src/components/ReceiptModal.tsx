import { useState } from "react";
import {
  ReceiptData,
  generateCustomerReceiptHtml,
  generateKitchenTicketHtml,
  printReceiptHtml,
} from "../lib/receiptService";
import { IconReceipt, IconChef, IconPrint, IconClose } from "./Icons";

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
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: "440px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
            {receiptType === "CUSTOMER" ? (
              <>
                <IconReceipt size={20} color="var(--primary)" /> Customer Receipt
              </>
            ) : (
              <>
                <IconChef size={20} color="var(--secondary)" /> Kitchen Ticket (KOT)
              </>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Receipt Type Switcher */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            type="button"
            className={`sub-nav-tab ${receiptType === "CUSTOMER" ? "active" : ""}`}
            style={{
              flex: 1,
              padding: "9px 12px",
              justifyContent: "center",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onClick={() => setReceiptType("CUSTOMER")}
          >
            <IconReceipt size={16} /> Customer Receipt
          </button>
          <button
            type="button"
            className={`sub-nav-tab ${receiptType === "KITCHEN" ? "active" : ""}`}
            style={{
              flex: 1,
              padding: "9px 12px",
              justifyContent: "center",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onClick={() => setReceiptType("KITCHEN")}
          >
            <IconChef size={16} /> Kitchen Ticket (KOT)
          </button>
        </div>

        {/* Receipt Thermal Paper Preview */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--border-light)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            borderRadius: "12px",
            padding: "12px",
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
              fontSize: "14px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            onClick={handlePrint}
          >
            <IconPrint size={18} /> Print {receiptType === "CUSTOMER" ? "Receipt" : "Kitchen Ticket"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{
              flex: 1,
              padding: "12px",
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
