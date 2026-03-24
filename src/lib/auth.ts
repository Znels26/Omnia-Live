// Supabase auth helpers — replaces NextAuth
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireUser() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

export async function getProfile(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export async function requireAdmin() {
  const user = await requireUser()
  const profile = await getProfile(user.id)
  if (profile?.role !== 'admin') redirect('/watch')
  return { user, profile }
}

export async function getSubscription(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function isSubscribed(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId)
  return sub?.status === 'active' || sub?.status === 'trialing'
}
