import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Tables } from '@/types/database'

type Person = Tables<'persons'>
type Culture = Tables<'cultures'>
type Settlement = Tables<'settlements'>

type PersonWithRelations = Person & {
  culture: Pick<Culture, 'id' | 'name' | 'color_hex'> | null
  settlement: Pick<Settlement, 'id' | 'name' | 'settlement_type'> | null
}

const CLASS_TIER_LABELS: Record<string, string> = {
  destitute: 'Destitute',
  poor: 'Poor',
  common: 'Common',
  skilled: 'Skilled',
  wealthy: 'Wealthy',
  noble: 'Noble',
  elite: 'Elite',
}

const CLASS_TIER_VARIANT: Record<string, 'default' | 'ember' | 'gold' | 'storm' | 'forest' | 'danger' | 'warning'> = {
  destitute: 'danger',
  poor: 'default',
  common: 'default',
  skilled: 'storm',
  wealthy: 'ember',
  noble: 'gold',
  elite: 'gold',
}

const LIFE_STAGE_LABELS: Record<string, string> = {
  infant: 'Infant',
  child: 'Child',
  adolescent: 'Adolescent',
  young_adult: 'Young Adult',
  adult: 'Adult',
  elder: 'Elder',
}

function StatBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="stat-bar">
      <div
        className="stat-bar-fill"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }}
      />
    </div>
  )
}

