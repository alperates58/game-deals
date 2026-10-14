const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const catalogTables = [
  "Game",
  "PriceHistory",
  "DealAnalysis",
  "GameRelation",
  "SyncRun",
  "SystemSetting",
];

const targetFile = path.resolve(__dirname, "../prisma/seed.dump");

// Extract DB credentials from DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("[create-seed-dump] DATABASE_URL environment variable is required.");
}

let host = "postgres";
let port = "5432";
let user = "postgres";
let password = "";
let database = "gamedeals";

try {
  const u = new URL(dbUrl);
  host = u.hostname || host;
  port = u.port || port;
  user = decodeURIComponent(u.username || user);
  password = u.password ? decodeURIComponent(u.password) : "";
  database = u.pathname.replace(/^\//, "") || database;
} catch (e) {
  throw new Error(`[create-seed-dump] Failed to parse DATABASE_URL: ${e.message}`);
}

const args = [
  "-h", host,
  "-p", port,
  "-U", user,
  "-d", database,
  "--no-owner",
  "--no-privileges",
  "--data-only",
  "-Fc",
];

for (const t of catalogTables) {
  args.push("-t", `"${t}"`);
}

args.push("-f", targetFile);

console.log("[create-seed-dump] Creating clean catalog seed dump at:", targetFile);
execFileSync("pg_dump", args, {
  env: { ...process.env, PGPASSWORD: password },
  stdio: "inherit",
});

const stats = fs.statSync(targetFile);
console.log(`[create-seed-dump] Done! File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
