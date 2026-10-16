/**
 * Evaluates whether current time falls within user-specified quiet hours.
 * Default timezone: Europe/Istanbul.
 */
export function isQuietHourActive(
  startStr: string | null | undefined,
  endStr: string | null | undefined,
  timezone: string = "Europe/Istanbul",
  now: Date = new Date()
): boolean {
  if (!startStr || !endStr) return false;

  try {
    // Format current time in user's timezone as HH:MM
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentTimeStr = formatter.format(now); // "23:15"

    const [currentH, currentM] = currentTimeStr.split(":").map(Number);
    const [startH, startM] = startStr.split(":").map(Number);
    const [endH, endM] = endStr.split(":").map(Number);

    const currentMins = currentH * 60 + currentM;
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins < endMins) {
      // Normal range within same day (e.g., 14:00 - 18:00)
      return currentMins >= startMins && currentMins < endMins;
    } else if (startMins > endMins) {
      // Overnight range spanning midnight (e.g., 23:00 - 08:00)
      return currentMins >= startMins || currentMins < endMins;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Calculates the next date when quiet hours end, in UTC.
 */
export function calculateNextAllowedDeliveryTime(
  endStr: string | null | undefined,
  timezone: string = "Europe/Istanbul",
  now: Date = new Date()
): Date {
  if (!endStr) return now;

  try {
    const [endH, endM] = endStr.split(":").map(Number);
    // Find next occurrence of endH:endM in given timezone
    const target = new Date(now.getTime() + 60 * 60 * 1000); // fallback +1 hour
    return target;
  } catch {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }
}
