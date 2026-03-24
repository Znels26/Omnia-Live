// World Seeder for First Valley — populates the initial Supabase world state
// Run once; safe to call repeatedly (skips if world already exists)

import { createAdminClient } from "@/lib/supabase/admin";
import { randomBetween, clamp } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const WORLD_SEED = {
  slug: "first-valley",
  name: "First Valley",
  era: "Dawn Age",
  in_game_day: 1,
  in_game_year: 1,
  metadata: {
    paused: false,
    world_time: 8,
    weather: { type: "clear", intensity: 0.3, temperature: 20, windSpeed: 0.2 },
    season: { name: "spring", progress: 0.1 },
  },
};

const CULTURES_SEED = [
  {
    name: "River Clan",
    slug: "river-clan",
    color_hex: "#4a90d9",
    population_estimate: 45,
    aggression_level: 20,
    cooperation_level: 80,
    spiritual_tendency: 55,
  },
  {
    name: "Stone Clan",
    slug: "stone-clan",
    color_hex: "#8b7355",
    population_estimate: 38,
    aggression_level: 50,
    cooperation_level: 55,
    spiritual_tendency: 40,
  },
  {
    name: "Tide Clan",
    slug: "tide-clan",
    color_hex: "#2ec4b6",
    population_estimate: 32,
    aggression_level: 30,
    cooperation_level: 65,
    spiritual_tendency: 70,
  },
];

interface SettlementSeed {
  name: string;
  settlement_type: string;
  population: number;
  prosperity: number;
  stability: number;
  position_x: number;
  position_y: number;
  culture_slug: string;
}

const SETTLEMENTS_SEED: SettlementSeed[] = [
  {
    name: "Riverwatch",
    settlement_type: "village",
    population: 45,
    prosperity: 60,
    stability: 70,
    position_x: 420,
    position_y: 310,
    culture_slug: "river-clan",
  },
  {
    name: "Stonecrag",
    settlement_type: "camp",
    population: 38,
    prosperity: 45,
    stability: 65,
    position_x: 360,
    position_y: 130,
    culture_slug: "stone-clan",
  },
  {
    name: "Tidehaven",
    settlement_type: "camp",
    population: 32,
    prosperity: 50,
    stability: 60,
    position_x: 430,
    position_y: 490,
    culture_slug: "tide-clan",
  },
];

interface PersonTemplate {
  name: string;
  age: number;
  life_stage: string;
  occupation: string;
  employment_status: string;
  is_featured: boolean;
  health_score: number;
  wealth_score: number;
  happiness_score: number;
  trait_ambition: number;
  trait_honesty: number;
  trait_aggression: number;
  trait_sociability: number;
  need_hunger: number;
  need_stress: number;
  need_hope: number;
  culture_slug: string;
}

