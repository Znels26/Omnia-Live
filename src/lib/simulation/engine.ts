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

// Stat delta for notable moments: [healthDelta, happinessDelta]
// Positive = beneficial, negative = harmful — applied immediately to the person
type StatDelta = [number, number];

function generateNotableMoment(
  p: DbPerson,
  day: number,
  year: number,
  recentTitles: string[]
): { event: PendingEvent; usedTitle: string; statDelta: StatDelta } | null {
  const name = p.name;
  const occ = (p.occupation ?? "villager").toLowerCase();

  // [title, description, healthDelta, happinessDelta]
  const pools: Record<string, Array<[string, string, number, number]>> = {
    hunter: [
      [`${name} returns with a great kill`, `After days in the wild, ${name} drags back enough meat to feed the settlement for a week. The hunt was dangerous but precise.`, 1, 3],
      [`${name} tracks something strange in the wood`, `${name} follows unusual prints into the forest. Whatever made them was large — and it knew it was being followed.`, 0, -1],
      [`${name} comes home from the hunt empty-handed`, `The forest gave nothing today. ${name} won't say what went wrong out there, but they came back quieter than usual.`, 0, -2],
      [`Something tracked ${name} back to camp`, `${name} noticed movement in the shadows behind them on the return. Whatever it was stopped at the tree line and waited. They didn't sleep well.`, -1, -2],
      [`${name} teaches the young ones to read the land`, `${name} spent the morning showing the settlement's youth how to set snares and find animal signs in the mud. The lesson landed.`, 0, 2],
      [`${name} takes a wound during the hunt`, `A close call in the undergrowth. The wound is not deep, but ${name}'s confidence took the harder blow. They are back on their feet and saying little about it.`, -2, -1],
      [`${name} discovers signs of a vast herd to the east`, `Following fresh tracks, ${name} found evidence of more animals than anyone has seen in years. The valley could eat well this season.`, 1, 3],
      [`${name} sits at the treeline and does not move for hours`, `The others watched from a distance. When ${name} finally returned, they said only that they had been thinking.`, 0, 0],
      [`${name} and a rival argue over who made the kill`, `The argument started quietly. By midday it had drawn a crowd. The kill was split, but the tension stayed.`, 0, -2],
      [`${name} misses the shot that would have mattered`, `So close. ${name} watched the opportunity vanish into the trees and said nothing for the rest of the day.`, 0, -1],
      [`${name} finds an old hunting camp, long abandoned`, `Deep in the wood, ${name} stumbled on a camp that hadn't been used in years. Old tools. Cold fire ring. Someone lived here once.`, 0, 1],
      [`${name} returns before dawn with no explanation`, `Everyone was asleep. By the time the settlement woke, ${name} was already cleaning their gear. Whatever happened out there, they're keeping it to themselves.`, -1, 0],
    ],
    farmer: [
      [`${name}'s harvest draws admiration`, `The rows ${name} has tended burst with grain. Others come to look, to learn, to copy the technique.`, 1, 3],
      [`${name} fights through the night to save the crop`, `A blight threatened the fields. ${name} worked until dawn pulling diseased stalks before it spread. By morning, most was saved.`, -1, 2],
      [`${name} tries something new with the soil`, `${name} mixes wood ash into the earth before sowing — an old idea, tested with fresh determination. No one knows yet if it will work.`, 0, 1],
      [`${name}'s field fails to yield`, `The seeds went in right. The rain came when it should. But the crop came up thin and pale. ${name} stares at the rows and says nothing.`, 0, -3],
      [`${name} argues with a neighbour over water rights`, `The irrigation channel only carries so much. Voices were raised. The matter is paused, not settled.`, 0, -2],
      [`A late frost threatens everything ${name} has grown`, `The temperature dropped overnight. ${name} woke before anyone else and ran to the fields. Some plants will not recover.`, -1, -2],
      [`${name} shares seed with a family who lost theirs`, `No one asked them to. ${name} simply came by with a portion of their store and left it without ceremony.`, 0, 2],
      [`${name} notices something wrong with the soil near the river`, `The earth is darker than it should be. Smells different. ${name} doesn't know what it means yet, but they've been checking every day.`, 0, -1],
      [`${name} teaches a child to tell good earth from bad`, `The lesson took most of the afternoon. The child paid attention. ${name} was not a patient teacher, but they were a thorough one.`, 0, 2],
      [`${name} works the field alone well past dark`, `The others went in when the light faded. ${name} stayed. There is something in the work that quiets their mind.`, -1, 1],
      [`${name}'s crop comes in after a long dry spell`, `Three seasons of uncertainty. One good morning. ${name} stood in the field for a while before cutting the first stalks.`, 1, 3],
    ],
    healer: [
      [`${name} pulls someone back from the edge`, `A fever that had lasted three days broke this morning. ${name} never left the patient's side.`, 1, 3],
      [`${name} loses a patient despite everything`, `Sometimes there is nothing to be done. ${name} knew before the end came. The knowing does not make it easier.`, 0, -3],
      [`${name} grinds new herbs by firelight`, `${name} is trying a remedy no one has used here before — something remembered from a distant elder's teaching.`, 0, 1],
      [`${name} suspects something is spreading through the camp`, `Three people with the same symptoms in two days. ${name} is watching carefully, saying little, and moving quickly.`, -1, -1],
      [`${name} tends the wounded without complaint`, `After a rough stretch in the valley, ${name} moves from person to person, setting bones, cleaning wounds. They do not rest until every hand is seen to.`, -1, 2],
      [`${name} sits with a dying elder through the night`, `There was nothing left to treat. So ${name} just sat. The elder did not die alone, and that was the whole medicine of it.`, 0, -2],
      [`${name} is asked for something beyond medicine`, `The request came quietly, after dark. ${name} listened. Whatever was asked, the answer took a long time coming.`, 0, 0],
      [`${name} refuses to share a remedy with a rival settlement`, `The need was real. But so was ${name}'s caution. They weighed it carefully and said no.`, 0, -1],
      [`${name} recognises a wound pattern they've seen before`, `The injury is unusual. ${name} went still when they saw it. Then they began to work very quickly.`, 0, -1],
      [`${name} is changed by a patient's final words`, `The elder said something before the end. ${name} has not repeated it. But something in them is different since.`, 0, 1],
    ],
    trader: [
      [`${name} strikes an unexpected deal`, `A traveller passed through and ${name} bartered well — what left as surplus returned as something the settlement badly needed.`, 0, 3],
      [`${name} gets the worst of an exchange`, `The trade seemed sound. It wasn't. ${name} realised it too late and has been trying to work out how they were fooled.`, 0, -2],
      [`${name} argues the clan's worth in open market`, `Voices were raised. ${name} held firm. The terms, in the end, favoured the clan.`, 0, 2],
      [`${name} returns from the road with news, not goods`, `The cargo was modest. But the information ${name} brought back is worth more than any pack animal could carry.`, 0, 1],
      [`${name} brokers a peace between two disputing families`, `No one asked them to. ${name} simply saw the opportunity and took it. Both families owe them something now.`, 0, 2],
      [`${name} suspects they were robbed on the road`, `Nothing is missing that can be proved. But the count is wrong, and ${name} knows the road between here and there.`, -1, -2],
      [`${name} maps the next trade route carefully`, `${name} notes which paths are passable, which tolls are fair, and which traders are worth trusting next season.`, 0, 1],
    ],
    guard: [
      [`${name} holds the line through the night`, `Something circled the settlement in the dark. ${name} did not sleep. At dawn, it was gone.`, -1, 0],
      [`${name} catches a trespasser near the storehouse`, `A stranger was found too close to the food stores. ${name} handled it firmly — no blood spilled, but the message was received.`, 0, 2],
      [`${name} drills the others until every stance is right`, `${name} ran the settlement's defenders through their paces. No one enjoyed it. Everyone is sharper for it.`, -1, 1],
      [`${name} stands at the perimeter and hears nothing — which worries them more`, `Silence in the wood is not always peace. ${name} stood at the edge a long time, reading the quiet for what it wasn't saying.`, 0, -1],
      [`${name} recognises someone on the road they shouldn't`, `From a distance, in poor light. But ${name} is certain. They said nothing to the others. Not yet.`, 0, -1],
      [`${name} questions a decision they made under pressure`, `It was the right call in the moment. Maybe. ${name} has been running it back in their mind, looking for the mistake.`, 0, -1],
      [`${name} warns of danger that others dismiss`, `The signs are there if you know how to look. ${name} has reported them twice now. The settlement is listening less carefully each time.`, 0, -2],
    ],
    scout: [
      [`${name} brings back word of movement beyond the ridge`, `Something is changing in the lands to the north. ${name}'s report is brief but urgent.`, 0, -1],
      [`${name} finds a path no one knew existed`, `Following the river upstream, ${name} discovered a narrow pass through the stone heights. It could matter greatly.`, 1, 3],
      [`${name} loses the trail and returns with nothing`, `Three days out, nothing to show for it. ${name} will try again, but the doubt is visible to anyone who knows them.`, -1, -2],
      [`${name} maps the full extent of the valley`, `${name} spent the day walking the boundary. What they found is both reassuring and troubling. The valley is larger than most know.`, 0, 1],
      [`${name} has a close encounter beyond the border`, `They won't describe it in detail. Only that they ran. Only that they made it back. Only that whatever it was, it was organised.`, -2, -2],
      [`${name} finds the ruins of an old settlement`, `The stones were small. Collapsed. No one there to ask what happened. ${name} stood in it for a while before coming back.`, 0, -1],
    ],
    fisher: [
      [`${name} hauls in more than expected`, `The net came up heavy this morning. ${name} worked the river for hours, reading the currents like an old friend.`, 1, 2],
      [`${name} finds a new stretch of river`, `Upstream, where most don't go, ${name} found still water full of fish. Tomorrow there will be enough for everyone.`, 1, 3],
      [`${name}'s nets come up empty for the third day`, `The fish have moved, or been scared off, or there are simply fewer of them. ${name} is not saying which they think it is.`, 0, -2],
      [`${name} watches the river change`, `The colour is different lately. The flow too. ${name} has been fishing here for years and something is not the same.`, 0, -1],
      [`${name} pulls up something strange in the net`, `Not a fish. Not exactly. ${name} cut it loose and threw it back without showing anyone. They've been quiet about it since.`, 0, -1],
    ],
    crafter: [
      [`${name} finishes something remarkable`, `${name} holds it up to the light — whatever it is, it's better than anything made here before. People gather to look.`, 1, 3],
      [`${name} solves a problem that stumped the others`, `The tool kept breaking. ${name} studied the break, changed the angle, chose a different material. It holds now.`, 0, 2],
      [`${name} works through the night on an idea`, `The fire in the workshop burned until dawn. Whatever ${name} is making, it cannot wait.`, -1, 1],
      [`${name}'s work falls apart on the final step`, `Hours of careful craft, undone at the end. ${name} sat with the pieces for a long time. Then they started over.`, 0, -2],
      [`${name} teaches their method to whoever will stay and learn`, `Not everyone has the patience for it. The few who did got something that cannot be untaught.`, 0, 2],
      [`${name} finds a material no one here has worked with before`, `Where they found it, they haven't said. What it can become, they're still figuring out. They seem excited in the way of someone who knows they're onto something.`, 0, 3],
    ],
    leader: [
      [`${name} settles a dispute before it turns bitter`, `Two voices were raised. ${name} listened to both, said little, and found the middle ground. The valley is quieter for it.`, 0, 2],
      [`${name} faces a decision with no good answer`, `Whichever way this goes, someone suffers. ${name} has been sitting with it for days. The clan is watching.`, 0, -2],
      [`${name} speaks of what is coming`, `Gathered around the fire, the clan listened as ${name} laid out the season ahead — the risks, the work, the hope. Most were reassured. Not all.`, 0, 1],
      [`${name} earns quiet respect`, `No grand gesture. Just steady presence, sound decisions, and a word at the right moment. ${name}'s standing grows.`, 0, 3],
      [`${name}'s authority is tested openly`, `Someone spoke against a decision in front of the whole settlement. ${name} heard them out fully before responding.`, 0, -1],
      [`${name} meets with a leader from another clan`, `The meeting was brief and cautious. Neither side gave much away. But it happened, which is more than before.`, 0, 1],
    ],
  };

  const defaultPool: Array<[string, string, number, number]> = [
    [`${name} leaves a mark on the day`, `A quiet act, a moment of clarity. ${name} did what needed doing, and the valley is better for it.`, 0, 1],
    [`${name} is noticed by those who pay attention`, `Word of ${name}'s recent work has spread. Not loudly — but those with sharp eyes have taken note.`, 0, 1],
    [`${name} sits apart from the others and watches`, `From a distance, ${name} observes the daily life of the valley. What they're thinking is not easy to guess.`, 0, 0],
    [`${name} does something no one expected`, `No one was prepared for it. Neither, perhaps, was ${name}. But it happened, and it won't be forgotten soon.`, 0, 1],
  ];

  const poolKey = Object.keys(pools).find(k => occ.includes(k)) ?? "default";
  const pool = pools[poolKey] ?? defaultPool;

  // Deduplicate: filter out titles used recently, fall back to full pool if exhausted
  const available = pool.filter(([title]) => !recentTitles.includes(title));
  const usePool = available.length > 0 ? available : pool;

  const pick = usePool[Math.floor(Math.random() * usePool.length)];

  // Score significance from the magnitude of stat impact — avoids flat 55 for everything
  const impactMagnitude = Math.abs(pick[2]) + Math.abs(pick[3]);
  const significance = impactMagnitude >= 4 ? 55 : impactMagnitude >= 2 ? 35 : 20;

  return {
    event: {
      world_id: p.world_id,
      event_type: "CUSTOM",
      title: pick[0],
      description: pick[1],
      primary_person_id: p.id,
      settlement_id: p.residence_id,
      significance_score: significance,
      is_milestone: false,
      is_featured: false,
      in_game_day: day,
      in_game_year: year,
      metadata: { occupation: p.occupation, action: p.current_action },
    },
    usedTitle: pick[0],
    statDelta: [pick[2], pick[3]] as StatDelta,
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
  }

  // Progress skills from current action
  const currentSkills = getPersonSkills(p.metadata)
  const { skills: updatedSkills, changed: skillChanged } = progressSkillFromAction(currentSkills, p.current_action)

  // Build updated metadata (skills + event dedup)
  const baseMeta = (p.metadata ?? {}) as Record<string, unknown>;
  const recentEventTitles: string[] = Array.isArray(baseMeta.recentEventTitles)
    ? (baseMeta.recentEventTitles as string[])
    : [];

  const metaPatch: Record<string, unknown> = {};

  // Notable moments — featured chars get ~1 per 3 minutes, non-featured ~1 per 10 minutes
  const momentChance = p.is_featured ? 0.005 : 0.0015;
  if (roll < momentChance) {
    const notableResult = generateNotableMoment(p, day, year, recentEventTitles);
    if (notableResult) {
      events.push(notableResult.event);
      metaPatch.recentEventTitles = [notableResult.usedTitle, ...recentEventTitles].slice(0, 10);
      // Apply real stat consequences from the event
      const [hDelta, hapDelta] = notableResult.statDelta;
      if (hDelta !== 0) health = clamp(health + hDelta, 1, 100);
      if (hapDelta !== 0) happiness = clamp(happiness + hapDelta, 1, 100);
    }
  }

  if (skillChanged) metaPatch.skills = updatedSkills;

  const metaChanged = Object.keys(metaPatch).length > 0;
  const updatedMetadata = metaChanged ? { ...baseMeta, ...metaPatch } : p.metadata;

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
      ...(metaChanged ? { metadata: updatedMetadata as import('@/types/database').Json } : {}),
    },
    events,
  };
}

