import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTokenCheckout } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { packId } = await req.json();

    const pack = await db.tokenPack.findUnique({
      where: { id: packId, active: true },
    });

    if (!pack) {
      return NextResponse.json({ error: "Token pack not found" }, { status: 404 });
    }

    const subscription = await db.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription) {
      return NextResponse.json({ error: "No subscription record" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const totalTokens = pack.tokens + pack.bonusTokens;

    const checkoutSession = await createTokenCheckout(
      subscription.stripeCustomerId,
      pack.priceUsd,
      totalTokens,
      pack.name,
      `${baseUrl}/tokens?purchased=true`,
      `${baseUrl}/tokens`,
      {
        userId: session.user.id,
        packId: pack.id,
        tokens: totalTokens.toString(),
        type: "token_purchase",
      }
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[Token checkout]", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
