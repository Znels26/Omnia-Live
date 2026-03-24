import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const admin = createAdminClient()
  const worldId = req.nextUrl.searchParams.get('worldId')

  let query = admin
    .from('world_votes')
    .select(`*, vote_options(*)`)
    .order('created_at', { ascending: false })
    .limit(10)

  if (worldId) {
    query = query.eq('world_id', worldId) as typeof query
  }

  const { data: votes } = await query
  return NextResponse.json({ votes: votes ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { voteId, optionId, tokenAmount = 0 } = body

  if (!voteId || !optionId) {
    return NextResponse.json({ error: 'voteId and optionId required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check vote is open
  const { data: vote } = await admin
    .from('world_votes')
    .select('*')
    .eq('id', voteId)
    .eq('status', 'open')
    .single()

  if (!vote) return NextResponse.json({ error: 'Vote not open' }, { status: 400 })

  // Check not already voted
  const { data: existing } = await admin
    .from('vote_participation')
    .select('id')
    .eq('vote_id', voteId)
    .eq('user_id', user.id)
    .single()

  if (existing) return NextResponse.json({ error: 'Already voted' }, { status: 400 })

  // If using tokens, spend them
  if (tokenAmount > 0) {
    const { data: canSpend } = await admin.rpc('spend_tokens', {
      p_user_id: user.id,
      p_amount: tokenAmount,
      p_description: `Vote amplification for vote ${voteId}`,
    })
    if (!canSpend) return NextResponse.json({ error: 'Insufficient tokens' }, { status: 400 })
  }

  // Record vote
  const { error } = await admin.from('vote_participation').insert({
    vote_id: voteId,
    user_id: user.id,
    option_id: optionId,
    token_amount: tokenAmount,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Increment option count
  await admin.rpc('increment_vote_count', {
    p_option_id: optionId,
    p_token_amount: tokenAmount,
  })

  // Update total
  await admin.from('world_votes')
    .update({ total_votes_cast: (vote.total_votes_cast ?? 0) + 1 })
    .eq('id', voteId)

  return NextResponse.json({ success: true })
}
