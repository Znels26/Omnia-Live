import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import type { Json } from '@/types/database'

const anthropic = new Anthropic()

const GOD_EMAIL = 'zacharynelson96@gmail.com'

// ---------------------------------------------------------------------------
// Auth guard — only the God Mode user can call this
// ---------------------------------------------------------------------------
async function requireGod() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated', status: 401 }
  if (user.email !== GOD_EMAIL) return { error: 'Forbidden', status: 403 }
  return { user }
}

// ---------------------------------------------------------------------------
// GET — fetch current world state for the God panel
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await requireGod()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const db = createAdminClient()
  const [
    { data: world },
    { data: persons },
    { data: settlements },
    { data: recentEvents },
  ] = await Promise.all([
    db.from('worlds').select('*').eq('slug', 'first-valley').single(),
    db.from('persons').select('id, name, is_alive, occupation, health_score, is_featured').eq('world_id', (await db.from('worlds').select('id').eq('slug', 'first-valley').single()).data?.id ?? '').limit(200),
    db.from('settlements').select('id, name, settlement_type').limit(50),
    db.from('public_events').select('id, title, event_type, significance_score, in_game_day').order('created_at', { ascending: false }).limit(20),
  ])

  return NextResponse.json({ world, persons, settlements, recentEvents })
}

