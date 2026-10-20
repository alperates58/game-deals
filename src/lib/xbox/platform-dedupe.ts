import { prisma } from "../db/prisma";

export interface CleanTitleResult {
  baseTitle: string;
  detectedPlatform?: "PC" | "XboxOne" | "XboxSeriesX" | "CrossGen";
}

const PLATFORM_SUFFIX_REGEX =
  /\s*(?:[\(\[]\s*(?:Xbox|Windows|PC)\b[^\)\]]*[\)\]]|\b(?:for|-)\s+(?:Windows|Xbox|PC)\b.*)\s*$/i;

export function getProductGroup(productClass: string): string {
  if (["ADD_ON", "CONTENT_PACK", "CURRENCY", "SEASON_PASS"].includes(productClass)) {
    return "DLC";
  }
  return "GAME";
}

/**
 * Strips platform-specific suffixes like "(Windows)", "(Xbox One)", "(Xbox Series X|S)",
 * "(Xbox One & Xbox Series X|S)", "(Windows PC)", "[PC]" etc. to find the unified base game title.
 */
export function cleanPlatformTitle(rawTitle: string): CleanTitleResult {
  if (!rawTitle) return { baseTitle: "" };

  let title = rawTitle.trim();
  let detectedPlatform: CleanTitleResult["detectedPlatform"] = undefined;

  const match = title.match(PLATFORM_SUFFIX_REGEX);
  if (match) {
    const rawPlat = match[0].toLowerCase();
    if (rawPlat.includes("windows") || rawPlat.includes("pc")) {
      detectedPlatform = "PC";
    } else if (rawPlat.includes("one") && rawPlat.includes("series")) {
      detectedPlatform = "CrossGen";
    } else if (rawPlat.includes("series")) {
      detectedPlatform = "XboxSeriesX";
    } else if (rawPlat.includes("one")) {
      detectedPlatform = "XboxOne";
    } else if (rawPlat.includes("xbox")) {
      detectedPlatform = "XboxOne";
    }

    title = title.slice(0, match.index).trim();
  }

  // Remove dangling punctuation at the end (e.g. trailing hyphens, brackets, colons)
  title = title.replace(/[\s\-\(\[\:\|\/]+$/, "").trim();

  return {
    baseTitle: title.length > 0 ? title : rawTitle.trim(),
    detectedPlatform,
  };
}

/**
 * Unifies platform array, ensuring consistent platform tokens:
 * "PC", "XboxSeriesX", "XboxOne", "Xbox"
 */
export function mergePlatformArrays(existing: string[], additions: string[]): string[] {
  const set = new Set<string>();

  for (const p of [...existing, ...additions]) {
    if (!p) continue;
    const lower = p.toLowerCase();
    if (lower === "pc" || lower.includes("windows")) {
      set.add("PC");
    } else if (lower === "xboxseriesx" || lower.includes("series")) {
      set.add("XboxSeriesX");
    } else if (lower === "xboxone" || lower === "one") {
      set.add("XboxOne");
    } else if (lower === "xbox") {
      set.add("Xbox");
    } else {
      set.add(p);
    }
  }

  // Desired display ordering: PC, XboxSeriesX, XboxOne, Xbox
  const order = ["PC", "XboxSeriesX", "XboxOne", "Xbox"];
  return Array.from(set).sort((a, b) => {
    const idxA = order.indexOf(a);
    const idxB = order.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Formats a platform key to human-readable Turkish label.
 */
export function formatPlatformLabel(platform: string): { label: string; short: string; icon: string } {
  switch (platform) {
    case "PC":
      return { label: "Windows 10/11 PC", short: "PC", icon: "desktop" };
    case "XboxSeriesX":
      return { label: "Xbox Series X|S", short: "X|S", icon: "gamepad" };
    case "XboxOne":
      return { label: "Xbox One", short: "One", icon: "gamepad" };
    case "Xbox":
    default:
      return { label: "Xbox Konsol", short: "Xbox", icon: "gamepad" };
  }
}

/**
 * Scans all games in the database and unifies cross-platform duplicates.
 * The primary/canonical entry is updated with all combined platforms,
 * while secondary platform editions are linked as platform variants.
 */
export async function deduplicateCrossPlatformGames(db = prisma): Promise<{
  groupsProcessed: number;
  variantsMarked: number;
}> {
  const allGames = await db.game.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      platforms: true,
      isCore: true,
      popularityScore: true,
      productClass: true,
      canonicalGameId: true,
      isPlatformVariant: true,
      _count: {
        select: { priceHistories: true },
      },
    },
  });

  // Group by normalized base title + productClass
  const groups = new Map<string, typeof allGames>();

  for (const game of allGames) {
    const { baseTitle, detectedPlatform } = cleanPlatformTitle(game.title);
    const normKey = `${baseTitle.toLowerCase().trim()}:::${getProductGroup(game.productClass)}`;

    if (!groups.has(normKey)) {
      groups.set(normKey, []);
    }
    groups.get(normKey)!.push(game);
  }

  let groupsProcessed = 0;
  let variantsMarked = 0;

  for (const [groupKey, members] of groups.entries()) {
    if (members.length <= 1) {
      // Single game: clean platform suffix if present and reset variant flags
      const single = members[0];
      const { baseTitle: cleanSingleTitle, detectedPlatform } = cleanPlatformTitle(single.title);
      const extra: string[] = [];
      if (detectedPlatform === "PC") extra.push("PC");
      if (detectedPlatform === "XboxSeriesX") extra.push("XboxSeriesX");
      if (detectedPlatform === "XboxOne") extra.push("XboxOne");
      if (detectedPlatform === "CrossGen") extra.push("XboxSeriesX", "XboxOne");

      const needsTitleClean = cleanSingleTitle !== single.title;
      const needsVariantReset = single.isPlatformVariant || single.canonicalGameId;
      const mergedPlats = mergePlatformArrays(single.platforms, extra);
      const needsPlatUpdate = mergedPlats.length !== single.platforms.length;

      if (needsTitleClean || needsVariantReset || needsPlatUpdate) {
        await db.game.update({
          where: { id: single.id },
          data: {
            title: cleanSingleTitle,
            platforms: mergedPlats,
            isPlatformVariant: false,
            canonicalGameId: null,
          },
        });
      }
      continue;
    }

    // Sort to determine canonical game:
    // 1. Exact match with clean base title (no platform suffix)
    // 2. isCore true
    // 3. More price histories
    // 4. Higher popularityScore
    members.sort((a, b) => {
      const aClean = cleanPlatformTitle(a.title);
      const bClean = cleanPlatformTitle(b.title);
      const aIsExact = aClean.baseTitle.toLowerCase() === a.title.toLowerCase();
      const bIsExact = bClean.baseTitle.toLowerCase() === b.title.toLowerCase();

      if (aIsExact && !bIsExact) return -1;
      if (!aIsExact && bIsExact) return 1;

      if (a.isCore && !b.isCore) return -1;
      if (!a.isCore && b.isCore) return 1;

      const histDiff = b._count.priceHistories - a._count.priceHistories;
      if (histDiff !== 0) return histDiff;

      return b.popularityScore - a.popularityScore;
    });

    const canonical = members[0];
    const variants = members.slice(1);

    // Collect all platforms across all members
    let allPlatforms: string[] = [];
    for (const m of members) {
      const { detectedPlatform } = cleanPlatformTitle(m.title);
      const mPlatforms = [...m.platforms];
      if (detectedPlatform === "PC" && !mPlatforms.includes("PC")) {
        mPlatforms.push("PC");
      } else if (detectedPlatform === "XboxSeriesX" && !mPlatforms.includes("XboxSeriesX")) {
        mPlatforms.push("XboxSeriesX");
      } else if (detectedPlatform === "XboxOne" && !mPlatforms.includes("XboxOne")) {
        mPlatforms.push("XboxOne");
      } else if (detectedPlatform === "CrossGen") {
        if (!mPlatforms.includes("XboxSeriesX")) mPlatforms.push("XboxSeriesX");
        if (!mPlatforms.includes("XboxOne")) mPlatforms.push("XboxOne");
      }
      allPlatforms = mergePlatformArrays(allPlatforms, mPlatforms);
    }

    // Clean canonical title if needed
    const { baseTitle: cleanCanonicalTitle } = cleanPlatformTitle(canonical.title);

    // Update canonical game
    await db.game.update({
      where: { id: canonical.id },
      data: {
        title: cleanCanonicalTitle,
        platforms: allPlatforms,
        isPlatformVariant: false,
        canonicalGameId: null,
      },
    });

    // Mark variants
    for (const v of variants) {
      const { detectedPlatform } = cleanPlatformTitle(v.title);
      const vPlatforms = [...v.platforms];
      if (detectedPlatform === "PC" && !vPlatforms.includes("PC")) {
        vPlatforms.push("PC");
      } else if (detectedPlatform === "XboxSeriesX" && !vPlatforms.includes("XboxSeriesX")) {
        vPlatforms.push("XboxSeriesX");
      } else if (detectedPlatform === "XboxOne" && !vPlatforms.includes("XboxOne")) {
        vPlatforms.push("XboxOne");
      }

      await db.game.update({
        where: { id: v.id },
        data: {
          platforms: mergePlatformArrays(vPlatforms, []),
          isPlatformVariant: true,
          canonicalGameId: canonical.id,
        },
      });
      variantsMarked++;
    }

    groupsProcessed++;
  }

  return { groupsProcessed, variantsMarked };
}
