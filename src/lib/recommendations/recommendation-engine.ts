import { prisma } from "../db/prisma";
import { ProductClass } from "@prisma/client";

export interface RecommendedGameItem {
  game: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    currentPrice: number;
    listPrice: number;
    discountPercent: number;
    currency: string;
    publisher: string | null;
    franchise: string | null;
    genres: string[];
    dealScore: number;
    verdict: string;
  };
  personalMatchScore: number; // 0-100
  explanation: string;
}

export interface OwnedDlcOpportunityItem {
  parentGame: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
  };
  dlc: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    currentPrice: number;
    listPrice: number;
    discountPercent: number;
    currency: string;
    productClass: ProductClass;
    dealScore: number;
    verdict: string;
  };
}

/**
 * Deterministic Recommendation Engine V1 (Zero LLM, 100% evidence-based).
 * Computes Personal Match Score (0-100) and derived explanations from user signals.
 */
export async function getPersonalRecommendations(
  userId: string,
  limit = 8
): Promise<RecommendedGameItem[]> {
  // 1. Fetch user's personal game signals
  const userGames = await prisma.userGame.findMany({
    where: { userId },
    include: {
      game: {
        select: {
          id: true,
          franchise: true,
          publisher: true,
          genres: true,
        },
      },
    },
  });

  const ownedGameIds = new Set<string>();
  const dislikedGameIds = new Set<string>();
  const likedFranchises = new Map<string, number>();
  const likedGenres = new Map<string, number>();
  const likedPublishers = new Map<string, number>();

  let hasSignals = false;

  for (const ug of userGames) {
    if (ug.owned) ownedGameIds.add(ug.gameId);
    if (ug.disliked) dislikedGameIds.add(ug.gameId);

    // Calculate weight: favorite=4, liked=3, wishlist=2, owned=1, disliked=-5
    let weight = 0;
    if (ug.favorite) weight += 4;
    if (ug.liked) weight += 3;
    if (ug.wishlist) weight += 2;
    if (ug.owned) weight += 1;
    if (ug.disliked) weight -= 5;

    if (weight !== 0) {
      hasSignals = true;
      if (ug.game.franchise) {
        likedFranchises.set(
          ug.game.franchise,
          (likedFranchises.get(ug.game.franchise) || 0) + weight
        );
      }
      if (ug.game.publisher) {
        likedPublishers.set(
          ug.game.publisher,
          (likedPublishers.get(ug.game.publisher) || 0) + weight
        );
      }
      const genres = Array.isArray(ug.game.genres) ? (ug.game.genres as string[]) : [];
      for (const g of genres) {
        likedGenres.set(g, (likedGenres.get(g) || 0) + weight);
      }
    }
  }

  // 2. Fetch candidate games (Base games and Bundles, excluding owned & disliked)
  const candidates = await prisma.game.findMany({
    where: {
      isActive: true,
      productClass: { in: [ProductClass.BASE_GAME, ProductClass.BUNDLE] },
      id: { notIn: Array.from(new Set([...ownedGameIds, ...dislikedGameIds])) },
    },
    include: {
      dealAnalysis: true,
    },
    take: 120,
    orderBy: [{ discountPercent: "desc" }, { popularityScore: "desc" }],
  });

  const scoredList: RecommendedGameItem[] = [];

  for (const c of candidates) {
    let score = 25; // Base exploration score
    const matchedReasons: string[] = [];

    const genres = Array.isArray(c.genres) ? (c.genres as string[]) : [];

    // Signal A: Franchise affinity (+30 pts)
    if (c.franchise && (likedFranchises.get(c.franchise) || 0) > 0) {
      score += 30;
      matchedReasons.push(`${c.franchise} serisindeki oyunları tercih ettiğin`);
    }

    // Signal B: Genre affinity (up to +30 pts)
    let genreScore = 0;
    const matchingGenres: string[] = [];
    for (const g of genres) {
      const gWeight = likedGenres.get(g) || 0;
      if (gWeight > 0) {
        genreScore += Math.min(gWeight * 4, 15);
        matchingGenres.push(g);
      } else if (gWeight < 0) {
        score -= 15; // Negative signal penalty
      }
    }
    score += Math.min(genreScore, 30);
    if (matchingGenres.length > 0 && matchedReasons.length === 0) {
      matchedReasons.push(`${matchingGenres.slice(0, 2).join(" ve ")} türündeki tercihlerine uygun olduğu`);
    }

    // Signal C: Publisher affinity (+10 pts)
    if (c.publisher && (likedPublishers.get(c.publisher) || 0) > 0) {
      score += 10;
      if (matchedReasons.length === 0) {
        matchedReasons.push(`${c.publisher} yapımlarını beğendiğin`);
      }
    }

    // Signal D: Deal Score weighting (up to +15 pts)
    const dealScore = c.dealAnalysis?.dealScore || 50;
    score += Math.round((dealScore / 100) * 15);

    // Bound between 10 and 99
    const finalScore = Math.max(10, Math.min(99, score));

    // Generate truthful derived explanation
    let explanation = "";
    if (hasSignals && matchedReasons.length > 0) {
      explanation = `Sana öneriyoruz çünkü ${matchedReasons[0]} için tespit edildi.`;
    } else {
      explanation = "Kataloğun en yüksek puanlı ve takip edilen gerçek fırsatlarından biri olduğu için öneriliyor.";
    }

    scoredList.push({
      game: {
        id: c.id,
        title: c.title,
        slug: c.slug,
        imageUrl: c.imageUrl,
        currentPrice: c.currentPrice.toNumber(),
        listPrice: c.listPrice.toNumber(),
        discountPercent: c.discountPercent,
        currency: c.currency,
        publisher: c.publisher,
        franchise: c.franchise,
        genres,
        dealScore,
        verdict: c.dealAnalysis?.verdict || "WAIT",
      },
      personalMatchScore: finalScore,
      explanation,
    });
  }

  // Sort by Personal Match Score descending
  scoredList.sort((a, b) => b.personalMatchScore - a.personalMatchScore);

  return scoredList.slice(0, limit);
}

