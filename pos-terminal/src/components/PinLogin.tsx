import { useState } from "react";

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

    setPin((current) => current + digit);
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

  const submitPin = async () => {
    if (pin.length < 4) {
      setInternalError("Please enter at least a 4-digit PIN.");
      return;
    }

    setInternalError("");
    setIsSubmitting(true);

    try {
      const result = await onLogin(pin);
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

  return (
    <main className="pin-login">
      <section className="pin-card">
        <div className="pin-header">
          <h1>Café Gulzara</h1>
          <p>POS Terminal</p>
        </div>

        <div className="pin-title">
          <h2>Staff Access</h2>
          <p>Enter your PIN code to continue</p>
        </div>

        <div className="pin-display" aria-label="PIN entry">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className={`pin-dot ${index < pin.length ? "filled" : ""}`} />
          ))}
        </div>

        {error && <div className="pin-error">{error}</div>}

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
            className="pin-key pin-action"
            onClick={clearPin}
            disabled={isSubmitting}
          >
            Clear
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
            className="pin-key pin-action"
            onClick={removeDigit}
            disabled={isSubmitting}
            aria-label="Backspace"
          >
            ←
          </button>
        </div>

        <button
          type="button"
          className="pin-login-button"
          onClick={submitPin}
          disabled={isSubmitting || pin.length < 4}
        >
          {isSubmitting ? "Authenticating..." : "Login"}
        </button>
      </section>
    </main>
  );
}
