import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Sidebar } from '@/components/layout/Navigation'

const PAGE_SIZE = 50

export default async function AdminCharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; alive?: string; class_tier?: string; culture_id?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/watch')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const aliveFilter = params.alive // 'true' | 'false' | undefined
  const classTierFilter = params.class_tier ?? ''
  const cultureIdFilter = params.culture_id ?? ''

  // Get world
  const { data: world } = await admin.from('worlds').select('id').eq('slug', 'first-valley').single()

  // Build query
  let query = admin.from('persons').select(
    'id, name, age, life_stage, class_tier, occupation, health_score, wealth_score, happiness_score, is_alive, is_featured, culture_id, residence_id',
    { count: 'exact' }
  )

  if (world) query = query.eq('world_id', world.id)
  if (aliveFilter === 'true') query = query.eq('is_alive', true)
  else if (aliveFilter === 'false') query = query.eq('is_alive', false)
  if (classTierFilter) query = query.eq('class_tier', classTierFilter as 'destitute' | 'poor' | 'common' | 'skilled' | 'wealthy' | 'noble' | 'elite')
  if (cultureIdFilter) query = query.eq('culture_id', cultureIdFilter)

  const offset = (page - 1) * PAGE_SIZE
  const { data: persons, count } = await query
    .order('is_alive', { ascending: false })
    .order('health_score', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  // Get cultures for filter labels
  const { data: cultures } = await admin.from('cultures').select('id, name, color_hex').eq('world_id', world?.id ?? '').order('name')

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const classTiers = ['destitute', 'poor', 'common', 'skilled', 'wealthy', 'noble', 'elite']

  const lifeStageLabel: Record<string, string> = {
    infant: 'Infant',
    child: 'Child',
    adolescent: 'Teen',
    young_adult: 'Young Adult',
    adult: 'Adult',
    elder: 'Elder',
  }

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { page: String(page), alive: aliveFilter, class_tier: classTierFilter, culture_id: cultureIdFilter, ...overrides }
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v)
    }
    return `/admin/characters?${p.toString()}`
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--fv-base)' }}>
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">

        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold mb-1" style={{ color: 'var(--fv-moon)' }}>
            Character Inspector
          </h1>
          <p style={{ color: 'var(--fv-text-muted)' }}>
            {count?.toLocaleString() ?? 0} persons found
            {aliveFilter === 'true' ? ' (alive only)' : aliveFilter === 'false' ? ' (deceased only)' : ''}
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Shown', value: count ?? 0 },
            { label: 'This Page', value: persons?.length ?? 0 },
            { label: 'Page', value: `${page} / ${totalPages}` },
            { label: 'Page Size', value: PAGE_SIZE },
          ].map((s) => (
            <Card key={s.label} variant="default" className="p-4">
              <div className="text-xs font-display uppercase tracking-wider mb-1" style={{ color: 'var(--fv-text-muted)' }}>{s.label}</div>
              <div className="font-display text-2xl font-bold" style={{ color: 'var(--fv-moon)' }}>
                {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
              </div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div
          className="mb-6 rounded-lg p-4 flex flex-wrap gap-3 items-center"
          style={{ background: 'var(--fv-card)', border: '1px solid var(--fv-border)' }}
        >
          <span className="text-xs font-display uppercase tracking-wider" style={{ color: 'var(--fv-text-muted)' }}>Filters:</span>

          {/* Alive/Dead */}
          <div className="flex gap-1">
            {[
              { label: 'All', value: '' },
              { label: 'Alive', value: 'true' },
              { label: 'Dead', value: 'false' },
            ].map((opt) => (
              <a
                key={opt.value}
                href={buildUrl({ alive: opt.value || undefined, page: '1' })}
                className="text-xs px-2.5 py-1 rounded transition-colors"
                style={{
                  background: (aliveFilter ?? '') === opt.value ? 'var(--fv-ember)' : 'var(--fv-surface)',
                  color: (aliveFilter ?? '') === opt.value ? 'white' : 'var(--fv-text-muted)',
                  border: '1px solid var(--fv-border)',
                }}
              >
                {opt.label}
              </a>
            ))}
          </div>

          {/* Class tier */}
          <div className="flex gap-1 flex-wrap">
            <a
              href={buildUrl({ class_tier: undefined, page: '1' })}
              className="text-xs px-2.5 py-1 rounded transition-colors"
              style={{
                background: !classTierFilter ? 'var(--fv-ember)' : 'var(--fv-surface)',
                color: !classTierFilter ? 'white' : 'var(--fv-text-muted)',
                border: '1px solid var(--fv-border)',
              }}
            >
              All Classes
            </a>
            {classTiers.map((tier) => (
              <a
                key={tier}
                href={buildUrl({ class_tier: tier, page: '1' })}
                className="text-xs px-2.5 py-1 rounded capitalize transition-colors"
                style={{
                  background: classTierFilter === tier ? 'var(--fv-gold)' : 'var(--fv-surface)',
                  color: classTierFilter === tier ? 'var(--fv-base)' : 'var(--fv-text-muted)',
                  border: '1px solid var(--fv-border)',
                }}
              >
                {tier}
              </a>
            ))}
          </div>

          {/* Culture */}
          {cultures && cultures.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <a
                href={buildUrl({ culture_id: undefined, page: '1' })}
                className="text-xs px-2.5 py-1 rounded transition-colors"
                style={{
                  background: !cultureIdFilter ? 'var(--fv-storm)' : 'var(--fv-surface)',
                  color: !cultureIdFilter ? 'white' : 'var(--fv-text-muted)',
                  border: '1px solid var(--fv-border)',
                }}
              >
                All Cultures
              </a>
              {cultures.map((c) => (
                <a
                  key={c.id}
                  href={buildUrl({ culture_id: c.id, page: '1' })}
                  className="text-xs px-2.5 py-1 rounded transition-colors"
                  style={{
                    background: cultureIdFilter === c.id ? (c.color_hex ?? 'var(--fv-storm)') : 'var(--fv-surface)',
                    color: cultureIdFilter === c.id ? 'white' : 'var(--fv-text-muted)',
                    border: `1px solid ${cultureIdFilter === c.id ? (c.color_hex ?? 'var(--fv-border)') : 'var(--fv-border)'}`,
                  }}
                >
                  {c.name}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>
              Persons — Page {page} of {totalPages}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--fv-border)' }}>
                    {['Name', 'Age / Stage', 'Class', 'Occupation', 'Health', 'Wealth', 'Happiness', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="pb-2 text-left text-xs font-display uppercase tracking-wider pr-4"
                        style={{ color: 'var(--fv-text-dim)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(persons ?? []).map((p) => (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid var(--fv-border)', opacity: p.is_alive ? 1 : 0.5 }}
                    >
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          {p.is_featured && <span style={{ color: 'var(--fv-gold)' }}>★</span>}
                          <span
                            className="font-medium"
                            style={{ color: p.is_featured ? 'var(--fv-moon)' : 'var(--fv-text)' }}
                          >
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs" style={{ color: 'var(--fv-text-muted)' }}>
                        {p.age} · {lifeStageLabel[p.life_stage] ?? p.life_stage}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded capitalize"
                          style={{
                            background: 'var(--fv-surface)',
                            color: p.class_tier === 'noble' || p.class_tier === 'elite' ? 'var(--fv-gold)' : 'var(--fv-text-muted)',
                            border: '1px solid var(--fv-border)',
                          }}
                        >
                          {p.class_tier}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs" style={{ color: 'var(--fv-text-muted)' }}>
                        {p.occupation ?? '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <ScoreBadge value={p.health_score} />
                      </td>
                      <td className="py-2 pr-4">
                        <ScoreBadge value={p.wealth_score} />
                      </td>
                      <td className="py-2 pr-4">
                        <ScoreBadge value={p.happiness_score} />
                      </td>
                      <td className="py-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: p.is_alive ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                            color: p.is_alive ? 'var(--fv-success)' : 'var(--fv-danger)',
                          }}
                        >
                          {p.is_alive ? 'Alive' : 'Dead'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 mt-6 pt-4" style={{ borderTop: '1px solid var(--fv-border)' }}>
                {page > 1 && (
                  <a
                    href={buildUrl({ page: String(page - 1) })}
                    className="text-xs px-3 py-1.5 rounded transition-colors"
                    style={{ background: 'var(--fv-surface)', border: '1px solid var(--fv-border)', color: 'var(--fv-text-muted)' }}
                  >
                    ← Previous
                  </a>
                )}
                <span className="text-xs" style={{ color: 'var(--fv-text-dim)' }}>
                  Page {page} of {totalPages} · {count?.toLocaleString()} total
                </span>
                {page < totalPages && (
                  <a
                    href={buildUrl({ page: String(page + 1) })}
                    className="text-xs px-3 py-1.5 rounded transition-colors"
                    style={{ background: 'var(--fv-surface)', border: '1px solid var(--fv-border)', color: 'var(--fv-text-muted)' }}
                  >
                    Next →
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

function ScoreBadge({ value }: { value: number }) {
  const color = value > 60 ? 'var(--fv-success)' : value > 30 ? 'var(--fv-warning)' : 'var(--fv-danger)'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-1 rounded-full overflow-hidden" style={{ background: 'var(--fv-border)' }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color: 'var(--fv-text-dim)' }}>{value}</span>
    </div>
  )
}