// ---------------------------------------------------------------------------
// World-level event generation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Birth names pool — draw from without replacement via a simple cycle
// ---------------------------------------------------------------------------
const BIRTH_NAMES = [
  "Asha","Bren","Cael","Dara","Elin","Fion","Gwen","Hale","Ivy","Jael",
  "Kael","Lyra","Mira","Nael","Oryn","Prae","Quen","Rael","Sera","Tael",
  "Uren","Vela","Wren","Xael","Yara","Zael","Arne","Bela","Cira","Dren",
  "Egan","Fara","Gael","Hira","Ilan","Jora","Kira","Lorn","Mael","Nora",
];

async function generateWorldEvents(
  db: ReturnType<typeof createAdminClient>,
  worldId: string,
  persons: DbPerson[],
  settlements: DbSettlement[],
  cultures: DbCulture[],
  day: number,
  year: number
): Promise<PendingEvent[]> {
  const events: PendingEvent[] = [];
  const alive = persons.filter((p) => p.is_alive);

  // ── Birth: ~1 per 8 minutes at 3s/tick (0.6% chance per tick) ──────────────
  const fertile = alive.filter((p) => p.age >= 16 && p.age <= 45);
  if (fertile.length >= 2 && Math.random() < 0.006) {
    const parent = fertile[Math.floor(Math.random() * fertile.length)];
    const childName = BIRTH_NAMES[Math.floor(Math.random() * BIRTH_NAMES.length)];
    const crossClanParent = alive.find(p => p.culture_id !== parent.culture_id && p.age >= 16 && p.age <= 45);
    const otherParentName = crossClanParent?.name;

    const birthDescs = [
      `${childName} is born before dawn, small and loud. ${parent.name} does not sleep. By morning, the whole settlement knows.`,
      `${parent.name} holds ${childName} for the first time — a new life in the valley, one more soul to feed and protect.`,
      `The birth was hard. ${parent.name} survived it. So did ${childName}. The valley has one more person now.`,
      otherParentName
        ? `Born of two clans, ${childName} enters the world. ${parent.name} of the ${cultures.find(c=>c.id===parent.culture_id)?.name??'valley'} and ${otherParentName} stand together. The child bridges old divides.`
        : `A cry in the night. By morning ${childName} is here — new lungs, new hunger, new hope.`,
    ].filter(Boolean) as string[];

    // Actually create the child as a new person in DB
    try {
      await db.from("persons").insert({
        world_id: worldId,
        name: childName,
        age: 0,
        life_stage: "infant",
        occupation: null,
        is_alive: true,
        is_featured: false,
        health_score: 8,
        happiness_score: 7,
        need_hunger: 5,
        need_stress: 2,
        need_hope: 3,
        need_fatigue: 3,
        need_belonging: 4,
        need_safety: 3,
        culture_id: parent.culture_id,
        residence_id: parent.residence_id,
        pos_x: parent.pos_x + Math.round((Math.random()-0.5)*20),
        pos_y: parent.pos_y + Math.round((Math.random()-0.5)*15),
        trait_ambition: 5, trait_aggression: 3, trait_loyalty: 6,
        trait_sociability: 6, trait_curiosity: 7, trait_spirituality: 4,
        trait_generosity: 5, trait_honesty: 7, trait_vindictiveness: 2,
        current_action: "Sleeping in their mother\'s arms",
        metadata: { backstory: `Child of ${parent.name}, born on day ${day} of year ${year}.` },
      });
      // Boost parent happiness
      await db.from("persons").update({ happiness_score: Math.min(10, (parent.happiness_score ?? 6) + 2) }).eq("id", parent.id);
    } catch { /* non-fatal */ }

    events.push({
      world_id: worldId,
      event_type: "BIRTH",
      title: `${childName} is born into the valley`,
      description: birthDescs[Math.floor(Math.random() * birthDescs.length)],
      primary_person_id: parent.id,
      settlement_id: parent.residence_id,
      significance_score: 40,
      is_milestone: false,
      is_featured: false,
      in_game_day: day,
      in_game_year: year,
      metadata: { child_name: childName, parent_name: parent.name },
    });
  }

  // ── Marriage: ~1 per 20 minutes (0.25% chance). Prefer same-clan but allow cross-clan ──
  if (alive.length >= 4 && Math.random() < 0.0025) {
    const adults = alive.filter((p) => p.age >= 18 && p.age <= 50);
    if (adults.length >= 2) {
      // 70% same-clan, 30% cross-clan
      const crossClan = Math.random() < 0.3 && cultures.length >= 2;
      let a = adults[Math.floor(Math.random() * adults.length)];
      let b: typeof a | undefined;

      if (crossClan) {
        // Pick b from a different clan
        const otherClan = adults.filter(p => p.culture_id !== a.culture_id);
        b = otherClan[Math.floor(Math.random() * otherClan.length)];
      } else {
        const sameClan = adults.filter(p => p.culture_id === a.culture_id && p.id !== a.id);
        b = sameClan[Math.floor(Math.random() * sameClan.length)];
        if (!b) b = adults.find(p => p.id !== a.id);
      }

      if (b) {
        const clanA = cultures.find(c => c.id === a.culture_id)?.name ?? "the valley";
        const clanB = cultures.find(c => c.id === b.culture_id)?.name ?? "the valley";
        const isCrossMarriage = a.culture_id !== b.culture_id;

        const marriageDescs = isCrossMarriage ? [
          `${a.name} of the ${clanA} and ${b.name} of the ${clanB} are joined at the river crossing. Both clans attended. Both clans watched the other carefully.`,
          `A union no one expected. ${a.name} and ${b.name} come from different peoples — different customs, different fires. They chose each other anyway.`,
          `The ${clanA} and the ${clanB} share a fire for the first time in memory. ${a.name} and ${b.name} are the reason.`,
        ] : [
          `${a.name} and ${b.name} made their vows at dusk, the fire between them. The settlement feasted late into the night.`,
          `${a.name} and ${b.name} stood before the clan and spoke plainly. Two households, one hearth.`,
          `${a.name} and ${b.name} have been inseparable for months. Now it is made formal.`,
        ];

        // Create relationship record
        try {
          await db.from("relationships").insert({
            world_id: worldId,
            person_a_id: a.id,
            person_b_id: b.id,
            relationship_type: "spouse",
            trust: 8, attraction: 7, resentment: 0,
            is_active: true,
            started_day: day,
          });
          // Move b to live near a, boost both happiness
          await db.from("persons").update({
            pos_x: Math.max(30, Math.min(770, a.pos_x + Math.round((Math.random()-0.5)*30))),
            pos_y: Math.max(50, Math.min(510, a.pos_y + Math.round((Math.random()-0.5)*25))),
            happiness_score: Math.min(10, (b.happiness_score ?? 6) + 3),
            residence_id: a.residence_id,
          }).eq("id", b.id);
          await db.from("persons").update({ happiness_score: Math.min(10, (a.happiness_score ?? 6) + 3) }).eq("id", a.id);

          // Cross-clan marriage improves relations between clans
          if (isCrossMarriage) {
            const aMeta = ((cultures.find(c=>c.id===a.culture_id) as any)?.metadata ?? {}) as Record<string,unknown>;
            const aRels = (aMeta.relations as Record<string,string>) ?? {};
            if ((aRels[b.culture_id!] ?? "neutral") !== "hostile") {
              aRels[b.culture_id!] = "allied";
              await db.from("cultures").update({ metadata: { ...aMeta, relations: aRels } }).eq("id", a.culture_id!);
            }
          }
        } catch { /* non-fatal */ }

        events.push({
          world_id: worldId,
          event_type: "MARRIAGE",
          title: isCrossMarriage
            ? `${a.name} (${clanA}) and ${b.name} (${clanB}) are joined — two clans, one hearth`
            : `${a.name} and ${b.name} are joined`,
          description: marriageDescs[Math.floor(Math.random() * marriageDescs.length)],
          primary_person_id: a.id,
          settlement_id: a.residence_id,
          significance_score: isCrossMarriage ? 70 : 45,
          is_milestone: isCrossMarriage,
          is_featured: isCrossMarriage,
          in_game_day: day,
          in_game_year: year,
          metadata: { person_a: a.name, person_b: b.name, cross_clan: isCrossMarriage },
        });
      }
    }
  }

  // ── Crime / betrayal: ~1 per 5 minutes (0.3% chance) ─────────────────────
  if (Math.random() < 0.003 && alive.length > 0) {
    const offender = alive[Math.floor(Math.random() * alive.length)];
    // Cross-clan crimes raise tension between clans
    const victim = alive.find(p => p.id !== offender.id && Math.random() < 0.4);
    const crossClanCrime = victim && victim.culture_id !== offender.culture_id;

    const crimePool: Array<[string, string, string, number]> = [
      ["theft", `${offender.name} caught stealing from the storehouse`,
        `Three days' worth of grain, gone. Eyes turned to ${offender.name}. The accused said nothing. Tensions are high.`, 30],
      ["assault", `${offender.name} strikes ${victim?.name ?? "a valley dweller"}`,
        `Voices raised, then fists. ${offender.name} struck first. The injured party is recovering. The matter is not yet settled.`, 40],
      ["poaching", `${offender.name} caught hunting on ${crossClanCrime ? `${cultures.find(c=>c.id===victim?.culture_id)?.name??'another clan'}'s land` : "forbidden ground"}`,
        `The tracks led back to ${offender.name}. ${crossClanCrime ? `The ${cultures.find(c=>c.id===victim?.culture_id)?.name??'other clan'} has heard. This will not be forgotten.` : "A line was crossed."}`, crossClanCrime ? 55 : 30],
      ["deception", `${offender.name} caught in a lie`,
        `A trade turned sour when the truth emerged. ${offender.name} knew all along. Trust is harder to rebuild than a fence.`, 35],
    ];
    const [crime, crimeTitle, crimeDesc, sig] = crimePool[Math.floor(Math.random() * crimePool.length)];

    // Cross-clan crimes raise inter-clan tension
    if (crossClanCrime && victim) {
      try {
        const offMeta = (persons.find(p=>p.id===offender.id) as any)?.metadata ?? {};
        const clanMeta = ((await db.from("cultures").select("metadata").eq("id", offender.culture_id!).single()).data?.metadata ?? {}) as Record<string,unknown>;
        const clanRels = (clanMeta.relations as Record<string,string>) ?? {};
        const clanTensions = (clanMeta.tensions as Record<string,number>) ?? {};
        clanTensions[victim.culture_id!] = Math.min(100, (clanTensions[victim.culture_id!] ?? 0) + 15);
        await db.from("cultures").update({ metadata: { ...clanMeta, relations: clanRels, tensions: clanTensions } }).eq("id", offender.culture_id!);
      } catch { /* non-fatal */ }
    }

    // Harm victim's health slightly
    if (victim && crime === "assault") {
      await db.from("persons").update({ health_score: Math.max(1, (victim.health_score ?? 7) - 1) }).eq("id", victim.id);
    }

    events.push({
      world_id: worldId,
      event_type: "BETRAYAL",
      title: crimeTitle,
      description: crimeDesc,
      primary_person_id: offender.id,
      settlement_id: offender.residence_id,
      significance_score: sig,
      is_milestone: false,
      is_featured: crossClanCrime ?? false,
      in_game_day: day,
      in_game_year: year,
      metadata: { crime, cross_clan: crossClanCrime },
    });
  }

  // ── Seasonal milestone (every 91 days) ────────────────────────────────────
  if (day % 91 === 0 && day > 0) {
    const seasons = ["spring", "summer", "autumn", "winter"];
    const season = seasons[Math.floor((day / 91) % 4)];
    const seasonDescs: Record<string, string> = {
      spring: "The frost breaks. Hunting parties head out at first light. The fields are turned and seeded. The valley breathes again.",
      summer: "Long days, heavy work. The crops grow tall. Children run. The elders watch the sky for signs of drought.",
      autumn: "Harvest time. Everything that can be stored, is stored. The nights grow longer. The question is always: will it be enough?",
      winter: "The valley hunkers down. Fires burn low but constant. Stories are told. Old grievances are remembered, and new plans are made.",
    };
    events.push({
      world_id: worldId,
      event_type: "RITUAL",
      title: `${season.charAt(0).toUpperCase() + season.slice(1)} comes to First Valley`,
      description: seasonDescs[season],
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

  // ── Year milestone ────────────────────────────────────────────────────────
  if (day % 365 === 0 && day > 0) {
    const pop = alive.length;
    events.push({
      world_id: worldId,
      event_type: "ERA_TRANSITION",
      title: `Year ${year} begins in First Valley`,
      description: `Another year has turned. ${pop} souls remain in the valley. Some have grown. Some have left. Some will not see another year.`,
      primary_person_id: null,
      settlement_id: null,
      significance_score: 85,
      is_milestone: true,
      is_featured: true,
      in_game_day: day,
      in_game_year: year,
      metadata: { year, population: pop },
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
    const tensions = (meta.tensions as Record<string, number>) ?? {};

    // ── Active war: run battle ticks ──────────────────────────────────────
    for (const [enemyId, relation] of Object.entries(relations)) {
      if (relation !== "hostile") continue;

      const enemy = cultures.find((c) => c.id === enemyId);
      if (!enemy || enemy.population_estimate <= 0) {
        relations[enemyId] = "neutral";
        tensions[enemyId] = 0;
        events.push({
          world_id: worldId,
          event_type: "CUSTOM",
          title: `${culture.name} claims victory over ${enemy?.name ?? "their enemy"}`,
          description: `The long conflict ends. The ${culture.name} stand victorious. The valley will remember what was lost on both sides.`,
          primary_person_id: null, settlement_id: null,
          significance_score: 95, is_milestone: true, is_featured: true,
          in_game_day: day, in_game_year: year,
          metadata: { victor: culture.id, defeated: enemyId },
        });
        continue;
      }

      // Process each war pair once (lower ID runs it)
      if (culture.id < enemy.id) {
        const attackerLoss = Math.floor(Math.random() * 3);
        const defenderLoss = Math.floor(Math.random() * 3);
        await db.from("cultures").update({ population_estimate: Math.max(0, culture.population_estimate - attackerLoss) }).eq("id", culture.id);
        await db.from("cultures").update({ population_estimate: Math.max(0, enemy.population_estimate - defenderLoss) }).eq("id", enemy.id);

        // Injure random warriors from each side
        const warriors = await db.from("persons").select("id, health_score, occupation")
          .eq("world_id", worldId).eq("is_alive", true).limit(50);
        const warPersons = (warriors.data ?? []) as Array<{id:string; health_score:number; occupation:string|null; culture_id?:string}>;
        const sideA = warPersons.filter(p => p.culture_id === culture.id && /warrior|guard|soldier|scout/i.test(p.occupation ?? ""));
        const sideB = warPersons.filter(p => p.culture_id === enemy.id && /warrior|guard|soldier|scout/i.test(p.occupation ?? ""));
        for (const warrior of sideA.slice(0,1)) {
          if (Math.random() < 0.3) await db.from("persons").update({ health_score: Math.max(1, warrior.health_score - 2) }).eq("id", warrior.id);
        }
        for (const warrior of sideB.slice(0,1)) {
          if (Math.random() < 0.3) await db.from("persons").update({ health_score: Math.max(1, warrior.health_score - 2) }).eq("id", warrior.id);
        }

        // Visible battle event (30% chance per tick to avoid noise)
        if (Math.random() < 0.3) {
          const attackerWins = attackerLoss < defenderLoss;
          const battleDescs = [
            `${culture.name} warriors push into ${enemy.name} territory at dawn. ${attackerWins ? `The ${enemy.name} line breaks.` : `They are driven back before midday.`}`,
            `A skirmish at the river crossing. Both sides bleed. Neither yields ground. The valley holds its breath.`,
            `${attackerWins ? culture.name : enemy.name} fighters seize a hill overlooking the valley. The other side regroups in the shadow of the treeline.`,
            `Bodies are carried home from both camps. Children watch in silence. The elders say nothing they haven't said before.`,
          ];
          events.push({
            world_id: worldId, event_type: "BATTLE",
            title: `${culture.name} and ${enemy.name} — the war continues`,
            description: battleDescs[Math.floor(Math.random() * battleDescs.length)],
            primary_person_id: null, settlement_id: null,
            significance_score: 70, is_milestone: false, is_featured: true,
            in_game_day: day, in_game_year: year,
            metadata: { attacker: culture.id, defender: enemy.id, attacker_loss: attackerLoss, defender_loss: defenderLoss },
          });
        }

        // Peace: 1.5% chance per tick once started (~7 real minutes)
        if (Math.random() < 0.015) {
          relations[enemyId] = "neutral";
          tensions[enemyId] = 20; // lingering tension even after peace
          const enemyMeta = (enemy.metadata ?? {}) as Record<string, unknown>;
          const enemyRelations = (enemyMeta.relations as Record<string, string>) ?? {};
          const enemyTensions = (enemyMeta.tensions as Record<string, number>) ?? {};
          enemyRelations[culture.id] = "neutral";
          enemyTensions[culture.id] = 20;
          await db.from("cultures").update({ metadata: { ...enemyMeta, relations: enemyRelations, tensions: enemyTensions } }).eq("id", enemy.id);

          const peaceDescs = [
            `Exhausted and bloodied, the ${culture.name} and the ${enemy.name} send word through a neutral messenger. Fighting stops. For now.`,
            `A child from one clan is found sheltering with the other. Something in the valley shifts. The fighting pauses — then stops.`,
            `Terms are spoken at the tree line. Both sides give something. Both sides lose something. The valley can breathe.`,
          ];
          events.push({
            world_id: worldId, event_type: "PEACE_TREATY",
            title: `${culture.name} and ${enemy.name} agree to cease fighting`,
            description: peaceDescs[Math.floor(Math.random() * peaceDescs.length)],
            primary_person_id: null, settlement_id: null,
            significance_score: 85, is_milestone: true, is_featured: true,
            in_game_day: day, in_game_year: year,
            metadata: { clan_a: culture.id, clan_b: enemy.id },
          });
        }
      }
    }

    // ── Tension escalation: passive drift and triggering war ─────────────
    // Tensions naturally decay toward zero when no incidents
    for (const otherId of Object.keys(tensions)) {
      tensions[otherId] = Math.max(0, tensions[otherId] - 0.2);
      if (tensions[otherId] < 1) delete tensions[otherId];
    }

    // Aggressive clans slowly build tension with their closest rival
    if (culture.aggression_level > 40) {
      const rivals = cultures.filter(c => c.id !== culture.id && c.population_estimate > 3 && (relations[c.id] ?? "neutral") !== "hostile");
      if (rivals.length > 0) {
        const rival = rivals[Math.floor(Math.random() * rivals.length)];
        // Tension drifts up slowly (0–0.8 per tick based on aggression)
        const drift = (culture.aggression_level - 40) / 100 * 0.8;
        tensions[rival.id] = Math.min(100, (tensions[rival.id] ?? 0) + drift);

        // Tension event thresholds: 40 = warning, 70 = skirmish, 100 = war
        const tension = tensions[rival.id];

        if (tension >= 40 && tension < 42) {
          // One-time warning event at threshold
          const tensionDescs = [
            `The ${culture.name} and the ${rival.name} have begun to eye each other across the valley. Hunters stray close to the border. Words are exchanged that cannot be taken back.`,
            `Something has shifted between the ${culture.name} and the ${rival.name}. Travelers report cold looks and closed gates. The valley feels smaller.`,
            `${culture.name} scouts have been seen near ${rival.name} territory. Both clans are counting their warriors. Nobody is saying the word yet.`,
          ];
          events.push({
            world_id: worldId, event_type: "CUSTOM",
            title: `Tension rises between ${culture.name} and ${rival.name}`,
            description: tensionDescs[Math.floor(Math.random() * tensionDescs.length)],
            primary_person_id: null, settlement_id: null,
            significance_score: 55, is_milestone: false, is_featured: true,
            in_game_day: day, in_game_year: year,
            metadata: { clan_a: culture.id, clan_b: rival.id, tension },
          });
        }

        if (tension >= 70 && tension < 73 && Math.random() < 0.5) {
          // Skirmish before full war
          const skirmishDescs = [
            `A ${culture.name} hunting party crosses into ${rival.name} land. Arrows are exchanged. Two people are injured. Nobody dead — yet.`,
            `${culture.name} and ${rival.name} warriors meet on the border road. A ${culture.name} fighter throws the first stone. The ${rival.name} respond with spears.`,
            `A ${rival.name} storehouse near the border is raided at night. Everyone knows who did it. Nobody can prove it. The ${rival.name} are sharpening blades.`,
          ];
          events.push({
            world_id: worldId, event_type: "BATTLE",
            title: `${culture.name} and ${rival.name}: first blood`,
            description: skirmishDescs[Math.floor(Math.random() * skirmishDescs.length)],
            primary_person_id: null, settlement_id: null,
            significance_score: 75, is_milestone: false, is_featured: true,
            in_game_day: day, in_game_year: year,
            metadata: { clan_a: culture.id, clan_b: rival.id, tension },
          });
          // Injure someone from each side
          for (const clanId of [culture.id, rival.id]) {
            const clanPeople = await db.from("persons").select("id, health_score").eq("world_id", worldId).eq("culture_id", clanId).eq("is_alive", true).limit(5);
            const victim = (clanPeople.data ?? [])[Math.floor(Math.random() * (clanPeople.data?.length ?? 1))];
            if (victim) await db.from("persons").update({ health_score: Math.max(1, victim.health_score - 2) }).eq("id", victim.id);
          }
        }

        if (tension >= 100 && (relations[rival.id] ?? "neutral") !== "hostile") {
          // War declaration — tension reached boiling point
          relations[rival.id] = "hostile";
          tensions[rival.id] = 100;
          const rivalMeta = (rival.metadata ?? {}) as Record<string, unknown>;
          const rivalRelations = (rivalMeta.relations as Record<string, string>) ?? {};
          const rivalTensions = (rivalMeta.tensions as Record<string, number>) ?? {};
          rivalRelations[culture.id] = "hostile";
          rivalTensions[culture.id] = 100;
          await db.from("cultures").update({ metadata: { ...rivalMeta, relations: rivalRelations, tensions: rivalTensions } }).eq("id", rival.id);

          const warDescs = [
            `What began with stolen game and sharp words ends with drawn weapons. The ${culture.name} march on the ${rival.name}. The valley is at war.`,
            `For seasons the ${culture.name} and ${rival.name} circled each other, testing the boundary. Today someone crossed it for the last time.`,
            `The ${culture.name} leader stood before the fire and named the ${rival.name} their enemy. Before dawn the first raiding party left camp.`,
          ];
          events.push({
            world_id: worldId, event_type: "WAR_DECLARED",
            title: `War: ${culture.name} rises against ${rival.name}`,
            description: warDescs[Math.floor(Math.random() * warDescs.length)],
            primary_person_id: null, settlement_id: null,
            significance_score: 95, is_milestone: true, is_featured: true,
            in_game_day: day, in_game_year: year,
            metadata: { aggressor: culture.id, target: rival.id },
          });

          // Move warriors toward enemy territory
          const warriors = await db.from("persons").select("id, pos_x, pos_y, occupation, culture_id")
            .eq("world_id", worldId).eq("culture_id", culture.id).eq("is_alive", true).limit(30);
          const rivalSettlement = await db.from("settlements").select("position_x, position_y").eq("culture_id", rival.id).limit(1).single();
          if (rivalSettlement.data) {
            const rx = Number(rivalSettlement.data.position_x);
            const ry = Number(rivalSettlement.data.position_y);
            for (const p of (warriors.data ?? [])) {
              if (/warrior|guard|soldier|scout/i.test(p.occupation ?? "")) {
                await db.from("persons").update({
                  pos_x: Math.round(Number(p.pos_x) + (rx - Number(p.pos_x)) * 0.5),
                  pos_y: Math.round(Number(p.pos_y) + (ry - Number(p.pos_y)) * 0.5),
                  current_action: `Marching to war against the ${rival.name}`,
                }).eq("id", p.id);
              }
            }
          }
        }
      }
    }

    // Update culture metadata with new relations and tensions
    await db.from("cultures").update({ metadata: { ...meta, relations, tensions } }).eq("id", culture.id);
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
    const dbCultures = (culturesRes.data ?? []) as DbCulture[];
    const cultures = dbCultures.map(dbCultureToSimClan);

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

    // World-level events (async — births create real persons, crimes update tensions)
    const worldEvents = await generateWorldEvents(db, world.id, persons, settlements, dbCultures, newDay, newYear);
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
