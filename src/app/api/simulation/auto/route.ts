import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSimulationTick } from "@/lib/simulation/engine";

// Auto-tick endpoint — runs the simulation for all active worlds
// Called by Vercel cron or external scheduler

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? process.env.SIMULATION_SECRET;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: worlds } = await admin
      .from("worlds")
      .select("id, slug, name")
      .eq("status", "active");

    if (!worlds?.length) {
      return NextResponse.json({ worlds: 0, message: "No active worlds" });
    }

    const results = await Promise.allSettled(
      worlds.map((w) => runSimulationTick(w.slug))
    );

    const summary = results.map((r, i) => ({
      world: worlds[i].slug,
      status: r.status,
      ...(r.status === "fulfilled" ? r.value : { error: String(r.reason) }),
    }));

    return NextResponse.json({ worlds: results.length, results: summary });
  } catch (error) {
    console.error("[Auto Tick]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
