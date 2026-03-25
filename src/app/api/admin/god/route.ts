import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const { data: worldRow } = await db.from('worlds').select('id, config').eq('slug', 'first-valley').single()
  if (!worldRow) return NextResponse.json({ error: 'World not found' }, { status: 404 })
  const worldId = worldRow.id
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
      await insertGodEvent(
        db, worldId,
        'Famine grips the valley',
        'The stores run empty. Children cry with hunger. The coming weeks will test every soul.',
        'FAMINE', 90
      )
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
