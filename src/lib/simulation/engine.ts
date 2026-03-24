// Simulation Engine — orchestrates all simulation systems for First Valley
// Uses Supabase instead of Prisma for all DB operations

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";
import { WorldState, SimBeing, SimClan, SimSettlement, SimEvent } from "./types";
import { clamp, randomBetween } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Convenience row aliases from the generated Database type
// ---------------------------------------------------------------------------

type DbWorld = Database["public"]["Tables"]["worlds"]["Row"];
type DbPerson = Database["public"]["Tables"]["persons"]["Row"];
type DbCulture = Database["public"]["Tables"]["cultures"]["Row"];
type DbSettlement = Database["public"]["Tables"]["settlements"]["Row"];

// ---------------------------------------------------------------------------
// Mappers: DB rows → Sim types
// ---------------------------------------------------------------------------

function lifeStageToSimLifeStage(ls: string): SimBeing["lifeStage"] {
  const map: Record<string, SimBeing["lifeStage"]> = {
    infant: "CHILD",
    child: "CHILD",
    adolescent: "YOUNG_ADULT",
    young_adult: "YOUNG_ADULT",
    adult: "ADULT",
    elder: "ELDER",
  };
  return map[ls] ?? "ADULT";
}

function settlementTypeToSim(t: string): SimSettlement["type"] {
  const map: Record<string, SimSettlement["type"]> = {
    camp: "CAMP",
    hamlet: "HAMLET",
    village: "VILLAGE",
    town: "TOWN",
    city: "CITY",
    fortress: "FORTRESS",
    ruins: "RUINS",
  };
  return map[t] ?? "CAMP";
}

function dbPersonToSimBeing(p: DbPerson): SimBeing {
  return {
    id: p.id,
    worldId: p.world_id,
    clanId: p.culture_id,
    regionId: p.residence_id,
    name: p.name,
    age: p.age,
    lifeStage: lifeStageToSimLifeStage(p.life_stage),
    role: p.occupation ?? "Resident",
    isCore: p.is_featured,
    status: p.is_alive ? "ALIVE" : "DEAD",
    x: p.pos_x,
    y: p.pos_y,
    bravery: clamp(1 - p.trait_aggression / 100, 0, 1) * 100,
    cunning: clamp(p.trait_ambition / 100, 0, 1) * 100,
    empathy: clamp(p.trait_sociability / 100, 0, 1) * 100,
    ambition: p.trait_ambition,
    wisdom: clamp(p.trait_honesty / 100, 0, 1) * 100,
    charisma: clamp(p.trait_sociability / 100, 0, 1) * 100,
    health: p.health_score,
    hunger: p.need_hunger,
    thirst: 0,
    fatigue: p.need_fatigue,
    happiness: p.happiness_score,
    fear: clamp(p.need_stress * 0.5, 0, 100),
    anger: clamp(p.trait_aggression, 0, 100),
    hope: p.need_hope,
    primaryGoal: p.current_goal,
    currentAction: p.current_action,
    drives: [],
    fears: [],
    beliefs: {},
    trustMap: {},
    relationships: [],
    description: p.occupation,
    backstory: null,
  };
}

function dbCultureToSimClan(c: DbCulture): SimClan {
  return {
    id: c.id,
    worldId: c.world_id,
    regionId: c.origin_region_id,
    name: c.name,
    color: c.color_hex ?? "#888888",
    population: c.population_estimate,
    status: "ACTIVE",
    age: "SURVIVAL",
    beliefs: [],
    traits: [],
    relations: {},
    resources: {},
    territory: [],
    x: 400,
    y: 300,
    power: clamp((c.cooperation_level + (100 - c.aggression_level)) / 2, 0, 100),
  };
}

function dbSettlementToSimSettlement(s: DbSettlement): SimSettlement {
  return {
    id: s.id,
    worldId: s.world_id,
    clanId: s.culture_id,
    regionId: s.region_id,
    name: s.name,
    type: settlementTypeToSim(s.settlement_type),
    population: s.population,
    x: s.position_x,
    y: s.position_y,
    level: 1,
    health: clamp(s.stability, 0, 100),
    defense: 50,
    food: clamp(s.prosperity, 0, 100),
    water: 50,
    morale: clamp((s.prosperity + s.stability) / 2, 0, 100),
    features: [],
  };
}

// ---------------------------------------------------------------------------
// Load world state from Supabase — identified by slug='first-valley'
// ---------------------------------------------------------------------------

