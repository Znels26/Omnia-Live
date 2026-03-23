import { NextRequest, NextResponse } from "next/server";
import { runSimulationTick } from "@/lib/simulation/engine";

// This route is called by a cron job or background worker to advance the simulation
// Protect with a secret to prevent unauthorized ticking

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-simulation-secret");
  if (secret !== process.env.SIMULATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const worldId = body.worldId as string;

    if (!worldId) {
      return NextResponse.json({ error: "worldId required" }, { status: 400 });
    }

    const result = await runSimulationTick(worldId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Simulation Tick]", error);
    return NextResponse.json({ error: "Tick failed" }, { status: 500 });
  }
}

// Allow GET for health check (unauthenticated)
export async function GET() {
  return NextResponse.json({ status: "simulation-ready" });
}
