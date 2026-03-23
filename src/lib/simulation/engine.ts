// Simulation Engine — orchestrates all simulation systems
// Called on each tick by the simulation worker

import { db } from "../db";
import { advanceWorldTime } from "./world";
import { tickBeing, generateReproductionEvent } from "./beings";
import { generateTickEvents } from "./events";
import { WorldState, SimBeing, SimSettlement, DEFAULT_SIM_CONFIG } from "./types";
import { randomBetween, clamp } from "../utils";
import { nanoid } from "nanoid";

export async function loadWorldState(worldId: string): Promise<WorldState | null> {
  try {
    const world = await db.world.findUnique({
      where: { id: worldId },
      include: {
        regions: true,
        clans: true,
        settlements: true,
        beings: {
          where: { status: { not: "DEAD" } },
          take: 200,
        },
        events: {
          orderBy: { tick: "desc" },
          take: 50,
        },
      },
    });

    if (!world) return null;

    // Parse JSON fields from DB
    const clans = world.clans.map((c) => ({
      ...c,
      beliefs: (c.beliefs as string[]) ?? [],
      traits: (c.traits as string[]) ?? [],
      relations: (c.relations as Record<string, "ally" | "neutral" | "hostile">) ?? {},
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

    const recentEvents = world.events.map((e) => ({
      ...e,
      metadata: (e.metadata as Record<string, unknown>) ?? {},
      x: e.x ?? undefined,
      y: e.y ?? undefined,
      clanId: e.clanId ?? undefined,
      beingId: e.beingId ?? undefined,
      impact: e.impact ?? undefined,
    }));

    const config = (world.config as Record<string, unknown>) ?? {};

    return {
      id: world.id,
      name: world.name,
      tick: world.tick,
      worldTime: world.worldTime,
      age: world.age,
      paused: world.paused,
      weather: (config.weather as WorldState["weather"]) ?? {
        type: "clear",
        intensity: 0.3,
        temperature: 20,
        windSpeed: 0.2,
      },
      season: (config.season as WorldState["season"]) ?? {
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
        type: s.type as SimSettlement["type"],
        clanId: s.clanId ?? null,
        regionId: s.regionId ?? null,
      })),
      recentEvents,
      population: beings.filter((b) => b.status === "ALIVE").length,
    };
  } catch (error) {
    console.error("[Engine] Failed to load world state:", error);
    return null;
  }
}

export async function saveWorldState(state: WorldState): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      // Update world core state
      await tx.world.update({
        where: { id: state.id },
        data: {
          tick: state.tick,
          worldTime: state.worldTime,
          age: state.age,
          config: JSON.parse(JSON.stringify({
            weather: state.weather,
            season: state.season,
            day: state.day,
            year: state.year,
          })),
          updatedAt: new Date(),
        },
      });

      // Update beings (batch update)
      for (const being of state.beings) {
        if (being.status === "DEAD") {
          await tx.being.update({
            where: { id: being.id },
            data: { status: "DEAD", currentAction: null },
          });
        } else {
          await tx.being.update({
            where: { id: being.id },
            data: {
              x: being.x,
              y: being.y,
              health: being.health,
              hunger: being.hunger,
              thirst: being.thirst,
              fatigue: being.fatigue,
              happiness: being.happiness,
              fear: being.fear,
              anger: being.anger,
              hope: being.hope,
              status: being.status,
              currentAction: being.currentAction,
              lifeStage: being.lifeStage,
              age: being.age,
              updatedAt: new Date(),
            },
          }).catch(() => {}); // Ignore errors for individual beings
        }
      }
    });
  } catch (error) {
    console.error("[Engine] Failed to save world state:", error);
  }
}

export async function persistNewBeings(beings: SimBeing[], worldId: string): Promise<void> {
  for (const being of beings) {
    try {
      await db.being.create({
        data: {
          id: being.id,
          worldId,
          clanId: being.clanId,
          regionId: being.regionId,
          name: being.name,
          age: being.age,
          lifeStage: being.lifeStage,
          role: being.role,
          isCore: being.isCore,
          status: being.status,
          x: being.x,
          y: being.y,
          bravery: being.bravery,
          cunning: being.cunning,
          empathy: being.empathy,
          ambition: being.ambition,
          wisdom: being.wisdom,
          charisma: being.charisma,
          health: being.health,
          hunger: being.hunger,
          thirst: being.thirst,
          fatigue: being.fatigue,
          happiness: being.happiness,
          fear: being.fear,
          anger: being.anger,
          hope: being.hope,
          primaryGoal: being.primaryGoal,
          currentAction: being.currentAction,
          drives: being.drives,
          fears: being.fears,
          beliefs: being.beliefs as object,
          trustMap: being.trustMap as object,
          relationships: being.relationships as object[],
          description: being.description,
          backstory: being.backstory,
        },
      });
    } catch (error) {
      // Ignore duplicate errors
    }
  }
}