export async function loadWorldState(): Promise<WorldState | null> {
  const db = createAdminClient();

  try {
    const { data: worldData, error: worldErr } = await db
      .from("worlds")
      .select("*")
      .eq("slug", "first-valley")
      .single();

    if (worldErr || !worldData) {
      console.error("[Engine] World not found:", worldErr?.message);
      return null;
    }

    const world = worldData as DbWorld;
    const worldConfig = (world.config ?? {}) as Record<string, unknown>;

    const [culturesRes, settlementsRes, personsRes, eventsRes] = await Promise.all([
      db.from("cultures").select("*").eq("world_id", world.id),
      db.from("settlements").select("*").eq("world_id", world.id),
      db.from("persons").select("*").eq("world_id", world.id).eq("is_alive", true).limit(200),
      db
        .from("public_events")
        .select("*")
        .eq("world_id", world.id)
        .order("in_game_day", { ascending: false })
        .limit(50),
    ]);

    const cultures = ((culturesRes.data ?? []) as DbCulture[]).map(dbCultureToSimClan);
    const settlements = ((settlementsRes.data ?? []) as DbSettlement[]).map(dbSettlementToSimSettlement);
    const beings = ((personsRes.data ?? []) as DbPerson[]).map(dbPersonToSimBeing);

    const recentEvents: SimEvent[] = (eventsRes.data ?? []).map((e) => ({
      id: e.id,
      worldId: e.world_id,
      type: (e.event_type as SimEvent["type"]) ?? "CUSTOM",
      category: "GENERAL" as SimEvent["category"],
      title: e.title,
      description: e.description,
      tick: e.in_game_day,
      worldTime: 0,
      importance: e.significance_score,
      highlighted: e.is_milestone,
      beingId: e.primary_person_id ?? undefined,
      metadata: (e.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(e.created_at),
    }));

    return {
      id: world.id,
      name: world.name,
      tick: world.in_game_day,
      worldTime: (worldConfig.world_time as number) ?? 8,
      age: "SURVIVAL",
      paused: world.status === "paused",
      weather: (worldConfig.weather as WorldState["weather"]) ?? {
        type: "clear",
        intensity: 0.3,
        temperature: 20,
        windSpeed: 0.2,
      },
      season: (worldConfig.season as WorldState["season"]) ?? {
        name: "spring",
        progress: 0.1,
      },
      day: world.in_game_day,
      year: world.in_game_year,
      regions: [],
      clans: cultures,
      beings,
      settlements,
      recentEvents,
      population: beings.length,
    };
  } catch (error) {
    console.error("[Engine] loadWorldState failed:", error);
    return null;
  }
}

// Re-export under an alternate name for WorldViewer compatibility
export { loadWorldState as getWorldState };

// ---------------------------------------------------------------------------
// Tick helpers
// ---------------------------------------------------------------------------

interface PersonTickResult {
  update: Database["public"]["Tables"]["persons"]["Update"];
  events: PendingEvent[];
}

interface PendingEvent {
  world_id: string;
  event_type: string;
  title: string;
  description: string;
  primary_person_id: string | null;
  settlement_id: string | null;
  significance_score: number;
  is_milestone: boolean;
  is_featured: boolean;
  in_game_day: number;
  in_game_year: number;
  metadata: Json;
}

function tickPerson(p: DbPerson, day: number, year: number): PersonTickResult {
  const events: PendingEvent[] = [];

  let hunger = clamp(p.need_hunger + randomBetween(1, 3), 0, 100);
  let fatigue = clamp(p.need_fatigue + randomBetween(0, 2), 0, 100);
  let stress = clamp(p.need_stress + randomBetween(-1, 2), 0, 100);
  let hope = clamp(p.need_hope + randomBetween(-1, 1), 0, 100);
  let health = p.health_score;
  let happiness = p.happiness_score;

  // Hunger erodes health when high
  if (hunger > 70) {
    health = clamp(health - randomBetween(1, 3), 0, 100);
    happiness = clamp(happiness - 2, 0, 100);
  } else if (hunger < 30) {
    health = clamp(health + 0.5, 0, 100);
    happiness = clamp(happiness + 1, 0, 100);
  }

  // Fatigue effect
  if (fatigue > 80) {
    stress = clamp(stress + 2, 0, 100);
    happiness = clamp(happiness - 1, 0, 100);
  }

  // High stress
  if (stress > 80) {
    happiness = clamp(happiness - 3, 0, 100);
    hope = clamp(hope - 2, 0, 100);
  }

  // Age-related health drift
  if (p.age > 60) {
    health = clamp(health - 0.2, 0, 100);
  }

  let isAlive = p.is_alive;
  let action = p.current_action;

  const roll = Math.random();

  // Death check
  if (
    health < 10 ||
    (hunger > 90 && Math.random() < 0.05) ||
    (p.age > 75 && Math.random() < 0.02)
  ) {
    isAlive = false;
    action = null;
    hunger = 0;
    fatigue = 0;
    const cause =
      health < 10 ? "illness" : p.age > 75 ? "old_age" : "starvation";
    events.push({
      world_id: p.world_id,
      event_type: "DEATH",
      title: `${p.name} has died`,
      description:
        cause === "illness"
          ? `${p.name} succumbed to illness or injury.`
          : cause === "old_age"
          ? `${p.name} passed away of old age after ${p.age} years.`
          : `${p.name} perished from starvation.`,
      primary_person_id: p.id,
      settlement_id: p.residence_id,
      significance_score: p.is_featured ? 80 : 40,
      is_milestone: p.is_featured,
      is_featured: p.is_featured,
      in_game_day: day,
      in_game_year: year,
      metadata: { age: p.age, cause },
    });
  } else if (roll < 0.02 && !p.current_action) {
    // Job change
    const jobs = ["Farmer", "Hunter", "Fisher", "Trader", "Healer", "Scout", "Crafter", "Guard"];
    const newJob = jobs[Math.floor(Math.random() * jobs.length)];
    action = `Becoming a ${newJob}`;
    events.push({
      world_id: p.world_id,
      event_type: "CUSTOM",
      title: `${p.name} changes occupation`,
      description: `${p.name} has taken up the role of ${newJob}.`,
      primary_person_id: p.id,
      settlement_id: p.residence_id,
      significance_score: 20,
      is_milestone: false,
      is_featured: false,
      in_game_day: day,
      in_game_year: year,
      metadata: { new_occupation: newJob },
    });
  } else if (roll < 0.04 && p.is_featured) {
    events.push({
      world_id: p.world_id,
      event_type: "CUSTOM",
      title: `${p.name} does something notable`,
      description: `The people of the valley take note of ${p.name}'s actions.`,
      primary_person_id: p.id,
      settlement_id: p.residence_id,
      significance_score: 55,
      is_milestone: false,
      is_featured: true,
      in_game_day: day,
      in_game_year: year,
      metadata: {},
    });
  }

  return {
    update: {
      need_hunger: hunger,
      need_fatigue: fatigue,
      need_stress: stress,
      need_hope: hope,
      health_score: health,
      happiness_score: happiness,
      is_alive: isAlive,
      current_action: action,
    },
    events,
  };
}

// ---------------------------------------------------------------------------
// World-level event generation
// ---------------------------------------------------------------------------

function generateWorldEvents(
  worldId: string,
  persons: DbPerson[],
  settlements: DbSettlement[],
  day: number,
  year: number
): PendingEvent[] {
  const events: PendingEvent[] = [];
  const alive = persons.filter((p) => p.is_alive);

  // Birth event
  const fertile = alive.filter((p) => p.age >= 16 && p.age <= 45);
  if (fertile.length >= 2 && Math.random() < 0.03) {
    const parent = fertile[Math.floor(Math.random() * fertile.length)];
    const childNames = ["Asha", "Bren", "Cael", "Dara", "Elin", "Fion", "Gwen", "Hale", "Ivy", "Jael"];
    const childName = childNames[Math.floor(Math.random() * childNames.length)];
    events.push({
      world_id: worldId,
      event_type: "BIRTH",
      title: "A child is born in the valley",
      description: `${childName} comes into the world near ${parent.name}'s settlement.`,
      primary_person_id: parent.id,
      settlement_id: parent.residence_id,
      significance_score: 35,
      is_milestone: false,
      is_featured: false,
      in_game_day: day,
      in_game_year: year,
      metadata: { child_name: childName, parent_name: parent.name },
    });
  }

  // Marriage event
  if (alive.length >= 2 && Math.random() < 0.015) {
    const adults = alive.filter((p) => p.age >= 18 && p.age <= 50);
    if (adults.length >= 2) {
      const shuffled = [...adults].sort(() => Math.random() - 0.5);
      const a = shuffled[0];
      const b = shuffled[1];
      events.push({
        world_id: worldId,
        event_type: "MARRIAGE",
        title: `${a.name} and ${b.name} are joined`,
        description: `The valley witnesses the union of ${a.name} and ${b.name}.`,
        primary_person_id: a.id,
        settlement_id: a.residence_id,
        significance_score: 45,
        is_milestone: false,
        is_featured: false,
        in_game_day: day,
        in_game_year: year,
        metadata: { person_a: a.name, person_b: b.name },
      });
    }
  }

  // Crime / conflict event
  if (Math.random() < 0.01 && alive.length > 0) {
    const offender = alive[Math.floor(Math.random() * alive.length)];
    const crimes = ["theft", "trespass", "assault", "poaching"];
    const crime = crimes[Math.floor(Math.random() * crimes.length)];
    events.push({
      world_id: worldId,
      event_type: "BETRAYAL",
      title: `${offender.name} accused of ${crime}`,
      description: `Tensions rise as ${offender.name} stands accused of ${crime} in the valley.`,
      primary_person_id: offender.id,
      settlement_id: offender.residence_id,
      significance_score: 30,
      is_milestone: false,
      is_featured: false,
      in_game_day: day,
      in_game_year: year,
      metadata: { crime },
    });
  }

  // Seasonal milestone (every 91 days)
  if (day % 91 === 0 && day > 0) {
    const seasons = ["spring", "summer", "autumn", "winter"];
    const season = seasons[Math.floor((day / 91) % 4)];
    events.push({
      world_id: worldId,
      event_type: "RITUAL",
      title: `The valley marks the turn of ${season}`,
      description: "Communities across First Valley gather to observe the change of season.",
      primary_person_id: null,
      settlement_id: settlements[0]?.id ?? null,
      significance_score: 60,
      is_milestone: true,
      is_featured: false,
      in_game_day: day,
      in_game_year: year,
      metadata: { season },
    });
  }

  // Year milestone
  if (day % 365 === 0 && day > 0) {
    events.push({
      world_id: worldId,
      event_type: "ERA_TRANSITION",
      title: `Year ${year} begins in First Valley`,
      description: "Another year has passed. The valley endures.",
      primary_person_id: null,
      settlement_id: null,
      significance_score: 80,
      is_milestone: true,
      is_featured: true,
      in_game_day: day,
      in_game_year: year,
      metadata: { year },
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Main simulation tick
// ---------------------------------------------------------------------------

export async function runSimulationTick(worldSlug = 'first-valley'): Promise<{
  success: boolean;
  eventsGenerated: number;
  day: number;
  year: number;
}> {
  const db = createAdminClient();

  try {
    const { data: worldData, error: worldErr } = await db
      .from("worlds")
      .select("*")
      .eq("slug", worldSlug)
      .single();

    if (worldErr || !worldData) {
      console.error("[Engine] Tick: world not found:", worldErr?.message);
      return { success: false, eventsGenerated: 0, day: 0, year: 0 };
    }

    const world = worldData as DbWorld;

    if (world.status === "paused") {
      return { success: true, eventsGenerated: 0, day: world.in_game_day, year: world.in_game_year };
    }

    // Advance day counter
    const newDay = world.in_game_day + 1;
    const newYear = newDay > 0 && newDay % 365 === 0 ? world.in_game_year + 1 : world.in_game_year;

    // Load living persons
    const { data: personsData } = await db
      .from("persons")
      .select("*")
      .eq("world_id", world.id)
      .eq("is_alive", true)
      .limit(200);

    const persons = (personsData ?? []) as DbPerson[];

    // Load settlements and cultures for event generation
    const [settlementsRes] = await Promise.all([
      db.from("settlements").select("*").eq("world_id", world.id),
    ]);

    const settlements = (settlementsRes.data ?? []) as DbSettlement[];

    // Tick each person
    const allEvents: PendingEvent[] = [];
    const personUpdates: Array<{ id: string; update: Database["public"]["Tables"]["persons"]["Update"] }> = [];

    for (const person of persons) {
      try {
        const { update, events } = tickPerson(person, newDay, newYear);
        personUpdates.push({ id: person.id, update });
        allEvents.push(...events);
      } catch (err) {
        console.error(`[Engine] Failed to tick person ${person.id}:`, err);
      }
    }

    // World-level events
    const worldEvents = generateWorldEvents(world.id, persons, settlements, newDay, newYear);
    allEvents.push(...worldEvents);

    // Build world config update (preserve existing config fields)
    const existingConfig = (world.config ?? {}) as Record<string, unknown>;
    const newConfig: Json = {
      ...existingConfig,
      world_time: ((existingConfig.world_time as number ?? 8) + 1) % 24,
    };

    // Persist all changes
    const updatePromises: PromiseLike<unknown>[] = [];

    // Update persons
    for (const { id, update } of personUpdates) {
      updatePromises.push(
        db
          .from("persons")
          .update(update)
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error(`[Engine] Person update failed (${id}):`, error.message);
          })
      );
    }

    // Insert events
    if (allEvents.length > 0) {
      updatePromises.push(
        db
          .from("public_events")
          .insert(allEvents)
          .then(({ error }) => {
            if (error) console.error("[Engine] Event insert failed:", error.message);
          })
      );
    }

    // Advance world day + config
    updatePromises.push(
      db
        .from("worlds")
        .update({
          in_game_day: newDay,
          in_game_year: newYear,
          config: newConfig,
          last_tick_at: new Date().toISOString(),
        })
        .eq("id", world.id)
        .then(({ error }) => {
          if (error) console.error("[Engine] World update failed:", error.message);
        })
    );

    await Promise.all(updatePromises as Promise<unknown>[]);

    return {
      success: true,
      eventsGenerated: allEvents.length,
      day: newDay,
      year: newYear,
    };
  } catch (error) {
    console.error("[Engine] runSimulationTick failed:", error);
    return { success: false, eventsGenerated: 0, day: 0, year: 0 };
  }
}
