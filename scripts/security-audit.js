const fs = require("fs");
const path = require("path");

function walk(dir) {
  let files = [];
  try {
    for (const item of fs.readdirSync(dir)) {
      if (["node_modules", ".next", ".git"].includes(item)) continue;
      if (item.endsWith(".dump") || item.endsWith(".png") || item.endsWith(".jpg") || item.endsWith(".ico")) continue;
      const full = path.join(dir, item);
      const st = fs.statSync(full);
      if (st.isDirectory()) files.push(...walk(full));
      else files.push(full);
    }
  } catch (e) {}
  return files;
}

const checkFiles = [
  ...walk("src"),
  ...walk("scripts"),
  ...walk("prisma"),
  "docker-compose.yml",
  "Dockerfile",
  ".env.example",
  "README.md",
];

const patterns = [
  "postgrespassword",
  "game-deals-super-secure-jwt-secret",
  "game-deals-super-secure",
  "some-known-static-secret",
  "SESSION_SECRET:-",
  "POSTGRES_PASSWORD:-",
];

let foundCount = 0;
for (const file of checkFiles) {
  if (!fs.existsSync(file)) continue;
  if (path.resolve(file) === path.resolve(__filename)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const pat of patterns) {
    if (content.includes(pat)) {
      console.log(`[ALERT] Found '${pat}' in ${file}`);
      foundCount++;
    }
  }
}

if (foundCount === 0) {
  console.log("[SECURITY VERIFIED] Zero hardcoded secrets/passwords found across all production files!");
  process.exit(0);
} else {
  console.error(`[FAILED] Found ${foundCount} occurrences of secrets!`);
  process.exit(1);
}
