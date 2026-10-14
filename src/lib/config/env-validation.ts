/**
 * Production Security: Server-side Environment Validation
 * Validates critical secrets at startup to fail-fast.
 * Never logs secrets or sensitive values.
 */

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateServerEnv(): EnvValidationResult {
  const errors: string[] = [];

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    errors.push("SESSION_SECRET is missing. It must be provided as an environment variable.");
  } else if (sessionSecret.length < 64) {
    errors.push(
      `SESSION_SECRET is too short (${sessionSecret.length} chars). Minimum required length is 64 characters.`
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push("DATABASE_URL is missing. It must be provided as an environment variable.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertServerEnv(): void {
  const { valid, errors } = validateServerEnv();
  if (!valid) {
    console.error("==================================================");
    console.error("CRITICAL SECURITY ERROR: STARTUP CONFIGURATION FAILED");
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    console.error("==================================================");
    throw new Error(`Startup aborted due to configuration errors: ${errors.join("; ")}`);
  }
}
