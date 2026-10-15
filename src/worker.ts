import { assertServerEnv } from "./lib/config/env-validation";
import { AutonomousWorker } from "./lib/scheduler/worker-loop";

// 1. Fail-fast on missing environment variables (e.g. DATABASE_URL, SESSION_SECRET)
try {
  assertServerEnv();
} catch (envError: any) {
  console.error("==================================================");
  console.error("  WORKER STARTUP ABORTED: ENVIRONMENT INVALID");
  console.error(envError.message);
  console.error("==================================================");
  process.exit(1);
}

// 2. Initialize worker runtime
const worker = new AutonomousWorker({
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS) || 30000,
});

// 3. Graceful shutdown handler
const shutdown = (signal: string) => {
  console.log(`\n[Worker] Received ${signal}. Initiating graceful shutdown...`);
  worker.stop();
  // Allow up to 10 seconds for any current tick to finish releasing locks
  setTimeout(() => {
    console.error("[Worker] Forcing exit after timeout.");
    process.exit(0);
  }, 10000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// 4. Start background polling loop
worker.start().catch((err) => {
  console.error("[Worker] Fatal error starting worker:", err);
  process.exit(1);
});
