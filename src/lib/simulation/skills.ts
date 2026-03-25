// Skill & Civilization Progression System
// Characters accumulate skills through actions → clan discoveries unlock technologies → eras advance

// ---------------------------------------------------------------------------
// Skill Definitions
// ---------------------------------------------------------------------------

export const SKILLS = {
  hunting:      { name: 'Hunting',      keywords: ['hunt', 'track', 'trap', 'stalk', 'prey', 'arrow'] },
  gathering:    { name: 'Gathering',    keywords: ['gather', 'forage', 'collect herb', 'pick', 'berry', 'root'] },
  farming:      { name: 'Farming',      keywords: ['farm', 'crop', 'plant', 'harvest', 'till', 'tend crop', 'sow'] },
  herding:      { name: 'Herding',      keywords: ['herd', 'tend animal', 'livestock', 'shepherd', 'feed animal'] },
  fishing:      { name: 'Fishing',      keywords: ['fish', 'net', 'river', 'cast'] },
  crafting:     { name: 'Crafting',     keywords: ['craft', 'tool', 'sharpen', 'carve', 'weave', 'make', 'shape', 'forge'] },
  building:     { name: 'Building',     keywords: ['build', 'construct', 'repair', 'stone', 'wall', 'lay'] },
  medicine:     { name: 'Medicine',     keywords: ['heal', 'tend sick', 'remedy', 'herb', 'wound', 'treat', 'cure'] },
  leadership:   { name: 'Leadership',   keywords: ['lead', 'organis', 'command', 'mediat', 'counsel', 'govern'] },
  combat:       { name: 'Combat',       keywords: ['fight', 'train', 'spar', 'patrol', 'guard', 'battle', 'sword', 'blade'] },
  trading:      { name: 'Trading',      keywords: ['trade', 'negotiat', 'bargain', 'sell', 'buy', 'market', 'barter'] },
  storytelling: { name: 'Storytelling', keywords: ['story', 'teach', 'recit', 'sing', 'tale', 'legend', 'poem', 'song'] },
  spirituality: { name: 'Spirituality', keywords: ['pray', 'meditat', 'ritual', 'shrine', 'spirit', 'worship', 'offering'] },
  metallurgy:   { name: 'Metallurgy',   keywords: ['smelt', 'forge', 'metal', 'ore', 'iron', 'copper', 'tin', 'bronze'] },
  writing:      { name: 'Writing',      keywords: ['writ', 'record', 'scroll', 'read', 'scribe', 'symbol', 'tablet'] },
  navigation:   { name: 'Navigation',   keywords: ['scout', 'explor', 'map', 'guide', 'path', 'horizon', 'star'] },
  science:      { name: 'Science',      keywords: ['observe', 'experiment', 'measur', 'calcul', 'study', 'discover', 'research'] },
  engineering:  { name: 'Engineering',  keywords: ['machine', 'engine', 'gear', 'pump', 'lever', 'mechanism', 'design'] },
} as const

export type SkillName = keyof typeof SKILLS
export type SkillMap = Partial<Record<SkillName, number>>

// ---------------------------------------------------------------------------
// Technology Tree
// ---------------------------------------------------------------------------

export type TechEra = 'STONE_AGE' | 'BRONZE_AGE' | 'IRON_AGE' | 'CLASSICAL' | 'MEDIEVAL' | 'RENAISSANCE' | 'INDUSTRIAL' | 'MODERN'

export interface Technology {
  name: string
  description: string
  era: TechEra
  /** Average skill levels needed across the clan */
  requirements: Partial<Record<SkillName, number>>
  /** Minimum number of clan members with those skill levels */
  populationThreshold: number
  eventTitle: string
  eventDescription: string
  significance: number
}

