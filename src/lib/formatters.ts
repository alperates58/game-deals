/**
 * Deterministic formatting helpers for consistent SSR and Client Hydration.
 * Prevents React Error #418 caused by Node.js ICU differences and timezone mismatches.
 */

const SHORT_MONTHS_TR = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"
];

/**
 * Format a date as DD.MM.YYYY deterministically
 */
export function formatDate(val: Date | string | null | undefined): string {
  if (!val) return "-";
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    const [year, month, day] = val.slice(0, 10).split("-");
    return `${day}.${month}.${year}`;
  }
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Format a date as DD MMM (e.g., "15 Eki")
 */
export function formatShortDate(val: Date | string | null | undefined): string {
  if (!val) return "-";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const monthName = SHORT_MONTHS_TR[d.getMonth()] || "";
  return `${day} ${monthName}`;
}

/**
 * Format date & time deterministically: DD.MM.YYYY HH:mm
 */
export function formatDateTime(val: Date | string | null | undefined): string {
  if (!val) return "-";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Format price deterministically with Turkish thousand separators:
 * e.g., 1250 -> "1.250", 1250.5 -> "1.250,50"
 */
export function formatPrice(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "string" ? parseFloat(val) : Number(val);
  if (isNaN(num)) return "0";
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const fixed = absNum.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = isNegative ? "-" : "";
  if (decPart === "00") {
    return `${sign}${formattedInt}`;
  }
  return `${sign}${formattedInt},${decPart}`;
}