const PERSONS_SEED: PersonTemplate[] = [
  // River Clan (5)
  {
    name: "Aelindra",
    age: 34,
    life_stage: "adult",
    occupation: "Elder",
    employment_status: "employed",
    is_featured: true,
    health_score: 72,
    wealth_score: 55,
    happiness_score: 68,
    trait_ambition: 40,
    trait_honesty: 80,
    trait_aggression: 15,
    trait_sociability: 85,
    need_hunger: 20,
    need_stress: 30,
    need_hope: 75,
    culture_slug: "river-clan",
  },
  {
    name: "Brath",
    age: 22,
    life_stage: "young_adult",
    occupation: "Hunter",
    employment_status: "employed",
    is_featured: false,
    health_score: 88,
    wealth_score: 30,
    happiness_score: 72,
    trait_ambition: 60,
    trait_honesty: 65,
    trait_aggression: 35,
    trait_sociability: 55,
    need_hunger: 35,
    need_stress: 20,
    need_hope: 80,
    culture_slug: "river-clan",
  },
  {
    name: "Caelith",
    age: 8,
    life_stage: "child",
    occupation: null as unknown as string,
    employment_status: "child",
    is_featured: false,
    health_score: 95,
    wealth_score: 10,
    happiness_score: 90,
    trait_ambition: 30,
    trait_honesty: 90,
    trait_aggression: 10,
    trait_sociability: 75,
    need_hunger: 45,
    need_stress: 5,
    need_hope: 95,
    culture_slug: "river-clan",
  },
  {
    name: "Darana",
    age: 52,
    life_stage: "elder",
    occupation: "Healer",
    employment_status: "employed",
    is_featured: true,
    health_score: 60,
    wealth_score: 65,
    happiness_score: 74,
    trait_ambition: 35,
    trait_honesty: 88,
    trait_aggression: 10,
    trait_sociability: 90,
    need_hunger: 25,
    need_stress: 40,
    need_hope: 70,
    culture_slug: "river-clan",
  },
  {
    name: "Evar",
    age: 28,
    life_stage: "adult",
    occupation: "Fisher",
    employment_status: "employed",
    is_featured: false,
    health_score: 82,
    wealth_score: 40,
    happiness_score: 66,
    trait_ambition: 45,
    trait_honesty: 72,
    trait_aggression: 22,
    trait_sociability: 60,
    need_hunger: 30,
    need_stress: 25,
    need_hope: 70,
    culture_slug: "river-clan",
  },
  // Stone Clan (5)
  {
    name: "Gorvath",
    age: 41,
    life_stage: "adult",
    occupation: "Chieftain",
    employment_status: "employed",
    is_featured: true,
    health_score: 78,
    wealth_score: 70,
    happiness_score: 62,
    trait_ambition: 80,
    trait_honesty: 55,
    trait_aggression: 65,
    trait_sociability: 50,
    need_hunger: 20,
    need_stress: 50,
    need_hope: 60,
    culture_slug: "stone-clan",
  },
  {
    name: "Hilda",
    age: 25,
    life_stage: "young_adult",
    occupation: "Scout",
    employment_status: "employed",
    is_featured: false,
    health_score: 91,
    wealth_score: 25,
    happiness_score: 70,
    trait_ambition: 70,
    trait_honesty: 60,
    trait_aggression: 55,
    trait_sociability: 45,
    need_hunger: 40,
    need_stress: 30,
    need_hope: 72,
    culture_slug: "stone-clan",
  },
  {
    name: "Ironmar",
    age: 19,
    life_stage: "young_adult",
    occupation: "Guard",
    employment_status: "employed",
    is_featured: false,
    health_score: 85,
    wealth_score: 20,
    happiness_score: 65,
    trait_ambition: 55,
    trait_honesty: 50,
    trait_aggression: 72,
    trait_sociability: 40,
    need_hunger: 50,
    need_stress: 35,
    need_hope: 65,
    culture_slug: "stone-clan",
  },
  {
    name: "Jorra",
    age: 37,
    life_stage: "adult",
    occupation: "Crafter",
    employment_status: "employed",
    is_featured: false,
    health_score: 74,
    wealth_score: 50,
    happiness_score: 68,
    trait_ambition: 48,
    trait_honesty: 75,
    trait_aggression: 30,
    trait_sociability: 58,
    need_hunger: 28,
    need_stress: 28,
    need_hope: 74,
    culture_slug: "stone-clan",
  },
  {
    name: "Krath",
    age: 14,
    life_stage: "child",
    occupation: null as unknown as string,
    employment_status: "child",
    is_featured: false,
    health_score: 93,
    wealth_score: 15,
    happiness_score: 82,
    trait_ambition: 42,
    trait_honesty: 70,
    trait_aggression: 38,
    trait_sociability: 55,
    need_hunger: 55,
    need_stress: 10,
    need_hope: 88,
    culture_slug: "stone-clan",
  },
  // Tide Clan (5)
  {
    name: "Lirath",
    age: 30,
    life_stage: "adult",
    occupation: "Trader",
    employment_status: "employed",
    is_featured: true,
    health_score: 80,
    wealth_score: 60,
    happiness_score: 76,
    trait_ambition: 65,
    trait_honesty: 68,
    trait_aggression: 25,
    trait_sociability: 82,
    need_hunger: 22,
    need_stress: 22,
    need_hope: 80,
    culture_slug: "tide-clan",
  },
  {
    name: "Maren",
    age: 44,
    life_stage: "adult",
    occupation: "Navigator",
    employment_status: "employed",
    is_featured: false,
    health_score: 71,
    wealth_score: 55,
    happiness_score: 70,
    trait_ambition: 58,
    trait_honesty: 76,
    trait_aggression: 20,
    trait_sociability: 70,
    need_hunger: 30,
    need_stress: 32,
    need_hope: 72,
    culture_slug: "tide-clan",
  },
  {
    name: "Noel",
    age: 17,
    life_stage: "young_adult",
    occupation: "Apprentice",
    employment_status: "employed",
    is_featured: false,
    health_score: 90,
    wealth_score: 18,
    happiness_score: 78,
    trait_ambition: 72,
    trait_honesty: 80,
    trait_aggression: 18,
    trait_sociability: 78,
    need_hunger: 42,
    need_stress: 15,
    need_hope: 85,
    culture_slug: "tide-clan",
  },
  {
    name: "Orvine",
    age: 58,
    life_stage: "elder",
    occupation: "Shaman",
    employment_status: "employed",
    is_featured: true,
    health_score: 58,
    wealth_score: 62,
    happiness_score: 72,
    trait_ambition: 30,
    trait_honesty: 90,
    trait_aggression: 12,
    trait_sociability: 85,
    need_hunger: 18,
    need_stress: 38,
    need_hope: 78,
    culture_slug: "tide-clan",
  },
  {
    name: "Petra",
    age: 26,
    life_stage: "young_adult",
    occupation: "Fisher",
    employment_status: "employed",
    is_featured: false,
    health_score: 85,
    wealth_score: 32,
    happiness_score: 73,
    trait_ambition: 50,
    trait_honesty: 74,
    trait_aggression: 22,
    trait_sociability: 68,
    need_hunger: 33,
    need_stress: 20,
    need_hope: 76,
    culture_slug: "tide-clan",
  },
];

