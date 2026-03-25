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
      .select('id, in_game_day, in_game_year, config')
      .eq('slug', 'first-valley')
      .single()

    if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })

    const [{ data: persons }, { data: cultures }, { data: events }, { data: votes }] = await Promise.all([
      db.from('persons')
        .select('name, age, occupation, health_score, happiness_score, is_featured, need_stress, current_goal, trait_ambition, trait_aggression')
        .eq('world_id', world.id).eq('is_alive', true).limit(30),
      db.from('cultures')
        .select('name, population_estimate, metadata')
        .eq('world_id', world.id),
      db.from('public_events')
        .select('title, significance_score, event_type, in_game_day')
        .eq('world_id', world.id)
        .order('created_at', { ascending: false })
        .limit(20),
      db.from('world_votes')
        .select('title, status')
        .eq('world_id', world.id)
        .in('status', ['open', 'upcoming'])
        .limit(3),
    ])

    const featured = (persons ?? []).filter(p => p.is_featured)

    const cultureLines = (cultures ?? []).map(c => {
      const meta = (c.metadata ?? {}) as Record<string, unknown>
      const rels = (meta.relations ?? {}) as Record<string, string>
      const hostile = Object.entries(rels).filter(([, v]) => v === 'hostile').map(([k]) => k)
      const allied = Object.entries(rels).filter(([, v]) => v === 'ally').map(([k]) => k)
      const relStr = [
        hostile.length ? `at war with ${hostile.join(', ')}` : '',
        allied.length ? `allied with ${allied.join(', ')}` : '',
      ].filter(Boolean).join('; ')
      return `${c.name} (${c.population_estimate} people)${relStr ? ` — ${relStr}` : ''}`
    }).join('\n')

    const bigEvents = (events ?? [])
      .filter(e => Number(e.significance_score) >= 55)
      .slice(0, 8)
      .map(e => `Day ${e.in_game_day}: ${e.title}`)
      .join('\n')

    const featuredLines = featured.map(p =>
      `${p.name} (${p.occupation}, health ${p.health_score}%, happiness ${p.happiness_score}%${p.current_goal ? `, wants: "${p.current_goal}"` : ''})`
    ).join('\n')

    const prompt = `You are the unseen narrator of First Valley — a living simulation watched by real subscribers.

WORLD STATE — Day ${world.in_game_day}, Year ${world.in_game_year}

Featured characters:
${featuredLines || 'None established yet'}

Cultures and relations:
${cultureLines || 'None'}

Significant recent events:
${bigEvents || 'Quiet period — nothing major'}

Open votes:
${(votes ?? []).map(v => v.title).join(', ') || 'None'}

Analyze the current dramatic situation. Reply ONLY with valid JSON, no markdown:
{
  "arc_title": "Compelling arc title, 6 words max",
  "arc_description": "Core dramatic tension in 1-2 sentences. Be specific about characters and stakes.",
  "tension": <integer 0-100>,
  "focus_character": "<name of most central character or null>",
  "focus_reason": "Why viewers should watch them — one vivid sentence",
  "omen": "One cryptic sentence hinting at what might unfold — do not be explicit"
}`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    let arc: Record<string, unknown> = {}
    try { arc = JSON.parse(raw) as Record<string, unknown> } catch {
      const m = raw.match(/\{[\s\S]*?\}/)
      if (m) { try { arc = JSON.parse(m[0]) as Record<string, unknown> } catch { /* ignore */ } }
    }

    if (!arc.arc_title) return NextResponse.json({ ok: false, reason: 'parse_failed' })

    const existingConfig = (world.config ?? {}) as Record<string, unknown>
    await db.from('worlds').update({
      config: {
        ...existingConfig,
        director_arc: { ...arc, generated_at: new Date().toISOString(), day: world.in_game_day },
      } as Json,
    }).eq('id', world.id)

    return NextResponse.json({ ok: true, arc })
  } catch (err) {
    console.error('[director]', err)
    return NextResponse.json({ error: 'Director failed' }, { status: 500 })
  }
}
