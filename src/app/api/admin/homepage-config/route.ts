import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/session";
import {
  getHomepageConfig,
  saveHomepageConfig,
  resetHomepageConfig,
  DEFAULT_HOMEPAGE_CONFIG,
  HomepageConfig,
} from "@/lib/settings/homepage-config";

export const dynamic = "force-dynamic";

const SectionSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  order: z.number().int().min(1),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(250).default(""),
  badgeText: z.string().max(60).default(""),
  icon: z.string().default("flame"),
  iconStyle: z.string().optional(),
  queryType: z.enum([
    "HISTORICAL_LOW",
    "DEEP_DISCOUNT",
    "DEAL_SCORE",
    "BUDGET",
    "PRICE_DROPS",
    "BUNDLES",
    "POPULAR",
    "FREE",
    "CUSTOM",
  ]),
  platform: z.enum(["ALL", "PC", "XboxSeriesX", "XboxOne", "Xbox"]).default("ALL"),
  productClass: z.enum(["ALL", "BASE_GAME", "BUNDLE", "ADD_ON"]).default("ALL"),
  onlyHistoricalLow: z.boolean().optional(),
  minDiscountPercent: z.number().min(0).max(100).optional(),
  maxDiscountPercent: z.number().min(0).max(100).optional(),
  minDealScore: z.number().min(0).max(100).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  onlyFree: z.boolean().optional(),
  sortBy: z.enum([
    "DEAL_SCORE_DESC",
    "DISCOUNT_DESC",
    "HISTORICAL_LOW_DATE",
    "PRICE_ASC",
    "PRICE_DESC",
    "RECENT_DROPS",
    "POPULARITY_DESC",
    "NEWEST_DISCOVERY",
  ]),
  limit: z.number().int().min(1).max(100).default(15),
  viewAllUrl: z.string().optional(),
  highlightBadge: z.enum(["historicalLow", "dealScore", "budget"]).optional(),
});

const HomepageConfigSchema = z.object({
  heroSlider: z.object({
    enabled: z.boolean(),
    title: z.string().min(1).max(120),
    platform: z.enum(["ALL", "PC", "XboxSeriesX", "XboxOne", "Xbox"]).default("ALL"),
    filter: z.enum(["DEAL_SCORE", "DISCOUNT", "HISTORICAL_LOW"]),
    minDiscount: z.number().min(0).max(100).default(0),
    limit: z.number().int().min(1).max(50).default(15),
    autoplaySeconds: z.number().min(2).max(60).default(5),
  }),
  sections: z.array(SectionSchema),
});

export async function GET() {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Bu alanı yalnızca sistem sahibi yönetebilir." }, { status: 403 });
  }

  try {
    const config = await getHomepageConfig();
    return NextResponse.json({
      config,
      defaultConfig: DEFAULT_HOMEPAGE_CONFIG,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Anasayfa yapılandırması alınamadı.", details: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Bu alanı yalnızca sistem sahibi yönetebilir." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validated = HomepageConfigSchema.parse(body);

    const saved = await saveHomepageConfig(validated as HomepageConfig);
    return NextResponse.json({
      success: true,
      message: "Anasayfa vitrin yapılandırması başarıyla kaydedildi.",
      config: saved,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Geçersiz yapılandırma parametreleri.", details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Kaydetme sırasında bir hata oluştu.", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json({ error: "Bu alanı yalnızca sistem sahibi yönetebilir." }, { status: 403 });
  }

  try {
    const reset = await resetHomepageConfig();
    return NextResponse.json({
      success: true,
      message: "Anasayfa vitrin yapılandırması varsayılan ayarlara sıfırlandı.",
      config: reset,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Sıfırlama sırasında bir hata oluştu.", details: err.message },
      { status: 500 }
    );
  }
}
