import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSimulationTick } from '@/lib/simulation/engine'
import { clamp } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Terrain zones — world-space coordinates matching the default regions
// ---------------------------------------------------------------------------
const ZONES = {
  forest:  { x: 200, y: 370 },
  river:   { x: 420, y: 310 },
  coast:   { x: 510, y: 480 },
  plains:  { x: 620, y: 330 },
  valley:  { x: 400, y: 370 },
  heights: { x: 360, y: 220 },
  market:  { x: 450, y: 400 },
}

// Preferred work zones per occupation keyword
const OCCUPATION_ZONES: Record<string, Array<{ x: number; y: number }>> = {
  hunter:    [ZONES.forest, ZONES.heights],
  scout:     [ZONES.heights, ZONES.plains, ZONES.forest],
  ranger:    [ZONES.forest, ZONES.heights],
  fisher:    [ZONES.river, ZONES.coast],
  sailor:    [ZONES.coast, ZONES.river],
  farmer:    [ZONES.plains, ZONES.valley],
  shepherd:  [ZONES.plains, ZONES.valley],
  herder:    [ZONES.plains],
  healer:    [ZONES.valley, ZONES.forest],
  shaman:    [ZONES.forest, ZONES.heights],
  trader:    [ZONES.market, ZONES.valley],
  merchant:  [ZONES.market, ZONES.valley],
  crafter:   [ZONES.valley],
  blacksmith:[ZONES.valley],
  guard:     [ZONES.valley],
  soldier:   [ZONES.valley],
  warrior:   [ZONES.valley, ZONES.plains],
  leader:    [ZONES.valley],
  elder:     [ZONES.valley],
  priest:    [ZONES.valley, ZONES.heights],
  default:   [ZONES.valley],
}

// Occupation-appropriate action text
function getOccupationActions(occ: string, isNight: boolean): string[] {
  if (isNight) return [
    'Sleeping near the fire',
    'Keeping night watch',
    'Tending the embers',
    'Resting beneath the stars',
    'Listening to the dark',
  ]

  const actions: Record<string, string[]> = {
    hunter: [
      'Tracking deer through the trees',
      'Setting snares in the undergrowth',
      'Reading animal trails in the mud',
      'Moving downwind of prey',
      'Sharpening a hunting knife',
      'Waiting in stillness for movement',
    ],
    scout: [
      'Watching from the high ground',
      'Marking a new trail through the hills',
      'Mapping what lies beyond the ridge',
      'Reading smoke on the horizon',
      'Moving quietly along the treeline',
    ],
    fisher: [
      'Casting a net into the current',
      'Reading the river for shoals',
      'Mending torn fishing lines',
      'Smoking the morning catch',
      'Wading in the shallows at dawn',
      'Setting fish traps upstream',
    ],
    farmer: [
      'Turning the soil with a wooden hoe',
      'Planting seeds in careful rows',
      'Pulling weeds from between the crops',
      'Carrying water to the dry field',
      'Harvesting grain by hand',
      'Binding sheaves of wheat',
    ],
    healer: [
      'Grinding herbs into a paste',
      'Tending a wound with clean cloth',
      'Gathering healing plants from the wood',
      'Mixing a fever remedy',
      'Checking on the sick',
      'Preparing a poultice',
    ],
    trader: [
      'Inspecting goods for quality',
      'Counting the day\'s trades',
      'Negotiating a fair price at market',
      'Appraising a newly acquired item',
      'Planning the next trade route',
    ],
    guard: [
      'Patrolling the outer boundary',
      'Standing watch at the settlement entrance',
      'Drilling combat stances with the others',
      'Sharpening a blade by the fire',
      'Checking for signs of intrusion',
    ],
    crafter: [
      'Shaping wood into a tool handle',
      'Weaving basket reeds by hand',
      'Carving a stone blade with care',
      'Firing clay in the pit kiln',
      'Stretching and scraping animal hide',
      'Fitting joints on a new frame',
    ],
    leader: [
      'Speaking with the clan elders',
      'Settling a dispute with steady words',
      'Planning the coming season',
      'Inspecting the food stores',
      'Listening to the people\'s concerns',
    ],
    shepherd: [
      'Following the flock to fresh grass',
      'Counting heads at the evening drive',
      'Mending a gap in the pen fence',
      'Guiding the animals away from the cliffs',
    ],
    default: [
      'Gathering berries from the brush',
      'Carrying water from the river',
      'Tending the communal fire',
      'Mending torn clothing by the light',
      'Watching children play near the settlement',
      'Sorting the morning\'s forage',
    ],
  }

  const key = Object.keys(actions).find(k => occ.includes(k)) ?? 'default'
  return actions[key]
}

