import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const EVENT_TYPE_ICONS: Record<string, string> = {
  BIRTH: '🍼',
  DEATH: '💀',
  MARRIAGE: '💑',
  BATTLE: '⚔️',
  WAR_DECLARED: '🔥',
  PEACE_TREATY: '🕊️',
  MIRACLE: '✨',
  RITUAL: '🌙',
  DISCOVERY: '🔍',
  FEAST: '🍖',
  TRADE_ROUTE: '⚖️',
  MIGRATION: '🚶',
  SETTLEMENT_FOUNDED: '🏕️',
  PLAGUE: '☠️',
  FAMINE: '🌾',
  FLOOD: '🌊',
  FIRE: '🔥',
  NATURAL_DISASTER: '⛈️',
  FIRST_CONTACT: '👁️',
  ASSASSINATION: '🗡️',
}

function getEventIcon(type: string): string {
  return EVENT_TYPE_ICONS[type] ?? '📌'
}

function getSignificanceLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Major', color: 'text-fv-gold' }
  if (score >= 50) return { label: 'Notable', color: 'text-fv-ember' }
  if (score >= 25) return { label: 'Minor', color: 'text-fv-storm' }
  return { label: 'Passing', color: 'text-fv-text-dim' }
}

type RawEvent = {
  id: string
  event_type: string
  title: string
  description: string | null
  significance_score: number | null
  is_featured: boolean | null
  in_game_day: number | null
  in_game_year: number | null
  created_at: string
}

type DayGroup = {
  day: number
  year: number
  events: RawEvent[]
  headlineEvent: RawEvent | null
}

