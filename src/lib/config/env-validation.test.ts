import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateServerEnv, assertServerEnv } from "./env-validation";

describe("Server Environment Validation (Security Fail-Fast)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should fail when SESSION_SECRET is missing", () => {
    delete process.env.SESSION_SECRET;
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";

    const result = validateServerEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("SESSION_SECRET is missing"))).toBe(true);

    expect(() => assertServerEnv()).toThrowError(/SESSION_SECRET is missing/);
  });

  it("should fail when SESSION_SECRET is shorter than 64 characters", () => {
    process.env.SESSION_SECRET = "short-secret-only-32-chars-long!";
    expect(process.env.SESSION_SECRET.length).toBeLessThan(64);
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";

    const result = validateServerEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("SESSION_SECRET is too short"))).toBe(true);

    expect(() => assertServerEnv()).toThrowError(/SESSION_SECRET is too short/);
  });

  it("should pass when SESSION_SECRET is at least 64 characters and DATABASE_URL is present", () => {
    // 64-character high entropy test secret
    process.env.SESSION_SECRET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^";
    expect(process.env.SESSION_SECRET.length).toBeGreaterThanOrEqual(64);
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";

    const result = validateServerEnv();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    expect(() => assertServerEnv()).not.toThrow();
  });

  it("should fail when DATABASE_URL is missing", () => {
    process.env.SESSION_SECRET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^";
    delete process.env.DATABASE_URL;

    const result = validateServerEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("DATABASE_URL is missing"))).toBe(true);

    expect(() => assertServerEnv()).toThrowError(/DATABASE_URL is missing/);
  });

  it("should NEVER leak the secret value in error messages or logs", () => {
    const sensitiveSecretValue = "ultra-secret-value-that-should-never-be-printed-in-any-log-file";
    process.env.SESSION_SECRET = sensitiveSecretValue;
    delete process.env.DATABASE_URL;

    const result = validateServerEnv();
    const joinedErrors = result.errors.join(" ");

    expect(joinedErrors).not.toContain(sensitiveSecretValue);
  });
});
