import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSubscriptionCheckout, getCustomerPortalUrl, SUBSCRIPTION_PRICE_ID } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscription = await db.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription) {
      return NextResponse.json({ error: "No subscription record found" }, { status: 400 });
    }

    // Already subscribed
    if (subscription.status === "ACTIVE") {
      return NextResponse.json({ error: "Already subscribed" }, { status: 409 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const checkoutSession = await createSubscriptionCheckout(
      subscription.stripeCustomerId,
      SUBSCRIPTION_PRICE_ID,
      `${baseUrl}/watch?subscribed=true`,
      `${baseUrl}/pricing?canceled=true`,
      { userId: session.user.id }
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[Subscription checkout]", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}

// GET: Customer portal for managing billing
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscription = await db.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription) {
      return NextResponse.json({ error: "No subscription" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const portalUrl = await getCustomerPortalUrl(
      subscription.stripeCustomerId,
      `${baseUrl}/billing`
    );

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    console.error("[Portal URL]", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
