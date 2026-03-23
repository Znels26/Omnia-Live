import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingActions } from "./BillingActions";
import { formatDate } from "@/lib/utils";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const subscription = await db.subscription.findUnique({
    where: { userId: session.user.id },
    include: {
      billingEvents: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  const isActive = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-fv-moon mb-8">Billing</h1>

      {/* Subscription status */}
      <Card variant={isActive ? "ember" : "default"} className="p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-display text-fv-moon font-bold text-xl mb-1">
              First Valley — Full Access
            </div>
            <div className="text-fv-text-muted text-sm">$10.00 / month</div>
          </div>
          <Badge
            variant={isActive ? "forest" : "danger"}
            className="text-xs"
          >
            {subscription?.status?.toLowerCase().replace("_", " ") ?? "inactive"}
          </Badge>
        </div>

        {subscription?.currentPeriodEnd && (
          <div className="text-sm text-fv-text-muted mb-4">
            {subscription.cancelAtPeriodEnd
              ? `Access ends ${formatDate(subscription.currentPeriodEnd)}`
              : `Renews ${formatDate(subscription.currentPeriodEnd)}`}
          </div>
        )}

        <BillingActions
          isActive={isActive}
          cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd ?? false}
          subscriptionId={subscription?.stripeSubscriptionId ?? null}
        />
      </Card>

      {/* Features included */}
      <Card variant="default" className="p-5 mb-6">
        <div className="font-display text-sm text-fv-moon uppercase tracking-wider mb-3">
          Included with your subscription
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Live world viewer",
            "All character profiles",
            "Clan histories",
            "Daily recaps",
            "Weekly recaps",
            "Standard votes",
            "Follow characters",
            "Notification alerts",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-fv-text-muted">
              <span className="text-fv-ember text-xs">✓</span>
              {f}
            </div>
          ))}
        </div>
      </Card>

      {/* Billing history */}
      {subscription?.billingEvents && subscription.billingEvents.length > 0 && (
        <Card variant="default" className="p-5">
          <div className="font-display text-sm text-fv-moon uppercase tracking-wider mb-4">
            Billing History
          </div>
          <div className="space-y-3">
            {subscription.billingEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-fv-text">{event.type.replace("_", " ")}</div>
                  <div className="text-xs text-fv-text-dim">
                    {formatDate(event.createdAt)}
                  </div>
                </div>
                {event.amount && (
                  <div className="text-fv-text-muted">
                    ${(event.amount / 100).toFixed(2)} {event.currency.toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
