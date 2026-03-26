import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import type { Json } from '@/types/database'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { personId } = await req.json()
    if (!personId) return NextResponse.json({ error: 'Missing personId' }, { status: 400 })

    const db = createAdminClient()

    const { data: person } = await db
      .from('persons')
      .select('id, name, age, occupation, health_score, happiness_score, current_goal, current_action, metadata, world_id')
      .eq('id', personId)
      .single()

    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

    const { data: world } = await db
      .from('worlds')
      .select('id, in_game_day, in_game_year')
      .eq('id', person.world_id)
      .single()

    if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })

    // AI generates an inspiring message for this specific person
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: `You write brief, meaningful moments of divine inspiration for Stone Age villagers. 2 sentences maximum. No modern concepts.`,
      messages: [{
        role: 'user',
        content: `A divine presence touches ${person.name} (${person.occupation ?? 'villager'}, age ${person.age}). Their current state: ${person.current_action ?? 'resting'}. Write a 1-sentence inspiration they feel, then a 1-sentence action they take in response. Era-appropriate, vivid.`,
      }],
    })

    const inspiration = msg.content[0].type === 'text' ? msg.content[0].text.trim() : 'A warm feeling of purpose fills them.'

    // Boost happiness significantly, restore some health
    await db.from('persons').update({
      happiness_score: Math.min(10, (Number(person.happiness_score) ?? 6) + 3),
      health_score: Math.min(10, (Number(person.health_score) ?? 7) + 1),
      current_action: 'Standing still, touched by something unseen',
    }).eq('id', personId)

    // Create a public event for this divine touch
    const meta = (person.metadata ?? {}) as Record<string, unknown>
    const existingMems = (meta.memories as Json[] ?? [])
    const newMem = { description: inspiration, day: world.in_game_day, importance: 8 }
    await db.from('persons').update({
      metadata: { ...meta, memories: [...existingMems.slice(-19), newMem as unknown as Json] } as Json,
    }).eq('id', personId)

    await db.from('public_events').insert({
      world_id: person.world_id,
      event_type: 'MIRACLE',
      title: `A divine touch reaches ${person.name}`,
      description: inspiration,
      primary_person_id: personId,
      significance_score: 70,
      is_milestone: false,
      is_featured: true,
      in_game_day: world.in_game_day,
      in_game_year: world.in_game_year,
      metadata: {} as Json,
    })

    return NextResponse.json({ ok: true, inspiration })
  } catch (err) {
    console.error('[inspire]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
