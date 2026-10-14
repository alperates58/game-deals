import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(1, parseInt(limitParam || "8", 10) || 8), 20);

  // Require at least 2 characters per spec
  if (q.length < 2) {
    return NextResponse.json({ results: [], query: q });
  }

  try {
    const results = await prisma.game.findMany({
      where: {
        isActive: true,
        // Exclude currency and consumable from live search results
        productClass: {
          notIn: ["CURRENCY", "CONSUMABLE"],
        },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { normalizedTitle: { contains: q, mode: "insensitive" } },
          { franchise: { contains: q, mode: "insensitive" } },
          { publisher: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        dealAnalysis: {
          select: {
            dealScore: true,
            verdict: true,
          },
        },
      },
      orderBy: [
        // Prioritize on sale items and higher deal scores
        { discountPercent: "desc" },
        { popularityScore: "desc" },
      ],
      take: limit,
    });

    const mapped = results.map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      imageUrl: g.imageUrl,
      publisher: g.publisher,
      productClass: g.productClass,
      currentPrice: g.currentPrice.toNumber(),
      listPrice: g.listPrice.toNumber(),
      discountPercent: g.discountPercent,
      currency: g.currency,
      dealScore: g.dealAnalysis?.dealScore || null,
      verdict: g.dealAnalysis?.verdict || null,
    }));

    return NextResponse.json({
      results: mapped,
      query: q,
      count: mapped.length,
    });
  } catch (error: any) {
    console.error("[LiveSearchAPI] Error:", error.message);
    return NextResponse.json({ error: "Arama sırasında hata oluştu" }, { status: 500 });
  }
}