// ---------------------------------------------------------------------------
// Move people with occupation-aware, time-of-day-aware pathfinding
// ---------------------------------------------------------------------------
async function movePeople(worldId: string) {
  const db = createAdminClient()

  const [{ data: persons }, { data: settlements }, { data: worldRow }] = await Promise.all([
    db.from('persons')
      .select('id, pos_x, pos_y, residence_id, is_alive, current_action, occupation')
      .eq('world_id', worldId)
      .eq('is_alive', true)
      .limit(200),
    db.from('settlements')
      .select('id, position_x, position_y')
      .eq('world_id', worldId),
    db.from('worlds')
      .select('config')
      .eq('id', worldId)
      .single(),
  ])

  if (!persons?.length) return

  const config = (worldRow?.config ?? {}) as Record<string, unknown>
  const worldTime = (config.world_time as number) ?? 12

  const isNight   = worldTime < 5.5 || worldTime > 21.5
  const isDawn    = worldTime >= 5.5 && worldTime < 7
  const isEvening = worldTime >= 19 && worldTime <= 21.5

  const settlementMap = new Map(
    (settlements ?? []).map(s => [s.id, { x: Number(s.position_x), y: Number(s.position_y) }])
  )

  const updates = persons.map(p => {
    const home = p.residence_id ? settlementMap.get(p.residence_id) : null
    const homeX = home?.x ?? 400
    const homeY = home?.y ?? 380

    const occ = (p.occupation ?? 'default').toLowerCase()
    const occKey = Object.keys(OCCUPATION_ZONES).find(k => occ.includes(k)) ?? 'default'
    const zones = OCCUPATION_ZONES[occKey]

    // Deterministic zone selection per person (no jitter between ticks)
    const zoneIdx = Math.floor(Math.abs((homeX * 7 + homeY * 3 + p.id.charCodeAt(0)) % zones.length))
    const workZone = zones[zoneIdx]

    let tx: number, ty: number
    const roll = Math.random()

    if (isNight) {
      // Night: tight cluster around settlement fire
      const angle = Math.random() * Math.PI * 2
      const dist = 20 + Math.random() * 35
      tx = homeX + Math.cos(angle) * dist
      ty = homeY + Math.sin(angle) * dist * 0.7
    } else if (isDawn) {
      // Dawn: half at home, half heading out
      if (roll < 0.5) {
        tx = homeX + (Math.random() - 0.5) * 50
        ty = homeY + (Math.random() - 0.5) * 40
      } else {
        tx = (workZone.x + homeX * 2) / 3 + (Math.random() - 0.5) * 60
        ty = (workZone.y + homeY * 2) / 3 + (Math.random() - 0.5) * 50
      }
    } else if (isEvening) {
      // Evening: heading back toward home
      if (roll < 0.6) {
        tx = homeX + (Math.random() - 0.5) * 60
        ty = homeY + (Math.random() - 0.5) * 50
      } else {
        tx = (workZone.x + homeX) / 2 + (Math.random() - 0.5) * 70
        ty = (workZone.y + homeY) / 2 + (Math.random() - 0.5) * 60
      }
    } else {
      // Daytime: mostly at work zone, occasional social/home visits
      if (roll < 0.6) {
        // Working in their zone
        tx = workZone.x + (Math.random() - 0.5) * 120
        ty = workZone.y + (Math.random() - 0.5) * 90
      } else if (roll < 0.8) {
        // Social movement: toward another person or between zones
        const spread = 180
        tx = workZone.x + (Math.random() - 0.5) * spread
        ty = workZone.y + (Math.random() - 0.5) * spread * 0.7
      } else {
        // Brief return home (meal, rest)
        tx = homeX + (Math.random() - 0.5) * 55
        ty = homeY + (Math.random() - 0.5) * 45
      }
    }

    // Smooth step: 18% toward target keeps movement fluid without snapping
    const newX = clamp(Number(p.pos_x) + (tx - Number(p.pos_x)) * 0.18, 30, 770)
    const newY = clamp(Number(p.pos_y) + (ty - Number(p.pos_y)) * 0.18, 50, 510)

    const dayActions = getOccupationActions(occ, isNight)
    const action = Math.random() < 0.1
      ? dayActions[Math.floor(Math.random() * dayActions.length)]
      : p.current_action

    return { id: p.id, pos_x: Math.round(newX), pos_y: Math.round(newY), current_action: action }
  })

  // Batch update in chunks of 20
  for (let i = 0; i < updates.length; i += 20) {
    const chunk = updates.slice(i, i + 20)
    await Promise.all(
      chunk.map(u =>
        db.from('persons')
          .update({ pos_x: u.pos_x, pos_y: u.pos_y, current_action: u.current_action })
          .eq('id', u.id)
      )
    )
  }
}

export async function POST() {
  try {
    const db = createAdminClient()

    const { data: world } = await db.from('worlds').select('id, status').eq('slug', 'first-valley').single()
    if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })
    if (world.status === 'paused') return NextResponse.json({ skipped: true, reason: 'paused' })

    await runSimulationTick('first-valley')
    await movePeople(world.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[tick] Error:', err)
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 })
  }
}
