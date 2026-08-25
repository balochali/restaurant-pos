import { getDb } from "./db";
import { hashPin, verifyPin } from "./pin";

export async function runPinStorageTest(): Promise<string[]> {
  const results: string[] = [];

  const db = await getDb();

  const testUserId = crypto.randomUUID();
  const testUsername = `pin_test_${Date.now()}`;

  const testPin = "1234";

  try {
    results.push("Starting T-011 PIN hashing test...");

    // --------------------------------------------------
    // 1. Hash PIN
    // --------------------------------------------------

    const pinHash = await hashPin(testPin);

    results.push("✓ PIN successfully hashed");

    // --------------------------------------------------
    // 2. Make sure plaintext PIN isn't inside hash
    // --------------------------------------------------

    if (pinHash.includes(testPin)) {
      throw new Error("PIN appears inside stored hash");
    }

    results.push("✓ Hash does not contain plaintext PIN");

    // --------------------------------------------------
    // 3. Store user in SQLite
    // --------------------------------------------------

    await db.execute(
      `
      INSERT INTO users (
        id,
        name,
        username,
        pin_hash,
        role,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [testUserId, "T-011 Test User", testUsername, pinHash, "CASHIER", 1],
    );

    results.push("✓ Hashed PIN stored in SQLite");

    // --------------------------------------------------
    // 4. Read hash back from SQLite
    // --------------------------------------------------

    const rows = await db.select<
      {
        id: string;
        username: string;
        pin_hash: string;
      }[]
    >(
      `
      SELECT id, username, pin_hash
      FROM users
      WHERE id = ?
      `,
      [testUserId],
    );

    if (rows.length !== 1) {
      throw new Error("Test user could not be read from SQLite");
    }

    const storedHash = rows[0].pin_hash;

    results.push("✓ Hash successfully read from SQLite");

    // --------------------------------------------------
    // 5. Confirm plaintext wasn't stored
    // --------------------------------------------------

    if (storedHash === testPin) {
      throw new Error("SECURITY FAILURE: plaintext PIN was stored");
    }

    results.push("✓ PIN is NOT stored as plaintext");

    // --------------------------------------------------
    // 6. Verify correct PIN
    // --------------------------------------------------

    const correctPinResult = await verifyPin(testPin, storedHash);

    if (!correctPinResult) {
      throw new Error("Correct PIN failed verification");
    }

    results.push("✓ Correct PIN verification succeeded");

    // --------------------------------------------------
    // 7. Verify incorrect PIN
    // --------------------------------------------------

    const wrongPinResult = await verifyPin("9999", storedHash);

    if (wrongPinResult) {
      throw new Error("Incorrect PIN was accepted");
    }

    results.push("✓ Incorrect PIN verification correctly failed");

    results.push("");
    results.push("================================");
    results.push("T-011 PIN TEST: SUCCESS");
    results.push("================================");

    return results;
  } finally {
    // --------------------------------------------------
    // Clean up test user
    // --------------------------------------------------

    await db.execute(
      `
      DELETE FROM users
      WHERE id = ?
      `,
      [testUserId],
    );

    results.push("✓ Temporary test user removed");
  }
}
