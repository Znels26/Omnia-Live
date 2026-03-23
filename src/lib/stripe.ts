import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

export const SUBSCRIPTION_PRICE_ID =
  process.env.STRIPE_SUBSCRIPTION_PRICE_ID ?? "price_placeholder";

export const SUBSCRIPTION_AMOUNT = 1000; // $10.00 in cents

export async function createStripeCustomer(email: string, name?: string) {
  return stripe.customers.create({ email, name: name ?? undefined });
}

export async function createSubscriptionCheckout(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
) {
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: metadata ?? {},
    subscription_data: {
      metadata: metadata ?? {},
    },
  });
}

export async function createTokenCheckout(
  customerId: string,
  amount: number,
  tokens: number,
  packName: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
) {
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${packName} — ${tokens} Fate Tokens`,
            description: `${tokens} tokens to influence the world of First Valley`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...metadata,
      tokens: tokens.toString(),
      type: "token_purchase",
    },
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function reactivateSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export async function getCustomerPortalUrl(
  customerId: string,
  returnUrl: string
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}
