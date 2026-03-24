import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await req.json()

  if (action === 'pause') {
    await admin.from('worlds').update({ status: 'paused' }).eq('slug', 'first-valley')
    return NextResponse.json({ success: true, action: 'paused' })
  }
  if (action === 'resume') {
    await admin.from('worlds').update({ status: 'active' }).eq('slug', 'first-valley')
    return NextResponse.json({ success: true, action: 'resumed' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