export const TECHNOLOGIES: Record<string, Technology> = {
  fire_mastery: {
    name: 'Fire Mastery',
    description: 'Reliable creation and control of fire',
    era: 'STONE_AGE',
    requirements: { gathering: 5 },
    populationThreshold: 2,
    eventTitle: 'The Eternal Flame Is Kindled',
    eventDescription: 'For the first time, the clan commands fire at will. Warmth, light, and cooked food change everything.',
    significance: 85,
  },
  stone_tools: {
    name: 'Stone Tools',
    description: 'Shaped flint, obsidian, and bone into blades, scrapers, and hammers',
    era: 'STONE_AGE',
    requirements: { crafting: 12 },
    populationThreshold: 2,
    eventTitle: 'Stone Yields to Skilled Hands',
    eventDescription: 'The clan shapes rock into tools. A flint knife, a bone needle — small objects that change the shape of daily life.',
    significance: 75,
  },
  basic_agriculture: {
    name: 'Basic Agriculture',
    description: 'Deliberate planting, tending, and harvesting of crops',
    era: 'STONE_AGE',
    requirements: { farming: 18, gathering: 12 },
    populationThreshold: 3,
    eventTitle: 'Seeds Planted, Future Sown',
    eventDescription: 'The clan learns to coax food from the earth itself. The first field is staked out. The age of wandering begins to end.',
    significance: 90,
  },
  pottery: {
    name: 'Pottery',
    description: 'Shaping fired clay into vessels for storage, cooking, and trade',
    era: 'STONE_AGE',
    requirements: { crafting: 22 },
    populationThreshold: 2,
    eventTitle: 'Clay Remembers the Shape of Hands',
    eventDescription: 'A pot rises from the earth, fired hard. Food can now be stored through winter. The first real wealth is born.',
    significance: 70,
  },
  organized_religion: {
    name: 'Organised Religion',
    description: 'Shared spiritual practices, priests, and sacred places',
    era: 'STONE_AGE',
    requirements: { spirituality: 25, storytelling: 20 },
    populationThreshold: 3,
    eventTitle: 'The First Temple Rises',
    eventDescription: 'Stone is arranged to honour forces greater than any person. A priest speaks for the unseen. The community has a soul.',
    significance: 80,
  },
  bronze_working: {
    name: 'Bronze Working',
    description: 'Smelting copper and tin to cast bronze weapons and tools',
    era: 'BRONZE_AGE',
    requirements: { crafting: 35, metallurgy: 20 },
    populationThreshold: 2,
    eventTitle: 'Fire and Metal — The Bronze Age Begins',
    eventDescription: 'The first bronze blade catches the light. Harder than stone, sharper than bone — the world will never be the same.',
    significance: 95,
  },
  writing: {
    name: 'Writing',
    description: 'Symbols, script, and records that outlast the speaker',
    era: 'BRONZE_AGE',
    requirements: { storytelling: 30, trading: 20 },
    populationThreshold: 2,
    eventTitle: 'Words Carved in Stone',
    eventDescription: 'A scribe marks symbols that speak across time. Laws, debts, stories — knowledge escapes the fragile vessel of memory.',
    significance: 95,
  },
  organised_warfare: {
    name: 'Organised Warfare',
    description: 'Formations, tactics, commanders, and military hierarchy',
    era: 'BRONZE_AGE',
    requirements: { combat: 35, leadership: 25 },
    populationThreshold: 4,
    eventTitle: 'The First Army Marches',
    eventDescription: 'Not a raid — an army. Ranks, banners, a general. War becomes a calculated art, and its shadow falls across every valley.',
    significance: 80,
  },
  iron_working: {
    name: 'Iron Working',
    description: 'Smelting iron ore for harder, cheaper tools and weapons',
    era: 'IRON_AGE',
    requirements: { metallurgy: 45, crafting: 40 },
    populationThreshold: 2,
    eventTitle: 'The Iron Age Dawns',
    eventDescription: 'Iron flows from the furnace. Cheaper than bronze and harder — every farmer can own a blade. Power shifts.',
    significance: 95,
  },
  advanced_medicine: {
    name: 'Advanced Medicine',
    description: 'Systematic healing: surgery, herbal remedies, diagnosis',
    era: 'IRON_AGE',
    requirements: { medicine: 40, gathering: 30, science: 10 },
    populationThreshold: 2,
    eventTitle: 'The Healers Conquer Death',
    eventDescription: 'A wound that would have killed now closes cleanly. The healer names diseases and knows their cures. Life grows longer.',
    significance: 85,
  },
  currency: {
    name: 'Currency',
    description: 'Standardised exchange medium enabling complex, large-scale trade',
    era: 'CLASSICAL',
    requirements: { trading: 40, writing: 30 },
    populationThreshold: 3,
    eventTitle: 'First Coins Struck — The Age of Commerce',
    eventDescription: 'Small discs of metal change hands for grain, cloth, and service. A merchant class is born. Wealth becomes portable.',
    significance: 85,
  },
  philosophy: {
    name: 'Philosophy',
    description: 'Systematic enquiry into existence, ethics, knowledge, and beauty',
    era: 'CLASSICAL',
    requirements: { writing: 35, storytelling: 35, spirituality: 25, science: 15 },
    populationThreshold: 2,
    eventTitle: 'The First Philosophers Question Everything',
    eventDescription: 'Under a tree, beside a river, a mind turns on itself and asks — why? The question echoes across centuries.',
    significance: 80,
  },
  mathematics: {
    name: 'Mathematics',
    description: 'Numbers, geometry, and the language of pattern',
    era: 'CLASSICAL',
    requirements: { science: 20, writing: 25, trading: 30 },
    populationThreshold: 2,
    eventTitle: 'Numbers Speak the Language of the World',
    eventDescription: 'The angles of stars, the curves of arches, the ledgers of merchants — all yield to the discipline of number.',
    significance: 75,
  },
  gunpowder: {
    name: 'Gunpowder',
    description: 'Explosive compound revolutionising warfare and mining',
    era: 'RENAISSANCE',
    requirements: { metallurgy: 55, crafting: 50, science: 25 },
    populationThreshold: 2,
    eventTitle: 'The World Trembles — Gunpowder Discovered',
    eventDescription: 'A roar, a flash, and stone crumbles. Walls that took years to build fall in moments. War is never the same again.',
    significance: 90,
  },
  printing_press: {
    name: 'Printing Press',
    description: 'Mass reproduction of written works spreading knowledge to all',
    era: 'RENAISSANCE',
    requirements: { writing: 55, crafting: 50, engineering: 15 },
    populationThreshold: 2,
    eventTitle: 'The Press Speaks — Knowledge for All',
    eventDescription: 'A hundred scrolls printed in a day. Ideas that once died with their author now walk the world freely. Everything changes.',
    significance: 90,
  },
  scientific_method: {
    name: 'Scientific Method',
    description: 'Systematic observation, hypothesis, and experiment',
    era: 'RENAISSANCE',
    requirements: { science: 40, writing: 40 },
    populationThreshold: 2,
    eventTitle: 'The Age of Reason Begins',
    eventDescription: 'A mind declares: belief is not enough. Observe. Test. Record. The universe must answer to the human question.',
    significance: 90,
  },
  steam_power: {
    name: 'Steam Power',
    description: 'Harnessing steam to drive machines, mills, and transport',
    era: 'INDUSTRIAL',
    requirements: { metallurgy: 65, engineering: 35, science: 40 },
    populationThreshold: 3,
    eventTitle: 'Steam Rises — The Industrial Age Begins',
    eventDescription: 'The first engine breathes and turns its wheel. A thousand arms could not match it. The valley will never sound the same.',
    significance: 95,
  },
  electricity: {
    name: 'Electricity',
    description: 'Harnessing electrical power for light, communication, and machines',
    era: 'MODERN',
    requirements: { science: 65, engineering: 55 },
    populationThreshold: 3,
    eventTitle: 'Light Without Fire — The Electric Age',
    eventDescription: 'Night is ended. A wire carries power across the valley. The world shrinks. The age of machines enters its final form.',
    significance: 95,
  },
}