/**
 * Returns on-sale DLC/Expansion/Season Pass opportunities for games owned by the user.
 */
export async function getOwnedDlcOpportunities(userId: string): Promise<OwnedDlcOpportunityItem[]> {
  const ownedUserGames = await prisma.userGame.findMany({
    where: { userId, owned: true },
    select: { gameId: true },
  });

  if (ownedUserGames.length === 0) return [];

  const ownedGameIds = ownedUserGames.map((ug) => ug.gameId);

  const relations = await prisma.gameRelation.findMany({
    where: {
      parentGameId: { in: ownedGameIds },
      relationType: { in: ["DLC_OF", "ADDON_OF", "EXPANSION_OF", "SEASON_PASS_OF"] },
    },
    include: {
      parentGame: {
        select: { id: true, title: true, slug: true, imageUrl: true },
      },
      childGame: {
        include: { dealAnalysis: true },
      },
    },
    orderBy: { childGame: { discountPercent: "desc" } },
  });

  const results: OwnedDlcOpportunityItem[] = [];

  for (const rel of relations) {
    const dlc = rel.childGame;
    if (!dlc || !dlc.isActive) continue;

    results.push({
      parentGame: rel.parentGame,
      dlc: {
        id: dlc.id,
        title: dlc.title,
        slug: dlc.slug,
        imageUrl: dlc.imageUrl,
        currentPrice: dlc.currentPrice.toNumber(),
        listPrice: dlc.listPrice.toNumber(),
        discountPercent: dlc.discountPercent,
        currency: dlc.currency,
        productClass: dlc.productClass,
        dealScore: dlc.dealAnalysis?.dealScore || 50,
        verdict: dlc.dealAnalysis?.verdict || "WAIT",
      },
    });
  }

  return results;
}