export async function persistEvents(
  events: Array<Partial<import("./types").SimEvent>>,
  worldId: string,
  tick: number,
  worldTime: number
): Promise<void> {
  for (const event of events) {
    try {
      await db.worldEvent.create({
        data: {
          worldId,
          type: (event.type as import("@prisma/client").EventType) ?? "CUSTOM",
          category: (event.category as import("@prisma/client").EventCategory) ?? "GENERAL",
          title: event.title ?? "Unknown Event",
          description: event.description ?? "",
          impact: event.impact,
          tick,
          worldTime,
          x: event.x,
          y: event.y,
          importance: event.importance ?? 50,
          highlighted: event.highlighted ?? false,
          clanId: event.clanId ?? null,
          beingId: event.beingId ?? null,
          metadata: (event.metadata as object) ?? {},
        },
      });
    } catch (error) {
      console.error("[Engine] Failed to persist event:", error);
    }
  }
}

export async function runSimulationTick(worldId: string): Promise<{
  success: boolean;
  eventsGenerated: number;
  tick: number;
}> {
  const state = await loadWorldState(worldId);
  if (!state) return { success: false, eventsGenerated: 0, tick: 0 };
  if (state.paused) return { success: true, eventsGenerated: 0, tick: state.tick };

  // Advance world time
  const updatedState = advanceWorldTime(state);

  // Tick all beings
  const newBeings: SimBeing[] = [];
  const beingEvents: Array<Partial<import("./types").SimEvent>> = [];
  const updatedBeings: SimBeing[] = [];

  for (const being of updatedState.beings) {
    const { updated, events } = tickBeing(being, updatedState);
    updatedBeings.push(updated);
    beingEvents.push(...events);
  }

  updatedState.beings = updatedBeings;

  // Check for reproduction
  const config = DEFAULT_SIM_CONFIG;
  if (Math.random() < config.reproductionChancePerTick * updatedState.beings.length) {
    const alivePairs = updatedState.beings
      .filter((b) => b.status === "ALIVE" && b.age > 16 && b.age < 45)
      .slice(0, 2);

    if (alivePairs.length >= 2) {
      const child = generateReproductionEvent(
        worldId,
        alivePairs[0],
        alivePairs[1],
        updatedState.tick,
        updatedState.worldTime
      );
      newBeings.push(child);
      beingEvents.push({
        type: "BIRTH",
        category: "SOCIAL",
        title: `A child is born to the ${alivePairs[0].clanId ? updatedState.clans.find(c => c.id === alivePairs[0].clanId)?.name ?? "clan" : "valley"}`,
        description: `${child.name} comes into the world. Another life begins.`,
        importance: 35,
        highlighted: false,
        clanId: child.clanId ?? undefined,
        x: child.x,
        y: child.y,
        metadata: { childName: child.name, parents: [alivePairs[0].name, alivePairs[1].name] },
      });
    }
  }

  // Generate world events
  const worldEvents = generateTickEvents(updatedState);

  // Persist everything
  const allEvents = [...beingEvents, ...worldEvents.map(e => ({
    ...e,
    metadata: e.metadata as Record<string, unknown>,
  }))];

  await Promise.all([
    saveWorldState(updatedState),
    persistEvents(allEvents, worldId, updatedState.tick, updatedState.worldTime),
    newBeings.length > 0 ? persistNewBeings(newBeings, worldId) : Promise.resolve(),
  ]);

  // Update clans with population counts
  const clanPopulations = new Map<string, number>();
  for (const being of updatedState.beings) {
    if (being.clanId && being.status === "ALIVE") {
      clanPopulations.set(being.clanId, (clanPopulations.get(being.clanId) ?? 0) + 1);
    }
  }

  for (const [clanId, pop] of clanPopulations) {
    await db.clan.update({
      where: { id: clanId },
      data: { population: pop },
    }).catch(() => {});
  }

  return {
    success: true,
    eventsGenerated: allEvents.length,
    tick: updatedState.tick,
  };
}
