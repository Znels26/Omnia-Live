import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ follows: [] })

  const admin = createAdminClient()
  const { data } = await admin
    .from('follows')
    .select('*')
    .eq('user_id', user.id)

  return NextResponse.json({ follows: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { followType, followTargetId, action } = await req.json()

  const admin = createAdminClient()

  if (action === 'unfollow') {
    await admin.from('follows')
      .delete()
      .eq('user_id', user.id)
      .eq('follow_type', followType)
      .eq('follow_target_id', followTargetId)
    return NextResponse.json({ following: false })
  }

  const { error } = await admin.from('follows').insert({
    user_id: user.id,
    follow_type: followType,
    follow_target_id: followTargetId,
  })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ following: true })
}
