import { prisma } from "../db/prisma";

const TITLE_PRIORITY = [
  "Tarihi Dip",
  "Mega İndirim",
  "Fırsat Skoru",
  "İstek Listesi",
  "Paket İndirimi",
  "Fiyat Alarmı",
  "Ücretsiz Oyun",
  "Favori",
];

function getPriority(title: string): number {
  const t = (title || "").toLowerCase();
  for (let i = 0; i < TITLE_PRIORITY.length; i++) {
    if (t.includes(TITLE_PRIORITY[i].toLowerCase())) return i;
  }
  return 999;
}

export function extractBadgesFromNotification(item: {
  title?: string | null;
  message?: string | null;
  badges?: string[] | null;
}): string[] {
  const badges = [...(item.badges || [])];
  const lowerTitle = (item.title || "").toLowerCase();
  const lowerMsg = (item.message || "").toLowerCase();

  if (lowerTitle.includes("tarihi dip") || lowerMsg.includes("tarihi dip")) {
    badges.push("🎯 Tarihi Dip");
  }
  if (
    lowerTitle.includes("mega") ||
    lowerTitle.includes("%70") ||
    lowerMsg.includes("%7") ||
    lowerMsg.includes("%8") ||
    lowerMsg.includes("%9")
  ) {
    badges.push("💥 Mega İndirim");
  }
  if (lowerTitle.includes("fırsat skoru") || lowerMsg.includes("skor")) {
    badges.push("⚡ Yüksek Fırsat");
  }
  if (lowerTitle.includes("ücretsiz") || lowerMsg.includes("0 tl")) {
    badges.push("🎁 Ücretsiz");
  }
  if (lowerTitle.includes("istek")) {
    badges.push("✨ İstek Listesi");
  }
  if (lowerTitle.includes("dlc") || lowerTitle.includes("eklenti")) {
    badges.push("📦 Eklenti");
  }
  if (lowerTitle.includes("favori")) {
    badges.push("❤️ Favori");
  }
  return Array.from(new Set(badges));
}

/**
 * Consolidates legacy and duplicate UserNotification records in the database.
 * Merges badges and ensures at most ONE notification exists per game per user per day.
 */
export async function deduplicateUserNotifications(
  userId?: string,
  db = prisma
): Promise<{ groupsProcessed: number; deletedDuplicates: number }> {
  try {
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    const notifs = await db.userNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        title: true,
        message: true,
        badges: true,
        linkUrl: true,
        readAt: true,
        createdAt: true,
      },
    });

    if (notifs.length === 0) {
      return { groupsProcessed: 0, deletedDuplicates: 0 };
    }

    // Group by userId + (linkUrl or title prefix) + day
    const groups = new Map<string, typeof notifs>();
    for (const n of notifs) {
      const day = n.createdAt.toISOString().split("T")[0];
      const targetKey = n.linkUrl || n.message.replace(/şu an.*/i, "").trim().toLowerCase();
      const groupKey = `${n.userId}:::${targetKey}:::${day}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(n);
    }

    let groupsProcessed = 0;
    let deletedDuplicates = 0;

    for (const [, items] of groups.entries()) {
      if (items.length <= 1) continue;

      // Sort: highest priority title first, then newest
      items.sort((a, b) => {
        const pA = getPriority(a.title);
        const pB = getPriority(b.title);
        if (pA !== pB) return pA - pB;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const canonical = items[0];
      const duplicates = items.slice(1);

      const allBadges = new Set<string>();
      for (const it of items) {
        for (const b of extractBadgesFromNotification(it)) {
          allBadges.add(b);
        }
      }

      const earliestReadAt = items.find((i) => Boolean(i.readAt))?.readAt || null;

      await db.userNotification.update({
        where: { id: canonical.id },
        data: {
          badges: Array.from(allBadges),
          readAt: earliestReadAt,
        },
      });

      const idsToDelete = duplicates.map((d) => d.id);
      await db.userNotification.deleteMany({
        where: { id: { in: idsToDelete } },
      });

      groupsProcessed++;
      deletedDuplicates += idsToDelete.length;
    }

    return { groupsProcessed, deletedDuplicates };
  } catch (err: any) {
    console.warn("[deduplicateUserNotifications Warning]", err?.message || err);
    return { groupsProcessed: 0, deletedDuplicates: 0 };
  }
}