export default async function RecapsPage() {
  const supabase = await createClient()

  const { data: world } = await supabase
    .from('worlds')
    .select('id, name, in_game_day, in_game_year')
    .eq('slug', 'first-valley')
    .single()

  if (!world) {
    return (
      <div className="p-8 text-center text-fv-text-muted">
        <div className="text-4xl mb-4">📜</div>
        <div className="font-display text-xl text-fv-moon mb-2">World not found</div>
        <div className="text-sm">First Valley hasn't been initialized yet.</div>
      </div>
    )
  }

  // Pull recent events from public_events — group by in_game_day to build recaps
  const { data: rawEvents } = await supabase
    .from('public_events')
    .select('id, event_type, title, description, significance_score, is_featured, in_game_day, in_game_year, created_at')
    .eq('world_id', world.id)
    .order('significance_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  const events = (rawEvents ?? []) as RawEvent[]

  // Group events by day
  const dayMap = new Map<number, DayGroup>()
  for (const e of events) {
    const day = e.in_game_day ?? 0
    if (!dayMap.has(day)) {
      dayMap.set(day, { day, year: e.in_game_year ?? 1, events: [], headlineEvent: null })
    }
    dayMap.get(day)!.events.push(e)
  }

  // For each day, pick the highest-significance event as headline
  for (const group of dayMap.values()) {
    group.headlineEvent = group.events.reduce((best, e) =>
      (e.significance_score ?? 0) > (best?.significance_score ?? 0) ? e : best
    , group.events[0] ?? null)
    // Sort events within the day by significance desc
    group.events.sort((a, b) => (b.significance_score ?? 0) - (a.significance_score ?? 0))
  }

  // Sort days descending
  const days = Array.from(dayMap.values()).sort((a, b) => b.day - a.day)

  const totalEvents = events.length
  const latestDay = days[0]?.day ?? 0

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-px h-8 bg-fv-ember" />
          <span className="font-display text-xs text-fv-ember uppercase tracking-widest">
            Chronicle
          </span>
        </div>
        <h1 className="font-display text-4xl font-bold text-fv-moon mb-3">
          Daily Recaps
        </h1>
        <p className="text-fv-text-muted text-base max-w-xl">
          Previously in First Valley. Every chapter of the story, written by the world itself.
        </p>
      </div>

      {/* Stats */}
      {days.length > 0 && (
        <div className="fv-card p-4 mb-8 flex items-center gap-6">
          <div>
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Days Recorded</div>
            <div className="font-display text-2xl font-bold text-fv-moon">{days.length}</div>
          </div>
          <div className="w-px h-8 bg-fv-border" />
          <div>
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Latest Day</div>
            <div className="font-display text-2xl font-bold text-fv-ember">{latestDay}</div>
          </div>
          <div className="w-px h-8 bg-fv-border" />
          <div>
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Events Total</div>
            <div className="font-display text-2xl font-bold text-fv-moon">{totalEvents}</div>
          </div>
          <div className="w-px h-8 bg-fv-border" />
          <div>
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">World Year</div>
            <div className="font-display text-2xl font-bold text-fv-moon">{world.in_game_year}</div>
          </div>
        </div>
      )}

      {/* Day recap list */}
      {days.length === 0 ? (
        <Card variant="default" className="p-12 text-center">
          <div className="text-5xl mb-5">📜</div>
          <div className="font-display text-xl text-fv-moon mb-2">
            The valley is young
          </div>
          <div className="text-sm text-fv-text-muted max-w-xs mx-auto">
            No events have unfolded yet. The world is still waking. Return once the simulation has run.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {days.map((group) => (
            <DayRecapCard key={group.day} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}

function DayRecapCard({ group }: { group: DayGroup }) {
  const headline = group.headlineEvent
  const rest = group.events.filter(e => e.id !== headline?.id).slice(0, 8)
  const majorCount = group.events.filter(e => (e.significance_score ?? 0) >= 75).length
  const featuredCount = group.events.filter(e => e.is_featured).length

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="h-px bg-gradient-to-r from-fv-ember/60 via-fv-gold/30 to-transparent" />

      <CardHeader className="px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            {/* Day badge */}
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-fv-ember/10 border border-fv-ember/30 flex flex-col items-center justify-center">
              <div className="font-display text-xs text-fv-ember uppercase tracking-wider leading-none">
                Day
              </div>
              <div className="font-display text-2xl font-bold text-fv-ember leading-none mt-0.5">
                {group.day}
              </div>
            </div>
            <div>
              <CardTitle className="text-fv-moon text-base normal-case">
                {headline?.title ?? `Day ${group.day} in the Valley`}
              </CardTitle>
              <div className="text-xs text-fv-text-dim mt-1">
                Year {group.year} · {group.events.length} event{group.events.length !== 1 ? 's' : ''}
                {majorCount > 0 && <> · <span className="text-fv-gold">{majorCount} major</span></>}
              </div>
            </div>
          </div>
          {featuredCount > 0 ? (
            <Badge variant="gold" className="text-xs flex-shrink-0">Featured</Badge>
          ) : majorCount > 0 ? (
            <Badge variant="ember" className="text-xs flex-shrink-0">Eventful</Badge>
          ) : (
            <Badge variant="default" className="text-xs flex-shrink-0">Quiet</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {/* Headline event description */}
        {headline?.description && (
          <div className="mb-4 p-3 rounded-lg bg-fv-gold/5 border border-fv-gold/20">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">{getEventIcon(headline.event_type)}</span>
              <div className="text-xs text-fv-gold uppercase tracking-wider font-display">
                Headline
              </div>
            </div>
            <p className="text-sm text-fv-text font-medium leading-snug">
              {headline.description}
            </p>
          </div>
        )}

        {/* Other events of the day */}
        {rest.length > 0 && (
          <div className="space-y-1.5">
            {rest.map((e) => {
              const sig = getSignificanceLabel(e.significance_score ?? 0)
              return (
                <div key={e.id} className="flex items-start gap-2.5 py-1">
                  <span className="text-sm flex-shrink-0 mt-0.5 opacity-80">{getEventIcon(e.event_type)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-fv-text leading-snug">{e.title}</span>
                    {e.description && e.description !== e.title && (
                      <p className="text-xs text-fv-text-muted mt-0.5 line-clamp-1 leading-relaxed">
                        {e.description}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] flex-shrink-0 uppercase tracking-wide font-medium ${sig.color}`}>
                    {sig.label}
                  </span>
                </div>
              )
            })}
            {group.events.length > 9 && (
              <div className="text-xs text-fv-text-dim pt-1">
                + {group.events.length - 9} more events this day
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
