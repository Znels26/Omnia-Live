import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Sidebar } from '@/components/layout/Navigation'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/watch')

  const [
    { count: totalUsers },
    { count: activeSubscribers },
    { data: worldRow },
    { count: totalPersons },
    { count: totalEvents },
    { count: tokenWallets },
    { data: recentEvents },
    { data: recentBilling },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('worlds').select('in_game_day, in_game_year, era, status, last_tick_at').eq('slug', 'first-valley').single(),
    admin.from('persons').select('*', { count: 'exact', head: true }).eq('is_alive', true),
    admin.from('public_events').select('*', { count: 'exact', head: true }),
    admin.from('token_wallets').select('*', { count: 'exact', head: true }),
    admin.from('public_events').select('id, title, description, event_type, significance_score, in_game_day, in_game_year, created_at').order('created_at', { ascending: false }).limit(10),
    admin.from('billing_events').select('id, event_type, amount_cents, currency, created_at, user_id').order('created_at', { ascending: false }).limit(5),
  ])

  const world = worldRow ?? null

  const stats = [
    { label: 'Total Users', value: totalUsers ?? 0, icon: '👥', color: 'default' as const },
    { label: 'Active Subscribers', value: activeSubscribers ?? 0, icon: '⭐', color: 'ember' as const },
    { label: 'World Day', value: world ? `Year ${world.in_game_year}, Day ${world.in_game_day}` : '—', icon: '🌍', color: 'default' as const },
    { label: 'Living Persons', value: totalPersons ?? 0, icon: '🧑', color: 'default' as const },
    { label: 'Total Events', value: totalEvents ?? 0, icon: '📌', color: 'default' as const },
    { label: 'Token Wallets', value: tokenWallets ?? 0, icon: '⚡', color: 'gold' as const },
  ]

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--fv-base)' }}>
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-1" style={{ color: 'var(--fv-moon)' }}>
            Admin Dashboard
          </h1>
          <p style={{ color: 'var(--fv-text-muted)' }}>First Valley control panel</p>
        </div>

        {/* World status strip */}
        {world && (
          <div
            className="mb-8 rounded-lg px-5 py-3 flex items-center gap-6 flex-wrap"
            style={{ background: 'var(--fv-card)', border: '1px solid var(--fv-border)' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: world.status === 'active' ? 'var(--fv-success)' : 'var(--fv-warning)',
                  boxShadow: world.status === 'active' ? '0 0 6px var(--fv-success)' : undefined,
                }}
              />
              <span className="text-xs font-display uppercase tracking-wider" style={{ color: world.status === 'active' ? 'var(--fv-success)' : 'var(--fv-warning)' }}>
                {world.status}
              </span>
            </div>
            <span className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>
              Era: <span style={{ color: 'var(--fv-text)' }}>{world.era}</span>
            </span>
            <span className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>
              Year {world.in_game_year}, Day {world.in_game_day}
            </span>
            {world.last_tick_at && (
              <span className="text-xs" style={{ color: 'var(--fv-text-dim)' }}>
                Last tick: {new Date(world.last_tick_at).toLocaleString()}
              </span>
            )}
            <Link
              href="/admin/world"
              className="ml-auto text-xs font-display uppercase tracking-wider transition-colors"
              style={{ color: 'var(--fv-ember)' }}
            >
              Manage World →
            </Link>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} variant={stat.color === 'ember' ? 'ember' : stat.color === 'gold' ? 'gold' : 'default'} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{stat.icon}</span>
                <span className="text-xs font-display uppercase tracking-wider" style={{ color: 'var(--fv-text-muted)' }}>
                  {stat.label}
                </span>
              </div>
              <div className="font-display text-3xl font-bold" style={{ color: 'var(--fv-moon)' }}>
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </div>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Recent world events */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Recent World Events</CardTitle>
            </CardHeader>
            <CardContent>
              {!recentEvents || recentEvents.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No events yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentEvents.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--fv-border)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-display uppercase" style={{ color: 'var(--fv-ember)' }}>
                            {ev.event_type}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--fv-text-dim)' }}>
                            Y{ev.in_game_year} D{ev.in_game_day}
                          </span>
                          {ev.significance_score >= 70 && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(201,113,74,0.15)', color: 'var(--fv-ember)' }}>
                              ★ {ev.significance_score}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium" style={{ color: 'var(--fv-text)' }}>{ev.title}</p>
                        <p className="text-xs leading-relaxed mt-0.5 line-clamp-1" style={{ color: 'var(--fv-text-muted)' }}>
                          {ev.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent billing events */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Recent Billing Events</CardTitle>
            </CardHeader>
            <CardContent>
              {!recentBilling || recentBilling.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No billing events yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentBilling.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--fv-border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--fv-text)' }}>
                          {ev.event_type.replace(/_/g, ' ')}
                        </p>
                        {ev.user_id && (
                          <p className="text-xs font-mono truncate" style={{ color: 'var(--fv-text-muted)' }}>
                            {ev.user_id}
                          </p>
                        )}
                        <p className="text-xs" style={{ color: 'var(--fv-text-dim)' }}>
                          {new Date(ev.created_at).toLocaleString()}
                        </p>
                      </div>
                      {ev.amount_cents != null && (
                        <span className="font-display font-bold text-sm flex-shrink-0" style={{ color: 'var(--fv-gold)' }}>
                          ${(ev.amount_cents / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/admin/analytics"
                className="block text-xs font-display uppercase tracking-wider mt-4 transition-colors"
                style={{ color: 'var(--fv-ember)' }}
              >
                View Analytics →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/admin/world', label: 'World Controls', icon: '🌍', desc: 'Simulation & regions' },
            { href: '/admin/characters', label: 'Characters', icon: '👥', desc: 'Persons inspector' },
            { href: '/admin/tokens', label: 'Token Economy', icon: '⚡', desc: 'Wallets & grants' },
            { href: '/admin/analytics', label: 'Analytics', icon: '📊', desc: 'Subscriptions & growth' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg p-4 text-center transition-all duration-200"
              style={{ background: 'var(--fv-card)', border: '1px solid var(--fv-border)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--fv-border-bright)'
                ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--fv-card-hover)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--fv-border)'
                ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--fv-card)'
              }}
            >
              <div className="text-3xl mb-2">{link.icon}</div>
              <div className="text-sm font-medium font-display" style={{ color: 'var(--fv-text)' }}>{link.label}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--fv-text-dim)' }}>{link.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
