import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSinceLastVisitRecap } from "@/lib/simulation/director";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    // Load the primary world
    const world = await db.world.findFirst({
      where: { slug: "first-valley" },
      include: {
        regions: true,
        clans: true,
        settlements: {
          include: { structures: true },
        },
        beings: {
          where: { status: { not: "DEAD" } },
          take: 100,
          orderBy: [{ isCore: "desc" }, { updatedAt: "desc" }],
        },
        events: {
          orderBy: { tick: "desc" },
          take: 50,
        },
      },
    });

    if (!world) {
      return NextResponse.json({ world: null, events: [] }, { status: 200 });
    }

    // Parse JSON fields
    const clans = world.clans.map((c) => ({
      ...c,
      beliefs: (c.beliefs as string[]) ?? [],
      traits: (c.traits as string[]) ?? [],
      relations: (c.relations as Record<string, string>) ?? {},
      resources: (c.resources as Record<string, number>) ?? {},
      territory: (c.territory as Array<{ x: number; y: number }>) ?? [],
    }));

    const beings = world.beings.map((b) => ({
      ...b,
      drives: (b.drives as string[]) ?? [],
      fears: (b.fears as string[]) ?? [],
      beliefs: (b.beliefs as Record<string, unknown>) ?? {},
      trustMap: (b.trustMap as Record<string, number>) ?? {},
      relationships: (b.relationships as Array<{ beingId: string; type: string; strength: number }>) ?? [],
    }));

    const config = (world.config as Record<string, unknown>) ?? {};

    const worldState = {
      id: world.id,
      name: world.name,
      tick: world.tick,
      worldTime: world.worldTime,
      age: world.age,
      paused: world.paused,
      weather: (config.weather as Record<string, unknown>) ?? {
        type: "clear",
        intensity: 0.3,
        temperature: 20,
        windSpeed: 0.2,
      },
      season: (config.season as Record<string, unknown>) ?? {
        name: "spring",
        progress: 0.5,
      },
      day: (config.day as number) ?? 1,
      year: (config.year as number) ?? 1,
      regions: world.regions,
      clans,
      beings,
      settlements: world.settlements.map((s) => ({
        ...s,
        features: (s.features as string[]) ?? [],
        clanId: s.clanId ?? null,
        regionId: s.regionId ?? null,
      })),
      population: beings.filter((b) => b.status === "ALIVE").length,
    };

    const events = world.events.map((e) => ({
      ...e,
      metadata: (e.metadata as Record<string, unknown>) ?? {},
      x: e.x ?? undefined,
      y: e.y ?? undefined,
      clanId: e.clanId ?? undefined,
      beingId: e.beingId ?? undefined,
      impact: e.impact ?? undefined,
    }));

    // Since last visit recap for authenticated users
    let sinceLastVisit: string | null = null;
    if (session?.user?.id) {
      // Could track last visit in analytics - for now just show generic since
      const recentEventCount = events.filter((e) => e.importance > 60).length;
      if (recentEventCount > 0) {
        sinceLastVisit = `${recentEventCount} notable events occurred recently. The world continues its course.`;
      }
    }

    return NextResponse.json({
      world: worldState,
      events,
      sinceLastVisit,
    });
  } catch (error) {
    console.error("[World API]", error);
    return NextResponse.json(
      { error: "Failed to load world state" },
      { status: 500 }
    );
  }
}
