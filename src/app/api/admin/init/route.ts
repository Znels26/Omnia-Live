import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OWNER_EMAIL = 'zacharynelson96@gmail.com'

// One-time endpoint: sets the owner account to admin role.
// Safe to call multiple times (idempotent). Remove once confirmed.
export async function POST() {
  const admin = createAdminClient()

  const { data: user, error: userError } = await admin.auth.admin.listUsers()
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 })

  const owner = user.users.find((u) => u.email === OWNER_EMAIL)
  if (!owner) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { error } = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', owner.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, userId: owner.id, role: 'admin' })
}
