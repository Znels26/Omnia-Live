import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const worldId = req.nextUrl.searchParams.get("worldId");
  if (!worldId) {
    return NextResponse.json({ votes: [] });
  }

  try {
    const votes = await db.vote.findMany({
      where: {
        worldId,
        status: "ACTIVE",
      },
      include: {
        userVotes: {
          select: { optionId: true, tokens: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const formattedVotes = votes.map((v) => {
      const options = (v.options as Array<{ id: string; label: string; description: string; votes: number }>) ?? [];
      // Tally votes
      const voteCounts: Record<string, number> = {};
      for (const uv of v.userVotes) {
        voteCounts[uv.optionId] = (voteCounts[uv.optionId] ?? 0) + 1;
      }

      return {
        id: v.id,
        title: v.title,
        description: v.description,
        options: options.map((o) => ({
          ...o,
          votes: (o.votes ?? 0) + (voteCounts[o.id] ?? 0),
        })),
        tokenCost: v.tokenCost,
        type: v.type,
        endsAt: v.endsAt.toISOString(),
        status: v.status,
      };
    });

    return NextResponse.json({ votes: formattedVotes });
  } catch (error) {
    console.error("[Votes GET]", error);
    return NextResponse.json({ votes: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { voteId, optionId, tokenSpend = 0 } = await req.json();

    const vote = await db.vote.findUnique({ where: { id: voteId } });
    if (!vote || vote.status !== "ACTIVE") {
      return NextResponse.json({ error: "Vote not active" }, { status: 400 });
    }

    // Check if already voted
    const existing = await db.userVote.findUnique({
      where: { userId_voteId: { userId: session.user.id, voteId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already voted" }, { status: 409 });
    }

    // Deduct tokens if required
    if (tokenSpend > 0) {
      const wallet = await db.tokenWallet.findUnique({
        where: { userId: session.user.id },
      });
      if (!wallet || wallet.balance < tokenSpend) {
        return NextResponse.json({ error: "Insufficient tokens" }, { status: 400 });
      }

      await db.tokenWallet.update({
        where: { userId: session.user.id },
        data: { balance: { decrement: tokenSpend }, totalSpent: { increment: tokenSpend } },
      });

      await db.tokenTransaction.create({
        data: {
          walletId: wallet.id,
          type: "VOTE_SPEND",
          amount: -tokenSpend,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance - tokenSpend,
          description: `Vote on: ${vote.title}`,
          voteId,
        },
      });
    }

    // Cast vote
    await db.userVote.create({
      data: {
        userId: session.user.id,
        voteId,
        optionId,
        tokens: tokenSpend,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Vote POST]", error);
    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}
