import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash a PIN using bcrypt.
 *
 * The resulting bcrypt hash contains:
 * - bcrypt algorithm identifier
 * - cost factor
 * - random salt
 * - derived hash
 */
export async function hashPin(pin: string): Promise<string> {
  if (!pin || pin.length < 4) {
    throw new Error("PIN must contain at least 4 characters");
  }

  return bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Verify a PIN against a previously generated bcrypt hash.
 *
 * Returns true only when the supplied PIN matches the stored hash.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  try {
    if (!pin || !storedHash) {
      return false;
    }

    return await bcrypt.compare(pin, storedHash);
  } catch {
    return false;
  }
}
