import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notifications: [] })

  const admin = createAdminClient()
  const { data } = await admin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ notifications: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json()
  const admin = createAdminClient()

  if (ids && Array.isArray(ids)) {
    await admin.from('notifications')
      .update({ is_read: true })
      .in('id', ids)
      .eq('user_id', user.id)
  } else {
    await admin.from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
  }

  return NextResponse.json({ success: true })
}
