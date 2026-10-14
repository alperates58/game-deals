export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only enforce runtime secret checks when actually serving, not during build compilation
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { assertServerEnv } = await import("./lib/config/env-validation");
      assertServerEnv();
    }
  }
}
