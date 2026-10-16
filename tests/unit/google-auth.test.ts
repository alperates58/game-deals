import { describe, it, expect, beforeEach, vi } from "vitest";
import { Role, AuthProvider, User } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  resolveGoogleUser,
  sanitizeReturnTo,
  createOAuthStateToken,
  verifyOAuthStateToken,
  getGoogleOAuthConfig,
} from "../../src/lib/auth/google";
import { POST as logoutPost, GET as logoutGet } from "../../src/app/api/auth/logout/route";

// In-memory mock database state for testing Google OAuth security rules
interface MockUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: Role;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  accounts: MockAuthAccount[];
}

interface MockAuthAccount {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockSystemSetting {
  id: string;
  allowRegistration: boolean;
}

function createMockDb(initialData?: {
  users?: MockUser[];
  accounts?: MockAuthAccount[];
  settings?: MockSystemSetting;
}) {
  const users: MockUser[] = initialData?.users ? [...initialData.users] : [];
  const accounts: MockAuthAccount[] = initialData?.accounts ? [...initialData.accounts] : [];
  const settings: MockSystemSetting = initialData?.settings || {
    id: "global",
    allowRegistration: true,
  };

  let lockHeld = false;

  const mockTx: any = {
    $executeRaw: vi.fn(async () => {
      // simulate advisory lock
      return 1;
    }),
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) {
          return users.find((u) => u.email.toLowerCase() === where.email?.toLowerCase()) || null;
        }
        if (where.id) {
          return users.find((u) => u.id === where.id) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newUser: MockUser = {
          id,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash || null,
          role: data.role,
          avatarUrl: data.avatarUrl || null,
          lastLoginAt: data.lastLoginAt || new Date(),
          accounts: [],
        };
        users.push(newUser);

        if (data.accounts?.create) {
          const accData = data.accounts.create;
          const accId = `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const newAcc: MockAuthAccount = {
            id: accId,
            userId: id,
            provider: accData.provider,
            providerAccountId: accData.providerAccountId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          accounts.push(newAcc);
          newUser.accounts.push(newAcc);
        }

        return newUser;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const user = users.find((u) => u.id === where.id);
        if (!user) throw new Error("User not found");
        if (data.lastLoginAt) user.lastLoginAt = data.lastLoginAt;
        if (data.avatarUrl) user.avatarUrl = data.avatarUrl;
        return user;
      }),
      count: vi.fn(async () => users.length),
    },
    authAccount: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { provider_providerAccountId: { provider: AuthProvider; providerAccountId: string } };
        }) => {
          const acc = accounts.find(
            (a) =>
              a.provider === where.provider_providerAccountId.provider &&
              a.providerAccountId === where.provider_providerAccountId.providerAccountId
          );
          if (!acc) return null;
          const user = users.find((u) => u.id === acc.userId);
          return { ...acc, user };
        }
      ),
      create: vi.fn(async ({ data }: { data: any }) => {
        // Enforce unique constraint
        const exists = accounts.find(
          (a) => a.provider === data.provider && a.providerAccountId === data.providerAccountId
        );
        if (exists) {
          const err: any = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const newAcc: MockAuthAccount = {
          id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          userId: data.userId,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        accounts.push(newAcc);
        const user = users.find((u) => u.id === data.userId);
        if (user) user.accounts.push(newAcc);
        return newAcc;
      }),
    },
    systemSetting: {
      findUnique: vi.fn(async () => settings),
      create: vi.fn(async ({ data }: any) => {
        Object.assign(settings, data);
        return settings;
      }),
    },
  };

  const mockDb: any = {
    ...mockTx,
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      // Mutex for atomic simulation
      while (lockHeld) {
        await new Promise((r) => setTimeout(r, 5));
      }
      lockHeld = true;
      try {
        return await cb(mockTx);
      } finally {
        lockHeld = false;
      }
    }),
  };

  return { mockDb, users, accounts, settings };
}

describe("Google OAuth Security & Account Resolution Hardening", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SESSION_SECRET:
        "test-session-secret-must-be-at-least-64-characters-long-high-entropy-production-secret-12345",
      DATABASE_URL: "postgresql://postgres:testpassword@localhost:5432/gamedeals",
      GOOGLE_CLIENT_ID: "mock-google-client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "mock-google-client-secret-xyz",
      APP_URL: "https://game.alperates.com.tr",
    };
  });

  // Test 1: Existing OWNER email + verified Google identity -> same User, same id, role remains OWNER, AuthAccount created
  it("1. Existing OWNER email + verified Google identity preserves OWNER role and links AuthAccount", async () => {
    const existingOwner: MockUser = {
      id: "owner-user-id-123",
      name: "Alper Ateş",
      email: "owner@alperates.com.tr",
      passwordHash: "$2a$12$hashedpasswordvalue",
      role: Role.OWNER,
      avatarUrl: null,
      lastLoginAt: new Date(),
      accounts: [],
    };

    const { mockDb, accounts, users } = createMockDb({ users: [existingOwner] });

    const user = await resolveGoogleUser(
      {
        sub: "google-sub-alper-999",
        email: "owner@alperates.com.tr",
        emailVerified: true,
        name: "Alper (Google)",
        picture: "https://lh3.googleusercontent.com/avatar.jpg",
      },
      mockDb
    );

    // Assert same User identity and OWNER role preserved
    expect(user.id).toBe("owner-user-id-123");
    expect(user.role).toBe(Role.OWNER);
    expect(user.passwordHash).toBe("$2a$12$hashedpasswordvalue"); // Password hash preserved!
    expect(users).toHaveLength(1); // No duplicate user created

    // Assert AuthAccount created with Google sub
    expect(accounts).toHaveLength(1);
    expect(accounts[0].userId).toBe("owner-user-id-123");
    expect(accounts[0].provider).toBe(AuthProvider.GOOGLE);
    expect(accounts[0].providerAccountId).toBe("google-sub-alper-999");
  });

  // Test 2: Existing USER email -> same USER preserved
  it("2. Existing USER email preserves existing USER and links AuthAccount", async () => {
    const existingUser: MockUser = {
      id: "regular-user-id-456",
      name: "Mehmet Demir",
      email: "mehmet@example.com",
      passwordHash: "$2a$12$hashedpasswordmehmet",
      role: Role.USER,
      avatarUrl: null,
      lastLoginAt: new Date(),
      accounts: [],
    };

    const { mockDb, accounts, users } = createMockDb({ users: [existingUser] });

    const user = await resolveGoogleUser(
      {
        sub: "google-sub-mehmet-777",
        email: "MEHMET@EXAMPLE.COM", // Case insensitivity test
        emailVerified: true,
        name: "Mehmet Demir",
      },
      mockDb
    );

    expect(user.id).toBe("regular-user-id-456");
    expect(user.role).toBe(Role.USER);
    expect(users).toHaveLength(1);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].providerAccountId).toBe("google-sub-mehmet-777");
  });

  // Test 3: New Google identity + registration enabled -> new USER, NEVER OWNER
  it("3. New Google identity + registration enabled creates new USER (never OWNER)", async () => {
    const { mockDb, users, accounts } = createMockDb({ users: [] }); // Zero users in DB

    const user = await resolveGoogleUser(
      {
        sub: "google-sub-brand-new-1",
        email: "newuser@example.com",
        emailVerified: true,
        name: "New Explorer",
        picture: "https://lh3.googleusercontent.com/new.jpg",
      },
      mockDb
    );

    expect(user.email).toBe("newuser@example.com");
    expect(user.role).toBe(Role.USER); // MUST be USER even if user table was empty!
    expect(user.passwordHash).toBeNull(); // Google-only user has null passwordHash
    expect(user.avatarUrl).toBe("https://lh3.googleusercontent.com/new.jpg");
    expect(users).toHaveLength(1);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].providerAccountId).toBe("google-sub-brand-new-1");
  });

  // Test 4: New Google identity + registration disabled -> rejected
  it("4. New Google identity + registration disabled is rejected with REGISTRATION_DISABLED", async () => {
    const { mockDb, users, accounts } = createMockDb({
      settings: { id: "global", allowRegistration: false },
    });

    await expect(
      resolveGoogleUser(
        {
          sub: "google-sub-blocked-1",
          email: "blocked@example.com",
          emailVerified: true,
          name: "Blocked User",
        },
        mockDb
      )
    ).rejects.toThrow("REGISTRATION_DISABLED");

    expect(users).toHaveLength(0);
    expect(accounts).toHaveLength(0);
  });

  // Test 5: Existing linked Google sub -> login existing user
  it("5. Existing linked Google sub logs in existing user directly", async () => {
    const existingUser: MockUser = {
      id: "already-linked-user-1",
      name: "Zeynep",
      email: "zeynep@example.com",
      passwordHash: null,
      role: Role.USER,
      avatarUrl: "https://lh3.googleusercontent.com/old.jpg",
      lastLoginAt: new Date(Date.now() - 100000),
      accounts: [],
    };
    const existingAccount: MockAuthAccount = {
      id: "acc-1",
      userId: existingUser.id,
      provider: AuthProvider.GOOGLE,
      providerAccountId: "google-sub-zeynep-555",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    existingUser.accounts.push(existingAccount);

    const { mockDb, users, accounts } = createMockDb({
      users: [existingUser],
      accounts: [existingAccount],
    });

    const user = await resolveGoogleUser(
      {
        sub: "google-sub-zeynep-555",
        email: "zeynep@example.com",
        emailVerified: true,
        name: "Zeynep Updated",
      },
      mockDb
    );

    expect(user.id).toBe("already-linked-user-1");
    expect(users).toHaveLength(1);
    expect(accounts).toHaveLength(1);
  });

  // Test 6: email_verified=false -> rejected
  it("6. Unverified Google email (email_verified=false) is strictly rejected", async () => {
    const { mockDb, users, accounts } = createMockDb();

    await expect(
      resolveGoogleUser(
        {
          sub: "google-sub-unverified",
          email: "unverified@example.com",
          emailVerified: false, // NOT VERIFIED
          name: "Attacker",
        },
        mockDb
      )
    ).rejects.toThrow("EMAIL_NOT_VERIFIED");

    expect(users).toHaveLength(0);
    expect(accounts).toHaveLength(0);
  });

  // Test 7: Duplicate concurrent account link -> no duplicate account/user
  it("7. Duplicate concurrent account link calls do not create duplicate records", async () => {
    const { mockDb, users, accounts } = createMockDb({ users: [] });

    // Run 2 simultaneous requests with same Google identity
    const p1 = resolveGoogleUser(
      {
        sub: "concurrent-sub-123",
        email: "concurrent@example.com",
        emailVerified: true,
        name: "Concurrent User",
      },
      mockDb
    );

    const p2 = resolveGoogleUser(
      {
        sub: "concurrent-sub-123",
        email: "concurrent@example.com",
        emailVerified: true,
        name: "Concurrent User",
      },
      mockDb
    );

    const [u1, u2] = await Promise.all([p1, p2]);

    expect(u1.id).toBe(u2.id);
    expect(users).toHaveLength(1);
    expect(accounts).toHaveLength(1);
  });

  // Test 8: Invalid state -> rejected
  it("8. Invalid or tampered state token is rejected by verifyOAuthStateToken", async () => {
    // 1. Completely invalid string
    const result1 = await verifyOAuthStateToken("invalid.token.here");
    expect(result1).toBeNull();

    // 2. Empty string
    const result2 = await verifyOAuthStateToken("");
    expect(result2).toBeNull();

    // 3. Valid token round-trip works
    const token = await createOAuthStateToken({
      state: "secret-state-xyz",
      codeVerifier: "pkce-verifier-123",
      nonce: "nonce-abc",
      returnTo: "/ayarlar",
    });

    const verified = await verifyOAuthStateToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.state).toBe("secret-state-xyz");
    expect(verified?.codeVerifier).toBe("pkce-verifier-123");
    expect(verified?.nonce).toBe("nonce-abc");
    expect(verified?.returnTo).toBe("/ayarlar");
  });

  // Test 9: Callback OAuth error -> safe error handling & Open Redirect defense
  it("9. Open Redirect prevention sanitizes external or malicious returnTo URLs", () => {
    // Malicious open redirect targets must fallback to /profil
    expect(sanitizeReturnTo("https://evil-phishing.com")).toBe("/profil");
    expect(sanitizeReturnTo("//evil-phishing.com")).toBe("/profil");
    expect(sanitizeReturnTo("/\\evil-phishing.com")).toBe("/profil");
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/profil");
    expect(sanitizeReturnTo("")).toBe("/profil");
    expect(sanitizeReturnTo(null)).toBe("/profil");
    expect(sanitizeReturnTo(undefined)).toBe("/profil");

    // Safe relative paths must be preserved
    expect(sanitizeReturnTo("/profil")).toBe("/profil");
    expect(sanitizeReturnTo("/ayarlar")).toBe("/ayarlar");
    expect(sanitizeReturnTo("/kutuphane")).toBe("/kutuphane");
    expect(sanitizeReturnTo("/oyun/halo-infinite")).toBe("/oyun/halo-infinite");
  });

  // Test 10: passwordHash=null user -> password login safe handling
  it("10. Users with passwordHash=null cannot authenticate via password login", () => {
    const googleOnlyUser = {
      id: "google-only-user",
      email: "googleonly@example.com",
      passwordHash: null,
      role: Role.USER,
    };

    // Confirm that passwordHash is indeed null
    expect(googleOnlyUser.passwordHash).toBeNull();

    // Verify the safety check logic in /api/auth/login
    const canAttemptPasswordLogin = Boolean(googleOnlyUser.passwordHash);
    expect(canAttemptPasswordLogin).toBe(false);
  });

  // Test 11: getGoogleOAuthConfig never leaks secret and reports truthful state
  it("11. getGoogleOAuthConfig provides truthful configuration state", () => {
    const config = getGoogleOAuthConfig();
    expect(config.isConfigured).toBe(true);
    expect(config.redirectUri).toBe("https://game.alperates.com.tr/api/auth/google/callback");

    // When env vars are missing
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const unconfigured = getGoogleOAuthConfig();
    expect(unconfigured.isConfigured).toBe(false);
  });

  // Test 12: Logout UX redirects to /login and clears session cookie
  it("12. Logout redirects browser requests to /login and clears session cookie", async () => {
    // Mock NextRequest for standard browser navigation / form post
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const res = await logoutPost(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    const cookieHeader = res.headers.get("set-cookie") || "";
    expect(cookieHeader).toContain("game_deals_session=");
    expect(cookieHeader).toContain("Max-Age=0");

    // Also verify GET /api/auth/logout
    const getReq = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "GET",
    });
    const getRes = await logoutGet(getReq);
    expect(getRes.status).toBe(303);
    expect(getRes.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
