import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Tables } from '@/types/database'

type Culture = Tables<'cultures'>

function TraitBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const color =
    pct > 75 ? 'var(--fv-danger)' :
    pct > 55 ? 'var(--fv-ember)' :
    pct > 35 ? 'var(--fv-gold)' :
    'var(--fv-storm)'

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-fv-text-dim">{label}</span>
        <span className="text-fv-text-muted">{pct}</span>
      </div>
      <div className="stat-bar">
        <div
          className="stat-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function CultureCard({ culture }: { culture: Culture }) {
  const color = culture.color_hex ?? '#555566'
  const initial = culture.name[0]

  return (
    <Card variant="elevated" className="overflow-hidden">
      {/* Color band */}
      <div
        className="h-1.5"
        style={{
          background: `linear-gradient(90deg, ${color}, ${color}55, transparent)`,
        }}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-display font-bold flex-shrink-0 border-2"
            style={{ borderColor: color, background: color + '18' }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl font-bold text-fv-moon mb-1 truncate">
              {culture.name}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {culture.slug}
              </span>
              <span className="text-xs text-fv-text-dim">
                {culture.population_estimate.toLocaleString()} people
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div
              className="font-display text-3xl font-bold"
              style={{ color }}
            >
              {culture.population_estimate >= 1000
                ? `${(culture.population_estimate / 1000).toFixed(1)}k`
                : culture.population_estimate}
            </div>
            <div className="text-xs text-fv-text-dim mt-0.5">population</div>
          </div>
        </div>

        {/* Description */}
        {culture.description && (
          <p className="text-sm text-fv-text-muted leading-relaxed mb-5 border-l-2 pl-3"
            style={{ borderColor: color + '60' }}>
            {culture.description}
          </p>
        )}

        {/* Color swatch row */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-8 h-8 rounded-lg border-2 border-white/10 flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <div>
            <div className="text-xs text-fv-text-muted font-mono">{color}</div>
            <div className="text-xs text-fv-text-dim">Culture color</div>
          </div>
        </div>

        {/* Trait bars */}
        <div className="space-y-2.5">
          <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-3">
            Cultural Traits
          </div>
          <TraitBar label="Aggression" value={culture.aggression_level} />
          <TraitBar label="Cooperation" value={culture.cooperation_level} />
          <TraitBar label="Spirituality" value={culture.spiritual_tendency} />
          <TraitBar label="Ambition" value={culture.ambition_level} />
          <TraitBar label="Work Ethic" value={culture.work_ethic} />
          <TraitBar label="Family Centrality" value={culture.family_centrality} />
        </div>

        {/* Badge row */}
        <div className="flex gap-2 flex-wrap mt-5 pt-4 border-t border-fv-border-subtle">
          {culture.aggression_level > 65 && (
            <Badge variant="danger" className="text-xs">Warlike</Badge>
          )}
          {culture.cooperation_level > 65 && (
            <Badge variant="forest" className="text-xs">Cooperative</Badge>
          )}
          {culture.spiritual_tendency > 65 && (
            <Badge variant="storm" className="text-xs">Devout</Badge>
          )}
          {culture.ambition_level > 65 && (
            <Badge variant="ember" className="text-xs">Ambitious</Badge>
          )}
          {culture.work_ethic > 65 && (
            <Badge variant="gold" className="text-xs">Industrious</Badge>
          )}
          {culture.family_centrality > 65 && (
            <Badge variant="default" className="text-xs">Family-Bound</Badge>
          )}
        </div>
      </div>
    </Card>
  )
}

export default async function ClansPage() {
  const supabase = await createClient()

  const { data: world } = await supabase
    .from('worlds')
    .select('id, name, in_game_day, in_game_year')
    .eq('slug', 'first-valley')
    .single()

  if (!world) {
    return (
      <div className="p-8 text-center text-fv-text-muted">
        <div className="text-4xl mb-4">🏕️</div>
        <div className="font-display text-xl text-fv-moon mb-2">World not found</div>
        <div className="text-sm">First Valley hasn't been initialized yet.</div>
      </div>
    )
  }

  const { data: cultures } = await supabase
    .from('cultures')
    .select('*')
    .eq('world_id', world.id)
    .order('population_estimate', { ascending: false })

  const allCultures = cultures ?? []
  const totalPopulation = allCultures.reduce((s, c) => s + c.population_estimate, 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-px h-8 bg-fv-ember" />
          <span className="font-display text-xs text-fv-ember uppercase tracking-widest">
            Year {world.in_game_year} · Day {world.in_game_day}
          </span>
        </div>
        <h1 className="font-display text-4xl font-bold text-fv-moon mb-3">
          Cultures &amp; Clans
        </h1>
        <p className="text-fv-text-muted text-base max-w-xl">
          {allCultures.length} distinct peoples share this valley — each shaped by ancestral belief, environment, and will.
        </p>
      </div>

      {/* World stats bar */}
      {allCultures.length > 0 && (
        <div className="fv-card p-4 mb-8 flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Cultures</div>
            <div className="font-display text-2xl font-bold text-fv-moon">{allCultures.length}</div>
          </div>
          <div className="w-px h-8 bg-fv-border" />
          <div>
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Total Population</div>
            <div className="font-display text-2xl font-bold text-fv-moon">{totalPopulation.toLocaleString()}</div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-2">Population Distribution</div>
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
              {allCultures.map((c) => {
                const pct = totalPopulation > 0 ? (c.population_estimate / totalPopulation) * 100 : 0
                return (
                  <div
                    key={c.id}
                    title={`${c.name}: ${c.population_estimate.toLocaleString()}`}
                    style={{ width: `${pct}%`, backgroundColor: c.color_hex ?? '#555' }}
                    className="rounded-sm"
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Culture grid */}
      {allCultures.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {allCultures.map((culture) => (
            <CultureCard key={culture.id} culture={culture} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-5xl mb-5">🏕️</div>
          <div className="font-display text-xl text-fv-moon mb-2">No cultures yet</div>
          <div className="text-sm text-fv-text-muted">
            The valley is still forming. Run the simulation to seed cultures.
          </div>
        </div>
      )}
    </div>
  )
}
