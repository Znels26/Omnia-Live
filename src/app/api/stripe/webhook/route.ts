import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFailed(invoice);
        break;
      }
    }
  } catch (error) {
    console.error("[Stripe Webhook] Processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string | null;
  const metadata = session.metadata ?? {};

  // Check if this is a token purchase
  if (metadata.type === "token_purchase") {
    const tokens = parseInt(metadata.tokens ?? "0");
    if (tokens > 0) {
      const subscription = await db.subscription.findUnique({
        where: { stripeCustomerId: customerId },
        include: { user: { include: { tokenWallet: true } } },
      });

      if (subscription?.user?.tokenWallet) {
        const wallet = subscription.user.tokenWallet;
        await db.tokenWallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: tokens },
            totalEarned: { increment: tokens },
          },
        });

        await db.tokenTransaction.create({
          data: {
            walletId: wallet.id,
            type: "PURCHASE",
            amount: tokens,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance + tokens,
            description: `Token purchase: ${tokens} tokens`,
            stripePaymentId: session.payment_intent as string,
            metadata: { sessionId: session.id },
          },
        });

        // Notify user
        await db.notification.create({
          data: {
            userId: subscription.user.id,
            type: "TOKENS_CREDITED",
            title: "Tokens Credited",
            body: `${tokens} fate tokens have been added to your wallet.`,
            link: "/tokens",
          },
        }).catch(() => {});
      }
    }
    return;
  }

  // Subscription checkout
  if (subscriptionId) {
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription & { current_period_start?: number; current_period_end?: number };
    await db.subscription.update({
      where: { stripeCustomerId: customerId },
      data: {
        stripeSubscriptionId: subscriptionId,
        stripePriceId: (stripeSub.items?.data[0] as { price?: { id: string } } | undefined)?.price?.id,
        status: "ACTIVE",
        currentPeriodStart: stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000) : null,
        currentPeriodEnd: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null,
      },
    });

    // Upgrade user role
    const subscription = await db.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (subscription) {
      await db.user.update({
        where: { id: subscription.userId },
        data: { role: "SUBSCRIBER" },
      });

      await db.notification.create({
        data: {
          userId: subscription.userId,
          type: "SUBSCRIPTION_RENEWED",
          title: "Welcome to First Valley",
          body: "Your subscription is active. The world awaits.",
          link: "/watch",
        },
      }).catch(() => {});
    }
  }
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription & { current_period_start?: number; current_period_end?: number }) {
  const customerId = sub.customer as string;

  await db.subscription.update({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: sub.id,
      status: mapStripeStatus(sub.status),
      currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    },
  }).catch(() => {});
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = sub.customer as string;

  const subscription = await db.subscription.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (subscription) {
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELED", canceledAt: new Date() },
    });

    await db.user.update({
      where: { id: subscription.userId },
      data: { role: "GUEST" },
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscription = await db.subscription.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (subscription) {
    await db.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: "payment_succeeded",
        amount: invoice.amount_paid,
        currency: invoice.currency,
        stripeEventId: invoice.id,
      },
    }).catch(() => {});
  }
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscription = await db.subscription.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (subscription) {
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: "PAST_DUE" },
    });

    await db.notification.create({
      data: {
        userId: subscription.userId,
        type: "SYSTEM",
        title: "Payment Failed",
        body: "Your subscription payment failed. Please update your billing information.",
        link: "/billing",
      },
    }).catch(() => {});
  }
}

function mapStripeStatus(
  status: Stripe.Subscription.Status
): "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | "INACTIVE" {
  const map: Record<string, "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | "INACTIVE"> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    incomplete: "INCOMPLETE",
    incomplete_expired: "CANCELED",
    unpaid: "PAST_DUE",
  };
  return map[status] ?? "INACTIVE";
}
