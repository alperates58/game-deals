import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const ToggleActionSchema = z.object({
  gameId: z.string().min(1),
  action: z.enum([
    "toggle_owned",
    "toggle_favorite",
    "toggle_wishlist",
    "toggle_liked",
    "toggle_disliked",
    "toggle_completed",
  ]),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ userGame: null, alert: null });
  }

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId");

  if (!gameId) {
    return NextResponse.json({ error: "gameId parametresi zorunludur." }, { status: 400 });
  }

  const [userGame, alert] = await Promise.all([
    prisma.userGame.findUnique({
      where: {
        userId_gameId: {
          userId: user.userId,
          gameId,
        },
      },
    }),
    prisma.priceAlert.findFirst({
      where: {
        userId: user.userId,
        gameId,
      },
    }),
  ]);

  return NextResponse.json({ userGame, alert });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Bu aksiyon için giriş yapmanız gerekmektedir.", requireLogin: true },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = ToggleActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz aksiyon verisi." }, { status: 400 });
    }

    const { gameId, action } = parsed.data;

    // Verify game exists
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });

    if (!game) {
      return NextResponse.json({ error: "Oyun bulunamadı." }, { status: 404 });
    }

    // Retrieve or initialize UserGame record
    let userGame = await prisma.userGame.findUnique({
      where: {
        userId_gameId: {
          userId: user.userId,
          gameId,
        },
      },
    });

    if (!userGame) {
      userGame = await prisma.userGame.create({
        data: {
          userId: user.userId,
          gameId,
        },
      });
    }

    let updatedData: any = {};

    switch (action) {
      case "toggle_owned":
        updatedData.owned = !userGame.owned;
        break;
      case "toggle_favorite":
        updatedData.favorite = !userGame.favorite;
        break;
      case "toggle_wishlist":
        updatedData.wishlist = !userGame.wishlist;
        break;
      case "toggle_liked": {
        const nextLiked = !userGame.liked;
        updatedData.liked = nextLiked;
        if (nextLiked) {
          updatedData.disliked = false; // Exclusivity
        }
        break;
      }
      case "toggle_disliked": {
        const nextDisliked = !userGame.disliked;
        updatedData.disliked = nextDisliked;
        if (nextDisliked) {
          updatedData.liked = false; // Exclusivity
        }
        break;
      }
      case "toggle_completed":
        updatedData.completed = !userGame.completed;
        break;
    }

    const updated = await prisma.userGame.update({
      where: { id: userGame.id },
      data: updatedData,
    });

    return NextResponse.json({ success: true, userGame: updated });
  } catch (err: any) {
    console.error("[UserGame Action Error]", err);
    return NextResponse.json({ error: "İşlem sırasında bir hata oluştu." }, { status: 500 });
  }
}
