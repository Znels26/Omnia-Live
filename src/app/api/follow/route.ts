import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/follow — follow a being or clan
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { targetType, beingId, clanId } = await req.json();

    if (targetType !== "BEING" && targetType !== "CLAN") {
      return NextResponse.json({ error: "Invalid targetType" }, { status: 400 });
    }
    if (targetType === "BEING" && !beingId) {
      return NextResponse.json({ error: "beingId required" }, { status: 400 });
    }
    if (targetType === "CLAN" && !clanId) {
      return NextResponse.json({ error: "clanId required" }, { status: 400 });
    }

    // Check if already following
    const existing = await db.follow.findFirst({
      where: {
        userId: session.user.id,
        targetType,
        beingId: beingId ?? null,
        clanId: clanId ?? null,
      },
    });

    if (existing) {
      return NextResponse.json({ following: true, alreadyFollowing: true });
    }

    await db.follow.create({
      data: {
        userId: session.user.id,
        targetType,
        beingId: beingId ?? null,
        clanId: clanId ?? null,
      },
    });

    return NextResponse.json({ following: true });
  } catch (error) {
    console.error("[Follow POST]", error);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }
}

// DELETE /api/follow — unfollow a being or clan
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { targetType, beingId, clanId } = await req.json();

    await db.follow.deleteMany({
      where: {
        userId: session.user.id,
        targetType,
        beingId: beingId ?? null,
        clanId: clanId ?? null,
      },
    });

    return NextResponse.json({ following: false });
  } catch (error) {
    console.error("[Follow DELETE]", error);
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }
}
