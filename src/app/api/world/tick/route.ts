import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSimulationTick } from '@/lib/simulation/engine'
import { clamp } from '@/lib/utils'

// Moved persons toward their settlement or a random wandering target
async function movePeople(worldId: string) {
  const db = createAdminClient()

  const [{ data: persons }, { data: settlements }] = await Promise.all([
    db.from('persons').select('id, pos_x, pos_y, residence_id, is_alive, current_action').eq('world_id', worldId).eq('is_alive', true).limit(200),
    db.from('settlements').select('id, position_x, position_y').eq('world_id', worldId),
  ])

  if (!persons?.length) return

  const settlementMap = new Map(
    (settlements ?? []).map(s => [s.id, { x: Number(s.position_x), y: Number(s.position_y) }])
  )

  const ACTIONS = [
    'Gathering food', 'Tending the fire', 'Hunting nearby', 'Collecting water',
    'Patrolling the perimeter', 'Resting', 'Talking with neighbors', 'Tending crops',
    'Crafting tools', 'Watching the horizon', 'Praying at the stones', 'Teaching children',
    'Mending cloth', 'Sharpening blades', 'Tending the sick', 'Trading goods',
  ]

  const updates = persons.map(p => {
    const home = p.residence_id ? settlementMap.get(p.residence_id) : null
    const homeX = home?.x ?? 400
    const homeY = home?.y ?? 300

    // 70% wander near home, 20% move toward home, 10% explore further
    const roll = Math.random()
    let tx: number, ty: number

    if (roll < 0.7) {
      // Wander within ~80px of home
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * 80
      tx = homeX + Math.cos(angle) * dist
      ty = homeY + Math.sin(angle) * dist
    } else if (roll < 0.9) {
      // Move toward home
      tx = homeX + (Math.random() - 0.5) * 30
      ty = homeY + (Math.random() - 0.5) * 30
    } else {
      // Explore — up to 150px from home
      const angle = Math.random() * Math.PI * 2
      const dist = 80 + Math.random() * 70
      tx = homeX + Math.cos(angle) * dist
      ty = homeY + Math.sin(angle) * dist
    }

    // Step 30% toward target position (smooth movement over multiple ticks)
    const newX = clamp(Number(p.pos_x) + (tx - Number(p.pos_x)) * 0.3, 10, 790)
    const newY = clamp(Number(p.pos_y) + (ty - Number(p.pos_y)) * 0.3, 40, 520)

    const action = Math.random() < 0.15
      ? ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
      : p.current_action

    return { id: p.id, pos_x: Math.round(newX), pos_y: Math.round(newY), current_action: action }
  })

  // Batch update in chunks of 20
  for (let i = 0; i < updates.length; i += 20) {
    const chunk = updates.slice(i, i + 20)
    await Promise.all(
      chunk.map(u =>
        db.from('persons').update({ pos_x: u.pos_x, pos_y: u.pos_y, current_action: u.current_action }).eq('id', u.id)
      )
    )
  }
}

export async function POST() {
  try {
    const db = createAdminClient()

    // Get world ID
    const { data: world } = await db.from('worlds').select('id, status').eq('slug', 'first-valley').single()
    if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })
    if (world.status === 'paused') return NextResponse.json({ skipped: true, reason: 'paused' })

    // Run simulation tick (updates DB: persons stats, events, clan relations, world day)
    const result = await runSimulationTick('first-valley')

    // Move people around the map
    await movePeople(world.id)

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[tick] Error:', err)
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 })
  }
}
