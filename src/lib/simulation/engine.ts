// Simulation Engine — orchestrates all simulation systems for First Valley
// Uses Supabase instead of Prisma for all DB operations

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";
import { WorldState, SimBeing, SimClan, SimSettlement, SimEvent } from "./types";
import { clamp, randomBetween } from "@/lib/utils";
import {
  progressSkillFromAction,
  getPersonSkills,
  getClanSkillAverages,
  checkNewDiscoveries,
  getClanEra,
  getEraDescription,
  TECHNOLOGIES,
} from "./skills";

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
  primary_person_id?: string | null;
  settlement_id?: string | null;
  culture_id?: string | null;
  significance_score: number;
  is_milestone: boolean;
  is_featured: boolean;
  in_game_day: number;
  in_game_year: number;
  metadata: Json;
}

function generateNotableMoment(p: DbPerson, day: number, year: number): PendingEvent | null {
  const name = p.name;
  const occ = (p.occupation ?? "villager").toLowerCase();
  const action = p.current_action ?? "";

  // Occupation-keyed event pools: [title, description]
  const pools: Record<string, Array<[string, string]>> = {
    hunter: [
      [`${name} returns with a great kill`, `After days in the wild, ${name} drags back enough meat to feed the settlement for a week. The hunt was dangerous but precise.`],
      [`${name} tracks something strange`, `${name} follows unusual prints into the forest. Whatever made them was large — and it knew it was being followed.`],
      [`${name} teaches the younger ones to hunt`, `${name} spends the morning showing the settlement's youth how to set snares and read animal signs in the mud.`],
    ],
    farmer: [
      [`${name}'s harvest draws admiration`, `The rows ${name} has tended burst with grain. Others come to look, to learn, to copy the technique.`],
      [`${name} fights to save the crop`, `A blight threatens the fields. ${name} works through the night pulling diseased stalks before it spreads.`],
      [`${name} tries something new with the soil`, `${name} mixes wood ash into the earth before sowing — an old idea, tested with fresh determination.`],
    ],
    healer: [
      [`${name} pulls someone back from the edge`, `A fever that had lasted three days broke this morning. ${name} never left the patient's side.`],
      [`${name} grinds new herbs by firelight`, `${name} is trying a remedy no one has used here before — something remembered from a distant elder's teaching.`],
      [`${name} tends the wounded in silence`, `After a rough day in the valley, ${name} moves from person to person, setting bones and cleaning wounds without a word of complaint.`],
    ],
    trader: [
      [`${name} strikes an unexpected deal`, `A traveller passed through and ${name} bartered well — what left as surplus returned as something the settlement badly needed.`],
      [`${name} argues the clan's worth in open market`, `Voices were raised. ${name} held firm. The terms, in the end, favoured the clan.`],
      [`${name} maps the road ahead`, `${name} notes which paths are passable, which tolls are fair, and which traders are worth trusting next season.`],
    ],
    guard: [
      [`${name} holds the line through the night`, `Something circled the settlement in the dark. ${name} did not sleep. At dawn, it was gone.`],
      [`${name} catches a trespasser`, `A stranger was found too close to the storehouse. ${name} handled it firmly — no blood spilled, message received.`],
      [`${name} drills the others until they're sharp`, `${name} ran the settlement's defenders through their paces until every stance was right and every reaction quick.`],
    ],
    scout: [
      [`${name} brings back word of movement beyond the ridge`, `Something is changing in the lands to the north. ${name}'s report is brief but urgent.`],
      [`${name} finds a path no one knew existed`, `Following the river upstream, ${name} discovered a narrow pass that cuts through the stone heights. It could matter greatly.`],
      [`${name} maps the territory in careful scratches`, `${name} spent the day walking boundaries and marking what was seen. The valley is larger than most know.`],
    ],
    fisher: [
      [`${name} hauls in more than expected`, `The net came up heavy this morning. ${name} worked the river for hours, reading the currents like an old friend.`],
      [`${name} finds a new stretch of river`, `Upstream, where most don't go, ${name} found still water full of fish. Tomorrow there will be enough for everyone.`],
    ],
    crafter: [
      [`${name} finishes something remarkable`, `${name} holds it up to the light — whatever it is, it's better than anything made here before. People gather to look.`],
      [`${name} solves a problem that had stumped the others`, `The tool kept breaking. ${name} studied the break, changed the angle, chose different material. It holds now.`],
      [`${name} works through the night on an idea`, `The fire in the workshop burned until dawn. Whatever ${name} is making, it cannot wait.`],
    ],
    leader: [
      [`${name} settles a dispute before it turns bitter`, `Two voices were raised. ${name} listened to both, said little, and found the middle ground. The valley is quieter for it.`],
      [`${name} speaks of what is coming`, `Gathered around the fire, the clan listened as ${name} laid out the season ahead — the risks, the work, the hope.`],
      [`${name} earns quiet respect`, `No grand gesture. Just steady presence, sound decisions, and a word at the right moment. ${name}'s standing grows.`],
    ],
  };

  // Match occupation to a pool key
  const poolKey = Object.keys(pools).find(k => occ.includes(k)) ?? "default";

  const defaultPool: Array<[string, string]> = [
    [`${name} leaves a mark on the day`, action
      ? `${name} was seen ${action.toLowerCase().replace(/^(he|she|they) (is |was |are )?/, "")}. It will be remembered.`
      : `A quiet act, a moment of clarity. ${name} did what needed doing, and the valley is better for it.`],
    [`${name} is watched by those who matter`, `Word of ${name}'s recent work has spread. Not loudly — but those with sharp eyes have noticed.`],
    [`The valley speaks ${name}'s name today`, action
      ? `"${action}" — that is what people say when asked what ${name} was doing. It means more than it sounds.`
      : `${name}'s name passes between people today, said in the tone reserved for those who have earned respect.`],
  ];

  const pool = pools[poolKey] ?? defaultPool;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  return {
    world_id: p.world_id,
    event_type: "CUSTOM",
    title: pick[0],
    description: pick[1],
    primary_person_id: p.id,
    settlement_id: p.residence_id,
    significance_score: 55,
    is_milestone: false,
    is_featured: true,
    in_game_day: day,
    in_game_year: year,
    metadata: { occupation: p.occupation, action: p.current_action },
  };
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
    const notableEvent = generateNotableMoment(p, day, year);
    if (notableEvent) events.push(notableEvent);
  }

  // Progress skills from current action
  const currentSkills = getPersonSkills(p.metadata)
  const { skills: updatedSkills, changed: skillChanged } = progressSkillFromAction(currentSkills, p.current_action)
  const updatedMetadata = skillChanged
    ? { ...((p.metadata ?? {}) as Record<string, unknown>), skills: updatedSkills }
    : p.metadata

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
      ...(skillChanged ? { metadata: updatedMetadata as import('@/types/database').Json } : {}),
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
    const birthDescs = [
      `${childName} is born before dawn, small and loud. ${parent.name} does not sleep. By morning, the whole settlement knows.`,
      `${parent.name} holds ${childName} for the first time — a new life in the valley, one more soul to feed, to protect, to watch grow.`,
      `The birth was hard. ${parent.name} survived it. So did ${childName}. The valley has one more person now.`,
    ];
    events.push({
      world_id: worldId,
      event_type: "BIRTH",
      title: `${childName} is born into the valley`,
      description: birthDescs[Math.floor(Math.random() * birthDescs.length)],
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
      const marriageDescs = [
        `${a.name} and ${b.name} made their vows at dusk, the fire between them. The settlement feasted late into the night.`,
        `It was not arranged. It was not expected. But ${a.name} and ${b.name} stood before the clan and spoke plainly. The valley approves.`,
        `${a.name} and ${b.name} have been inseparable for months. Now it is made formal. Two households, one hearth.`,
      ];
      events.push({
        world_id: worldId,
        event_type: "MARRIAGE",
        title: `${a.name} and ${b.name} are joined`,
        description: marriageDescs[Math.floor(Math.random() * marriageDescs.length)],
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
    const crimePool: Array<[string, string, string]> = [
      ["theft", `${offender.name} caught stealing from the storehouse`, `Three days' worth of grain, gone. Eyes turned to ${offender.name}. The accused said nothing. Tensions are high.`],
      ["trespass", `${offender.name} found in forbidden territory`, `${offender.name} was discovered where they had no right to be. Whether it was curiosity or calculation, the clan wants answers.`],
      ["assault", `${offender.name} strikes a fellow valley dweller`, `Voices were raised, then fists. ${offender.name} struck first. The injured party is recovering. The matter is not yet settled.`],
      ["poaching", `${offender.name} accused of poaching on another clan's land`, `The tracks led back to ${offender.name}. A deer taken from grounds that were not theirs to hunt. The other clan has heard.`],
      ["deception", `${offender.name} caught in a lie`, `A trade that seemed fair turned sour when the truth came out. ${offender.name} knew all along. Trust is harder to rebuild than a fence.`],
    ];
    const [crime, crimeTitle, crimeDesc] = crimePool[Math.floor(Math.random() * crimePool.length)];
    events.push({
      world_id: worldId,
      event_type: "BETRAYAL",
      title: crimeTitle,
      description: crimeDesc,
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
// Vote resolution — picks winner and applies effects for closed votes
// ---------------------------------------------------------------------------

async function resolveExpiredVotes(
  db: ReturnType<typeof createAdminClient>,
  worldId: string,
  day: number,
  year: number
): Promise<PendingEvent[]> {
  const events: PendingEvent[] = [];

  // Find votes that are 'open' and past their closes_at time
  const { data: closedVotes } = await db
    .from("world_votes")
    .select("*")
    .eq("world_id", worldId)
    .eq("status", "open")
    .lte("closes_at", new Date().toISOString());

  if (!closedVotes?.length) return events;

  for (const vote of closedVotes) {
    const { data: optionsData } = await db
      .from("vote_options")
      .select("id, title, votes_count, token_votes_count, effect_config")
      .eq("vote_id", vote.id);

    const options = (optionsData ?? []) as Array<{
      id: string;
      title: string;
      votes_count: number;
      token_votes_count: number;
      effect_config: Record<string, unknown> | null;
    }>;

    if (!options.length) continue;

    // Pick winner: highest (votes_count + token_votes_count), break ties randomly
    const winner = options.reduce((best, opt) => {
      const score = opt.votes_count + opt.token_votes_count;
      const bestScore = best.votes_count + best.token_votes_count;
      if (score > bestScore) return opt;
      if (score === bestScore && Math.random() < 0.5) return opt;
      return best;
    });

    // Apply the effect_config to the world
    const effectEvents = await applyVoteEffect(db, worldId, winner.effect_config, day, year, vote.title, winner.title);
    events.push(...effectEvents);

    // Mark vote as resolved
    await db
      .from("world_votes")
      .update({
        status: "resolved",
        winning_option_id: winner.id,
        effect_applied: true,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", vote.id);

    events.push({
      world_id: worldId,
      event_type: "CUSTOM",
      title: `The people have spoken: ${winner.title}`,
      description: `The vote on "${vote.title}" has concluded. The valley has chosen: ${winner.title}.`,
      primary_person_id: null,
      settlement_id: null,
      significance_score: 70,
      is_milestone: true,
      is_featured: true,
      in_game_day: day,
      in_game_year: year,
      metadata: { vote_id: vote.id, winning_option: winner.title },
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Vote effect executor — interprets effect_config and modifies world state
// ---------------------------------------------------------------------------

async function applyVoteEffect(
  db: ReturnType<typeof createAdminClient>,
  worldId: string,
  effectConfig: Record<string, unknown> | null,
  day: number,
  year: number,
  voteTitle: string,
  optionTitle: string
): Promise<PendingEvent[]> {
  const events: PendingEvent[] = [];
  if (!effectConfig) return events;

  const type = effectConfig.type as string;

  if (type === "BOOST_CLAN") {
    const clanId = effectConfig.target_id as string;
    const amount = (effectConfig.amount as number) ?? 10;
    const { data: clan } = await db.from("cultures").select("population_estimate, name").eq("id", clanId).single();
    if (clan) {
      const newPop = Math.max(0, (clan.population_estimate ?? 0) + amount);
      await db.from("cultures").update({ population_estimate: newPop }).eq("id", clanId);
      events.push({
        world_id: worldId,
        event_type: "CUSTOM",
        title: `The ${clan.name} grow stronger`,
        description: `Following the audience's choice, the ${clan.name} receive aid and grow in strength.`,
        primary_person_id: null,
        settlement_id: null,
        significance_score: 55,
        is_milestone: false,
        is_featured: false,
        in_game_day: day,
        in_game_year: year,
        metadata: { clan_id: clanId, population_change: amount },
      });
    }
  }

  if (type === "HEAL_PERSON") {
    const personId = effectConfig.target_id as string;
    const { data: person } = await db.from("persons").select("name").eq("id", personId).single();
    if (person) {
      await db
        .from("persons")
        .update({ health_score: 80, need_hunger: 20, need_fatigue: 20, need_stress: 20 })
        .eq("id", personId);
      events.push({
        world_id: worldId,
        event_type: "CUSTOM",
        title: `${person.name} is restored`,
        description: `The will of the audience reaches ${person.name}. They recover against all odds.`,
        primary_person_id: personId,
        settlement_id: null,
        significance_score: 75,
        is_milestone: false,
        is_featured: true,
        in_game_day: day,
        in_game_year: year,
        metadata: { effect: "heal", vote_title: voteTitle },
      });
    }
  }

  if (type === "END_WAR") {
    // Remove hostile relations between all cultures in this world
    const { data: cultures } = await db.from("cultures").select("id, metadata").eq("world_id", worldId);
    if (cultures) {
      for (const culture of cultures) {
        const meta = (culture.metadata as Record<string, unknown>) ?? {};
        const relations = (meta.relations as Record<string, string>) ?? {};
        const updated = Object.fromEntries(
          Object.entries(relations).map(([k, v]) => [k, v === "hostile" ? "neutral" : v])
        );
        await db.from("cultures").update({ metadata: { ...meta, relations: updated } }).eq("id", culture.id);
      }
    }
    events.push({
      world_id: worldId,
      event_type: "CUSTOM",
      title: "The audience demands peace",
      description: "Heeding the will of those who watch, the warring clans lay down their arms.",
      primary_person_id: null,
      settlement_id: null,
      significance_score: 85,
      is_milestone: true,
      is_featured: true,
      in_game_day: day,
      in_game_year: year,
      metadata: { effect: "end_war" },
    });
  }

  if (type === "START_WAR") {
    const clanAId = effectConfig.clan_a as string;
    const clanBId = effectConfig.clan_b as string;
    if (clanAId && clanBId) {
      for (const [myId, theirId] of [[clanAId, clanBId], [clanBId, clanAId]]) {
        const { data: c } = await db.from("cultures").select("name, metadata").eq("id", myId).single();
        if (c) {
          const meta = (c.metadata as Record<string, unknown>) ?? {};
          const relations = (meta.relations as Record<string, string>) ?? {};
          relations[theirId] = "hostile";
          await db.from("cultures").update({ metadata: { ...meta, relations } }).eq("id", myId);
        }
      }
      const { data: clanA } = await db.from("cultures").select("name").eq("id", clanAId).single();
      const { data: clanB } = await db.from("cultures").select("name").eq("id", clanBId).single();
      events.push({
        world_id: worldId,
        event_type: "WAR_DECLARED",
        title: `${clanA?.name ?? "A clan"} declares war on ${clanB?.name ?? "another clan"}`,
        description: `The audience has ignited conflict. ${clanA?.name} raises arms against ${clanB?.name}.`,
        primary_person_id: null,
        settlement_id: null,
        significance_score: 90,
        is_milestone: true,
        is_featured: true,
        in_game_day: day,
        in_game_year: year,
        metadata: { clan_a: clanAId, clan_b: clanBId },
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// War simulation — check for hostile clans, run battles, resolve wars
// ---------------------------------------------------------------------------

async function tickClanRelations(
  db: ReturnType<typeof createAdminClient>,
  worldId: string,
  day: number,
  year: number
): Promise<PendingEvent[]> {
  const events: PendingEvent[] = [];

  const { data: culturesData } = await db
    .from("cultures")
    .select("id, name, population_estimate, aggression_level, cooperation_level, metadata")
    .eq("world_id", worldId);

  if (!culturesData?.length) return events;

  const cultures = culturesData as Array<{
    id: string;
    name: string;
    population_estimate: number;
    aggression_level: number;
    cooperation_level: number;
    metadata: Record<string, unknown> | null;
  }>;

  for (const culture of cultures) {
    if (culture.population_estimate <= 0) continue;

    const meta = (culture.metadata ?? {}) as Record<string, unknown>;
    const relations = (meta.relations as Record<string, string>) ?? {};

    // Check each hostile relation — run a battle tick
    for (const [enemyId, relation] of Object.entries(relations)) {
      if (relation !== "hostile") continue;

      const enemy = cultures.find((c) => c.id === enemyId);
      if (!enemy || enemy.population_estimate <= 0) {
        // Enemy wiped out — war ends
        relations[enemyId] = "neutral";
        events.push({
          world_id: worldId,
          event_type: "CUSTOM",
          title: `${culture.name} claims victory`,
          description: `The ${culture.name} have crushed the ${enemy?.name ?? "enemy"} and emerged victorious from the conflict.`,
          primary_person_id: null,
          settlement_id: null,
          significance_score: 90,
          is_milestone: true,
          is_featured: true,
          in_game_day: day,
          in_game_year: year,
          metadata: { victor: culture.id, defeated: enemyId },
        });
        continue;
      }

      // Battle: both sides lose population each tick they're at war (only from the attacker's perspective to avoid double-processing)
      if (culture.id < enemy.id) {
        // Process this pair once (lower ID side runs the battle)
        const attackerLoss = Math.floor(Math.random() * 3);
        const defenderLoss = Math.floor(Math.random() * 3);
        const newAttackerPop = Math.max(0, culture.population_estimate - attackerLoss);
        const newDefenderPop = Math.max(0, enemy.population_estimate - defenderLoss);

        await db.from("cultures").update({ population_estimate: newAttackerPop }).eq("id", culture.id);
        await db.from("cultures").update({ population_estimate: newDefenderPop }).eq("id", enemy.id);

        // Occasional visible battle event (not every tick — 20% chance)
        if (Math.random() < 0.2) {
          const attackerWins = attackerLoss < defenderLoss;
          events.push({
            world_id: worldId,
            event_type: "BATTLE",
            title: `${culture.name} and ${enemy.name} clash`,
            description: attackerWins
              ? `The ${culture.name} press their advantage against the ${enemy.name}. The ${enemy.name} suffer greater losses.`
              : `The ${enemy.name} repel an assault by the ${culture.name}, inflicting heavy casualties.`,
            primary_person_id: null,
            settlement_id: null,
            significance_score: 65,
            is_milestone: false,
            is_featured: false,
            in_game_day: day,
            in_game_year: year,
            metadata: {
              attacker: culture.id,
              defender: enemy.id,
              attacker_loss: attackerLoss,
              defender_loss: defenderLoss,
            },
          });
        }

        // 2% chance per tick of peace breaking out
        if (Math.random() < 0.02) {
          relations[enemyId] = "neutral";
          const enemyMeta = (enemy.metadata ?? {}) as Record<string, unknown>;
          const enemyRelations = (enemyMeta.relations as Record<string, string>) ?? {};
          enemyRelations[culture.id] = "neutral";
          await db.from("cultures").update({ metadata: { ...enemyMeta, relations: enemyRelations } }).eq("id", enemy.id);

          events.push({
            world_id: worldId,
            event_type: "CUSTOM",
            title: `${culture.name} and ${enemy.name} agree to peace`,
            description: `After bitter conflict, the ${culture.name} and ${enemy.name} lay down their arms. An uneasy peace settles over the valley.`,
            primary_person_id: null,
            settlement_id: null,
            significance_score: 80,
            is_milestone: true,
            is_featured: true,
            in_game_day: day,
            in_game_year: year,
            metadata: { clan_a: culture.id, clan_b: enemy.id },
          });
        }
      }
    }

    // Update this culture's metadata if relations changed
    await db.from("cultures").update({ metadata: { ...meta, relations } }).eq("id", culture.id);

    // Chance of a new war breaking out between high-aggression cultures (1 per 50 days on average)
    if (Math.random() < 0.02 && culture.aggression_level > 60) {
      const target = cultures.find(
        (c) =>
          c.id !== culture.id &&
          c.population_estimate > 5 &&
          (relations[c.id] ?? "neutral") === "neutral"
      );
      if (target) {
        const myMeta = (culture.metadata ?? {}) as Record<string, unknown>;
        const myRelations = (myMeta.relations as Record<string, string>) ?? {};
        myRelations[target.id] = "hostile";
        await db.from("cultures").update({ metadata: { ...myMeta, relations: myRelations } }).eq("id", culture.id);

        const targetMeta = (target.metadata ?? {}) as Record<string, unknown>;
        const targetRelations = (targetMeta.relations as Record<string, string>) ?? {};
        targetRelations[culture.id] = "hostile";
        await db.from("cultures").update({ metadata: { ...targetMeta, relations: targetRelations } }).eq("id", target.id);

        events.push({
          world_id: worldId,
          event_type: "WAR_DECLARED",
          title: `${culture.name} declares war on ${target.name}`,
          description: `Tensions that have simmered for seasons finally boil over. The ${culture.name} raise their banners against the ${target.name}.`,
          primary_person_id: null,
          settlement_id: null,
          significance_score: 90,
          is_milestone: true,
          is_featured: true,
          in_game_day: day,
          in_game_year: year,
          metadata: { aggressor: culture.id, target: target.id },
        });
      }
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Vote auto-creation — creates a new vote every 7 in-game days if none open
// ---------------------------------------------------------------------------

async function maybeCreateVote(
  db: ReturnType<typeof createAdminClient>,
  worldId: string,
  day: number,
  year: number,
  cycleNumber: number
): Promise<void> {
  // Only check every 7 days
  if (day % 7 !== 0) return;

  // Check if there's already an open or upcoming vote
  const { data: existingVote } = await db
    .from("world_votes")
    .select("id")
    .eq("world_id", worldId)
    .in("status", ["open", "upcoming"])
    .limit(1)
    .single();

  if (existingVote) return;

  // Load world state to pick a contextual vote
  const { data: cultures } = await db
    .from("cultures")
    .select("id, name, population_estimate, aggression_level, metadata")
    .eq("world_id", worldId);

  const { data: persons } = await db
    .from("persons")
    .select("id, name, is_featured, is_alive")
    .eq("world_id", worldId)
    .eq("is_alive", true)
    .eq("is_featured", true)
    .limit(5);

  const cultureList = (cultures ?? []) as Array<{ id: string; name: string; population_estimate: number; aggression_level: number; metadata: Record<string, unknown> | null }>;
  const featuredPersons = (persons ?? []) as Array<{ id: string; name: string; is_featured: boolean }>;

  // Check for warring clans
  const atWar = cultureList.filter((c) => {
    const relations = ((c.metadata ?? {}) as Record<string, unknown>).relations as Record<string, string> | undefined;
    return relations && Object.values(relations).some((r) => r === "hostile");
  });

  let voteData: {
    title: string;
    description: string;
    vote_category: string;
    options: Array<{ title: string; description: string; effect_summary: string; effect_config: Record<string, unknown> }>;
  };

  if (atWar.length > 0) {
    voteData = {
      title: "Should the audience intervene in the war?",
      description: `Conflict rages in the valley. The ${atWar[0].name} and their enemies clash. The audience may shape the outcome.`,
      vote_category: "INTERVENTION",
      options: [
        {
          title: "Demand peace",
          description: "The audience uses its influence to end the conflict immediately.",
          effect_summary: "All wars in the valley end immediately.",
          effect_config: { type: "END_WAR" },
        },
        {
          title: "Let fate decide",
          description: "The audience watches and does not interfere.",
          effect_summary: "No effect — the war continues.",
          effect_config: { type: "NO_OP" },
        },
      ],
    };
  } else if (featuredPersons.length > 0) {
    const person = featuredPersons[Math.floor(Math.random() * featuredPersons.length)];
    voteData = {
      title: `Fate of ${person.name}`,
      description: `${person.name} stands at a crossroads. The audience will decide their next chapter.`,
      vote_category: "CHARACTER_FATE",
      options: [
        {
          title: `Aid ${person.name}`,
          description: `The audience blesses ${person.name} with good fortune.`,
          effect_summary: `${person.name}'s health and wellbeing are restored.`,
          effect_config: { type: "HEAL_PERSON", target_id: person.id },
        },
        {
          title: "Leave them to fate",
          description: "The audience observes without interfering.",
          effect_summary: "No effect — fate runs its course.",
          effect_config: { type: "NO_OP" },
        },
      ],
    };
  } else if (cultureList.length >= 2) {
    const clan = cultureList[Math.floor(Math.random() * cultureList.length)];
    voteData = {
      title: `Should the ${clan.name} expand?`,
      description: `The ${clan.name} are considering pushing into new territory. The audience may encourage or restrain them.`,
      vote_category: "CLAN_FATE",
      options: [
        {
          title: `Bless the ${clan.name}'s expansion`,
          description: "The audience wills the clan forward, granting them strength.",
          effect_summary: `The ${clan.name}'s population grows.`,
          effect_config: { type: "BOOST_CLAN", target_id: clan.id, amount: 5 },
        },
        {
          title: "Hold them back",
          description: "The audience urges caution.",
          effect_summary: "No expansion occurs.",
          effect_config: { type: "NO_OP" },
        },
      ],
    };
  } else {
    return; // not enough world state to make an interesting vote
  }

  const opensAt = new Date();
  const closesAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

  // Create vote
  const { data: newVote } = await db
    .from("world_votes")
    .insert({
      world_id: worldId,
      cycle_number: cycleNumber,
      title: voteData.title,
      description: voteData.description,
      vote_category: voteData.vote_category,
      status: "open",
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      in_game_day_opens: day,
      total_votes_cast: 0,
      metadata: { auto_generated: true, in_game_year: year },
    })
    .select("id")
    .single();

  if (!newVote) return;

  // Insert options
  await db.from("vote_options").insert(
    voteData.options.map((opt) => ({
      vote_id: newVote.id,
      title: opt.title,
      description: opt.description,
      effect_summary: opt.effect_summary,
      effect_config: opt.effect_config as Json,
      votes_count: 0,
      token_votes_count: 0,
    }))
  );
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

    // Compute new world-time first — it drives the day/year rollover.
    // 1 sim day = 12 real hours = 14 400 ticks at 3 s/tick → +1/600 world-hours per tick.
    const existingConfig = (world.config ?? {}) as Record<string, unknown>;
    const prevWorldTime = (existingConfig.world_time as number) ?? 8;
    const newWorldTime = (prevWorldTime + 1 / 600) % 24;

    // Day only advances when the clock wraps past midnight (keeps day & time in sync)
    const dayIncrement = newWorldTime < prevWorldTime ? 1 : 0;
    const newDay = world.in_game_day + dayIncrement;
    const newYear = dayIncrement > 0 && newDay % 365 === 0 ? world.in_game_year + 1 : world.in_game_year;

    // Load living persons
    const { data: personsData } = await db
      .from("persons")
      .select("*")
      .eq("world_id", world.id)
      .eq("is_alive", true)
      .limit(200);

    const persons = (personsData ?? []) as DbPerson[];

    // Load settlements and cultures for event generation
    const [settlementsRes, culturesRes] = await Promise.all([
      db.from("settlements").select("*").eq("world_id", world.id),
      db.from("cultures").select("*").eq("world_id", world.id),
    ]);

    const settlements = (settlementsRes.data ?? []) as DbSettlement[];
    const cultures = ((culturesRes.data ?? []) as DbCulture[]).map(dbCultureToSimClan);

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

    // Clan relations & war simulation
    try {
      const warEvents = await tickClanRelations(db, world.id, newDay, newYear);
      allEvents.push(...warEvents);
    } catch (err) {
      console.error("[Engine] War tick failed:", err);
    }

    // Vote resolution (close expired votes and apply effects)
    try {
      const voteEvents = await resolveExpiredVotes(db, world.id, newDay, newYear);
      allEvents.push(...voteEvents);
    } catch (err) {
      console.error("[Engine] Vote resolution failed:", err);
    }

    // Auto-create next vote if none open
    try {
      await maybeCreateVote(db, world.id, newDay, newYear, world.in_game_day);
    } catch (err) {
      console.error("[Engine] Vote creation failed:", err);
    }

    // Civilisation progression check — runs every 5 real ticks (~15s) to avoid overhead
    if (world.in_game_day % 5 === 0) {
      try {
        const civEvents = await checkCivilizationProgress(db, world.id, persons, cultures, newDay, newYear);
        allEvents.push(...civEvents);
      } catch (err) {
        console.error("[Engine] Civilisation check failed:", err);
      }
    }

    // Build world config update (preserve existing config fields)
    const newConfig: Json = {
      ...existingConfig,
      world_time: newWorldTime, // already computed above from prevWorldTime
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

// ---------------------------------------------------------------------------
// Civilisation Progression
// ---------------------------------------------------------------------------

async function checkCivilizationProgress(
  db: ReturnType<typeof createAdminClient>,
  worldId: string,
  persons: DbPerson[],
  cultures: SimClan[],
  day: number,
  year: number
): Promise<PendingEvent[]> {
  const events: PendingEvent[] = []

  for (const clan of cultures) {
    // Get all alive persons in this clan
    const clanPersons = persons.filter(p => p.is_alive && p.culture_id === clan.id)
    if (clanPersons.length === 0) continue

    // Fetch current culture metadata for discovered tech list
    const { data: cultureRow } = await db
      .from('cultures')
      .select('metadata')
      .eq('id', clan.id)
      .single()

    const meta = (cultureRow?.metadata ?? {}) as Record<string, unknown>
    const discovered: string[] = Array.isArray(meta.technologies) ? meta.technologies as string[] : []

    // Compute average skills from all clan members' metadata
    const clanMetadatas = clanPersons.map(p => p.metadata)
    const avgSkills = getClanSkillAverages(clanMetadatas)

    // Check for new discoveries
    const newTechs = checkNewDiscoveries(avgSkills, clanPersons.length, discovered)

    if (newTechs.length === 0) continue

    // Apply discoveries
    const allDiscovered = [...discovered, ...newTechs]
    const newEra = getClanEra(allDiscovered)
    const prevEra = getClanEra(discovered)

    await db.from('cultures').update({
      metadata: {
        ...meta,
        technologies: allDiscovered,
        era: newEra,
        knowledge_level: allDiscovered.length,
      } as Json,
    }).eq('id', clan.id)

    // Create events for each discovery
    for (const techId of newTechs) {
      const tech = TECHNOLOGIES[techId]
      if (!tech) continue

      // Find a featured person from this clan to be the discoverer
      const discoverer = clanPersons.find(p => p.is_featured) ?? clanPersons[0]

      events.push({
        world_id: worldId,
        event_type: 'ERA_TRANSITION',
        title: `${clan.name}: ${tech.eventTitle}`,
        description: `${tech.eventDescription} ${discoverer ? `${discoverer.name} leads this breakthrough for the ${clan.name}.` : ''}`,
        primary_person_id: discoverer?.id ?? null,
        culture_id: clan.id,
        significance_score: tech.significance,
        is_milestone: tech.significance >= 85,
        is_featured: tech.significance >= 85,
        in_game_day: day,
        in_game_year: year,
        metadata: { technology: techId, era: newEra } as Json,
      })
    }

    // Era transition event (if era changed)
    if (newEra !== prevEra) {
      events.push({
        world_id: worldId,
        event_type: 'ERA_TRANSITION',
        title: `${clan.name} enters the ${newEra.replace('_', ' ').toLowerCase()}`,
        description: `Through knowledge, labour, and discovery, the ${clan.name} have crossed into a new age. ${getEraDescription(newEra)}.`,
        culture_id: clan.id,
        significance_score: 98,
        is_milestone: true,
        is_featured: true,
        in_game_day: day,
        in_game_year: year,
        metadata: { prev_era: prevEra, new_era: newEra } as Json,
      })
    }
  }

  return events
}
