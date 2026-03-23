import {
  SimBeing,
  SimClan,
  SimEvent,
  SimSettlement,
  WorldState,
  DEFAULT_SIM_CONFIG,
} from "./types";
import { randomBetween, randomInt, pickRandom, clamp } from "../utils";
import { nanoid } from "nanoid";

const MALE_NAMES = [
  "Adon", "Bran", "Cael", "Doran", "Eron", "Fael", "Garun", "Hern",
  "Idun", "Javar", "Kael", "Lorn", "Maerl", "Neron", "Oryn", "Pell",
  "Quen", "Rael", "Sorn", "Tovar", "Ulyn", "Vael", "Wren", "Xael",
  "Yarl", "Zorak", "Aldric", "Beorn", "Caius", "Dravan",
];

const FEMALE_NAMES = [
  "Aela", "Bryna", "Caia", "Dara", "Elara", "Finna", "Gara", "Hilde",
  "Ilara", "Jara", "Kira", "Lyra", "Mara", "Nira", "Orla", "Pira",
  "Qara", "Rysa", "Sora", "Tara", "Ula", "Vara", "Wyla", "Xira",
  "Yara", "Zara", "Aerin", "Bela", "Cass", "Deva",
];

const ROLES = [
  "hunter", "gatherer", "healer", "elder", "warrior", "shaman",
  "craftsperson", "farmer", "scout", "leader", "storyteller", "trader",
];

const PRIMARY_GOALS = [
  "find food", "protect family", "build shelter", "gain respect",
  "explore territory", "form alliances", "seek power", "preserve traditions",
  "discover fire's secrets", "survive the winter", "unite the clans",
];

const DRIVES = [
  "survival", "belonging", "status", "curiosity", "protection", "legacy",
  "freedom", "power", "spirituality", "love", "revenge", "knowledge",
];

const FEARS = [
  "starvation", "exile", "death", "darkness", "losing family",
  "the unknown wilderness", "enemy clans", "the spirits", "illness",
];

export function createBeing(
  worldId: string,
  clanId: string | null,
  regionId: string | null,
  position: { x: number; y: number },
  isCore = false,
  overrides: Partial<SimBeing> = {}
): SimBeing {
  const isMale = Math.random() > 0.5;
  const names = isMale ? MALE_NAMES : FEMALE_NAMES;
  const name = pickRandom(names);

  return {
    id: nanoid(),
    worldId,
    clanId,
    regionId,
    name,
    age: randomInt(16, 40),
    lifeStage: "YOUNG_ADULT",
    role: pickRandom(ROLES),
    isCore,
    status: "ALIVE",
    x: position.x + randomBetween(-20, 20),
    y: position.y + randomBetween(-20, 20),
    bravery: randomInt(20, 80),
    cunning: randomInt(20, 80),
    empathy: randomInt(20, 80),
    ambition: randomInt(20, 80),
    wisdom: randomInt(15, 70),
    charisma: randomInt(20, 80),
    health: 100,
    hunger: randomInt(70, 100),
    thirst: randomInt(70, 100),
    fatigue: randomInt(0, 30),
    happiness: randomInt(40, 80),
    fear: randomInt(10, 40),
    anger: randomInt(5, 25),
    hope: randomInt(40, 80),
    primaryGoal: pickRandom(PRIMARY_GOALS),
    currentAction: pickRandom(["foraging", "resting", "socializing", "hunting", "gathering water"]),
    drives: [pickRandom(DRIVES), pickRandom(DRIVES)].filter((v, i, a) => a.indexOf(v) === i),
    fears: [pickRandom(FEARS)],
    beliefs: {},
    trustMap: {},
    relationships: [],
    ...overrides,
  };
}