function CharacterCard({ person }: { person: PersonWithRelations }) {
  const initials = person.name.split(' ').map((n) => n[0]).join('').slice(0, 2)
  const cultureColor = person.culture?.color_hex ?? '#555566'
  const healthColor =
    person.health_score > 70 ? 'var(--fv-success)' :
    person.health_score > 40 ? 'var(--fv-warning)' :
    'var(--fv-danger)'
  const wealthColor =
    person.wealth_score > 70 ? 'var(--fv-gold)' :
    person.wealth_score > 40 ? 'var(--fv-ember)' :
    'var(--fv-storm)'

  return (
    <Card variant="elevated" hoverable className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-base font-display font-bold flex-shrink-0 border-2"
          style={{ borderColor: cultureColor, background: cultureColor + '22' }}
        >
          {person.is_featured ? '★' : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-fv-moon text-base leading-tight">
              {person.name}
            </span>
            {person.is_featured && (
              <Badge variant="gold" className="text-xs">Featured</Badge>
            )}
          </div>
          <div className="text-xs text-fv-text-muted mt-0.5">
            {LIFE_STAGE_LABELS[person.life_stage] ?? person.life_stage} · Age {person.age}
          </div>
          {person.occupation && (
            <div className="text-xs text-fv-ember mt-0.5 truncate">{person.occupation}</div>
          )}
        </div>
        <Badge
          variant={CLASS_TIER_VARIANT[person.class_tier] ?? 'default'}
          className="text-xs flex-shrink-0"
        >
          {CLASS_TIER_LABELS[person.class_tier] ?? person.class_tier}
        </Badge>
      </div>

      {/* Culture & Settlement */}
      <div className="flex items-center gap-3 text-xs">
        {person.culture && (
          <span
            className="flex items-center gap-1.5"
            style={{ color: cultureColor }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: cultureColor }}
            />
            {person.culture.name}
          </span>
        )}
        {person.settlement && (
          <span className="text-fv-text-muted truncate">
            {person.settlement.name}
            <span className="text-fv-text-dim ml-1">
              ({person.settlement.settlement_type})
            </span>
          </span>
        )}
      </div>

      {/* Stat bars */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-fv-text-dim">Health</span>
            <span className="text-fv-text-muted">{person.health_score}</span>
          </div>
          <StatBar value={person.health_score} color={healthColor} />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-fv-text-dim">Wealth</span>
            <span className="text-fv-text-muted">{person.wealth_score}</span>
          </div>
          <StatBar value={person.wealth_score} color={wealthColor} />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-fv-text-dim">Happiness</span>
            <span className="text-fv-text-muted">{person.happiness_score}</span>
          </div>
          <StatBar
            value={person.happiness_score}
            color="var(--fv-storm-bright)"
          />
        </div>
      </div>

      {/* Current action */}
      {person.current_action && (
        <div className="text-xs text-fv-ember italic border-t border-fv-border-subtle pt-3">
          {person.current_action}
        </div>
      )}
    </Card>
  )
}

export default async function CharactersPage() {
  const supabase = await createClient()

  const { data: world } = await supabase
    .from('worlds')
    .select('id, name, in_game_day, in_game_year')
    .eq('slug', 'first-valley')
    .single()

  if (!world) {
    return (
      <div className="p-8 text-center text-fv-text-muted">
        <div className="text-4xl mb-4">🌍</div>
        <div className="font-display text-xl text-fv-moon mb-2">World not found</div>
        <div className="text-sm">First Valley hasn't been initialized yet.</div>
      </div>
    )
  }

  const { data: rawPersons } = await supabase
    .from('persons')
    .select(`
      *,
      culture:cultures(id, name, color_hex),
      settlement:settlements(id, name, settlement_type)
    `)
    .eq('world_id', world.id)
    .eq('is_alive', true)
    .order('is_featured', { ascending: false })
    .order('reputation_score', { ascending: false })
    .limit(120)

  const persons = (rawPersons ?? []) as unknown as PersonWithRelations[]
  const featured = persons.filter((p) => p.is_featured)
  const rest = persons.filter((p) => !p.is_featured)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-px h-8 bg-fv-ember" />
          <span className="font-display text-xs text-fv-ember uppercase tracking-widest">
            Year {world.in_game_year} · Day {world.in_game_day}
          </span>
        </div>
        <h1 className="font-display text-4xl font-bold text-fv-moon mb-3">
          Characters
        </h1>
        <p className="text-fv-text-muted text-base max-w-xl">
          {persons.length} souls walk the valley. Each carries their own fate, forged by choice and circumstance.
        </p>
      </div>

      {/* Featured characters */}
      {featured.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <span className="font-display text-xs text-fv-gold uppercase tracking-widest">
              Featured Characters
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-fv-gold/30 to-transparent" />
            <span className="text-xs text-fv-text-dim">{featured.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((person) => (
              <CharacterCard key={person.id} person={person} />
            ))}
          </div>
        </section>
      )}

      {/* Valley folk */}
      {rest.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="font-display text-xs text-fv-text-muted uppercase tracking-widest">
              Valley Folk
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-fv-border to-transparent" />
            <span className="text-xs text-fv-text-dim">{rest.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {rest.map((person) => (
              <Card key={person.id} variant="default" hoverable className="p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-display border flex-shrink-0"
                    style={{
                      borderColor: person.culture?.color_hex ?? '#555566',
                      background: (person.culture?.color_hex ?? '#555566') + '22',
                    }}
                  >
                    {person.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-fv-text truncate">{person.name}</div>
                    <div className="text-xs text-fv-text-dim truncate">
                      {person.occupation ?? LIFE_STAGE_LABELS[person.life_stage]}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-fv-text-dim">
                  <span
                    style={{ color: person.culture?.color_hex ?? undefined }}
                    className="truncate"
                  >
                    {person.culture?.name ?? '—'}
                  </span>
                  <span>Age {person.age}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <StatBar
                    value={person.health_score}
                    color={person.health_score > 50 ? 'var(--fv-success)' : 'var(--fv-danger)'}
                  />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {persons.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-5">👥</div>
          <div className="font-display text-xl text-fv-moon mb-2">No souls yet</div>
          <div className="text-sm text-fv-text-muted">
            The valley is empty. Run the simulation to populate the world.
          </div>
        </div>
      )}
    </div>
  )
}
