// First Valley — World Seed Data
// This creates the initial world state for First Valley

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌍 Seeding First Valley...");

  // ── Token Packs ─────────────────────────────────────────────────
  await db.tokenPack.createMany({
    data: [
      {
        name: "Spark",
        slug: "spark",
        tokens: 100,
        priceUsd: 299,
        bonusTokens: 0,
        badge: null,
        active: true,
        sortOrder: 1,
      },
      {
        name: "Ember",
        slug: "ember",
        tokens: 500,
        priceUsd: 999,
        bonusTokens: 50,
        badge: "POPULAR",
        active: true,
        sortOrder: 2,
      },
      {
        name: "Inferno",
        slug: "inferno",
        tokens: 1500,
        priceUsd: 2499,
        bonusTokens: 200,
        badge: null,
        active: true,
        sortOrder: 3,
      },
      {
        name: "Founder's Cache",
        slug: "founders-cache",
        tokens: 5000,
        priceUsd: 7499,
        bonusTokens: 1000,
        badge: "BEST VALUE",
        active: true,
        sortOrder: 4,
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Token packs created");

  // ── Admin Config ─────────────────────────────────────────────────
  await db.adminConfig.createMany({
    data: [
      { key: "subscription_price_usd", value: 1000, category: "billing" },
      { key: "simulation_tick_interval_ms", value: 5000, category: "simulation" },
      { key: "world_paused", value: false, category: "simulation" },
      { key: "max_events_per_tick", value: 3, category: "simulation" },
    ],
    skipDuplicates: true,
  });

  // ── Admin User ────────────────────────────────────────────────────
  const adminEmail = "admin@firstvalley.world";
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("AdminPassword123!", 12);
    await db.user.create({
      data: {
        email: adminEmail,
        name: "Valley Admin",
        passwordHash,
        role: "ADMIN",
        subscription: {
          create: {
            stripeCustomerId: "admin_customer",
            status: "ACTIVE",
          },
        },
        tokenWallet: {
          create: { balance: 9999 },
        },
      },
    });
    console.log("✅ Admin user created (admin@firstvalley.world / AdminPassword123!)");
  }

  // ── Check if world already exists ────────────────────────────────
  const existing = await db.world.findUnique({ where: { slug: "first-valley" } });
  if (existing) {
    console.log("⚠️  World already exists, skipping world seed");
    return;
  }

  // ── Create the World ─────────────────────────────────────────────
  const world = await db.world.create({
    data: {
      name: "First Valley",
      slug: "first-valley",
      description:
        "A fertile valley cradled between ancient mountains, an eastern forest, a southern coast, and western plains. Three clans begin here, at the dawn of everything.",
      age: "SURVIVAL",
      tick: 0,
      worldTime: 8,
      paused: false,
      seed: "firstvalley2024",
      config: {
        weather: { type: "clear", intensity: 0.3, temperature: 18, windSpeed: 0.2 },
        season: { name: "spring", progress: 0.15 },
        day: 1,
        year: 1,
      },
    },
  });

  console.log("✅ World created:", world.name);

  // ── Create Regions ────────────────────────────────────────────────
  const [riverBasin, northPeaks, eastForest, southCoast, westPlains] = await Promise.all([
    db.region.create({
      data: {
        worldId: world.id,
        name: "The River Basin",
        type: "RIVER_BASIN",
        biome: "wetlands",
        x: 400,
        y: 300,
        width: 200,
        height: 150,
        fertility: 0.9,
        waterAccess: 1.0,
        elevation: 0.1,
        temperature: 0.55,
        color: "#3d7a4a",
        description: "A rich basin fed by the Great River. Fertile soil, abundant fish, natural shelter. The most contested ground in the valley.",
      },
    }),
    db.region.create({
      data: {
        worldId: world.id,
        name: "The Northern Peaks",
        type: "MOUNTAINS",
        biome: "alpine",
        x: 350,
        y: 100,
        width: 280,
        height: 160,
        fertility: 0.2,
        waterAccess: 0.4,
        elevation: 0.9,
        temperature: 0.2,
        color: "#6b6b7a",
        description: "Harsh, cold, and mineral-rich. Home to the Iron Clan, who have learned to survive where others dare not venture.",
      },
    }),
    db.region.create({
      data: {
        worldId: world.id,
        name: "The Eastern Forest",
        type: "FOREST",
        biome: "temperate_forest",
        x: 630,
        y: 250,
        width: 180,
        height: 220,
        fertility: 0.7,
        waterAccess: 0.6,
        elevation: 0.35,
        temperature: 0.5,
        color: "#2d5a27",
        description: "Ancient, dense, and full of secrets. The Forest Clan moves through it like shadows. Others enter and do not always return.",
      },
    }),
    db.region.create({
      data: {
        worldId: world.id,
        name: "The Southern Coast",
        type: "COAST",
        biome: "coastal",
        x: 400,
        y: 490,
        width: 320,
        height: 100,
        fertility: 0.6,
        waterAccess: 0.95,
        elevation: 0.05,
        temperature: 0.7,
        color: "#4a7a6a",
        description: "Warm, fish-rich, and open. The River People's second home. Trade will come through here someday.",
      },
    }),
    db.region.create({
      data: {
        worldId: world.id,
        name: "The Western Plains",
        type: "PLAINS",
        biome: "grassland",
        x: 160,
        y: 280,
        width: 220,
        height: 200,
        fertility: 0.75,
        waterAccess: 0.5,
        elevation: 0.2,
        temperature: 0.55,
        color: "#7a8a3a",
        description: "Wide open grasslands where herds roam. Good for hunting, farming, and moving armies.",
      },
    }),
  ]);

  console.log("✅ Regions created");

  // ── Create Clans ─────────────────────────────────────────────────
  const [ironClan, riverPeople, forestClan] = await Promise.all([
    db.clan.create({
      data: {
        worldId: world.id,
        regionId: northPeaks.id,
        name: "The Iron Clan",
        color: "#c9714a",
        emblem: "⚔️",
        culture: "Warrior culture. Strength above all. Led by the strongest.",
        population: 18,
        status: "ACTIVE",
        age: "SURVIVAL",
        beliefs: ["Strength is the only true virtue", "The weak make the strong possible"],
        traits: ["warriors", "disciplined", "ambitious", "harsh"],
        relations: {},
        resources: { food: 40, water: 30, stone: 80, wood: 20 },
        territory: [],
        x: 330,
        y: 130,
        power: 35,
      },
    }),
    db.clan.create({
      data: {
        worldId: world.id,
        regionId: riverBasin.id,
        name: "The River People",
        color: "#4a6a8a",
        emblem: "🌊",
        culture: "Spiritual, communal, and wise. Led by their shamans.",
        population: 22,
        status: "ACTIVE",
        age: "SURVIVAL",
        beliefs: ["The river speaks to those who listen", "All life is sacred", "Memory is power"],
        traits: ["spiritual", "wise", "communal", "peaceful"],
        relations: {},
        resources: { food: 70, water: 90, fish: 60, herbs: 40 },
        territory: [],
        x: 390,
        y: 310,
        power: 25,
      },
    }),
    db.clan.create({
      data: {
        worldId: world.id,
        regionId: eastForest.id,
        name: "The Forest Clan",
        color: "#2d7a3a",
        emblem: "🌿",
        culture: "Secretive, fast, and deeply connected to the land.",
        population: 15,
        status: "ACTIVE",
        age: "SURVIVAL",
        beliefs: ["The forest provides", "What cannot be seen cannot be fought", "We are the oldest"],
        traits: ["stealthy", "cunning", "proud", "isolationist"],
        relations: {},
        resources: { food: 55, water: 40, wood: 90, herbs: 70 },
        territory: [],
        x: 620,
        y: 270,
        power: 20,
      },
    }),
  ]);

  console.log("✅ Clans created");

  // ── Create Settlements ────────────────────────────────────────────
  const [ironCamp, riverCamp, forestCamp] = await Promise.all([
    db.settlement.create({
      data: {
        worldId: world.id,
        clanId: ironClan.id,
        regionId: northPeaks.id,
        name: "Ironhold",
        type: "CAMP",
        population: 18,
        x: 320,
        y: 140,
        level: 1,
        health: 100,
        defense: 20,
        storage: 80,
        food: 40,
        water: 30,
        morale: 65,
        features: ["watchtower", "weapons_cache"],
      },
    }),
    db.settlement.create({
      data: {
        worldId: world.id,
        clanId: riverPeople.id,
        regionId: riverBasin.id,
        name: "Rivermouth",
        type: "CAMP",
        population: 22,
        x: 400,
        y: 300,
        level: 1,
        health: 100,
        defense: 10,
        storage: 120,
        food: 70,
        water: 90,
        morale: 75,
        features: ["shrine", "healing_circle"],
      },
    }),
    db.settlement.create({
      data: {
        worldId: world.id,
        clanId: forestClan.id,
        regionId: eastForest.id,
        name: "Deepcanopy",
        type: "CAMP",
        population: 15,
        x: 620,
        y: 260,
        level: 1,
        health: 100,
        defense: 15,
        storage: 100,
        food: 55,
        water: 40,
        morale: 70,
        features: ["lookout_trees", "hidden_paths"],
      },
    }),
  ]);

  console.log("✅ Settlements created");

  // ── Create Core Beings ────────────────────────────────────────────

  // Iron Clan core beings
  const [doran, aldric] = await Promise.all([
    db.being.create({
      data: {
        worldId: world.id,
        clanId: ironClan.id,
        regionId: northPeaks.id,
        name: "Doran",
        age: 32,
        lifeStage: "ADULT",
        role: "chieftain",
        isCore: true,
        status: "ALIVE",
        x: 320 + 5,
        y: 140 - 8,
        bravery: 88,
        cunning: 72,
        empathy: 30,
        ambition: 95,
        wisdom: 55,
        charisma: 75,
        health: 100,
        hunger: 85,
        thirst: 80,
        fatigue: 20,
        happiness: 60,
        fear: 15,
        anger: 45,
        hope: 70,
        primaryGoal: "unite the valley under Iron Clan leadership",
        currentAction: "surveying territory from the high rocks",
        drives: ["power", "legacy", "survival"],
        fears: ["weakness", "being forgotten", "losing his clan"],
        beliefs: { strengthIsEverything: true, weaknessIsBetrayal: true },
        trustMap: {},
        relationships: [],
        description: "The iron-willed chieftain of the Iron Clan. Born during a killing storm, he has never known weakness. His ambition is vast — he dreams of a valley united under his banner.",
        backstory: "His father died in a hunting accident when Doran was eight. He fought his way to chieftain by age 24, defeating the previous leader in single combat. He has never lost since.",
      },
    }),
    db.being.create({
      data: {
        worldId: world.id,
        clanId: ironClan.id,
        regionId: northPeaks.id,
        name: "Aldric",
        age: 28,
        lifeStage: "ADULT",
        role: "warrior",
        isCore: true,
        status: "ALIVE",
        x: 305,
        y: 155,
        bravery: 92,
        cunning: 55,
        empathy: 55,
        ambition: 65,
        wisdom: 45,
        charisma: 60,
        health: 100,
        hunger: 80,
        thirst: 75,
        fatigue: 25,
        happiness: 55,
        fear: 20,
        anger: 35,
        hope: 60,
        primaryGoal: "prove himself worthy of becoming Doran's second",
        currentAction: "training with spears near the camp perimeter",
        drives: ["belonging", "status", "protection"],
        fears: ["failing Doran", "being seen as weak", "the Iron Clan dying"],
        beliefs: {},
        trustMap: {},
        relationships: [{ beingId: "DORAN_PLACEHOLDER", type: "loyalty", strength: 80 }],
        description: "Doran's most loyal warrior and likely heir. Strong, brave, and honorable — qualities Doran values but cannot quite share himself.",
        backstory: "Grew up in the Iron Clan's brutal training regime. Unlike Doran, he has a capacity for mercy that he hides carefully.",
      },
    }),
  ]);

  // River People core beings
  const [mara, idun] = await Promise.all([
    db.being.create({
      data: {
        worldId: world.id,
        clanId: riverPeople.id,
        regionId: riverBasin.id,
        name: "Mara",
        age: 45,
        lifeStage: "ADULT",
        role: "shaman",
        isCore: true,
        status: "ALIVE",
        x: 405,
        y: 290,
        bravery: 60,
        cunning: 80,
        empathy: 92,
        ambition: 45,
        wisdom: 95,
        charisma: 85,
        health: 90,
        hunger: 75,
        thirst: 80,
        fatigue: 30,
        happiness: 65,
        fear: 35,
        anger: 10,
        hope: 75,
        primaryGoal: "protect the River People and preserve their ancient knowledge",
        currentAction: "performing the morning blessing at the water's edge",
        drives: ["spirituality", "belonging", "knowledge", "protection"],
        fears: ["losing the old ways", "darkness she has foreseen", "her people starving"],
        beliefs: { riverIsAlive: true, ancestorsGuide: true, memoriesHaveWeight: true },
        trustMap: {},
        relationships: [],
        description: "The elder shaman and heart of the River People. She remembers things no one else does. She has seen visions of what the valley might become — and what it might lose.",
        backstory: "Born with the gift of hearing patterns in water. She has guided her people through three hard winters and two failed harvests. She knows this peace will not last.",
      },
    }),
    db.being.create({
      data: {
        worldId: world.id,
        clanId: riverPeople.id,
        regionId: riverBasin.id,
        name: "Idun",
        age: 22,
        lifeStage: "YOUNG_ADULT",
        role: "healer",
        isCore: true,
        status: "ALIVE",
        x: 415,
        y: 310,
        bravery: 50,
        cunning: 65,
        empathy: 88,
        ambition: 55,
        wisdom: 60,
        charisma: 70,
        health: 100,
        hunger: 85,
        thirst: 85,
        fatigue: 15,
        happiness: 72,
        fear: 25,
        anger: 8,
        hope: 85,
        primaryGoal: "learn everything Mara knows before it is lost",
        currentAction: "gathering herbs along the riverbank",
        drives: ["knowledge", "belonging", "love"],
        fears: ["Mara dying before she can learn from her", "failing the sick"],
        beliefs: {},
        trustMap: {},
        relationships: [],
        description: "Mara's apprentice and the River People's future. Young, brilliant, and desperately afraid of losing her mentor.",
        backstory: "Was brought to Mara at age seven after her parents drowned in the flood. The river took and the river gave back.",
      },
    }),
  ]);

  // Forest Clan core beings
  const [lyra, beorn] = await Promise.all([
    db.being.create({
      data: {
        worldId: world.id,
        clanId: forestClan.id,
        regionId: eastForest.id,
        name: "Lyra",
        age: 26,
        lifeStage: "YOUNG_ADULT",
        role: "scout",
        isCore: true,
        status: "ALIVE",
        x: 625,
        y: 255,
        bravery: 78,
        cunning: 90,
        empathy: 65,
        ambition: 70,
        wisdom: 62,
        charisma: 68,
        health: 100,
        hunger: 80,
        thirst: 78,
        fatigue: 20,
        happiness: 62,
        fear: 30,
        anger: 25,
        hope: 65,
        primaryGoal: "understand what lies beyond the eastern peaks",
        currentAction: "moving silently through the high canopy",
        drives: ["curiosity", "freedom", "loyalty", "survival"],
        fears: ["being trapped", "the unknown thing she saw beyond the mountains", "her clan's isolation destroying them"],
        beliefs: { forestHasMemory: true, shadowsProtect: true },
        trustMap: {},
        relationships: [],
        description: "The Forest Clan's fastest and most trusted scout. She has seen something beyond the eastern forest that she hasn't told her people about yet.",
        backstory: "Grew up running the treetops. She discovered a passage through the eastern mountains at age 19 and has been trying to decide whether to reveal it ever since.",
      },
    }),
    db.being.create({
      data: {
        worldId: world.id,
        clanId: forestClan.id,
        regionId: eastForest.id,
        name: "Beorn",
        age: 55,
        lifeStage: "ELDER",
        role: "elder",
        isCore: true,
        status: "ALIVE",
        x: 610,
        y: 270,
        bravery: 45,
        cunning: 70,
        empathy: 78,
        ambition: 25,
        wisdom: 92,
        charisma: 72,
        health: 75,
        hunger: 70,
        thirst: 72,
        fatigue: 40,
        happiness: 60,
        fear: 40,
        anger: 15,
        hope: 55,
        primaryGoal: "prepare the Forest Clan for what is coming",
        currentAction: "telling the old stories to the children by the fire",
        drives: ["legacy", "belonging", "protection"],
        fears: ["dying before he can protect his people", "the Iron Clan", "his people's pride blinding them"],
        beliefs: {},
        trustMap: {},
        relationships: [],
        description: "The oldest living member of the Forest Clan. He has watched three generations grow and fade. He knows the Iron Clan will come for them eventually.",
        backstory: "Survived a massacre by the Iron Clan ancestors forty years ago. He has never forgiven, but he has learned to wait.",
      },
    }),
  ]);

  console.log("✅ Core beings created");

  // ── Background Beings ────────────────────────────────────────────
  const backgroundBatch = [];

  const ironNames = ["Harken", "Bryn", "Torak", "Veld", "Skar", "Erna", "Rold", "Kaela", "Drev", "Vira", "Orun", "Selka"];
  const riverNames = ["Aelin", "Soran", "Pell", "Tira", "Nura", "Cael", "Lira", "Orin", "Yara", "Sael", "Brin", "Fena"];
  const forestNames = ["Wyn", "Thera", "Caix", "Mira", "Doran", "Aela", "Gael", "Kira", "Oran", "Vina", "Zeal", "Hale"];

  const clanData = [
    { clan: ironClan, region: northPeaks, names: ironNames, x: 320, y: 140, roles: ["warrior", "hunter", "gatherer", "craftsperson"] },
    { clan: riverPeople, region: riverBasin, names: riverNames, x: 400, y: 300, roles: ["healer", "farmer", "fisherman", "storyteller"] },
    { clan: forestClan, region: eastForest, names: forestNames, x: 620, y: 260, roles: ["scout", "hunter", "gatherer", "trapper"] },
  ];

  for (const { clan, region, names, x, y, roles } of clanData) {
    for (let i = 0; i < Math.min(names.length, 10); i++) {
      const age = 15 + Math.floor(Math.random() * 40);
      const lifeStage = age < 20 ? "YOUNG_ADULT" : age < 50 ? "ADULT" : "ELDER";
      backgroundBatch.push(
        db.being.create({
          data: {
            worldId: world.id,
            clanId: clan.id,
            regionId: region.id,
            name: names[i],
            age,
            lifeStage,
            role: roles[Math.floor(Math.random() * roles.length)],
            isCore: false,
            status: "ALIVE",
            x: x + (Math.random() - 0.5) * 60,
            y: y + (Math.random() - 0.5) * 60,
            bravery: 20 + Math.floor(Math.random() * 60),
            cunning: 20 + Math.floor(Math.random() * 60),
            empathy: 20 + Math.floor(Math.random() * 60),
            ambition: 15 + Math.floor(Math.random() * 50),
            wisdom: 15 + Math.floor(Math.random() * 55),
            charisma: 20 + Math.floor(Math.random() * 60),
            health: 80 + Math.floor(Math.random() * 20),
            hunger: 65 + Math.floor(Math.random() * 35),
            thirst: 65 + Math.floor(Math.random() * 35),
            fatigue: Math.floor(Math.random() * 30),
            happiness: 40 + Math.floor(Math.random() * 40),
            fear: 10 + Math.floor(Math.random() * 30),
            anger: Math.floor(Math.random() * 25),
            hope: 40 + Math.floor(Math.random() * 40),
            primaryGoal: ["find food", "protect family", "gain respect", "survive the season"][Math.floor(Math.random() * 4)],
            currentAction: ["gathering", "resting", "hunting", "socializing", "tending the fire"][Math.floor(Math.random() * 5)],
            drives: ["survival", "belonging"],
            fears: ["starvation"],
            beliefs: {},
            trustMap: {},
            relationships: [],
          },
        })
      );
    }
  }

  await Promise.all(backgroundBatch);
  console.log("✅ Background beings created");

  // ── Resource Nodes ────────────────────────────────────────────────
  await db.resourceNode.createMany({
    data: [
      { worldId: world.id, regionId: riverBasin.id, type: "FOOD", amount: 100, maxAmount: 100, regenRate: 0.3, x: 380, y: 320 },
      { worldId: world.id, regionId: riverBasin.id, type: "WATER", amount: 100, maxAmount: 100, regenRate: 1.0, x: 420, y: 290 },
      { worldId: world.id, regionId: riverBasin.id, type: "FISH", amount: 80, maxAmount: 100, regenRate: 0.4, x: 400, y: 340 },
      { worldId: world.id, regionId: northPeaks.id, type: "STONE", amount: 100, maxAmount: 100, regenRate: 0.01, x: 340, y: 110 },
      { worldId: world.id, regionId: northPeaks.id, type: "MINERALS", amount: 80, maxAmount: 100, regenRate: 0.01, x: 360, y: 130 },
      { worldId: world.id, regionId: northPeaks.id, type: "FOOD", amount: 40, maxAmount: 60, regenRate: 0.1, x: 310, y: 150 },
      { worldId: world.id, regionId: eastForest.id, type: "WOOD", amount: 100, maxAmount: 100, regenRate: 0.2, x: 640, y: 250 },
      { worldId: world.id, regionId: eastForest.id, type: "HERBS", amount: 80, maxAmount: 100, regenRate: 0.25, x: 615, y: 280 },
      { worldId: world.id, regionId: eastForest.id, type: "ANIMALS", amount: 70, maxAmount: 100, regenRate: 0.15, x: 650, y: 230 },
      { worldId: world.id, regionId: southCoast.id, type: "FISH", amount: 100, maxAmount: 100, regenRate: 0.5, x: 400, y: 490 },
      { worldId: world.id, regionId: southCoast.id, type: "WATER", amount: 100, maxAmount: 100, regenRate: 1.0, x: 430, y: 495 },
      { worldId: world.id, regionId: westPlains.id, type: "FOOD", amount: 90, maxAmount: 100, regenRate: 0.3, x: 170, y: 290 },
      { worldId: world.id, regionId: westPlains.id, type: "ANIMALS", amount: 85, maxAmount: 100, regenRate: 0.2, x: 200, y: 310 },
    ],
  });

  console.log("✅ Resource nodes created");

  // ── Seed Events — The beginning ───────────────────────────────────
  await db.worldEvent.createMany({
    data: [
      {
        worldId: world.id,
        type: "SETTLEMENT_FOUNDED",
        category: "CULTURAL",
        title: "Ironhold is established",
        description: "The Iron Clan plants their banner in the northern peaks. A rough camp of stone and timber. It will not stay rough for long.",
        tick: 0,
        worldTime: 0,
        importance: 80,
        highlighted: true,
        clanId: ironClan.id,
        x: 320,
        y: 140,
        metadata: {},
      },
      {
        worldId: world.id,
        type: "SETTLEMENT_FOUNDED",
        category: "CULTURAL",
        title: "Rivermouth rises at the water's edge",
        description: "The River People establish Rivermouth at the bend in the Great River. They have lived here for generations, but now they build to last.",
        tick: 0,
        worldTime: 2,
        importance: 80,
        highlighted: true,
        clanId: riverPeople.id,
        x: 400,
        y: 300,
        metadata: {},
      },
      {
        worldId: world.id,
        type: "SETTLEMENT_FOUNDED",
        category: "CULTURAL",
        title: "Deepcanopy — hidden in the eastern forest",
        description: "The Forest Clan does not build. They adapt. Deepcanopy is a settlement that cannot be found unless you already know where to look.",
        tick: 0,
        worldTime: 4,
        importance: 75,
        highlighted: true,
        clanId: forestClan.id,
        x: 620,
        y: 260,
        metadata: {},
      },
      {
        worldId: world.id,
        type: "FIRST_CONTACT",
        category: "SOCIAL",
        title: "The three clans are aware of each other",
        description: "Scouts from each clan have confirmed what the elders suspected — they are not alone in the valley. Three fires burn in the night. Three wills will have to find a way to coexist.",
        tick: 1,
        worldTime: 10,
        importance: 90,
        highlighted: true,
        metadata: {},
      },
      {
        worldId: world.id,
        type: "RITUAL",
        category: "SPIRITUAL",
        title: "Mara performs the First Water Blessing",
        description: "At dawn, Mara wades into the river and speaks words that have been spoken since before memory. The water brightens. Her people feel it.",
        tick: 2,
        worldTime: 6,
        importance: 65,
        highlighted: false,
        clanId: riverPeople.id,
        beingId: mara.id,
        x: 400,
        y: 300,
        metadata: { ritual: "First Water Blessing" },
      },
      {
        worldId: world.id,
        type: "DISCOVERY",
        category: "CULTURAL",
        title: "Doran finds iron ore in the northern cliffs",
        description: "While tracking prey into the deep peaks, Doran discovers a vein of iron ore. His eyes widen. He does not tell the clan yet — he needs time to think about what this means.",
        tick: 5,
        worldTime: 14,
        importance: 78,
        highlighted: true,
        clanId: ironClan.id,
        beingId: doran.id,
        x: 360,
        y: 115,
        metadata: { discovery: "iron ore", discoverer: "Doran" },
      },
    ],
  });

  console.log("✅ Seed events created");

  // ── Initial Vote ──────────────────────────────────────────────────
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 3);

  await db.vote.create({
    data: {
      worldId: world.id,
      title: "Who should guide the valley?",
      description: "Three clans begin their story. The audience speaks first. Which clan should receive a blessing that gives them an early advantage?",
      options: [
        { id: "iron", label: "The Iron Clan", description: "Grant them sharper weapons and stronger resolve.", votes: 0 },
        { id: "river", label: "The River People", description: "Grant them a bountiful harvest and spiritual clarity.", votes: 0 },
        { id: "forest", label: "The Forest Clan", description: "Grant them knowledge of a hidden path and faster movement.", votes: 0 },
      ],
      type: "STANDARD",
      status: "ACTIVE",
      tokenCost: 0,
      endsAt,
    },
  });

  console.log("✅ Initial vote created");

  console.log("\n🔥 First Valley is ready!");
  console.log("   World: First Valley");
  console.log("   Clans: Iron Clan, River People, Forest Clan");
  console.log("   Core beings: Doran, Aldric, Mara, Idun, Lyra, Beorn");
  console.log("   Admin: admin@firstvalley.world / AdminPassword123!");
  console.log("\n   Run: npx prisma migrate dev --name init");
  console.log("   Then: npx ts-node prisma/seed.ts");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
