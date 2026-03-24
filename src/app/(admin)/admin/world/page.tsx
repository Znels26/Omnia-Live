import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Sidebar } from '@/components/layout/Navigation'
import { WorldControls } from '../WorldControls'

export default async function AdminWorldPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/watch')

  const [
    { data: world },
    { data: regions },
    { data: settlements },
    { data: activeVotes },
    { data: recentEvents },
  ] = await Promise.all([
    admin.from('worlds').select('*').eq('slug', 'first-valley').single(),
    admin.from('world_regions').select('*').order('name'),
    admin.from('settlements').select('id, name, settlement_type, population, prosperity, stability, status').order('population', { ascending: false }),
    admin.from('world_votes').select('id, title, vote_category, status, opens_at, closes_at, total_votes_cast, cycle_number').eq('status', 'open').order('opens_at'),
    admin.from('public_events').select('id, title, description, event_type, significance_score, in_game_day, in_game_year, created_at').order('created_at', { ascending: false }).limit(20),
  ])

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--fv-base)' }}>
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-1" style={{ color: 'var(--fv-moon)' }}>
            World Controls
          </h1>
          <p style={{ color: 'var(--fv-text-muted)' }}>Manage and inspect the First Valley simulation</p>
        </div>

        {!world ? (
          <div className="rounded-lg p-10 text-center" style={{ border: '1px solid var(--fv-border)', color: 'var(--fv-text-muted)' }}>
            No world found. Run the seed script to initialize First Valley.
          </div>
        ) : (
          <div className="space-y-6">

            {/* World state + controls */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card variant="default">
                <CardHeader>
                  <CardTitle>World State</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Status', value: world.status, badge: true },
                    { label: 'Era', value: world.era },
                    { label: 'In-Game Year', value: String(world.in_game_year) },
                    { label: 'In-Game Day', value: String(world.in_game_day) },
                    {
                      label: 'Last Tick',
                      value: world.last_tick_at ? new Date(world.last_tick_at).toLocaleString() : '—',
                    },
                    {
                      label: 'Next Vote Opens',
                      value: world.next_vote_opens_at ? new Date(world.next_vote_opens_at).toLocaleString() : '—',
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between items-center text-sm">
                      <span style={{ color: 'var(--fv-text-muted)' }}>{row.label}</span>
                      {row.badge ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded font-display uppercase tracking-wider"
                          style={{
                            background: world.status === 'active' ? 'rgba(74,222,128,0.1)' : 'rgba(250,204,21,0.1)',
                            color: world.status === 'active' ? 'var(--fv-success)' : 'var(--fv-warning)',
                            border: `1px solid ${world.status === 'active' ? 'rgba(74,222,128,0.3)' : 'rgba(250,204,21,0.3)'}`,
                          }}
                        >
                          {world.status}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--fv-text)' }}>{row.value}</span>
                      )}
                    </div>
                  ))}
                  <div className="pt-3" style={{ borderTop: '1px solid var(--fv-border)' }}>
                    <WorldControls worldStatus={world.status} />
                  </div>
                </CardContent>
              </Card>

              {/* Environment / config */}
              <Card variant="default">
                <CardHeader>
                  <CardTitle>Environment State</CardTitle>
                </CardHeader>
                <CardContent>
                  {world.config ? (
                    <pre
                      className="text-xs leading-relaxed overflow-auto max-h-64 rounded p-3"
                      style={{ background: 'var(--fv-surface)', color: 'var(--fv-text-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {JSON.stringify(world.config, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No environment config stored.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Active votes */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Active Votes ({activeVotes?.length ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!activeVotes || activeVotes.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No votes currently open.</p>
                ) : (
                  <div className="space-y-3">
                    {activeVotes.map((vote) => (
                      <div
                        key={vote.id}
                        className="rounded-lg p-3 flex items-start gap-4"
                        style={{ background: 'var(--fv-surface)', border: '1px solid var(--fv-border)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-display uppercase"
                              style={{ background: 'rgba(201,113,74,0.15)', color: 'var(--fv-ember)' }}
                            >
                              {vote.vote_category}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--fv-text-dim)' }}>
                              Cycle {vote.cycle_number}
                            </span>
                          </div>
                          <p className="text-sm font-medium" style={{ color: 'var(--fv-text)' }}>{vote.title}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--fv-text-dim)' }}>
                            {vote.total_votes_cast} votes cast · Closes {vote.closes_at ? new Date(vote.closes_at).toLocaleDateString() : '—'}
                          </p>
                        </div>
                        <span
                          className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                          style={{ background: 'rgba(74,222,128,0.1)', color: 'var(--fv-success)', border: '1px solid rgba(74,222,128,0.2)' }}
                        >
                          open
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Regions */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Regions ({regions?.length ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!regions || regions.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No regions found.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {regions.map((region) => (
                      <div
                        key={region.id}
                        className="rounded-lg p-3 text-xs"
                        style={{
                          background: 'var(--fv-surface)',
                          border: '1px solid var(--fv-border)',
                          borderLeft: `3px solid var(--fv-ember)`,
                        }}
                      >
                        <div className="font-medium mb-1" style={{ color: 'var(--fv-text)' }}>{region.name}</div>
                        <div style={{ color: 'var(--fv-text-dim)' }}>{region.biome}</div>
                        <div className="mt-1 space-y-0.5" style={{ color: 'var(--fv-text-dim)' }}>
                          <div>Fertility {Math.round(region.fertility_level * 100)}%</div>
                          <div>Water {Math.round(region.water_access * 100)}%</div>
                          <div>Resources {Math.round(region.resource_richness * 100)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settlements */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Settlements ({settlements?.length ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!settlements || settlements.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No settlements found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--fv-border)' }}>
                          {['Name', 'Type', 'Population', 'Prosperity', 'Stability', 'Status'].map((h) => (
                            <th key={h} className="pb-2 text-left text-xs font-display uppercase tracking-wider pr-4" style={{ color: 'var(--fv-text-dim)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {settlements.map((s) => (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--fv-border)' }}>
                            <td className="py-2 pr-4 font-medium" style={{ color: 'var(--fv-text)' }}>{s.name}</td>
                            <td className="py-2 pr-4 text-xs capitalize" style={{ color: 'var(--fv-text-muted)' }}>{s.settlement_type}</td>
                            <td className="py-2 pr-4 font-mono text-xs" style={{ color: 'var(--fv-text)' }}>{s.population.toLocaleString()}</td>
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'var(--fv-border)' }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${s.prosperity}%`,
                                      background: s.prosperity > 60 ? 'var(--fv-success)' : s.prosperity > 30 ? 'var(--fv-warning)' : 'var(--fv-danger)',
                                    }}
                                  />
                                </div>
                                <span className="text-xs" style={{ color: 'var(--fv-text-dim)' }}>{s.prosperity}</span>
                              </div>
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'var(--fv-border)' }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${s.stability}%`,
                                      background: s.stability > 60 ? 'var(--fv-success)' : s.stability > 30 ? 'var(--fv-warning)' : 'var(--fv-danger)',
                                    }}
                                  />
                                </div>
                                <span className="text-xs" style={{ color: 'var(--fv-text-dim)' }}>{s.stability}</span>
                              </div>
                            </td>
                            <td className="py-2">
                              <span
                                className="text-xs px-2 py-0.5 rounded capitalize"
                                style={{
                                  background: s.status === 'active' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                                  color: s.status === 'active' ? 'var(--fv-success)' : 'var(--fv-danger)',
                                }}
                              >
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent events */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Recent World Events (Last 20)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(recentEvents ?? []).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start gap-3 py-2.5"
                      style={{ borderBottom: '1px solid var(--fv-border)' }}
                    >
                      <span className="text-xs font-mono flex-shrink-0 mt-0.5" style={{ color: 'var(--fv-text-dim)' }}>
                        Y{ev.in_game_year} D{ev.in_game_day}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: 'var(--fv-text)' }}>{ev.title}</span>
                          {ev.significance_score >= 70 && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(201,113,74,0.15)', color: 'var(--fv-ember)' }}>
                              {ev.significance_score}
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--fv-text-muted)' }}>{ev.description}</p>
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--fv-text-dim)' }}>
                        {ev.event_type}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  )
}
