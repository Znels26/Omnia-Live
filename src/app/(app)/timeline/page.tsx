import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { getEventIcon } from '@/lib/utils'
import type { Tables } from '@/types/database'

type PublicEvent = Tables<'public_events'>

const EVENT_TYPE_VARIANT: Record<string, 'ember' | 'gold' | 'storm' | 'forest' | 'danger' | 'warning' | 'default'> = {
  birth: 'forest',
  death: 'danger',
  marriage: 'ember',
  alliance: 'storm',
  war_declared: 'danger',
  battle: 'danger',
  peace_treaty: 'forest',
  migration: 'default',
  famine: 'warning',
  feast: 'forest',
  plague: 'danger',
  natural_disaster: 'warning',
  discovery: 'storm',
  invention: 'gold',
  ritual: 'ember',
  election: 'gold',
  betrayal: 'danger',
  assassination: 'danger',
  settlement_founded: 'forest',
  settlement_destroyed: 'danger',
  religion_founded: 'storm',
  miracle: 'gold',
  drought: 'warning',
  flood: 'warning',
  era_transition: 'gold',
  viewer_vote: 'ember',
  intervention: 'gold',
}

function EventTypeBadge({ type }: { type: string }) {
  const variant = EVENT_TYPE_VARIANT[type.toLowerCase()] ?? 'default'
  const label = type.replace(/_/g, ' ')
  return (
    <Badge variant={variant} className="text-xs uppercase tracking-wide">
      {label}
    </Badge>
  )
}

function DayMarker({ day, year }: { day: number; year: number }) {
  return (
    <div className="relative flex items-center gap-4 py-2">
      <div className="absolute -left-8 w-4 h-4 rounded-full border-2 border-fv-ember bg-fv-ember/20 flex items-center justify-center z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-fv-ember" />
      </div>
      <div className="font-display text-xs text-fv-ember uppercase tracking-widest">
        Year {year} · Day {day}
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-fv-ember/30 to-transparent" />
    </div>
  )
}

export default async function TimelinePage() {
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

  const { data: events } = await supabase
    .from('public_events')
    .select('*')
    .eq('world_id', world.id)
    .order('in_game_day', { ascending: false })
    .order('significance_score', { ascending: false })
    .limit(200)

  const allEvents = (events ?? []) as PublicEvent[]

  // Group events by in_game_day
  const grouped = allEvents.reduce<Record<number, { day: number; year: number; events: PublicEvent[] }>>(
    (acc, ev) => {
      const key = ev.in_game_day
      if (!acc[key]) {
        acc[key] = { day: ev.in_game_day, year: ev.in_game_year, events: [] }
      }
      acc[key].events.push(ev)
      return acc
    },
    {}
  )

  const days = Object.values(grouped).sort((a, b) => b.day - a.day)
  const milestoneCount = allEvents.filter((e) => e.is_milestone).length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-px h-8 bg-fv-ember" />
          <span className="font-display text-xs text-fv-ember uppercase tracking-widest">
            World History
          </span>
        </div>
        <h1 className="font-display text-4xl font-bold text-fv-moon mb-3">
          Timeline
        </h1>
        <p className="text-fv-text-muted text-base max-w-xl">
          Every war. Every birth. Every collapse. The complete history of First Valley, unfolding in real time.
        </p>
      </div>

      {/* Stats bar */}
      <div className="fv-card p-4 mb-8 flex items-center gap-6 flex-wrap">
        <div>
          <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Current Day</div>
          <div className="font-display text-2xl font-bold text-fv-moon">
            {world.in_game_day}
          </div>
        </div>
        <div className="w-px h-8 bg-fv-border" />
        <div>
          <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Year</div>
          <div className="font-display text-2xl font-bold text-fv-moon">
            {world.in_game_year}
          </div>
        </div>
        <div className="w-px h-8 bg-fv-border" />
        <div>
          <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Events Recorded</div>
          <div className="font-display text-2xl font-bold text-fv-moon">{allEvents.length}</div>
        </div>
        <div className="w-px h-8 bg-fv-border" />
        <div>
          <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Milestones</div>
          <div className="font-display text-2xl font-bold text-fv-gold">{milestoneCount}</div>
        </div>
      </div>

      {/* Timeline */}
      {days.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-5">📜</div>
          <div className="font-display text-xl text-fv-moon mb-2">No events yet</div>
          <div className="text-sm text-fv-text-muted">
            The valley is quiet. History begins with the first tick.
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical spine */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-fv-ember/40 via-fv-border to-transparent" />

          <div className="pl-12 space-y-8">
            {days.map(({ day, year, events: dayEvents }) => (
              <div key={day}>
                <DayMarker day={day} year={year} />

                <div className="space-y-3 mt-3">
                  {dayEvents.map((event) => {
                    const isMilestone = event.is_milestone
                    const icon = getEventIcon(event.event_type.toUpperCase())

                    return (
                      <div
                        key={event.id}
                        className={`relative fv-card p-4 transition-all ${
                          isMilestone
                            ? 'border-fv-gold/40 bg-fv-gold/5 shadow-lg shadow-fv-gold/5'
                            : event.is_featured
                            ? 'border-fv-ember/30 bg-fv-ember/5'
                            : 'hover:border-fv-border-bright'
                        }`}
                      >
                        {/* Timeline dot on spine */}
                        <div
                          className={`absolute -left-9 top-4 w-3 h-3 rounded-full border flex-shrink-0 ${
                            isMilestone
                              ? 'border-fv-gold bg-fv-gold/30'
                              : 'border-fv-border bg-fv-surface'
                          }`}
                        />

                        <div className="flex items-start gap-3">
                          <span className="text-lg flex-shrink-0 leading-none mt-0.5">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap mb-1.5">
                              <span
                                className={`font-medium text-sm leading-snug ${
                                  isMilestone ? 'text-fv-gold' : 'text-fv-text'
                                }`}
                              >
                                {event.title}
                              </span>
                              {isMilestone && (
                                <Badge variant="gold" className="text-xs flex-shrink-0">
                                  Milestone
                                </Badge>
                              )}
                              {event.is_featured && !isMilestone && (
                                <Badge variant="ember" className="text-xs flex-shrink-0">
                                  Featured
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-fv-text-muted leading-relaxed mb-2">
                              {event.description}
                            </p>

                            <div className="flex items-center gap-3 flex-wrap">
                              <EventTypeBadge type={event.event_type} />
                              {event.significance_score > 0 && (
                                <span className="text-xs text-fv-text-dim">
                                  Significance: {event.significance_score}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* World origin marker */}
            <div className="relative">
              <div className="absolute -left-8 top-3 w-4 h-4 rounded-full border-2 border-fv-ember bg-fv-ember/30 flex items-center justify-center z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-fv-ember" />
              </div>
              <div className="fv-card p-5 border-fv-ember/40">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🌅</span>
                  <span className="font-display font-bold text-fv-ember">First Valley Begins</span>
                </div>
                <p className="text-xs text-fv-text-muted leading-relaxed">
                  The valley awakens. Cultures form. Fate is unwritten.
                </p>
                <div className="text-xs text-fv-text-dim mt-1.5">Year 1 · Day 1 · The Beginning</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
