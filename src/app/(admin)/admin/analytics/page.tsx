import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Sidebar } from '@/components/layout/Navigation'

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/watch')

  const now = new Date()
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: newUsers7d },
    { count: newUsers30d },
    { count: activeSubscriptions },
    { count: canceledSubscriptions },
    { count: tokenPurchases },
    { count: totalBirthEvents },
    { data: recentBilling },
    { data: recentTokenTx },
    { data: walletBalances },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', last7Days),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', last30Days),
    admin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'canceled'),
    admin.from('billing_events').select('*', { count: 'exact', head: true }).eq('event_type', 'token_purchase'),
    admin.from('public_events').select('*', { count: 'exact', head: true }).eq('event_type', 'BIRTH'),
    admin.from('billing_events')
      .select('id, event_type, amount_cents, currency, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(20),
    admin.from('token_transactions')
      .select('id, user_id, amount, balance_after, type, description, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    admin.from('token_wallets')
      .select('balance')
      .order('balance', { ascending: false })
      .limit(200),
  ])

  const totalTokensInCirculation = (walletBalances ?? []).reduce((s, w) => s + (w.balance ?? 0), 0)
  const conversionRate = (totalUsers ?? 0) > 0
    ? (((activeSubscriptions ?? 0) / (totalUsers ?? 1)) * 100).toFixed(1)
    : '0.0'

  // Group billing events by date for a simple table
  const billingByDate: Record<string, { count: number; revenue: number }> = {}
  for (const ev of recentBilling ?? []) {
    const date = ev.created_at.slice(0, 10)
    if (!billingByDate[date]) billingByDate[date] = { count: 0, revenue: 0 }
    billingByDate[date].count += 1
    billingByDate[date].revenue += ev.amount_cents ?? 0
  }
  const billingRows = Object.entries(billingByDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--fv-base)' }}>
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-1" style={{ color: 'var(--fv-moon)' }}>
            Analytics
          </h1>
          <p style={{ color: 'var(--fv-text-muted)' }}>Platform metrics and world growth</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: (totalUsers ?? 0).toLocaleString(), icon: '👥', color: 'default' as const },
            { label: 'Active Subscribers', value: (activeSubscriptions ?? 0).toLocaleString(), icon: '⭐', color: 'ember' as const },
            { label: 'Conversion Rate', value: `${conversionRate}%`, icon: '📈', color: 'default' as const },
            { label: 'Tokens In Circulation', value: totalTokensInCirculation.toLocaleString(), icon: '⚡', color: 'gold' as const },
          ].map((s) => (
            <Card key={s.label} variant={s.color === 'ember' ? 'ember' : s.color === 'gold' ? 'gold' : 'default'} className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span>{s.icon}</span>
                <span className="text-xs font-display uppercase tracking-wider" style={{ color: 'var(--fv-text-muted)' }}>{s.label}</span>
              </div>
              <div className="font-display text-3xl font-bold" style={{ color: 'var(--fv-moon)' }}>{s.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* User growth */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>User Growth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {[
                { label: 'New signups — last 7 days', value: newUsers7d ?? 0 },
                { label: 'New signups — last 30 days', value: newUsers30d ?? 0 },
                { label: 'Active subscriptions', value: activeSubscriptions ?? 0 },
                { label: 'Canceled subscriptions', value: canceledSubscriptions ?? 0 },
                { label: 'Token purchases (all time)', value: tokenPurchases ?? 0 },
                { label: 'Total births in world', value: totalBirthEvents ?? 0 },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: '1px solid var(--fv-border)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>{item.label}</span>
                  <span className="font-display font-bold" style={{ color: 'var(--fv-moon)' }}>
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Token economy snapshot */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Token Economy Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 rounded-lg text-center" style={{ background: 'var(--fv-surface)', border: '1px solid var(--fv-border)' }}>
                <div className="text-xs font-display uppercase tracking-wider mb-1" style={{ color: 'var(--fv-text-muted)' }}>
                  Total In Circulation
                </div>
                <div className="font-display text-4xl font-bold" style={{ color: 'var(--fv-gold)' }}>
                  ⚡ {totalTokensInCirculation.toLocaleString()}
                </div>
              </div>
              <div className="space-y-0">
                {[
                  { label: 'Token purchases logged', value: tokenPurchases ?? 0 },
                  { label: 'Wallets tracked', value: walletBalances?.length ?? 0 },
                  { label: 'Avg balance (top 200)', value: walletBalances && walletBalances.length > 0 ? Math.round(totalTokensInCirculation / walletBalances.length) : 0 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-3"
                    style={{ borderBottom: '1px solid var(--fv-border)' }}
                  >
                    <span className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>{item.label}</span>
                    <span className="font-display font-bold" style={{ color: 'var(--fv-moon)' }}>
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing by date */}
        <Card variant="default" className="mb-6">
          <CardHeader>
            <CardTitle>Billing Events by Date (Recent)</CardTitle>
          </CardHeader>
          <CardContent>
            {billingRows.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No billing events yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fv-border)' }}>
                      {['Date', 'Events', 'Revenue'].map((h) => (
                        <th key={h} className="pb-2 text-left text-xs font-display uppercase tracking-wider pr-6" style={{ color: 'var(--fv-text-dim)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billingRows.map(([date, data]) => (
                      <tr key={date} style={{ borderBottom: '1px solid var(--fv-border)' }}>
                        <td className="py-2 pr-6 font-mono text-xs" style={{ color: 'var(--fv-text)' }}>{date}</td>
                        <td className="py-2 pr-6" style={{ color: 'var(--fv-text-muted)' }}>{data.count}</td>
                        <td className="py-2 font-display font-bold text-sm" style={{ color: 'var(--fv-gold)' }}>
                          ${(data.revenue / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent token transactions */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Recent Token Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentTokenTx || recentTokenTx.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fv-border)' }}>
                      {['User ID', 'Type', 'Amount', 'Balance After', 'Description', 'Date'].map((h) => (
                        <th key={h} className="pb-2 text-left text-xs font-display uppercase tracking-wider pr-4" style={{ color: 'var(--fv-text-dim)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentTokenTx.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--fv-border)' }}>
                        <td className="py-2 pr-4 text-xs font-mono max-w-[100px] truncate" style={{ color: 'var(--fv-text-muted)' }}>
                          {tx.user_id.slice(0, 8)}…
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className="text-xs px-2 py-0.5 rounded capitalize"
                            style={{
                              background: tx.type === 'purchase' ? 'rgba(74,222,128,0.1)' : tx.type === 'admin_grant' ? 'rgba(201,160,80,0.1)' : 'rgba(201,113,74,0.1)',
                              color: tx.type === 'purchase' ? 'var(--fv-success)' : tx.type === 'admin_grant' ? 'var(--fv-gold)' : 'var(--fv-ember)',
                            }}
                          >
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: tx.amount > 0 ? 'var(--fv-success)' : 'var(--fv-danger)' }}
                          >
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs" style={{ color: 'var(--fv-text)' }}>
                          {tx.balance_after}
                        </td>
                        <td className="py-2 pr-4 text-xs max-w-[180px] truncate" style={{ color: 'var(--fv-text-muted)' }}>
                          {tx.description ?? '—'}
                        </td>
                        <td className="py-2 text-xs whitespace-nowrap" style={{ color: 'var(--fv-text-dim)' }}>
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
