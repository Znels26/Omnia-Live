"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FollowButtonProps {
  targetType: "BEING" | "CLAN";
  targetId: string;
  targetName: string;
  initialFollowing?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function FollowButton({
  targetType,
  targetId,
  targetName,
  initialFollowing = false,
  size = "sm",
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const body =
        targetType === "BEING"
          ? { targetType, beingId: targetId }
          : { targetType, clanId: targetId };

      const res = await fetch("/api/follow", {
        method: following ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setFollowing(!following);
      }
    } catch (error) {
      console.error("Follow error:", error);
    }
    setLoading(false);
  }

  return (
    <Button
      variant={following ? "ghost" : "outline"}
      size={size}
      loading={loading}
      onClick={toggle}
      className={className}
    >
      {following ? `✓ Following ${targetName}` : `Follow ${targetName}`}
    </Button>
  );
}
