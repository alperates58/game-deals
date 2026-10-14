import fs from "node:fs";

async function verifyHttp() {
  const baseUrl = "http://localhost:3000";
  console.log("Verifying HTTP routes on", baseUrl);

  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthJson = await healthRes.json();
  console.log("Health API status:", healthRes.status, JSON.stringify(healthJson));

  // 2. Home page
  const homeRes = await fetch(`${baseUrl}/`);
  const homeHtml = await homeRes.text();
  console.log("Home page status:", homeRes.status, `(${homeHtml.length} bytes)`);

  // 3. Deals page
  const dealsRes = await fetch(`${baseUrl}/firsatlar`);
  const dealsHtml = await dealsRes.text();
  console.log("Deals page status:", dealsRes.status, `(${dealsHtml.length} bytes)`);

  // 4. Historical Lows page
  const lowsRes = await fetch(`${baseUrl}/tarihi-dip`);
  const lowsHtml = await lowsRes.text();
  console.log("Historical Lows page status:", lowsRes.status, `(${lowsHtml.length} bytes)`);

  // Save evidence
  fs.writeFileSync(
    "docs/evidence/faz0/health-check-response.json",
    JSON.stringify(healthJson, null, 2)
  );

  console.log("HTTP Verification completed successfully!");
}

verifyHttp().catch(console.error);
