import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireOwner } from "@/lib/auth/session";
import { XboxCatalogClient } from "@/lib/xbox/catalog-client";
import { processNormalizedProduct } from "@/lib/pricing/price-sync";
import { RelationType } from "@prisma/client";

const ManualAddSchema = z.object({
  input: z.string().min(1, "Ürün ID veya URL gereklidir."),
});

/**
 * Extracts a 12-character Microsoft Store BigId from raw ID or Xbox URL.
 */
function extractBigId(raw: string): string | null {
  const trimmed = raw.trim();
  // Match standard 12-char Microsoft BigIds (e.g. 9NBLGGH42CFD, C48ZFTBQ1CVF, 9NZW5P7130S2)
  const directMatch = trimmed.match(/\b([A-Z0-9]{12})\b/i);
  if (directMatch) {
    return directMatch[1].toUpperCase();
  }

  // URL matching: /games/store/.../([A-Z0-9]{12})
  const urlMatch = trimmed.match(/[\/=]([A-Za-z0-9]{12})(?:[\/?#]|$)/);
  if (urlMatch) {
    return urlMatch[1].toUpperCase();
  }

  return null;
}

export async function POST(req: Request) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Bu işlemi yalnızca sistem yöneticisi (OWNER) gerçekleştirebilir." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = ManualAddSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz giriş." },
        { status: 400 }
      );
    }

    const bigId = extractBigId(parsed.data.input);
    if (!bigId) {
      return NextResponse.json(
        {
          error:
            "Geçerli bir Microsoft Store Ürün ID'si (12 karakterli BigId) veya Xbox Store linki bulunamadı. Örn: 9NBLGGH42CFD",
        },
        { status: 400 }
      );
    }

    // Query Microsoft Display Catalog
    const client = new XboxCatalogClient();
    const products = await client.fetchProductsBatch([bigId]);

    if (!products || products.length === 0) {
      return NextResponse.json(
        {
          error: `[${bigId}] kimlikli ürün Microsoft Catalog Türkiye (tr-TR) mağazasında bulunamadı veya satışta değil.`,
        },
        { status: 404 }
      );
    }

    const product = products[0];

    // Process and insert/update product
    const syncResult = await processNormalizedProduct(product, "Manuel Eklenen", true);

    // Update extended metadata
    const updatedGame = await prisma.game.update({
      where: { xboxProductId: product.productId },
      data: {
        productClass: product.productClass,
        developer: product.developer,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        releaseDate: product.releaseDate,
        genres: product.genres,
        capabilities: product.capabilities,
        screenshots: product.screenshots,
      },
      include: {
        priceHistories: { orderBy: { observedAt: "desc" }, take: 1 },
        dealAnalysis: true,
      },
    });

    // Check & discover bundle children if any
    let discoveredChildrenCount = 0;
    if (product.bundledProductIds && product.bundledProductIds.length > 0) {
      const childProducts = await client.fetchAllInBatches(product.bundledProductIds);
      for (let i = 0; i < childProducts.length; i++) {
        const cp = childProducts[i];
        try {
          await processNormalizedProduct(cp, "İlişkili İçerik", false);
          const childGame = await prisma.game.findUnique({ where: { xboxProductId: cp.productId } });
          if (childGame) {
            await prisma.gameRelation.upsert({
              where: {
                parentGameId_childGameId_relationType: {
                  parentGameId: updatedGame.id,
                  childGameId: childGame.id,
                  relationType: RelationType.BUNDLE_CONTAINS,
                },
              },
              create: {
                parentGameId: updatedGame.id,
                childGameId: childGame.id,
                relationType: RelationType.BUNDLE_CONTAINS,
                position: i,
              },
              update: {
                position: i,
              },
            });
            discoveredChildrenCount++;
          }
        } catch (e) {
          console.warn(`[ManualAdd] Child import error for ${cp.productId}:`, e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `"${updatedGame.title}" (${updatedGame.productClass}) başarıyla takip listesine eklendi.`,
      game: {
        id: updatedGame.id,
        xboxProductId: updatedGame.xboxProductId,
        title: updatedGame.title,
        slug: updatedGame.slug,
        productClass: updatedGame.productClass,
        currentPrice: Number(updatedGame.currentPrice),
        listPrice: Number(updatedGame.listPrice),
        discountPercent: updatedGame.discountPercent,
        imageUrl: updatedGame.imageUrl,
        dealScore: updatedGame.dealAnalysis?.dealScore,
        verdict: updatedGame.dealAnalysis?.verdict,
        discoveredChildrenCount,
      },
    });
  } catch (err: any) {
    console.error("[ManualAdd Error]", err);
    return NextResponse.json({ error: `Ürün eklenirken hata oluştu: ${err.message}` }, { status: 500 });
  }
}