// ---------------------------------------------------------------------------
// POST — perform a god action
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = await requireGod()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as {
    action: string
    payload?: Record<string, unknown>
  }

  const db = createAdminClient()

  // Fetch world id once
  const { data: worldRow } = await db.from('worlds').select('id, config, in_game_day, in_game_year').eq('slug', 'first-valley').single()
  if (!worldRow) return NextResponse.json({ error: 'World not found' }, { status: 404 })
  const worldId = worldRow.id
  const worldDay = worldRow.in_game_day ?? 1
  const worldYear = worldRow.in_game_year ?? 1
  const worldConfig = (worldRow.config ?? {}) as Record<string, unknown>

  switch (body.action) {

    // ── World controls ──────────────────────────────────────────────────────

    case 'RESTART_WORLD': {
      // 1. Wipe all events for this world
      await db.from('public_events').delete().eq('world_id', worldId)

      // 2. Reset world row — clean config, day 1 year 1
      await db.from('worlds').update({
        in_game_day: 1,
        in_game_year: 1,
        era: 'Dawn Age',
        status: 'active',
        config: {
          season: 'spring',
          weather: 'clear',
        },
      }).eq('id', worldId)

      // 3. Fetch all persons for this world (alive or dead)
      const { data: allPersons } = await db
        .from('persons')
        .select('id, residence_id')
        .eq('world_id', worldId)

      // 4. Fetch settlements so we can scatter persons back near their home
      const { data: allSettlements } = await db
        .from('settlements')
        .select('id, position_x, position_y')
        .eq('world_id', worldId)
      const settlementMap = new Map(
        (allSettlements ?? []).map(s => [s.id, { x: Number(s.position_x), y: Number(s.position_y) }])
      )

      // 5. Reset every person to full health, alive, clean metadata
      if (allPersons?.length) {
        for (let i = 0; i < allPersons.length; i += 30) {
          const chunk = allPersons.slice(i, i + 30)
          await Promise.all(chunk.map(p => {
            const home = p.residence_id ? settlementMap.get(p.residence_id) : null
            const hx = home?.x ?? 400
            const hy = home?.y ?? 380
            // Scatter slightly around home
            const angle = Math.random() * Math.PI * 2
            const dist = 20 + Math.random() * 40
            return db.from('persons').update({
              is_alive: true,
              health_score: 85 + Math.floor(Math.random() * 15),
              happiness_score: 60 + Math.floor(Math.random() * 20),
              need_hunger: Math.floor(Math.random() * 15),
              need_fatigue: Math.floor(Math.random() * 15),
              need_stress: Math.floor(Math.random() * 10),
              need_hope: Math.floor(Math.random() * 10),
              current_action: null,
              current_goal: null,
              pos_x: Math.round(Math.max(30, Math.min(770, hx + Math.cos(angle) * dist))),
              pos_y: Math.round(Math.max(50, Math.min(510, hy + Math.sin(angle) * dist * 0.7))),
              metadata: {},
            }).eq('id', p.id)
          }))
        }
      }

      // 6. Insert a single genesis event
      await db.from('public_events').insert({
        world_id: worldId,
        event_type: 'CUSTOM',
        title: 'The world begins again',
        description: 'The valley wakes. The old history is gone. Everything starts fresh.',
        significance_score: 100,
        is_milestone: true,
        is_featured: true,
        in_game_day: 1,
        in_game_year: 1,
        metadata: { source: 'restart' },
      })

      return NextResponse.json({
        ok: true,
        message: `World reset. ${allPersons?.length ?? 0} characters restored. All events cleared.`,
      })
    }

    case 'PAUSE_WORLD': {
      await db.from('worlds').update({ status: 'paused' }).eq('id', worldId)
      return NextResponse.json({ ok: true, message: 'World paused' })
    }

    case 'RESUME_WORLD': {
      await db.from('worlds').update({ status: 'active' }).eq('id', worldId)
      return NextResponse.json({ ok: true, message: 'World resumed' })
    }

    case 'SET_SEASON': {
      const season = body.payload?.season as string
      await db.from('worlds').update({ config: { ...worldConfig, season } }).eq('id', worldId)
      return NextResponse.json({ ok: true, message: `Season set to ${season}` })
    }

    case 'SET_WORLD_TIME': {
      const hour = Number(body.payload?.hour ?? 12)
      await db.from('worlds').update({ config: { ...worldConfig, world_time: hour } }).eq('id', worldId)
      return NextResponse.json({ ok: true, message: `World time set to ${hour}:00` })
    }

    // ── Weather events ──────────────────────────────────────────────────────

    case 'SET_WEATHER': {
      const weather = body.payload?.weather as string
      await db.from('worlds').update({ config: { ...worldConfig, weather } }).eq('id', worldId)
      const descs: Record<string, string> = {
        clear:    'The sky clears. Light falls across the valley like a blessing.',
        rain:     'Rain sweeps in from the hills, drumming on every roof and leaf.',
        storm:    'A violent storm tears through the valley. Trees bend. People shelter.',
        snow:     'Snow falls thick and silent. The valley turns white and still.',
        drought:  'The sun beats down without mercy. The ground cracks. Water is scarce.',
        fog:      'A thick fog rolls in from the lowlands. Nothing can be seen beyond ten paces.',
        heatwave: 'Oppressive heat settles over the valley. The air shimmers.',
      }
      const desc = descs[weather] ?? `The weather shifts to ${weather}.`
      await insertGodEvent(db, worldId, `Weather changes: ${weather}`, desc, 'WEATHER', 60)
      // Trigger consciousness reaction for storm/snow/drought
      if (['storm', 'snow', 'drought', 'heatwave'].includes(weather)) {
        triggerConsciousnessReaction(db, worldId, worldDay, worldYear, 'storm', desc).catch(console.error)
      }
      return NextResponse.json({ ok: true, message: `Weather set to ${weather}` })
    }

    // ── Wars & conflict ─────────────────────────────────────────────────────

    case 'START_WAR': {
      const clanA = body.payload?.clanA as string
      const clanB = body.payload?.clanB as string
      const reason = (body.payload?.reason as string) || 'territorial dispute'
      await insertGodEvent(
        db, worldId,
        `War breaks out between ${clanA} and ${clanB}`,
        `The old tensions finally snap. ${clanA} and ${clanB} clash openly over ${reason}. The valley holds its breath.`,
        'CONFLICT', 90
      )
      await db.from('worlds').update({
        config: { ...worldConfig, war: { clanA, clanB, reason, active: true } }
      }).eq('id', worldId)
      // Every being reacts to war immediately
      triggerConsciousnessReaction(
        db, worldId, worldDay, worldYear, 'war',
        `Open war has broken out between ${clanA} and ${clanB} over ${reason}. The valley is no longer safe.`
      ).catch(console.error)
      return NextResponse.json({ ok: true, message: `War started between ${clanA} and ${clanB}` })
    }

    case 'END_WAR': {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { war: _war, ...config2 } = worldConfig
      await db.from('worlds').update({ config: config2 as import('@/types/database').Json }).eq('id', worldId)
      await insertGodEvent(
        db, worldId,
        'The war comes to an end',
        'Exhausted, both sides lay down their weapons. Uneasy peace returns to the valley.',
        'CONFLICT', 85
      )
      return NextResponse.json({ ok: true, message: 'War ended' })
    }

    // ── Characters ──────────────────────────────────────────────────────────

    case 'KILL_CHARACTER': {
      const personId = body.payload?.personId as string
      const { data: person } = await db.from('persons').select('name').eq('id', personId).single()
      if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
      await db.from('persons').update({ is_alive: false, health_score: 0 }).eq('id', personId)
      await insertGodEvent(
        db, worldId,
        `${person.name} has fallen`,
        `${person.name} is gone. The valley will not forget them.`,
        'DEATH', 80
      )
      return NextResponse.json({ ok: true, message: `${person.name} killed` })
    }

    case 'HEAL_CHARACTER': {
      const personId = body.payload?.personId as string
      const { data: person } = await db.from('persons').select('name').eq('id', personId).single()
      if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
      await db.from('persons').update({
        health_score: 100, need_hunger: 20, need_fatigue: 10, need_stress: 10
      }).eq('id', personId)
      return NextResponse.json({ ok: true, message: `${person.name} healed` })
    }

    case 'FEATURE_CHARACTER': {
      const personId = body.payload?.personId as string
      const featured = body.payload?.featured !== false
      await db.from('persons').update({ is_featured: featured }).eq('id', personId)
      return NextResponse.json({ ok: true, message: `Character ${featured ? 'featured' : 'unfeatured'}` })
    }

    // ── World events ────────────────────────────────────────────────────────

    case 'CREATE_EVENT': {
      const title = body.payload?.title as string
      const description = body.payload?.description as string
      const eventType = (body.payload?.eventType as string) || 'CUSTOM'
      const significance = Number(body.payload?.significance ?? 70)
      await insertGodEvent(db, worldId, title, description, eventType, significance)
      return NextResponse.json({ ok: true, message: 'Event created' })
    }

    case 'TRIGGER_PLAGUE': {
      const severity = (body.payload?.severity as string) || 'moderate'
      const severityMap: Record<string, { healthDmg: number; desc: string }> = {
        mild:   { healthDmg: 10, desc: 'A mild sickness spreads through the settlement. Most recover, but all are weakened.' },
        moderate: { healthDmg: 25, desc: 'A plague moves through the valley. Healers are overwhelmed. Many suffer.' },
        severe: { healthDmg: 45, desc: 'A devastating plague sweeps the land. The dead are counted in dozens.' },
      }
      const { healthDmg, desc } = severityMap[severity] ?? severityMap.moderate
      // Damage all living persons
      const { data: alive } = await db.from('persons').select('id, health_score').eq('world_id', worldId).eq('is_alive', true)
      if (alive?.length) {
        for (let i = 0; i < alive.length; i += 50) {
          const chunk = alive.slice(i, i + 50)
          await Promise.all(chunk.map(p =>
            db.from('persons').update({
              health_score: Math.max(5, (p.health_score ?? 80) - healthDmg - Math.floor(Math.random() * 15))
            }).eq('id', p.id)
          ))
        }
      }
      await insertGodEvent(db, worldId, `A ${severity} plague strikes the valley`, desc, 'PLAGUE', 95)
      triggerConsciousnessReaction(db, worldId, worldDay, worldYear, 'plague', desc).catch(console.error)
      return NextResponse.json({ ok: true, message: `${severity} plague triggered` })
    }

    case 'TRIGGER_FAMINE': {
      // Spike hunger for all living persons
      const { data: alive } = await db.from('persons').select('id').eq('world_id', worldId).eq('is_alive', true)
      if (alive?.length) {
        for (let i = 0; i < alive.length; i += 50) {
          const chunk = alive.slice(i, i + 50)
          await Promise.all(chunk.map(p =>
            db.from('persons').update({ need_hunger: 75 + Math.floor(Math.random() * 20) }).eq('id', p.id)
          ))
        }
      }
      const famineDesc = 'The stores run empty. Children cry with hunger. The coming weeks will test every soul.'
      await insertGodEvent(db, worldId, 'Famine grips the valley', famineDesc, 'FAMINE', 90)
      triggerConsciousnessReaction(db, worldId, worldDay, worldYear, 'famine', famineDesc).catch(console.error)
      return NextResponse.json({ ok: true, message: 'Famine triggered' })
    }

    case 'BOOST_CLAN': {
      const settlementId = body.payload?.settlementId as string
      // Boost all persons in a settlement
      const { data: residents } = await db.from('persons')
        .select('id')
        .eq('residence_id', settlementId)
        .eq('is_alive', true)
      if (residents?.length) {
        await Promise.all(residents.map(p =>
          db.from('persons').update({
            health_score: 100, need_hunger: 10, need_fatigue: 10, need_stress: 5, happiness_score: 90
          }).eq('id', p.id)
        ))
      }
      return NextResponse.json({ ok: true, message: `Clan boosted (${residents?.length ?? 0} persons)` })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
  }
}

