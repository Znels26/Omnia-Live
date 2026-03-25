import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

const anthropic = new Anthropic()

export async function POST() {
  try {
    const db = createAdminClient()

    const { data: world } = await db
      .from('worlds')
      .select('id, in_game_day, in_game_year')
      .eq('slug', 'first-valley')
      .single()

    if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })

    const { data: persons } = await db
      .from('persons')
      .select('id, name, age, occupation, culture_id, health_score, happiness_score, need_hunger, need_stress, need_hope, need_fatigue, need_belonging, need_safety, trait_ambition, trait_aggression, trait_loyalty, trait_sociability, trait_curiosity, trait_spirituality, trait_generosity, trait_honesty, trait_vindictiveness, current_action, current_goal, metadata')
      .eq('world_id', world.id)
      .eq('is_featured', true)
      .eq('is_alive', true)
      .limit(8)

    if (!persons?.length) return NextResponse.json({ ok: true, processed: 0 })

    const [{ data: recentEvents }, { data: cultures }] = await Promise.all([
      db.from('public_events')
        .select('title, primary_person_id, in_game_day, significance_score')
        .eq('world_id', world.id)
        .order('created_at', { ascending: false })
        .limit(20),
      db.from('cultures')
        .select('id, name')
        .eq('world_id', world.id),
    ])

    const results = await Promise.allSettled(
      persons.map(p => decideForPerson(p, recentEvents ?? [], cultures ?? [], world, db))
    )

    return NextResponse.json({ ok: true, processed: results.filter(r => r.status === 'fulfilled').length })
  } catch (err) {
    console.error('[ai-tick]', err)
    return NextResponse.json({ error: 'AI tick failed' }, { status: 500 })
  }
}

async function decideForPerson(
  person: Record<string, unknown>,
  recentEvents: Record<string, unknown>[],
  cultures: Record<string, unknown>[],
  world: { id: string; in_game_day: number; in_game_year: number },
  db: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>
) {
  const memories: Array<{ description: string; day: number }> =
    ((person.metadata as Record<string, unknown>)?.memories as Array<{ description: string; day: number }> ?? []).slice(-10)

  const personalEvents = recentEvents
    .filter(e => e.primary_person_id === person.id)
    .slice(0, 5)

  const worldEvents = recentEvents
    .filter(e => e.primary_person_id !== person.id && Number(e.significance_score) >= 55)
    .slice(0, 4)

  const culture = cultures.find(c => c.id === person.culture_id)

  // Build trait summary (high/low)
  const traitMap: Array<[string, number]> = [
    ['ambitious', Number(person.trait_ambition)],
    ['aggressive', Number(person.trait_aggression)],
    ['loyal', Number(person.trait_loyalty)],
    ['sociable', Number(person.trait_sociability)],
    ['curious', Number(person.trait_curiosity)],
    ['spiritual', Number(person.trait_spirituality)],
    ['generous', Number(person.trait_generosity)],
    ['honest', Number(person.trait_honesty)],
    ['vindictive', Number(person.trait_vindictiveness)],
  ]
  const traits = traitMap
    .filter(([, v]) => v >= 70 || v <= 30)
    .map(([l, v]) => (v >= 70 ? l : `not ${l}`))
    .slice(0, 4)
    .join(', ') || 'balanced'

  // Build needs summary
  const pressing = [
    Number(person.need_hunger) > 55 && 'hungry',
    Number(person.need_fatigue) > 65 && 'tired',
    Number(person.need_stress) > 60 && 'stressed',
    Number(person.need_belonging) > 65 && 'lonely',
    Number(person.need_safety) > 65 && 'afraid',
    Number(person.need_hope) > 65 && 'losing hope',
  ].filter(Boolean).join(', ') || 'feeling okay'

  const userPrompt = `Character: ${person.name}, age ${person.age}, ${person.occupation || 'villager'} of the ${(culture?.name as string) ?? 'valley'}.
Day ${world.in_game_day}, Year ${world.in_game_year}.
Personality: ${traits}. State: ${pressing}. Health ${person.health_score}%. Happiness ${person.happiness_score}%.
${person.current_goal ? `Ongoing goal: "${person.current_goal}"` : ''}

${personalEvents.length ? `Their recent events:\n${personalEvents.map(e => `- ${e.title} (day ${e.in_game_day})`).join('\n')}` : ''}
${worldEvents.length ? `\nWorld events:\n${worldEvents.map(e => `- ${e.title}`).join('\n')}` : ''}
${memories.length ? `\nMemories:\n${memories.map(m => `- ${m.description} (day ${m.day})`).join('\n')}` : ''}

What is ${person.name} doing and thinking RIGHT NOW? Reply ONLY with valid JSON, no markdown:
{"action":"present-tense activity 5-8 words","goal":"what they want most 8-12 words","thought":"a vivid inner thought 10-15 words"}`

  let parsed: { action?: string; goal?: string; thought?: string } = {}

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: 'You are a character simulator for First Valley, a living world watched by real players. Generate authentic, era-appropriate (pre-industrial) character thoughts. Be specific and vivid. No modern slang.',
      messages: [{ role: 'user', content: userPrompt }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    try { parsed = JSON.parse(raw) } catch {
      const m = raw.match(/\{[\s\S]*?\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch { /* ignore */ } }
    }
  } catch (err) {
    console.error(`[ai-tick] Haiku failed for ${person.name}:`, err)
    return
  }

  if (!parsed.action) return

  const newMemory = parsed.thought
    ? { description: parsed.thought, day: world.in_game_day, importance: 5 }
    : null

  const existingMeta = (person.metadata as Record<string, unknown>) ?? {}
  const existingMems: Json[] = (existingMeta.memories as Json[] ?? [])
  const updatedMems: Json[] = newMemory ? [...existingMems.slice(-19), newMemory as unknown as Json] : existingMems

  await db.from('persons').update({
    current_action: parsed.action,
    ...(parsed.goal ? { current_goal: parsed.goal } : {}),
    metadata: { ...existingMeta, memories: updatedMems } as Json,
  }).eq('id', person.id as string)
}
