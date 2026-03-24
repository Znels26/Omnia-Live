import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Sidebar, TopBar } from '@/components/layout/Navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Check subscription
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', user.id)
    .single()

  const isSubscribed = subscription?.status === 'active' || subscription?.status === 'trialing'

  if (!isSubscribed) {
    redirect('/pricing?reason=subscription_required')
  }

  // Get token balance
  const { data: wallet } = await admin
    .from('token_wallets')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  // Get unread notification count
  const { count: notifCount } = await admin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return (
    <div className="flex min-h-screen bg-fv-base">
      <Sidebar />
      <div className="flex-1 ml-[200px]">
        <TopBar
          tokenBalance={wallet?.balance ?? 0}
          notificationCount={notifCount ?? 0}
        />
        <main className="pt-12 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
