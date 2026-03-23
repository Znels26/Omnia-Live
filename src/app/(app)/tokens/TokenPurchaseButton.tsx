"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function TokenPurchaseButton({ packId }: { packId: string }) {
  const [loading, setLoading] = useState(false);

  async function handlePurchase() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Purchase failed:", error);
    }
    setLoading(false);
  }

  return (
    <Button
      variant="token"
      size="md"
      className="w-full"
      onClick={handlePurchase}
      loading={loading}
    >
      ⚡ Purchase
    </Button>
  );
}
