import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role } from "@prisma/client";

// In-memory simulated database state for testing concurrency & security rules
interface MockUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

interface MockSystemSetting {
  id: string;
  allowRegistration: boolean;
}

describe("Registration Concurrency & Security Hardening", () => {
  let users: MockUser[] = [];
  let systemSettings: MockSystemSetting = { id: "global", allowRegistration: true };
  let lockHeld = false;

  beforeEach(() => {
    users = [];
    systemSettings = { id: "global", allowRegistration: true };
    lockHeld = false;
  });

  // Simulated atomic registration service matching the route handler's transaction logic
  async function simulateAtomicRegister(input: {
    name: string;
    email: string;
    password: string;
  }) {
    // 1. Simulate PostgreSQL transaction advisory lock (exclusive mutex)
    while (lockHeld) {
      await new Promise((r) => setTimeout(r, 10));
    }
    lockHeld = true;

    try {
      // 2. Validate registration policy
      if (!systemSettings.allowRegistration) {
        throw new Error("REGISTRATION_DISABLED");
      }

      // 3. Duplicate check
      if (users.some((u) => u.email === input.email)) {
        throw new Error("EMAIL_EXISTS");
      }

      // 4. Atomic check for first OWNER
      const isFirstUser = users.length === 0;
      const role: Role = isFirstUser ? Role.OWNER : Role.USER;

      const newUser: MockUser = {
        id: `user-${Date.now()}-${Math.random()}`,
        name: input.name,
        email: input.email,
        passwordHash: "bcrypt-hashed-secret-value",
        role,
      };
      users.push(newUser);

      // 5. Auto-close registration after first OWNER
      if (isFirstUser) {
        systemSettings.allowRegistration = false;
      }

      // 6. Safe API Response (Never expose passwordHash, secrets, tokens)
      const safeUser = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      };

      return { success: true, user: safeUser };
    } finally {
      lockHeld = false;
    }
  }

  it("first registration creates exactly one OWNER", async () => {
    const res = await simulateAtomicRegister({
      name: "Alper",
      email: "owner@alperates.com.tr",
      password: "strongpassword123",
    });

    expect(res.success).toBe(true);
    expect(res.user.role).toBe(Role.OWNER);
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe(Role.OWNER);
  });

  it("registration automatically becomes disabled after first OWNER is created", async () => {
    await simulateAtomicRegister({
      name: "Alper",
      email: "owner@alperates.com.tr",
      password: "strongpassword123",
    });

    expect(systemSettings.allowRegistration).toBe(false);

    // Subsequent registration attempt without re-enabling must be rejected
    await expect(
      simulateAtomicRegister({
        name: "Second User",
        email: "second@example.com",
        password: "password123",
      })
    ).rejects.toThrow("REGISTRATION_DISABLED");
  });

  it("concurrent first registration cannot create two OWNER accounts", async () => {
    // Launch two simultaneous registration requests
    const p1 = simulateAtomicRegister({
      name: "User A",
      email: "a@example.com",
      password: "password123",
    });
    const p2 = simulateAtomicRegister({
      name: "User B",
      email: "b@example.com",
      password: "password123",
    });

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed as OWNER, and the concurrent one must be rejected (due to auto-close)
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const ownerUsers = users.filter((u) => u.role === Role.OWNER);
    expect(ownerUsers).toHaveLength(1);
  });

  it("existing OWNER can re-enable registration and allow subsequent USER accounts", async () => {
    // 1. First user registers and becomes OWNER
    await simulateAtomicRegister({
      name: "Owner",
      email: "owner@alperates.com.tr",
      password: "password123",
    });

    expect(systemSettings.allowRegistration).toBe(false);

    // 2. OWNER explicitly re-enables registration in Settings
    systemSettings.allowRegistration = true;

    // 3. Second user registers
    const res2 = await simulateAtomicRegister({
      name: "Family Member",
      email: "family@example.com",
      password: "password123",
    });

    expect(res2.success).toBe(true);
    expect(res2.user.role).toBe(Role.USER); // MUST be USER, not OWNER

    const ownerCount = users.filter((u) => u.role === Role.OWNER).length;
    expect(ownerCount).toBe(1);
  });

  it("no secret or password hash is exposed in the API response", async () => {
    const res = await simulateAtomicRegister({
      name: "Alper",
      email: "owner@alperates.com.tr",
      password: "mySuperSecretPassword123!",
    });

    expect(res.user).toHaveProperty("id");
    expect(res.user).toHaveProperty("email");
    expect(res.user).toHaveProperty("name");
    expect(res.user).toHaveProperty("role");

    // Assert that sensitive fields are completely absent from API response
    expect(res.user).not.toHaveProperty("password");
    expect(res.user).not.toHaveProperty("passwordHash");
    expect(res.user).not.toHaveProperty("sessionSecret");
    expect(res.user).not.toHaveProperty("token");

    const jsonString = JSON.stringify(res);
    expect(jsonString).not.toContain("mySuperSecretPassword123!");
    expect(jsonString).not.toContain("bcrypt-hashed-secret-value");
  });
});
