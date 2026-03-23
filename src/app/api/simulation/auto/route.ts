import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSimulationTick } from "@/lib/simulation/engine";

// Auto-tick endpoint — runs the simulation for all active worlds
// Called by Vercel cron or external scheduler

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? process.env.SIMULATION_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const worlds = await db.world.findMany({
      where: { paused: false },
      select: { id: true, name: true },
    });

    const results = await Promise.all(
      worlds.map((w) => runSimulationTick(w.id))
    );

    return NextResponse.json({ worlds: results.length, results });
  } catch (error) {
    console.error("[Auto Tick]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