export type TechName = keyof typeof TECHNOLOGIES

// Era progression — the order matters
export const ERA_ORDER: TechEra[] = [
  'STONE_AGE', 'BRONZE_AGE', 'IRON_AGE', 'CLASSICAL',
  'MEDIEVAL', 'RENAISSANCE', 'INDUSTRIAL', 'MODERN',
]

// Minimum technologies to be "in" an era
const ERA_TECH_THRESHOLD: Partial<Record<TechEra, number>> = {
  STONE_AGE: 0,   // default
  BRONZE_AGE: 1,
  IRON_AGE: 1,
  CLASSICAL: 2,
  MEDIEVAL: 2,
  RENAISSANCE: 2,
  INDUSTRIAL: 1,
  MODERN: 1,
}

// ---------------------------------------------------------------------------
// Skill Utilities
// ---------------------------------------------------------------------------

export function getPersonSkills(metadata: unknown): SkillMap {
  if (!metadata || typeof metadata !== 'object') return {}
  const m = metadata as Record<string, unknown>
  if (!m.skills || typeof m.skills !== 'object') return {}
  return m.skills as SkillMap
}

/**
 * Increment relevant skills based on current action text.
 * Returns updated map and whether anything changed.
 */
export function progressSkillFromAction(
  skills: SkillMap,
  action: string | null
): { skills: SkillMap; changed: boolean } {
  if (!action) return { skills, changed: false }
  const lower = action.toLowerCase()
  let changed = false
  const updated = { ...skills }

  for (const [id, def] of Object.entries(SKILLS)) {
    const skill = id as SkillName
    if (def.keywords.some(k => lower.includes(k))) {
      const current = updated[skill] ?? 0
      if (current < 100) {
        updated[skill] = Math.min(100, current + 0.15 + Math.random() * 0.25)
        changed = true
      }
    }
  }

  return { skills: updated, changed }
}

