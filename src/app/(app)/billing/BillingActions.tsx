"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function BillingActions({
  isActive,
  cancelAtPeriodEnd,
  subscriptionId,
}: {
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  subscriptionId: string | null;
}) {
  const [loading, setLoading] = useState(false);

  async function openBillingPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/subscription", { method: "GET" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Portal error:", error);
    }
    setLoading(false);
  }

  async function startSubscription() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/subscription", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Subscription error:", error);
    }
    setLoading(false);
  }

  if (!isActive) {
    return (
      <Button variant="cinematic" onClick={startSubscription} loading={loading} className="w-full">
        🔥 Subscribe — $10/month
      </Button>
    );
  }

  return (
    <div className="flex gap-3">
      <Button variant="outline" onClick={openBillingPortal} loading={loading} size="sm">
        Manage Billing
      </Button>
      {cancelAtPeriodEnd ? (
        <Button variant="outline" size="sm" onClick={openBillingPortal} loading={loading}>
          Reactivate Subscription
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={openBillingPortal} className="text-fv-text-dim">
          Cancel
        </Button>
      )}
    </div>
  );
}
