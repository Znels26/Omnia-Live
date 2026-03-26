import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  WorldState,
  SimBeing,
  SimClan,
  SimSettlement,
  SimRegion,
  SimEvent,
  LifeStage,
  BeingStatus,
} from '@/lib/simulation/types'

export async function GET() {
  const supabase = createAdminClient()

  // Try full query first; fall back to minimal columns if any are missing
  let worldResult = await supabase
    .from('worlds')
    .select(`
      *,
      world_regions(*),
      cultures(*),
      settlements(*),
      persons!persons_world_id_fkey(
        id, name, age, life_stage, occupation,
        is_alive, is_featured, health_score, happiness_score,
        pos_x, pos_y, culture_id,
        trait_ambition, trait_aggression, trait_sociability,
        trait_loyalty, trait_curiosity, trait_spirituality,
        trait_generosity, trait_honesty, trait_vindictiveness,
        need_hunger, need_stress, need_hope, need_fatigue,
        need_belonging, need_safety,
        current_action, current_goal, metadata
      )
    `)
    .eq('slug', 'first-valley')
    .single()

  // If extended query fails (missing columns), fall back to minimal safe set
  if (worldResult.error) {
    worldResult = await supabase
      .from('worlds')
      .select(`
        *,
        world_regions(*),
        cultures(*),
        settlements(*),
        persons!persons_world_id_fkey(
          id, name, age, life_stage, occupation,
          is_alive, is_featured, health_score, happiness_score,
          pos_x, pos_y, culture_id,
          trait_ambition, trait_aggression, trait_sociability,
          need_hunger, need_stress, need_hope,
          current_action, current_goal, metadata
        )
      `)
      .eq('slug', 'first-valley')
      .single()
  }

  const { data: world, error } = worldResult

  if (error || !world) {
    return NextResponse.json({ error: 'World not found' }, { status: 404 })
  }

  const config = (world.config ?? {}) as Record<string, unknown>

  // Map cultures → SimClan
  const clans: SimClan[] = ((world as any).cultures ?? []).map((c: any) => ({
    id: c.id,
    worldId: world.id,
    regionId: c.origin_region_id ?? null,
    name: c.name,
    color: c.color_hex ?? '#888888',
    population: c.population_estimate ?? 0,
    status: 'ACTIVE' as const,
    age: 'SURVIVAL' as const,
    beliefs: [],
    traits: [],
    relations: {},
    resources: {},
    territory: [],
    x: 400,
    y: 300,
    power: (c.cooperation_level ?? 5) * 10,
  }))

  // Map persons → SimBeing (only alive)
  function mapLifeStage(ls: string): LifeStage {
    if (['infant', 'child', 'adolescent'].includes(ls)) return 'CHILD'
    if (ls === 'young_adult') return 'YOUNG_ADULT'
    if (ls === 'elder') return 'ELDER'
    return 'ADULT'
  }

  // Derive human-readable drives/fears from personality trait scores
  function derivePersonality(p: any): { drives: string[]; fears: string[] } {
    const drives: string[] = []
    const fears: string[] = []
    if ((p.trait_ambition ?? 5) >= 7) drives.push('Rise above their station')
    if ((p.trait_curiosity ?? 5) >= 7) drives.push('Discover what lies beyond')
    if ((p.trait_spirituality ?? 5) >= 7) drives.push('Honor the ancient spirits')
    if ((p.trait_generosity ?? 5) >= 7) drives.push('Provide for others')
    if ((p.trait_sociability ?? 5) >= 7) drives.push('Build bonds with the clan')
    if ((p.trait_loyalty ?? 5) >= 7) drives.push('Protect those they love')
    if ((p.trait_honesty ?? 5) >= 7) drives.push('Speak truth, whatever the cost')
    if ((p.trait_aggression ?? 5) >= 7) drives.push('Prove their strength')
    if ((p.trait_vindictiveness ?? 5) >= 7) fears.push('Being wronged without recourse')
    if ((p.trait_aggression ?? 5) <= 3) fears.push('Open confrontation')
    if ((p.trait_curiosity ?? 5) <= 3) fears.push('The unknown')
    if ((p.need_safety ?? 3) >= 6) fears.push('Dying alone in the dark')
    if ((p.need_belonging ?? 3) >= 6) fears.push('Being cast out by the clan')
    if ((p.health_score ?? 7) <= 4) fears.push('Their body failing them')
    return { drives: drives.slice(0, 3), fears: fears.slice(0, 2) }
  }

  const beings: SimBeing[] = ((world as any).persons ?? [])
    .filter((p: any) => p.is_alive !== false)
    .map((p: any) => {
      const { drives, fears } = derivePersonality(p)
      const meta = (p.metadata ?? {}) as Record<string, unknown>
      return {
        id: p.id,
        worldId: world.id,
        clanId: p.culture_id ?? null,
        regionId: null,
        name: p.name,
        age: p.age ?? 25,
        lifeStage: mapLifeStage(p.life_stage ?? 'adult'),
        role: p.occupation ?? 'Villager',
        isCore: p.is_featured ?? false,
        status: 'ALIVE' as BeingStatus,
        x: Number(p.pos_x) || Math.random() * 700 + 50,
        y: Number(p.pos_y) || Math.random() * 480 + 40,
        bravery: (p.trait_aggression ?? 5) * 10,
        cunning: (p.trait_curiosity ?? 5) * 10,
        empathy: (p.trait_sociability ?? 5) * 10,
        ambition: (p.trait_ambition ?? 5) * 10,
        wisdom: (p.trait_spirituality ?? 5) * 10,
        charisma: (p.trait_honesty ?? 5) * 10,
        health: (p.health_score ?? 7) * 10,
        hunger: 100 - (p.need_hunger ?? 2) * 10,
        thirst: 80,
        fatigue: (p.need_fatigue ?? 2) * 10,
        happiness: (p.happiness_score ?? 6) * 10,
        fear: (p.need_stress ?? 2) * 10,
        anger: (p.trait_vindictiveness ?? 3) * 10,
        hope: 100 - (p.need_hope ?? 4) * 10,
        primaryGoal: p.current_goal ?? null,
        currentAction: p.current_action ?? null,
        drives,
        fears,
        beliefs: {},
        trustMap: {},
        relationships: [],
        description: (meta.description as string | null) ?? null,
        backstory: (meta.backstory as string | null) ?? null,
      }
    })

  // Map settlements → SimSettlement
  function mapSettlementType(t: string): SimSettlement['type'] {
    const map: Record<string, SimSettlement['type']> = {
      camp: 'CAMP',
      village: 'VILLAGE',
      town: 'TOWN',
      city: 'CITY',
    }
    return map[t] ?? 'HAMLET'
  }

  const settlements: SimSettlement[] = ((world as any).settlements ?? []).map((s: any) => ({
    id: s.id,
    worldId: world.id,
    clanId: s.culture_id ?? null,
    regionId: s.region_id ?? null,
    name: s.name,
    type: mapSettlementType(s.settlement_type),
    population: s.population ?? 0,
    x: Number(s.position_x) || 400,
    y: Number(s.position_y) || 300,
    level: 1,
    health: (s.stability ?? 5) * 10,
    defense: 50,
    food: (s.prosperity ?? 5) * 10,
    water: 80,
    morale: 70,
    features: [],
  }))

  // Map world_regions → SimRegion
  const biomeColors: Record<string, string> = {
    forest: '#2d5a27',
    plains: '#7a9a4a',
    mountains: '#6a6a7a',
    river: '#3a7abf',
    river_basin: '#3a7abf',
    coast: '#2e8b8b',
    valley: '#4a7c3f',
    desert: '#c8a055',
    swamp: '#4a6a3a',
  }

  const dbRegions = (world as any).world_regions ?? []
  const regions: SimRegion[] = dbRegions.length > 0
    ? dbRegions.map((r: any) => ({
        id: r.id,
        worldId: world.id,
        name: r.name,
        type: (r.biome?.toUpperCase().replace(' ', '_') ?? 'VALLEY') as SimRegion['type'],
        biome: r.biome ?? 'valley',
        x: Number(r.position_x) || 400,
        y: Number(r.position_y) || 300,
        width: 150,
        height: 120,
        fertility: (r.fertility_level ?? 5) * 10,
        waterAccess: (r.water_access ?? 5) * 10,
        elevation: 100,
        temperature: 20,
        color: biomeColors[r.biome?.toLowerCase() ?? ''] ?? '#4a7c3f',
      }))
    // No DB regions — generate default terrain for First Valley
    : [
        { id: 'r-valley',   worldId: world.id, name: 'The Valley Floor', type: 'VALLEY'      as const, biome: 'valley',      x: 400, y: 350, width: 310, height: 200, fertility: 75, waterAccess: 65, elevation: 100, temperature: 18, color: '#4a7c3f' },
        { id: 'r-river',    worldId: world.id, name: 'River Basin',       type: 'RIVER_BASIN' as const, biome: 'river_basin', x: 420, y: 310, width: 180, height: 130, fertility: 80, waterAccess: 100, elevation: 50,  temperature: 18, color: '#3a7abf' },
        { id: 'r-forest',   worldId: world.id, name: 'Forest of Ash',     type: 'FOREST'      as const, biome: 'forest',      x: 180, y: 380, width: 210, height: 160, fertility: 70, waterAccess: 60, elevation: 80,  temperature: 16, color: '#2d5a27' },
        { id: 'r-mountain', worldId: world.id, name: 'Stone Heights',     type: 'MOUNTAINS'   as const, biome: 'mountains',   x: 360, y: 130, width: 170, height: 130, fertility: 20, waterAccess: 30, elevation: 400, temperature: 12, color: '#6a6a7a' },
        { id: 'r-coast',    worldId: world.id, name: 'Tide Shore',        type: 'COAST'       as const, biome: 'coast',       x: 500, y: 490, width: 260, height: 90,  fertility: 60, waterAccess: 90, elevation: 20,  temperature: 20, color: '#2e8b8b' },
        { id: 'r-plains',   worldId: world.id, name: 'Dry Plains',        type: 'PLAINS'      as const, biome: 'plains',      x: 620, y: 320, width: 190, height: 160, fertility: 55, waterAccess: 40, elevation: 120, temperature: 22, color: '#7a9a4a' },
      ]

  // Get recent events and map to SimEvent
  const { data: rawEvents } = await supabase
    .from('public_events')
    .select('*')
    .eq('world_id', world.id)
    .order('created_at', { ascending: false })
    .limit(50)

  function mapEventCategory(type: string): SimEvent['category'] {
    switch (type) {
      case 'BIRTH': case 'MARRIAGE': case 'SOCIAL': case 'FIRST_CONTACT': return 'SOCIAL'
      case 'DEATH': case 'ASSASSINATION': return 'SOCIAL'
      case 'WAR_DECLARED': case 'BATTLE': case 'PEACE_TREATY': case 'INTERVENTION': return 'MILITARY'
      case 'PLAGUE': case 'FAMINE': case 'DROUGHT': case 'FLOOD': case 'FIRE': case 'NATURAL_DISASTER': return 'SURVIVAL'
      case 'RITUAL': case 'RELIGION_FOUNDED': case 'MIRACLE': return 'SPIRITUAL'
      case 'DISCOVERY': case 'INVENTION': case 'MONUMENT_BUILT': return 'CULTURAL'
      case 'TRADE_ROUTE': case 'FEAST': return 'ECONOMIC'
      case 'MIGRATION': case 'SETTLEMENT_FOUNDED': case 'SETTLEMENT_DESTROYED': return 'NATURAL'
      case 'ERA_TRANSITION': case 'RULER_CHANGED': case 'ELECTION': return 'POLITICAL'
      case 'VIEWER_VOTE': return 'VIEWER'
      default: return 'GENERAL'
    }
  }

  const events: SimEvent[] = (rawEvents ?? []).map((e: any) => ({
    id: e.id,
    worldId: e.world_id,
    type: (e.event_type ?? 'CUSTOM') as SimEvent['type'],
    category: mapEventCategory(e.event_type ?? 'CUSTOM'),
    title: e.title,
    description: e.description ?? '',
    tick: e.in_game_day ?? 0,
    worldTime: 12,
    importance: e.significance_score ?? 10,
    highlighted: e.is_featured ?? false,
    clanId: e.culture_id ?? undefined,
    beingId: e.primary_person_id ?? undefined,
    metadata: e.metadata ?? {},
    createdAt: new Date(e.created_at),
  }))

  const weatherConfig = (config.weather ?? {}) as Record<string, unknown>
  const seasonConfig = (config.season ?? {}) as Record<string, unknown>

  const worldState: WorldState = {
    id: world.id,
    name: world.name,
    tick: 0,
    // Derive worldTime from real clock so it's always accurate on load
    // 1 game day = 12 real hours, so the cycle repeats every 12h
    worldTime: (() => {
      const GAME_DAY_MS = 12 * 60 * 60 * 1000
      return ((Date.now() % GAME_DAY_MS) / GAME_DAY_MS) * 24
    })(),
    age: 'SURVIVAL',
    paused: (config.paused as boolean) ?? false,
    weather: {
      type: (weatherConfig.type as WorldState['weather']['type']) ?? 'clear',
      intensity: (weatherConfig.intensity as number) ?? 0.3,
      temperature: (weatherConfig.temperature as number) ?? 20,
      windSpeed: (weatherConfig.windSpeed as number) ?? 0.2,
    },
    season: {
      name: (seasonConfig.name as WorldState['season']['name']) ?? 'spring',
      progress: (seasonConfig.progress as number) ?? 0.1,
    },
    regions,
    clans,
    beings,
    settlements,
    recentEvents: events,
    population: clans.reduce((s, c) => s + c.population, 0),
    day: world.in_game_day ?? 1,
    year: world.in_game_year ?? 1,
  }

  // Expose AI director arc if available
  const directorArc = (config.director_arc ?? null) as {
    arc_title: string;
    arc_description: string;
    tension: number;
    focus_character: string | null;
    focus_reason: string;
    omen: string;
    day: number;
  } | null

  return NextResponse.json({ world: worldState, events, directorArc })
}
