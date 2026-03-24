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

  const { data: world, error } = await supabase
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
        need_hunger, need_stress, need_hope, current_action, current_goal
      )
    `)
    .eq('slug', 'first-valley')
    .single()

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

  const beings: SimBeing[] = ((world as any).persons ?? [])
    .filter((p: any) => p.is_alive !== false)
    .map((p: any) => ({
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
      cunning: 50,
      empathy: (p.trait_sociability ?? 5) * 10,
      ambition: (p.trait_ambition ?? 5) * 10,
      wisdom: 50,
      charisma: 50,
      health: (p.health_score ?? 7) * 10,
      hunger: 100 - (p.need_hunger ?? 2) * 10,
      thirst: 80,
      fatigue: 20,
      happiness: (p.happiness_score ?? 6) * 10,
      fear: (p.need_stress ?? 2) * 10,
      anger: 20,
      hope: 100 - (p.need_hope ?? 4) * 10,
      primaryGoal: p.current_goal ?? null,
      currentAction: p.current_action ?? null,
      drives: [],
      fears: [],
      beliefs: {},
      trustMap: {},
      relationships: [],
    }))

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

  const regions: SimRegion[] = ((world as any).world_regions ?? []).map((r: any) => ({
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

  // Get recent events and map to SimEvent
  const { data: rawEvents } = await supabase
    .from('public_events')
    .select('*')
    .eq('world_id', world.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const events: SimEvent[] = (rawEvents ?? []).map((e: any) => ({
    id: e.id,
    worldId: e.world_id,
    type: (e.event_type ?? 'CUSTOM') as SimEvent['type'],
    category: 'GENERAL' as const,
    title: e.title,
    description: e.description,
    tick: 0,
    worldTime: 12,
    importance: (e.significance_score ?? 1) * 10,
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
    worldTime: (config.world_time as number) ?? 8,
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

  return NextResponse.json({ world: worldState, events })
}
