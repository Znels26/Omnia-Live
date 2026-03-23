"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function WorldControls({ worldId, isPaused }: { worldId: string; isPaused: boolean }) {
  const [paused, setPaused] = useState(isPaused);
  const [loading, setLoading] = useState(false);
  const [tickLoading, setTickLoading] = useState(false);

  async function togglePause() {
    setLoading(true);
    try {
      await fetch(`/api/admin/world`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, paused: !paused }),
      });
      setPaused(!paused);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function runTick() {
    setTickLoading(true);
    try {
      await fetch("/api/simulation/tick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-simulation-secret": process.env.NEXT_PUBLIC_SIMULATION_SECRET ?? "dev-simulation-secret-key",
        },
        body: JSON.stringify({ worldId }),
      });
    } catch (e) {
      console.error(e);
    }
    setTickLoading(false);
  }

  return (
    <div className="flex gap-2 pt-2">
      <Button
        variant={paused ? "primary" : "outline"}
        size="sm"
        onClick={togglePause}
        loading={loading}
      >
        {paused ? "▶ Resume" : "⏸ Pause"}
      </Button>
      <Button variant="outline" size="sm" onClick={runTick} loading={tickLoading}>
        ⏭ Manual Tick
      </Button>
    </div>
  );
}
