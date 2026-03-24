import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle } from "lucide-react";

async function handleSubscribe() {
  "use server";
  // Handled client-side via /api/stripe/subscription
}

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: billingEvents } = await admin
    .from("billing_events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-fv-gold" />
        <h1 className="font-display text-2xl font-bold text-fv-moon">Billing</h1>
      </div>

      {/* Subscription status */}
      <div className={`fv-card p-6 mb-6 ${isActive ? "border-fv-ember/30 bg-fv-ember/5" : ""}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-display text-fv-moon font-bold text-lg mb-1">
              First Valley — Full Access
            </div>
            <div className="text-fv-text-muted text-sm">$10.00 / month</div>
          </div>
          <Badge
            variant={isActive ? "ember" : "default"}
            className="text-xs"
          >
            {subscription?.status?.replace("_", " ") ?? "inactive"}
          </Badge>
        </div>

        {subscription?.current_period_end && (
          <div className="text-sm text-fv-text-muted mb-4">
            {subscription.cancel_at_period_end
              ? `Access ends ${new Date(subscription.current_period_end).toLocaleDateString()}`
              : `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`}
          </div>
        )}

        {isActive ? (
          <div className="flex items-center gap-2 text-sm text-fv-success">
            <CheckCircle className="w-4 h-4" />
            Your subscription is active
          </div>
        ) : (
          <SubscribeButton />
        )}
      </div>

      {/* Features */}
      <div className="fv-card p-5 mb-6">
        <div className="font-display text-xs text-fv-gold uppercase tracking-wider mb-3">
          Included with your subscription
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Live world viewer",
            "All character profiles",
            "Culture histories",
            "Daily recaps",
            "Weekly recaps",
            "Standard votes",
            "Follow anyone",
            "Notification alerts",
            "Timeline access",
            "Replay archives",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-fv-text-muted">
              <span className="text-fv-ember text-xs">✓</span>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Billing history */}
      {billingEvents && billingEvents.length > 0 && (
        <div className="fv-card p-5">
          <div className="font-display text-xs text-fv-gold uppercase tracking-wider mb-4">
            Billing History
          </div>
          <div className="space-y-3">
            {billingEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-fv-text capitalize">{event.event_type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-fv-text-dim">
                    {new Date(event.created_at).toLocaleDateString()}
                  </div>
                </div>
                {event.amount_cents && (
                  <div className="text-fv-text-muted">
                    ${(event.amount_cents / 100).toFixed(2)} {event.currency?.toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubscribeButton() {
  return (
    <form action="/api/stripe/subscription" method="POST">
      <Button variant="cinematic" size="sm" type="submit">
        Subscribe — $10/month
      </Button>
    </form>
  );
}
