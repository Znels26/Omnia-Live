import {
  SimClan,
  SimBeing,
  SimEvent,
  WorldState,
  EventType,
  EventCategory,
} from "./types";
import { pickRandom, randomInt, clamp } from "../utils";
import { nanoid } from "nanoid";

interface EventTemplate {
  type: EventType;
  category: EventCategory;
  importance: number;
  condition: (state: WorldState) => boolean;
  generate: (state: WorldState) => Omit<SimEvent, "id" | "worldId" | "tick" | "worldTime" | "createdAt"> | null;
}

function evt(
  worldId: string,
  tick: number,
  worldTime: number,
  data: Omit<SimEvent, "id" | "worldId" | "tick" | "worldTime" | "createdAt">
): SimEvent {
  return {
    id: nanoid(),
    worldId,
    tick,
    worldTime,
    createdAt: new Date(),
    ...data,
    highlighted: data.highlighted ?? data.importance > 75,
  };
}

const EVENT_TEMPLATES: EventTemplate[] = [
  // Survival events
  {
    type: "FAMINE",
    category: "SURVIVAL",
    importance: 80,
    condition: (state) => state.beings.some((b) => b.hunger < 15 && b.status === "ALIVE"),
    generate: (state) => {
      const starving = state.beings.filter((b) => b.hunger < 15 && b.status === "ALIVE");
      if (starving.length === 0) return null;
      const clan = state.clans.find((c) => c.id === starving[0].clanId);
      return {
        type: "FAMINE",
        category: "SURVIVAL",
        title: `Famine grips ${clan?.name ?? "the valley"}`,
        description: `${starving.length} souls face starvation as food becomes desperately scarce. The hunters have returned empty-handed for the third day.`,
        impact: "Population at risk. Clans may migrate or become desperate.",
        importance: 80,
        highlighted: true,
        clanId: clan?.id,
        x: clan?.x,
        y: clan?.y,
        metadata: { starvingCount: starving.length },
      };
    },
  },

  // Social events
  {
    type: "MARRIAGE",
    category: "SOCIAL",
    importance: 55,
    condition: (state) =>
      state.beings.filter((b) => b.status === "ALIVE" && b.age > 16 && b.lifeStage !== "CHILD").length >= 2,
    generate: (state) => {
      const eligible = state.beings.filter(
        (b) => b.status === "ALIVE" && b.age > 16 && b.lifeStage !== "CHILD" && b.happiness > 40
      );
      if (eligible.length < 2) return null;
      const partner1 = pickRandom(eligible);
      const remaining = eligible.filter((b) => b.id !== partner1.id);
      if (remaining.length === 0) return null;
      const partner2 = pickRandom(remaining);

      return {
        type: "MARRIAGE",
        category: "SOCIAL",
        title: `${partner1.name} and ${partner2.name} are bonded`,
        description: `Under the watching stars, ${partner1.name} and ${partner2.name} have pledged themselves to one another. The clan celebrates through the night.`,
        importance: 55,
        highlighted: false,
        beingId: partner1.id,
        clanId: partner1.clanId ?? undefined,
        x: partner1.x,
        y: partner1.y,
        metadata: { partner1: partner1.name, partner2: partner2.name },
      };
    },
  },

  // Political events
  {
    type: "ELECTION",
    category: "POLITICAL",
    importance: 75,
    condition: (state) => state.tick > 0 && state.tick % 500 === 0,
    generate: (state) => {
      const clan = pickRandom(state.clans.filter((c) => c.status !== "COLLAPSED"));
      if (!clan) return null;
      const candidates = state.beings.filter(
        (b) => b.clanId === clan.id && b.charisma > 50 && b.status === "ALIVE"
      );
      if (candidates.length === 0) return null;
      const winner = pickRandom(candidates);

      return {
        type: "RULER_CHANGED",
        category: "POLITICAL",
        title: `${winner.name} rises to lead the ${clan.name}`,
        description: `After a council of elders and heated deliberation among the clan, ${winner.name} has been chosen as the new chieftain. Their ${winner.bravery > 60 ? "bold" : "cautious"} nature will shape what comes next.`,
        impact: `The ${clan.name} clan enters a new era of leadership.`,
        importance: 75,
        highlighted: true,
        clanId: clan.id,
        beingId: winner.id,
        x: clan.x,
        y: clan.y,
        metadata: { newLeader: winner.name, clan: clan.name },
      };
    },
  },

  // Military events
  {
    type: "WAR_DECLARED",
    category: "MILITARY",
    importance: 90,
    condition: (state) => {
      const hostile = state.clans.filter((c) => {
        const relations = c.relations as Record<string, string>;
        return Object.values(relations).includes("hostile");
      });
      return hostile.length > 0 && state.tick > 100;
    },
    generate: (state) => {
      const hostilesMap = state.clans.filter((c) => {
        const relations = c.relations as Record<string, string>;
        return Object.values(relations).includes("hostile") && c.status === "ACTIVE";
      });
      if (hostilesMap.length === 0) return null;
      const aggressor = pickRandom(hostilesMap);
      const targets = state.clans.filter(
        (c) => c.id !== aggressor.id && c.status === "ACTIVE"
      );
      if (targets.length === 0) return null;
      const target = pickRandom(targets);

      return {
        type: "WAR_DECLARED",
        category: "MILITARY",
        title: `The ${aggressor.name} declare war on the ${target.name}`,
        description: `Tensions that have simmered for seasons finally erupt. The ${aggressor.name} warriors have crossed into ${target.name} territory, torches in hand. War has come to the valley.`,
        impact: "Both clans enter conflict. Casualties expected. Trade routes disrupted.",
        importance: 90,
        highlighted: true,
        clanId: aggressor.id,
        x: (aggressor.x + target.x) / 2,
        y: (aggressor.y + target.y) / 2,
        metadata: { aggressor: aggressor.name, target: target.name },
      };
    },
  },

  // Alliance events
  {
    type: "ALLIANCE",
    category: "POLITICAL",
    importance: 80,
    condition: (state) => state.clans.filter((c) => c.status === "ACTIVE").length >= 2 && state.tick % 300 === 0,
    generate: (state) => {
      const active = state.clans.filter((c) => c.status === "ACTIVE");
      if (active.length < 2) return null;
      const clan1 = pickRandom(active);
      const others = active.filter((c) => c.id !== clan1.id);
      if (others.length === 0) return null;
      const clan2 = pickRandom(others);

      return {
        type: "ALLIANCE",
        category: "POLITICAL",
        title: `The ${clan1.name} and ${clan2.name} forge an alliance`,
        description: `After secret negotiations conducted by firelight, the ${clan1.name} and ${clan2.name} have sealed a pact of mutual protection. This changes the balance of power in the valley.`,
        impact: "Two clans are now allied. Their combined strength may reshape the region.",
        importance: 80,
        highlighted: true,
        clanId: clan1.id,
        x: (clan1.x + clan2.x) / 2,
        y: (clan1.y + clan2.y) / 2,
        metadata: { clan1: clan1.name, clan2: clan2.name },
      };
    },
  },

  // Spiritual events
  {
    type: "RITUAL",
    category: "SPIRITUAL",
    importance: 60,
    condition: (state) => state.tick % 100 === 0,
    generate: (state) => {
      const clan = pickRandom(state.clans.filter((c) => c.status !== "COLLAPSED"));
      if (!clan) return null;
      const shamans = state.beings.filter(
        (b) => b.clanId === clan.id && (b.role === "shaman" || b.wisdom > 65) && b.status === "ALIVE"
      );

      const rituals = [
        "the Great Fire ritual",
        "the River Blessing",
        "the Hunt Dance",
        "the Ancestor Calling",
        "the Moon Vigil",
        "the Storm Appeasement",
        "the Harvest Prayer",
      ];

      const ritual = pickRandom(rituals);
      const shaman = shamans.length > 0 ? shamans[0] : null;

      return {
        type: "RITUAL",
        category: "SPIRITUAL",
        title: `The ${clan.name} perform ${ritual}`,
        description: shaman
          ? `${shaman.name} leads the ${clan.name} in ${ritual}, calling to the spirits for guidance and protection. The fire burns through the night.`
          : `The ${clan.name} gather in a circle of firelight to perform ${ritual}. Old words are spoken. The valley listens.`,
        importance: 60,
        highlighted: false,
        clanId: clan.id,
        beingId: shaman?.id,
        x: clan.x,
        y: clan.y,
        metadata: { ritual, clan: clan.name },
      };
    },
  },

  // Discovery events
  {
    type: "DISCOVERY",
    category: "CULTURAL",
    importance: 70,
    condition: (state) => state.tick > 50 && state.tick % 200 === 0,
    generate: (state) => {
      const discoverer = pickRandom(
        state.beings.filter((b) => b.status === "ALIVE" && b.cunning > 50)
      );
      if (!discoverer) return null;

      const discoveries = [
        { name: "fire-making", desc: "learned to create fire reliably from flint and dry tinder" },
        { name: "plant cultivation", desc: "discovered that seeds planted intentionally yield greater harvests" },
        { name: "clay hardening", desc: "found that clay vessels fired in flame become hard and lasting" },
        { name: "animal domestication", desc: "tamed a wolf pup, beginning a partnership that will echo through time" },
        { name: "leather tanning", desc: "developed a technique for preserving and working animal hides" },
        { name: "the river crossing", desc: "found a safe ford across the great river, opening new territory" },
        { name: "medicinal herbs", desc: "identified a plant that relieves fever and fights infection" },
      ];

      const discovery = pickRandom(discoveries);

      return {
        type: "DISCOVERY",
        category: "CULTURAL",
        title: `${discoverer.name} discovers ${discovery.name}`,
        description: `${discoverer.name} has ${discovery.desc}. This knowledge spreads quickly through the clan, changing what is possible.`,
        impact: `The ${discoverer.clanId ? state.clans.find((c) => c.id === discoverer.clanId)?.name ?? "" : ""} clan gains a significant advantage.`,
        importance: 70,
        highlighted: true,
        beingId: discoverer.id,
        clanId: discoverer.clanId ?? undefined,
        x: discoverer.x,
        y: discoverer.y,
        metadata: { discovery: discovery.name, discoverer: discoverer.name },
      };
    },
  },

  // Settlement events
  {
    type: "SETTLEMENT_FOUNDED",
    category: "CULTURAL",
    importance: 85,
    condition: (state) => state.tick > 100 && state.tick % 400 === 0 && state.settlements.length < 6,
    generate: (state) => {
      const clan = pickRandom(state.clans.filter((c) => c.status === "ACTIVE" && c.power > 20));
      if (!clan) return null;

      const settlementNames = [
        "Ashford", "Stonehaven", "Rivermouth", "Highrock", "Thornbury",
        "Deepwell", "Ironmere", "Coldwater", "Shadowmoor", "Goldenvale",
      ];

      return {
        type: "SETTLEMENT_FOUNDED",
        category: "CULTURAL",
        title: `The ${clan.name} establish a new settlement`,
        description: `With enough hands and will, the ${clan.name} have broken ground on a permanent settlement. The first structures rise from the earth — primitive now, but the seed of something lasting.`,
        impact: "A new settlement expands the clan's territory and production capacity.",
        importance: 85,
        highlighted: true,
        clanId: clan.id,
        x: clan.x + randomInt(-30, 30),
        y: clan.y + randomInt(-30, 30),
        metadata: { clan: clan.name },
      };
    },
  },

  // Natural events
  {
    type: "NATURAL_DISASTER",
    category: "NATURAL",
    importance: 85,
    condition: (state) => Math.random() < 0.002 && state.tick > 50,
    generate: (state) => {
      const disasters = [
        { name: "a great flood", desc: "The river swells beyond its banks, sweeping through camps and stores. Weeks of work undone in hours." },
        { name: "a wildfire", desc: "Fire races through the eastern forest, driven by wind. Settlements scramble to firebreak and flee." },
        { name: "a drought", desc: "The rains cease. Rivers shrink. Crops wither. The valley holds its breath." },
        { name: "an earthquake", desc: "The earth shudders and cracks. Structures fall. The ground itself seems hostile." },
        { name: "a plague of locusts", desc: "A vast cloud of insects descends, consuming crops and reserves in days." },
      ];

      const disaster = pickRandom(disasters);
      const x = randomInt(100, 700);
      const y = randomInt(100, 500);

      return {
        type: "NATURAL_DISASTER",
        category: "NATURAL",
        title: `Catastrophe: ${disaster.name} strikes the valley`,
        description: disaster.desc,
        impact: "Multiple clans affected. Resources depleted. Population at risk.",
        importance: 85,
        highlighted: true,
        x,
        y,
        metadata: { disaster: disaster.name },
      };
    },
  },

  // Religion founding
  {
    type: "RELIGION_FOUNDED",
    category: "SPIRITUAL",
    importance: 92,
    condition: (state) => state.tick > 300 && state.tick % 800 === 0,
    generate: (state) => {
      const prophet = pickRandom(
        state.beings.filter(
          (b) => b.status === "ALIVE" && (b.role === "shaman" || b.wisdom > 70)
        )
      );
      if (!prophet) return null;
      const clan = state.clans.find((c) => c.id === prophet.clanId);

      const religionNames = [
        "the Way of the River", "the Ember Faith", "the Stone Circle",
        "the Sky Covenant", "the Root Path", "the Ash Tradition",
      ];

      const religion = pickRandom(religionNames);

      return {
        type: "RELIGION_FOUNDED",
        category: "SPIRITUAL",
        title: `${prophet.name} founds ${religion}`,
        description: `After days of solitary fasting in the wilderness, ${prophet.name} returns with visions and revelations. They speak of higher forces shaping fate. The ${clan?.name ?? "clan"} listens, and something ancient stirs.`,
        impact: "A new belief system emerges. Other clans may adopt or oppose it.",
        importance: 92,
        highlighted: true,
        beingId: prophet.id,
        clanId: prophet.clanId ?? undefined,
        x: prophet.x,
        y: prophet.y,
        metadata: { religion, prophet: prophet.name },
      };
    },
  },

  // Battle
  {
    type: "BATTLE",
    category: "MILITARY",
    importance: 88,
    condition: (state) => {
      const atWar = state.clans.filter((c) => c.status === "AT_WAR");
      return atWar.length > 0 && state.tick % 50 === 0;
    },
    generate: (state) => {
      const warring = state.clans.filter((c) => c.status === "AT_WAR");
      if (warring.length < 2) return null;
      const attacker = pickRandom(warring);
      const defender = pickRandom(warring.filter((c) => c.id !== attacker.id));
      if (!defender) return null;

      const attackerWins = attacker.power > defender.power
        ? Math.random() < 0.65
        : Math.random() < 0.35;

      const winner = attackerWins ? attacker : defender;
      const loser = attackerWins ? defender : attacker;

      return {
        type: "BATTLE",
        category: "MILITARY",
        title: `Battle: ${attacker.name} vs ${defender.name}`,
        description: `Warriors clash at the boundary stones. Spears fly. The ${winner.name} drive back the ${loser.name}, but blood has been spilled on both sides. This will not be forgotten.`,
        impact: `The ${loser.name} lose ground and morale. The ${winner.name} celebrate, but at cost.`,
        importance: 88,
        highlighted: true,
        clanId: winner.id,
        x: (attacker.x + defender.x) / 2,
        y: (attacker.y + defender.y) / 2,
        metadata: {
          attacker: attacker.name,
          defender: defender.name,
          winner: winner.name,
          loser: loser.name,
        },
      };
    },
  },

  // Era transition
  {
    type: "ERA_TRANSITION",
    category: "GENERAL",
    importance: 99,
    condition: (state) => state.tick > 0 && state.tick % 1000 === 0,
    generate: (state) => {
      const ages: Record<string, string> = {
        SURVIVAL: "TRIBE_FORMATION",
        TRIBE_FORMATION: "SETTLEMENT",
        SETTLEMENT: "EARLY_POLITICS",
        EARLY_POLITICS: "CIVILIZATION",
        CIVILIZATION: "EXPANSION",
        EXPANSION: "COLLAPSE",
        COLLAPSE: "RENEWAL",
        RENEWAL: "CIVILIZATION",
      };

      const nextAge = ages[state.age] as string;
      if (!nextAge) return null;

      const ageNames: Record<string, string> = {
        SURVIVAL: "Age of Survival",
        TRIBE_FORMATION: "Age of Tribes",
        SETTLEMENT: "Age of Settlement",
        EARLY_POLITICS: "Age of Politics",
        CIVILIZATION: "Age of Civilization",
        EXPANSION: "Age of Expansion",
        COLLAPSE: "Age of Collapse",
        RENEWAL: "Age of Renewal",
      };

      return {
        type: "ERA_TRANSITION",
        category: "GENERAL",
        title: `A new age begins: ${ageNames[nextAge]}`,
        description: `The valley has changed. What began as desperate survival has evolved into something greater. A new chapter opens — the ${ageNames[nextAge]}. Those who live through it will tell their grandchildren.`,
        impact: "The world changes significantly. New events and opportunities emerge.",
        importance: 99,
        highlighted: true,
        metadata: { previousAge: state.age, newAge: nextAge },
      };
    },
  },
];

export function generateTickEvents(state: WorldState): SimEvent[] {
  const events: SimEvent[] = [];

  for (const template of EVENT_TEMPLATES) {
    if (template.condition(state) && Math.random() < 0.7) {
      const data = template.generate(state);
      if (data) {
        events.push(
          evt(state.id, state.tick, state.worldTime, data)
        );
      }
    }
  }

  return events;
}

export function scoreEventImportance(event: Partial<SimEvent>): number {
  const typeWeights: Partial<Record<EventType, number>> = {
    ERA_TRANSITION: 99,
    WAR_DECLARED: 92,
    RELIGION_FOUNDED: 92,
    ASSASSINATION: 88,
    BATTLE: 88,
    NATURAL_DISASTER: 85,
    SETTLEMENT_FOUNDED: 85,
    RULER_CHANGED: 80,
    ALLIANCE: 80,
    FAMINE: 78,
    DISCOVERY: 70,
    RITUAL: 60,
    MARRIAGE: 55,
    BIRTH: 40,
    DEATH: 45,
  };

  return typeWeights[event.type as EventType] ?? event.importance ?? 50;
}