export function tickBeing(being: SimBeing, worldState: WorldState): {
  updated: SimBeing;
  events: Partial<SimEvent>[];
} {
  const config = DEFAULT_SIM_CONFIG;
  const events: Partial<SimEvent>[] = [];
  const updated = { ...being };

  if (updated.status === "DEAD") return { updated, events };

  // Decay physical needs
  updated.hunger = clamp(
    updated.hunger - config.hungerDecayPerTick,
    0,
    100
  );
  updated.thirst = clamp(
    updated.thirst - config.thirstDecayPerTick,
    0,
    100
  );
  updated.fatigue = clamp(
    updated.fatigue + config.fatigueIncreasePerTick,
    0,
    100
  );

  // Weather effects
  const { weather } = worldState;
  if (weather.type === "storm" || weather.type === "snow") {
    updated.fatigue = clamp(updated.fatigue + 2, 0, 100);
    updated.happiness = clamp(updated.happiness - 1, 0, 100);
  }

  // Decide action based on needs
  const needsFood = updated.hunger < 30;
  const needsWater = updated.thirst < 20;
  const needsRest = updated.fatigue > 80;

  if (needsWater) {
    updated.currentAction = "seeking water";
    updated.thirst = clamp(updated.thirst + 15, 0, 100);
  } else if (needsFood) {
    updated.currentAction = "foraging for food";
    updated.hunger = clamp(updated.hunger + 10, 0, 100);
  } else if (needsRest) {
    updated.currentAction = "resting";
    updated.fatigue = clamp(updated.fatigue - 20, 0, 100);
    updated.happiness = clamp(updated.happiness + 5, 0, 100);
  } else {
    // Normal activities
    const actions = [
      "gathering with the clan",
      "tending to the settlement",
      "exploring nearby",
      "crafting tools",
      "teaching children",
      "performing rituals",
      "hunting",
      "trading",
      "guarding",
      "storytelling by the fire",
    ];
    if (Math.random() < 0.1) {
      updated.currentAction = pickRandom(actions);
    }

    // Natural recovery
    updated.hunger = clamp(updated.hunger + 2, 0, 100);
    updated.thirst = clamp(updated.thirst + 3, 0, 100);
    updated.happiness = clamp(updated.happiness + 1, 0, 100);
  }

  // Health effects from hunger/thirst
  if (updated.hunger < 10 || updated.thirst < 5) {
    updated.health = clamp(updated.health - 5, 0, 100);
    updated.status = updated.health < 20 ? "DYING" : "SICK";

    if (updated.health <= 0) {
      updated.status = "DEAD";
      events.push({
        type: "DEATH",
        category: "SURVIVAL",
        title: `${updated.name} has perished`,
        description: `${updated.name} of the ${updated.role} role has died from ${
          updated.hunger < 10 ? "starvation" : "dehydration"
        }.`,
        importance: updated.isCore ? 90 : 40,
        beingId: updated.id,
        clanId: updated.clanId ?? undefined,
      });
    }
  } else if (updated.status === "SICK" || updated.status === "DYING") {
    // Recovery
    if (updated.health > 30) {
      updated.status = "ALIVE";
      updated.health = clamp(updated.health + 5, 0, 100);
    }
  }

  // Emotional state updates
  if (updated.hunger > 70 && updated.thirst > 70 && updated.health > 80) {
    updated.happiness = clamp(updated.happiness + 2, 0, 100);
    updated.fear = clamp(updated.fear - 1, 0, 100);
    updated.hope = clamp(updated.hope + 1, 0, 100);
  }

  // Aging
  const ticksPerYear = config.agingTicksPerYear;
  if (worldState.tick % ticksPerYear === 0 && worldState.tick > 0) {
    updated.age += 1;
    updated.lifeStage =
      updated.age < 16 ? "CHILD"
      : updated.age < 35 ? "YOUNG_ADULT"
      : updated.age < 60 ? "ADULT"
      : "ELDER";

    // Elder wisdom increase
    if (updated.lifeStage === "ELDER") {
      updated.wisdom = clamp(updated.wisdom + 2, 0, 100);
    }

    // Natural death from old age
    if (updated.age > 70 && Math.random() < 0.1 * (updated.age - 70)) {
      updated.status = "DEAD";
      events.push({
        type: "DEATH",
        category: "SOCIAL",
        title: `${updated.name} has passed peacefully`,
        description: `${updated.name}, who lived to ${updated.age} years, has passed from this world, leaving behind a legacy remembered by the ${updated.clanId ?? "unknown"} clan.`,
        importance: updated.isCore ? 85 : 35,
        beingId: updated.id,
        clanId: updated.clanId ?? undefined,
      });
    }
  }

  // Random movement
  if (Math.random() < 0.3 && updated.status === "ALIVE") {
    const settlement = worldState.settlements.find(
      (s) => s.clanId === updated.clanId
    );
    if (settlement) {
      const range = 60;
      updated.targetX = settlement.x + randomBetween(-range, range);
      updated.targetY = settlement.y + randomBetween(-range, range);
    }
  }

  // Move toward target
  if (updated.targetX !== undefined && updated.targetY !== undefined) {
    const dx = updated.targetX - updated.x;
    const dy = updated.targetY - updated.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      const speed = updated.status === "ALIVE" ? 3 : 1;
      updated.x += (dx / dist) * speed;
      updated.y += (dy / dist) * speed;
    } else {
      updated.targetX = undefined;
      updated.targetY = undefined;
    }
  }

  return { updated, events };
}