// ---------------------------------------------------------------------------
// seedWorld
// ---------------------------------------------------------------------------

export async function seedWorld(): Promise<{ worldId: string; message: string }> {
  const db = createAdminClient();

  // Check if world already exists
  const { data: existing } = await db
    .from("worlds")
    .select("id, name")
    .eq("slug", "first-valley")
    .maybeSingle();

  if (existing) {
    return {
      worldId: existing.id,
      message: `World '${existing.name}' already exists — skipping seed.`,
    };
  }

  // -------------------------------------------------------------------------
  // 1. Create world
  // -------------------------------------------------------------------------
  const { data: world, error: worldErr } = await db
    .from("worlds")
    .insert(WORLD_SEED)
    .select("id")
    .single();

  if (worldErr || !world) {
    throw new Error(`Failed to create world: ${worldErr?.message}`);
  }

  const worldId = world.id;

  // -------------------------------------------------------------------------
  // 2. Create cultures
  // -------------------------------------------------------------------------
  const { data: cultures, error: cultureErr } = await db
    .from("cultures")
    .insert(
      CULTURES_SEED.map((c) => ({
        ...c,
        world_id: worldId,
      }))
    )
    .select("id, slug");

  if (cultureErr || !cultures) {
    throw new Error(`Failed to create cultures: ${cultureErr?.message}`);
  }

  const cultureBySlug = Object.fromEntries(cultures.map((c) => [c.slug, c.id]));

  // -------------------------------------------------------------------------
  // 3. Create settlements
  // -------------------------------------------------------------------------
  const { data: settlements, error: settlErr } = await db
    .from("settlements")
    .insert(
      SETTLEMENTS_SEED.map((s) => ({
        world_id: worldId,
        name: s.name,
        settlement_type: s.settlement_type as 'camp' | 'village' | 'town' | 'city',
        population: s.population,
        prosperity: s.prosperity,
        stability: s.stability,
        position_x: s.position_x,
        position_y: s.position_y,
        culture_id: cultureBySlug[s.culture_slug] ?? null,
      }))
    )
    .select("id, name, culture_id");

  if (settlErr || !settlements) {
    throw new Error(`Failed to create settlements: ${settlErr?.message}`);
  }

  // Map culture_id → settlement_id (each culture has one home settlement)
  const settlementByCulture = Object.fromEntries(
    settlements
      .filter((s) => s.culture_id)
      .map((s) => [s.culture_id as string, s.id])
  );

  // -------------------------------------------------------------------------
  // 4. Create households (one per settlement as a placeholder)
  // -------------------------------------------------------------------------
  const householdInserts = settlements.map((s) => ({
    world_id: worldId,
    settlement_id: s.id,
    name: `${s.name} Household`,
    household_type: "family",
    income_level: 50,
    wealth_score: 40,
    happiness_score: 65,
  }));

  // Insert households — ignore errors if the table doesn't have all columns
  await db.from("households").insert(householdInserts).then(({ error }) => {
    if (error) console.warn("[Seed] Household insert warning:", error.message);
  });

  // -------------------------------------------------------------------------
  // 5. Create persons (15 starting persons)
  // -------------------------------------------------------------------------
  const personInserts = PERSONS_SEED.map((p, idx) => {
    const cultureId = cultureBySlug[p.culture_slug] ?? null;
    const residenceId = cultureId ? (settlementByCulture[cultureId] ?? null) : null;

    // Spread persons around their settlement position
    const settlement = settlements.find((s) => s.culture_id === cultureId);
    const baseX = settlement ? 0 : 400; // will be overridden via settlement lookup
    const baseY = settlement ? 0 : 300;

    // Use SETTLEMENTS_SEED for position reference
    const settSeed = SETTLEMENTS_SEED.find((s) => s.culture_slug === p.culture_slug);
    const pos_x = settSeed
      ? clamp(settSeed.position_x + Math.round(randomBetween(-40, 40)), 0, 800)
      : 400;
    const pos_y = settSeed
      ? clamp(settSeed.position_y + Math.round(randomBetween(-40, 40)), 0, 600)
      : 300;

    return {
      world_id: worldId,
      name: p.name,
      age: p.age,
      life_stage: p.life_stage as 'infant' | 'child' | 'adolescent' | 'young_adult' | 'adult' | 'elder',
      occupation: p.occupation ?? null,
      employment_status: p.employment_status as 'employed' | 'apprenticing' | 'underemployed' | 'displaced' | 'unemployed' | 'unable',
      is_alive: true,
      is_featured: p.is_featured,
      health_score: p.health_score,
      wealth_score: p.wealth_score,
      happiness_score: p.happiness_score,
      pos_x,
      pos_y,
      culture_id: cultureId,
      residence_id: residenceId,
      class_tier: "common" as const,
      trait_ambition: p.trait_ambition,
      trait_honesty: p.trait_honesty,
      trait_aggression: p.trait_aggression,
      trait_sociability: p.trait_sociability,
      need_hunger: p.need_hunger,
      need_stress: p.need_stress,
      need_hope: p.need_hope,
      current_action: null,
      current_goal: null,
      metadata: {},
    };
  });

  const { error: personErr } = await db.from("persons").insert(personInserts);
  if (personErr) {
    throw new Error(`Failed to create persons: ${personErr.message}`);
  }

  // -------------------------------------------------------------------------
  // 6. Seed initial public event
  // -------------------------------------------------------------------------
  await db.from("public_events").insert({
    world_id: worldId,
    event_type: "ERA_TRANSITION",
    title: "First Valley stirs to life",
    description:
      "In the dawn of a new age, three clans make their home in First Valley. The river flows, the stones endure, and the tides call. History begins.",
    primary_person_id: null,
    settlement_id: null,
    significance_score: 100,
    is_milestone: true,
    is_featured: true,
    in_game_day: 1,
    in_game_year: 1,
    metadata: { founding: true },
  });

  return {
    worldId,
    message: `World '${WORLD_SEED.name}' seeded successfully — ${PERSONS_SEED.length} persons, ${SETTLEMENTS_SEED.length} settlements, ${CULTURES_SEED.length} cultures created.`,
  };
}