// ---------------------------------------------------------------------------
// Consciousness cascade — called after major god actions so beings react
// ---------------------------------------------------------------------------

// Deterministic action pools per occupation × crisis type
const CRISIS_ACTIONS: Record<string, Record<string, string[]>> = {
  plague: {
    healer:  ['treating the sick with trembling hands', 'boiling herbs as fast as the fire allows', 'moving between the dying, refusing to stop'],
    hunter:  ['keeping away from the settlement, watching from distance', 'hunting alone, afraid to return', 'tracking the edge of the forest, uneasy'],
    farmer:  ['burning the infected stores of grain', 'boiling every drop of water before drinking', 'keeping children inside the shelter'],
    guard:   ['turning away strangers at the settlement edge', 'burning the belongings of the dead', 'patrolling with cloth wrapped over their face'],
    trader:  ['refusing to trade, turning away all outsiders', 'burying their goods before plague reaches them', 'counting who is still alive among their contacts'],
    scout:   ['scouting for healthy settlements to flee toward', 'watching the sick from a safe distance', 'tracking how far the illness has spread'],
    crafter: ['making masks and wrappings for protection', 'boarding up their workshop', 'working alone, letting no one near'],
    fisher:  ['staying on the water, away from the sick', 'fishing all day to feed those too weak to work', 'avoiding the settlement shores'],
    default: ['staying inside, afraid to breathe', 'praying for the sickness to pass', 'watching the horizon for any sign of hope'],
  },
  war: {
    hunter:  ['stalking the enemy through the trees', 'setting ambushes along the forest paths', 'tracking enemy movements from the ridge'],
    guard:   ['standing at the settlement walls, spear in hand', 'drilling the young men for battle', 'reinforcing the palisade through the night'],
    farmer:  ['hiding stores of food underground', 'moving the children away from the fighting', 'digging a shelter beneath the grain stores'],
    healer:  ['preparing bandages and poultices for the wounded', 'setting up a healing space away from the battle', 'tending to the first of the wounded'],
    trader:  ['hiding valuable goods before raiders arrive', 'negotiating desperately for a truce', 'calculating what the war will cost the settlement'],
    scout:   ['tracking enemy forces through the valley', 'reporting positions back to the settlement', 'moving through the forest unseen'],
    crafter: ['hammering spear points all through the night', 'repairing armor and weapons brought to them', 'forging what is needed for the fight ahead'],
    fisher:  ['hiding boats in the reeds', 'watching the river crossings for enemies', 'supplying fish to feed the fighters'],
    default: ['hiding with family inside the shelter', 'watching the smoke on the horizon in fear', 'clutching their children and waiting'],
  },
  famine: {
    hunter:  ['tracking through empty forest all day, finding nothing', 'pushing deeper into unknown territory for game', 'setting every trap they know in desperate hope'],
    farmer:  ['digging through dry ground for any root or seed', 'planting in every patch of soil they can find', 'rationing the last of the stored grain'],
    healer:  ['identifying every wild plant that can be eaten', 'treating the malnourished children', 'watching the weakest members with heavy worry'],
    guard:   ['standing watch over the dwindling food stores', 'enforcing fair rationing through argument and authority', 'keeping desperate people from stealing the last grain'],
    trader:  ['trading everything they have for a sack of grain', 'traveling far to find food', 'negotiating with distant settlements for emergency supplies'],
    scout:   ['searching every valley and hillside for food sources', 'tracking animals through increasingly empty land', 'scouting for settlements that still have stores to trade'],
    crafter: ['fashioning better tools for foraging and hunting', 'making traps and nets from whatever they can find', 'repairing everything that needs fixing, hungry and focused'],
    fisher:  ['fishing from before dawn to after dark', 'teaching others to fish who have never tried', 'pulling every net and line they own through the water'],
    default: ['searching the hillsides for anything to eat', 'sharing what little remains with the children first', 'watching the sky and praying for rain'],
  },
  storm: {
    default: ['sheltering inside, listening to the wind tear at the walls', 'checking on neighbors through the driving rain', 'securing the roof before it lifts away'],
    guard:   ['securing the settlement gates against the storm', 'checking on the most exposed shelters', 'keeping watch from the doorway'],
    healer:  ['tending to those hurt by flying debris', 'checking on the elderly and very young', 'keeping a fire lit through the storm'],
    fisher:  ['pulling boats up from the water frantically', 'watching in horror as waves take the nets', 'lashing everything to the posts and praying'],
  },
}