export function generateReproductionEvent(
  worldId: string,
  parentA: SimBeing,
  parentB: SimBeing,
  tick: number,
  worldTime: number
): SimBeing {
  const isMale = Math.random() > 0.5;
  const parentNames = [parentA.name, parentB.name];
  const namePool = isMale ? MALE_NAMES : FEMALE_NAMES;

  // Child inherits some traits from parents
  return {
    id: nanoid(),
    worldId,
    clanId: parentA.clanId,
    regionId: parentA.regionId,
    name: pickRandom(namePool),
    age: 0,
    lifeStage: "CHILD",
    role: "child",
    isCore: false,
    status: "ALIVE",
    x: parentA.x + randomBetween(-10, 10),
    y: parentA.y + randomBetween(-10, 10),
    bravery: Math.round((parentA.bravery + parentB.bravery) / 2 + randomBetween(-10, 10)),
    cunning: Math.round((parentA.cunning + parentB.cunning) / 2 + randomBetween(-10, 10)),
    empathy: Math.round((parentA.empathy + parentB.empathy) / 2 + randomBetween(-10, 10)),
    ambition: Math.round((parentA.ambition + parentB.ambition) / 2 + randomBetween(-10, 10)),
    wisdom: randomInt(5, 20),
    charisma: Math.round((parentA.charisma + parentB.charisma) / 2 + randomBetween(-10, 10)),
    health: 100,
    hunger: 90,
    thirst: 90,
    fatigue: 10,
    happiness: 80,
    fear: 15,
    anger: 5,
    hope: 90,
    primaryGoal: "grow and learn",
    currentAction: "resting near parents",
    drives: ["survival", "belonging"],
    fears: ["separation from family"],
    beliefs: {},
    trustMap: {
      [parentA.id]: 90,
      [parentB.id]: 90,
    },
    relationships: [
      { beingId: parentA.id, type: "parent", strength: 90 },
      { beingId: parentB.id, type: "parent", strength: 90 },
    ],
    description: `Born to ${parentNames.join(" and ")}`,
    backstory: `A child of the ${parentA.clanId ?? "unknown"} clan`,
  };
}

export function getBeingMoodLabel(being: SimBeing): string {
  if (being.happiness > 75) return "content";
  if (being.happiness > 50) return "hopeful";
  if (being.fear > 70) return "terrified";
  if (being.anger > 70) return "furious";
  if (being.happiness < 25) return "despairing";
  if (being.hunger < 20) return "starving";
  if (being.thirst < 20) return "parched";
  return "enduring";
}

export function getBeingStatusColor(being: SimBeing): string {
  switch (being.status) {
    case "ALIVE": return "#4ade80";
    case "INJURED": return "#facc15";
    case "SICK": return "#fb923c";
    case "DYING": return "#f87171";
    case "DEAD": return "#6b7280";
    case "EXILED": return "#c084fc";
    default: return "#4ade80";
  }
}