/** Summarise notable skills for AI prompts */
export function getSkillSummary(skills: SkillMap): string {
  const notable = (Object.entries(skills) as [SkillName, number][])
    .filter(([, v]) => v >= 10)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([k, v]) => `${SKILLS[k].name} ${Math.round(v)}`)
    .join(', ')
  return notable || 'no notable skills yet'
}

/** Average skills across a group of person metadata objects */
export function getClanSkillAverages(metadatas: unknown[]): SkillMap {
  const totals: Partial<Record<SkillName, number>> = {}
  const counts: Partial<Record<SkillName, number>> = {}

  for (const meta of metadatas) {
    const skills = getPersonSkills(meta)
    for (const [skill, level] of Object.entries(skills) as [SkillName, number][]) {
      if (level > 0) {
        totals[skill] = (totals[skill] ?? 0) + level
        counts[skill] = (counts[skill] ?? 0) + 1
      }
    }
  }

  const result: SkillMap = {}
  for (const skill of Object.keys(totals) as SkillName[]) {
    result[skill] = totals[skill]! / counts[skill]!
  }
  return result
}

/** Check which new technologies a clan can discover */
export function checkNewDiscoveries(
  avgSkills: SkillMap,
  populationWithSkills: number,
  alreadyDiscovered: string[]
): TechName[] {
  const results: TechName[] = []

  for (const [id, tech] of Object.entries(TECHNOLOGIES)) {
    if (alreadyDiscovered.includes(id)) continue
    if (populationWithSkills < tech.populationThreshold) continue

    const met = (Object.entries(tech.requirements) as [SkillName, number][])
      .every(([skill, required]) => (avgSkills[skill] ?? 0) >= required)

    if (met) results.push(id as TechName)
  }

  return results
}

/** Determine current era from list of discovered technology ids */
export function getClanEra(discovered: string[]): TechEra {
  let era: TechEra = 'STONE_AGE'

  for (const eraName of ERA_ORDER) {
    const eraTechs = Object.entries(TECHNOLOGIES)
      .filter(([, t]) => t.era === eraName)
      .map(([id]) => id)
    const discoveredInEra = eraTechs.filter(t => discovered.includes(t)).length
    const threshold = ERA_TECH_THRESHOLD[eraName] ?? 1
    if (discoveredInEra >= threshold) era = eraName
  }

  return era
}

/** Get human-readable era description for AI prompts */
export function getEraDescription(era: TechEra): string {
  const descriptions: Record<TechEra, string> = {
    STONE_AGE:   'Stone Age — fire, stone tools, early settlements',
    BRONZE_AGE:  'Bronze Age — metal weapons, writing, organised armies',
    IRON_AGE:    'Iron Age — iron tools, advanced medicine, widespread trade',
    CLASSICAL:   'Classical Era — philosophy, currency, mathematics, complex politics',
    MEDIEVAL:    'Medieval Era — feudal societies, advanced agriculture, stone castles',
    RENAISSANCE: 'Renaissance — gunpowder, printing press, scientific method',
    INDUSTRIAL:  'Industrial Age — steam engines, factories, mass production',
    MODERN:      'Modern Era — electricity, telecommunications, advanced science',
  }
  return descriptions[era]
}
