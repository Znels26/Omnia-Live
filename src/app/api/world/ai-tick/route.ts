import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import {
  getPersonSkills,
  getSkillSummary,
  getEraDescription,
  getClanEra,
} from '@/lib/simulation/skills'

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

    const [{ data: allPersons }, { data: cultures }, { data: recentEvents }] = await Promise.all([
      db.from('persons')
        .select('id, name, age, occupation, culture_id, is_featured, health_score, happiness_score, need_hunger, need_stress, need_hope, need_fatigue, need_belonging, need_safety, trait_ambition, trait_aggression, trait_loyalty, trait_sociability, trait_curiosity, trait_spirituality, trait_generosity, trait_honesty, trait_vindictiveness, current_action, current_goal, metadata, pos_x, pos_y')
        .eq('world_id', world.id)
        .eq('is_alive', true)
        .limit(100),
      db.from('cultures')
        .select('id, name, metadata')
        .eq('world_id', world.id),
      db.from('public_events')
        .select('title, primary_person_id, in_game_day, significance_score')
        .eq('world_id', world.id)
        .order('created_at', { ascending: false })
        .limit(25),
    ])

    const featured = (allPersons ?? []).filter(p => p.is_featured === true)
    // Fallback: if no is_featured column returned, treat first 8 as core
    const corePersons = featured.length > 0 ? featured.slice(0, 8) : (allPersons ?? []).slice(0, 8)

    if (!corePersons.length) return NextResponse.json({ ok: true, processed: 0, interactions: 0 })

    // Build era map per culture
    const eraMap: Record<string, string> = {}
    for (const culture of (cultures ?? [])) {
      const meta = (culture.metadata ?? {}) as Record<string, unknown>
      const discovered = Array.isArray(meta.technologies) ? meta.technologies as string[] : []
      eraMap[culture.id] = getEraDescription(getClanEra(discovered))
    }

    // Phase 1: Individual AI decisions for core characters
    const decisionResults = await Promise.allSettled(
      corePersons.map(p => decideForPerson(p, recentEvents ?? [], cultures ?? [], eraMap, world, db))
    )

    // Phase 2: Character interactions (proximity-based, max 4 per tick)
    const interactionResults = await runInteractions(
      allPersons ?? [],
      cultures ?? [],
      eraMap,
      recentEvents ?? [],
      world,
      db
    )

    return NextResponse.json({
      ok: true,
      processed: decisionResults.filter(r => r.status === 'fulfilled').length,
      interactions: interactionResults,
    })
  } catch (err) {
    console.error('[ai-tick]', err)
    return NextResponse.json({ error: 'AI tick failed' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Individual character decision
// ---------------------------------------------------------------------------

async function decideForPerson(
  person: Record<string, unknown>,
  recentEvents: Record<string, unknown>[],
  cultures: Record<string, unknown>[],
  eraMap: Record<string, string>,
  world: { id: string; in_game_day: number; in_game_year: number },
  db: ReturnType<typeof createAdminClient>
) {
  const meta = (person.metadata as Record<string, unknown>) ?? {}
  const memories: Array<{ description: string; day: number }> =
    (meta.memories as Array<{ description: string; day: number }> ?? []).slice(-10)

  const skills = getPersonSkills(person.metadata)
  const skillSummary = getSkillSummary(skills)
  const era = eraMap[person.culture_id as string] ?? 'Stone Age — fire, stone tools, early settlements'

  const personalEvents = recentEvents
    .filter(e => e.primary_person_id === person.id)
    .slice(0, 5)

  const worldEvents = recentEvents
    .filter(e => e.primary_person_id !== person.id && Number(e.significance_score) >= 55)
    .slice(0, 4)

  const culture = cultures.find(c => c.id === person.culture_id)

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

  const pressing = [
    Number(person.need_hunger) > 55 && 'hungry',
    Number(person.need_fatigue) > 65 && 'tired',
    Number(person.need_stress) > 60 && 'stressed',
    Number(person.need_belonging) > 65 && 'lonely',
    Number(person.need_safety) > 65 && 'afraid',
    Number(person.need_hope) > 65 && 'losing hope',
  ].filter(Boolean).join(', ') || 'feeling okay'

  const userPrompt = `Character: ${person.name}, age ${person.age}, ${person.occupation || 'villager'} of the ${(culture?.name as string) ?? 'valley'}.
Era: ${era}.
Day ${world.in_game_day}, Year ${world.in_game_year}.
Personality: ${traits}. State: ${pressing}. Health ${person.health_score}%. Happiness ${person.happiness_score}%.
Skills: ${skillSummary}.
${person.current_goal ? `Ongoing goal: "${person.current_goal}"` : ''}

${personalEvents.length ? `Recent personal events:\n${personalEvents.map(e => `- ${e.title} (day ${e.in_game_day})`).join('\n')}` : ''}
${worldEvents.length ? `\nWorld events:\n${worldEvents.map(e => `- ${e.title}`).join('\n')}` : ''}
${memories.length ? `\nMemories:\n${memories.map(m => `- ${m.description} (day ${m.day})`).join('\n')}` : ''}

What is ${person.name} doing and thinking RIGHT NOW? Be specific to their skills and era. Reply ONLY with valid JSON:
{"action":"present-tense activity 5-8 words","goal":"what they want most right now 8-12 words","thought":"a vivid inner thought reflecting their life 10-15 words"}`

  let parsed: { action?: string; goal?: string; thought?: string } = {}

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 160,
      system: `You are a character simulator for First Valley, a living civilisation watched by real players. Characters exist in ${era}. Generate authentic, era-appropriate thoughts and actions. A Stone Age character thinks about fire and flint, not books or markets. A Bronze Age character knows metal. Be vivid and specific. No modern language.`,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    try { parsed = JSON.parse(raw) } catch {
      const m = raw.match(/\{[\s\S]*?\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch { /* ignore */ } }
    }
  } catch (err) {
    console.error(`[ai-tick] Decision failed for ${person.name}:`, err)
    return
  }

  if (!parsed.action) return

  const newMemory = parsed.thought
    ? { description: parsed.thought, day: world.in_game_day, importance: 5 }
    : null

  const existingMems: Json[] = (meta.memories as Json[] ?? [])
  const updatedMems: Json[] = newMemory ? [...existingMems.slice(-19), newMemory as unknown as Json] : existingMems

  await db.from('persons').update({
    current_action: parsed.action as string,
    ...(parsed.goal ? { current_goal: parsed.goal as string } : {}),
    metadata: { ...meta, memories: updatedMems } as Json,
  }).eq('id', person.id as string)
}

// ---------------------------------------------------------------------------
// Character interaction pass
// ---------------------------------------------------------------------------

async function runInteractions(
  allPersons: Record<string, unknown>[],
  cultures: Record<string, unknown>[],
  eraMap: Record<string, string>,
  recentEvents: Record<string, unknown>[],
  world: { id: string; in_game_day: number; in_game_year: number },
  db: ReturnType<typeof createAdminClient>
): Promise<number> {
  // Find pairs of persons within proximity (~100px)
  const alive = allPersons.filter(p => (p as Record<string, unknown>).is_alive !== false)
  const pairs: Array<[Record<string, unknown>, Record<string, unknown>]> = []

  for (let i = 0; i < alive.length && pairs.length < 6; i++) {
    for (let j = i + 1; j < alive.length && pairs.length < 6; j++) {
      const a = alive[i], b = alive[j]
      const dx = Number(a.pos_x) - Number(b.pos_x)
      const dy = Number(a.pos_y) - Number(b.pos_y)
      if (Math.sqrt(dx * dx + dy * dy) < 100) {
        pairs.push([a, b])
      }
    }
  }

  if (pairs.length === 0) return 0

  // Only run interactions for a random subset (max 3, 40% chance each)
  const selected = pairs
    .filter(() => Math.random() < 0.4)
    .slice(0, 3)

  const results = await Promise.allSettled(
    selected.map(([a, b]) => interactPair(a, b, cultures, eraMap, recentEvents, world, db))
  )

  return results.filter(r => r.status === 'fulfilled').length
}

async function interactPair(
  personA: Record<string, unknown>,
  personB: Record<string, unknown>,
  cultures: Record<string, unknown>[],
  eraMap: Record<string, string>,
  recentEvents: Record<string, unknown>[],
  world: { id: string; in_game_day: number; in_game_year: number },
  db: ReturnType<typeof createAdminClient>
) {
  const cultureA = cultures.find(c => c.id === personA.culture_id)
  const cultureB = cultures.find(c => c.id === personB.culture_id)
  const sameClan = personA.culture_id === personB.culture_id
  const era = eraMap[personA.culture_id as string] ?? 'Stone Age'

  const skillsA = getSkillSummary(getPersonSkills(personA.metadata))
  const skillsB = getSkillSummary(getPersonSkills(personB.metadata))

  // Check existing relationship
  const { data: relationship } = await db.from('relationships')
    .select('relationship_type, trust, resentment, attraction')
    .or(`and(person_a_id.eq.${personA.id},person_b_id.eq.${personB.id}),and(person_a_id.eq.${personB.id},person_b_id.eq.${personA.id})`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const relDesc = relationship
    ? `${relationship.relationship_type} (trust: ${relationship.trust}/10, resentment: ${relationship.resentment}/10)`
    : 'strangers'

  const prompt = `Two people encounter each other in First Valley (${era}, Day ${world.in_game_day}).

${personA.name} (age ${personA.age}, ${personA.occupation || 'villager'}, ${(cultureA?.name as string) ?? 'valley'}, skills: ${skillsA})
${personB.name} (age ${personB.age}, ${personB.occupation || 'villager'}, ${(cultureB?.name as string) ?? 'valley'}, skills: ${skillsB})
Relationship: ${relDesc}. Same clan: ${sameClan}.

What happens in this brief encounter? Reply ONLY with valid JSON:
{
  "interaction_type": "teaching|argument|trade|bonding|rivalry|romance|warning|storytelling|nothing",
  "what_happens": "1-2 vivid sentences describing the encounter",
  "a_says": "what ${personA.name} says or does (8-15 words, era-appropriate)",
  "b_says": "what ${personB.name} says or does (8-15 words, era-appropriate)",
  "outcome": "teaching|conflict|friendship|neutral|romance|trade",
  "skill_transfer": "<skill_name> or null",
  "relationship_change": "improved|worsened|unchanged",
  "significance": 10-60
}`

  let parsed: {
    interaction_type?: string
    what_happens?: string
    a_says?: string
    b_says?: string
    outcome?: string
    skill_transfer?: string | null
    relationship_change?: string
    significance?: number
  } = {}

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      system: `You generate character interactions for a ${era} simulation. Be authentic to the era and the characters' personalities. Interactions should feel human and specific.`,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    try { parsed = JSON.parse(raw) } catch {
      const m = raw.match(/\{[\s\S]*?\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch { /* ignore */ } }
    }
  } catch (err) {
    console.error('[ai-tick] Interaction failed:', err)
    return
  }

  if (!parsed.what_happens) return

  const significance = parsed.significance ?? 25

  // Create a public event for this interaction
  await db.from('public_events').insert({
    world_id: world.id,
    event_type: 'SOCIAL',
    title: `${personA.name} and ${personB.name}: ${parsed.interaction_type ?? 'an encounter'}`,
    description: `${parsed.what_happens}${parsed.a_says ? ` "${parsed.a_says}"` : ''}${parsed.b_says ? ` "${parsed.b_says}"` : ''}`,
    primary_person_id: personA.id as string,
    significance_score: significance,
    is_milestone: false,
    is_featured: significance >= 50,
    in_game_day: world.in_game_day,
    in_game_year: world.in_game_year,
    metadata: {
      person_b_id: personB.id,
      outcome: parsed.outcome,
      skill_transfer: parsed.skill_transfer,
    } as Json,
  })

  // Add memories to both characters
  const memA = parsed.a_says
    ? { description: `I told ${personB.name}: "${parsed.a_says}"`, day: world.in_game_day, importance: 6 }
    : null
  const memB = parsed.b_says
    ? { description: `${personA.name} said to me: "${parsed.a_says ?? '...'}"`, day: world.in_game_day, importance: 6 }
    : null

  const metaA = (personA.metadata as Record<string, unknown>) ?? {}
  const metaB = (personB.metadata as Record<string, unknown>) ?? {}
  const memsA = (metaA.memories as Json[] ?? [])
  const memsB = (metaB.memories as Json[] ?? [])

  const updatePromises: PromiseLike<unknown>[] = []

  if (memA) {
    updatePromises.push(
      db.from('persons').update({
        metadata: { ...metaA, memories: [...memsA.slice(-19), memA as unknown as Json] } as Json,
      }).eq('id', personA.id as string)
    )
  }
  if (memB) {
    updatePromises.push(
      db.from('persons').update({
        metadata: { ...metaB, memories: [...memsB.slice(-19), memB as unknown as Json] } as Json,
      }).eq('id', personB.id as string)
    )
  }

  // Skill transfer: if teaching happened, boost skill in learner
  if (parsed.skill_transfer && parsed.outcome === 'teaching') {
    const skillName = parsed.skill_transfer
    const learnerMeta = (personB.metadata as Record<string, unknown>) ?? {}
    const learnerSkills = getPersonSkills(learnerMeta)
    const current = (learnerSkills as Record<string, number>)[skillName] ?? 0
    if (current < 100) {
      const updatedSkills = { ...learnerSkills, [skillName]: Math.min(100, current + 2 + Math.random() * 3) }
      updatePromises.push(
        db.from('persons').update({
          metadata: { ...learnerMeta, skills: updatedSkills } as Json,
        }).eq('id', personB.id as string)
      )
    }
  }

  // Update or create relationship record
  if (parsed.relationship_change !== 'unchanged' && relationship) {
    const delta = parsed.relationship_change === 'improved' ? 1 : -1
    updatePromises.push(
      db.from('relationships')
        .update({
          trust: Math.max(0, Math.min(10, (relationship.trust ?? 5) + delta)),
          resentment: Math.max(0, Math.min(10, (relationship.resentment ?? 0) - delta)),
        })
        .or(`and(person_a_id.eq.${personA.id},person_b_id.eq.${personB.id}),and(person_a_id.eq.${personB.id},person_b_id.eq.${personA.id})`)
        .eq('is_active', true)
    )
  } else if (parsed.relationship_change !== 'unchanged' && !relationship) {
    // Create new relationship
    updatePromises.push(
      db.from('relationships').insert({
        world_id: world.id,
        person_a_id: personA.id as string,
        person_b_id: personB.id as string,
        relationship_type: parsed.outcome === 'friendship' ? 'friend' : parsed.outcome === 'conflict' ? 'rival' : 'acquaintance',
        trust: parsed.relationship_change === 'improved' ? 6 : 3,
        resentment: parsed.relationship_change === 'worsened' ? 4 : 0,
        attraction: parsed.outcome === 'romance' ? 5 : 0,
        is_active: true,
        started_day: world.in_game_day,
      })
    )
  }

  await Promise.allSettled(updatePromises)
}
