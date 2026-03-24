import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
        id, name, age, life_stage, occupation, employment_status,
        is_alive, is_featured, health_score, wealth_score, happiness_score,
        pos_x, pos_y, culture_id, residence_id, class_tier,
        trait_ambition, trait_honesty, trait_aggression, trait_sociability,
        need_hunger, need_stress, need_hope, current_action, current_goal
      )
    `)
    .eq('slug', 'first-valley')
    .eq('persons.is_alive', true)
    .single()

  if (error || !world) {
    return NextResponse.json({ error: 'World not found' }, { status: 404 })
  }

  // Get recent events
  const { data: events } = await supabase
    .from('public_events')
    .select('*')
    .eq('world_id', world.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get active vote
  const { data: activeVote } = await supabase
    .from('world_votes')
    .select(`*, vote_options(*)`)
    .eq('world_id', world.id)
    .eq('status', 'open')
    .single()

  return NextResponse.json({
    world,
    events: events ?? [],
    activeVote: activeVote ?? null,
  })
}
