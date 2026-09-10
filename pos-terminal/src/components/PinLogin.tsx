import { useState } from "react";
import { IconLock, IconShield, IconClose } from "./Icons";

interface PinLoginProps {
  onLogin: (pin: string) => Promise<boolean | void> | boolean | void;
  error?: string;
  clearError?: () => void;
}

const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function PinLogin({ onLogin, error: externalError, clearError }: PinLoginProps) {
  const [pin, setPin] = useState("");
  const [internalError, setInternalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const error = externalError || internalError;

  const addDigit = (digit: string) => {
    if (externalError && clearError) clearError();
    setInternalError("");

    if (pin.length >= 6) {
      return;
    }

    const newPin = pin + digit;
    setPin(newPin);

    // Auto submit on 4 digits if desired or user clicks check
    if (newPin.length === 4) {
      autoSubmit(newPin);
    }
  };

  const autoSubmit = async (pinToTry: string) => {
    setIsSubmitting(true);
    try {
      const result = await onLogin(pinToTry);
      if (result === false) {
        setInternalError("Invalid PIN. Please try again.");
        setPin("");
      }
    } catch {
      setInternalError("Authentication failed. Please try again.");
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearPin = () => {
    setPin("");
    if (externalError && clearError) clearError();
    setInternalError("");
  };

  const removeDigit = () => {
    setPin((current) => current.slice(0, -1));
    if (externalError && clearError) clearError();
    setInternalError("");
  };

  const handleQuickFill = (demoPin: string) => {
    setPin(demoPin);
    autoSubmit(demoPin);
  };

  return (
    <main className="pin-login">
      <section className="pin-card">
        {/* Luxury Brand Header */}
        <div className="pin-logo-badge">
          <IconShield size={34} color="#FFFFFF" />
        </div>

        <div className="pin-header">
          <h1>RESTAURANT POS</h1>
          <p>Secure Terminal Access</p>
        </div>

        {/* PIN Dots Display */}
        <div className="pin-display" aria-label="PIN entry">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index} className={`pin-dot ${index < pin.length ? "filled" : ""}`} />
          ))}
        </div>

        {error && <div className="pin-error">{error}</div>}

        {/* Tactile Keypad */}
        <div className="pin-keypad">
          {keypad.map((digit) => (
            <button
              key={digit}
              type="button"
              className="pin-key"
              onClick={() => addDigit(digit)}
              disabled={isSubmitting}
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            className="pin-key action-key"
            onClick={clearPin}
            disabled={isSubmitting || pin.length === 0}
            title="Clear"
          >
            <IconClose size={20} />
          </button>

          <button
            type="button"
            className="pin-key"
            onClick={() => addDigit("0")}
            disabled={isSubmitting}
          >
            0
          </button>

          <button
            type="button"
            className="pin-key action-key"
            onClick={removeDigit}
            disabled={isSubmitting || pin.length === 0}
            title="Backspace"
          >
            ⌫
          </button>
        </div>

        {/* Quick Demo PIN Chips */}
        <div className="pin-demo-accounts">
          <div className="pin-demo-title">
            <IconLock size={14} color="var(--green)" />
            Quick Demo Accounts
          </div>
          <div className="pin-demo-chips">
            <button
              type="button"
              className="pin-demo-chip"
              onClick={() => handleQuickFill("1234")}
            >
              👑 Admin <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>PIN: 1234</span>
            </button>
            <button
              type="button"
              className="pin-demo-chip"
              onClick={() => handleQuickFill("2222")}
            >
              🛒 Cashier <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>PIN: 2222</span>
            </button>
            <button
              type="button"
              className="pin-demo-chip"
              onClick={() => handleQuickFill("3333")}
            >
              🍽️ Waiter <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>PIN: 3333</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