function getCrisisAction(occupation: string | null, crisisType: string): string {
  const occ = (occupation ?? 'default').toLowerCase()
  const pool = CRISIS_ACTIONS[crisisType] ?? {}
  const key = Object.keys(pool).find(k => occ.includes(k)) ?? 'default'
  const actions = pool[key] ?? pool['default'] ?? ['watching the crisis unfold in fear']
  return actions[Math.floor(Math.random() * actions.length)]
}

async function triggerConsciousnessReaction(
  db: ReturnType<typeof createAdminClient>,
  worldId: string,
  worldDay: number,
  worldYear: number,
  crisisType: 'plague' | 'war' | 'famine' | 'storm' | string,
  crisisDescription: string
) {
  // Fetch all alive persons
  const { data: alive } = await db
    .from('persons')
    .select('id, name, age, occupation, is_featured, health_score, need_stress, trait_aggression, trait_sociability, trait_spirituality, metadata, current_goal')
    .eq('world_id', worldId)
    .eq('is_alive', true)
    .limit(200)

  if (!alive?.length) return

  const featured = alive.filter(p => p.is_featured)

  // 1. Update ALL persons with deterministic crisis actions (fast, no AI)
  for (let i = 0; i < alive.length; i += 30) {
    const chunk = alive.slice(i, i + 30)
    await Promise.all(chunk.map(p =>
      db.from('persons').update({
        current_action: getCrisisAction(p.occupation, crisisType),
        need_stress: Math.min(100, (p.need_stress ?? 20) + 25),
      }).eq('id', p.id)
    ))
  }

  // 2. For featured characters: run Claude Haiku for rich personal reactions
  //    and generate a personal event for each
  const reactionPromises = featured.slice(0, 6).map(async (person) => {
    try {
      const meta = (person.metadata as Record<string, unknown>) ?? {}

      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `You simulate a conscious Stone Age person experiencing a crisis. Be visceral, specific, and human. No modern language. Reply ONLY with valid JSON.`,
        messages: [{
          role: 'user',
          content: `${person.name}, age ${person.age}, ${person.occupation ?? 'villager'}.
CRISIS: ${crisisDescription}
Their nature: aggression ${person.trait_aggression ?? 5}/10, social ${person.trait_sociability ?? 5}/10, spiritual ${person.trait_spirituality ?? 5}/10.
Health: ${Math.round(person.health_score ?? 80)}%.

What is ${person.name} doing and feeling RIGHT NOW in response to this crisis?
{"action":"specific thing they are doing this moment, 6-10 words","thought":"their raw inner thought, 10-15 words","event_title":"a vivid event headline for observers, 8-12 words","event_desc":"one powerful sentence about what they do in this crisis"}`,
        }],
      })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      let parsed: { action?: string; thought?: string; event_title?: string; event_desc?: string } = {}
      try { parsed = JSON.parse(raw) } catch {
        const m = raw.match(/\{[\s\S]*?\}/)
        if (m) { try { parsed = JSON.parse(m[0]) } catch { /* ignore */ } }
      }

      if (!parsed.action) return

      // Update person with AI-generated reaction
      const newMemory = parsed.thought
        ? { description: parsed.thought, day: worldDay, importance: 8 }
        : null
      const existingMems: Json[] = (meta.memories as Json[] ?? [])
      const updatedMems: Json[] = newMemory
        ? [...existingMems.slice(-19), newMemory as unknown as Json]
        : existingMems

      await db.from('persons').update({
        current_action: parsed.action,
        metadata: { ...meta, memories: updatedMems } as Json,
      }).eq('id', person.id)

      // Insert a personal reaction event
      if (parsed.event_title) {
        await db.from('public_events').insert({
          world_id: worldId,
          event_type: crisisType.toUpperCase(),
          title: parsed.event_title,
          description: parsed.event_desc ?? crisisDescription,
          primary_person_id: person.id,
          significance_score: 65,
          is_milestone: false,
          is_featured: true,
          in_game_day: worldDay,
          in_game_year: worldYear,
          metadata: { source: 'consciousness_reaction', crisis: crisisType } as Json,
        })
      }
    } catch (err) {
      console.error(`[god/react] Failed for ${person.name}:`, err)
    }
  })

  await Promise.allSettled(reactionPromises)
}

async function insertGodEvent(
  db: ReturnType<typeof createAdminClient>,
  worldId: string,
  title: string,
  description: string,
  eventType: string,
  significance: number
) {
  const { data: world } = await db.from('worlds').select('in_game_day, in_game_year').eq('id', worldId).single()
  await db.from('public_events').insert({
    world_id: worldId,
    event_type: eventType,
    title,
    description,
    significance_score: significance,
    is_milestone: significance >= 80,
    is_featured: significance >= 80,
    in_game_day: world?.in_game_day ?? 1,
    in_game_year: world?.in_game_year ?? 1,
    metadata: { source: 'god_mode' },
  })
}
