import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Tables } from '@/types/database'

type DailyRecap = Tables<'daily_recaps'>

function RecapCard({ recap }: { recap: DailyRecap }) {
  return (
    <Card variant="elevated" className="overflow-hidden">
      {/* Day number accent */}
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
                {recap.in_game_day}
              </div>
            </div>
            <div>
              {recap.title ? (
                <CardTitle className="text-fv-moon text-base normal-case">
                  {recap.title}
                </CardTitle>
              ) : (
                <CardTitle>
                  Year {recap.in_game_year} · Day {recap.in_game_day}
                </CardTitle>
              )}
              <div className="text-xs text-fv-text-dim mt-1">
                Year {recap.in_game_year}
                {recap.published_at && (
                  <> · Published {new Date(recap.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                )}
              </div>
            </div>
          </div>
          <Badge variant="ember" className="text-xs flex-shrink-0">
            Published
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {/* Headline event */}
        {recap.headline_event && (
          <div className="mb-4 p-3 rounded-lg bg-fv-gold/5 border border-fv-gold/20">
            <div className="text-xs text-fv-gold uppercase tracking-wider mb-1 font-display">
              Headline
            </div>
            <p className="text-sm text-fv-text font-medium leading-snug">
              {recap.headline_event}
            </p>
          </div>
        )}

        {/* AI narrative */}
        {recap.ai_narrative ? (
          <p className="text-sm text-fv-text-muted leading-relaxed mb-4">
            {recap.ai_narrative}
          </p>
        ) : recap.summary ? (
          <p className="text-sm text-fv-text-muted leading-relaxed mb-4">
            {recap.summary}
          </p>
        ) : null}

        {/* Drama & weather notes */}
        <div className="flex flex-col gap-2 mt-4">
          {recap.drama_note && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-fv-ember flex-shrink-0">⚡</span>
              <span className="text-fv-text-muted italic">{recap.drama_note}</span>
            </div>
          )}
          {recap.weather_note && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-fv-storm flex-shrink-0">🌤</span>
              <span className="text-fv-text-muted italic">{recap.weather_note}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
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

  const { data: recaps } = await supabase
    .from('daily_recaps')
    .select('*')
    .eq('world_id', world.id)
    .eq('is_published', true)
    .order('in_game_day', { ascending: false })
    .limit(30)

  const allRecaps = (recaps ?? []) as DailyRecap[]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-px h-8 bg-fv-ember" />
          <span className="font-display text-xs text-fv-ember uppercase tracking-widest">
            Recap Center
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
      {allRecaps.length > 0 && (
        <div className="fv-card p-4 mb-8 flex items-center gap-6">
          <div>
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Recaps Published</div>
            <div className="font-display text-2xl font-bold text-fv-moon">{allRecaps.length}</div>
          </div>
          <div className="w-px h-8 bg-fv-border" />
          <div>
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">Latest Day</div>
            <div className="font-display text-2xl font-bold text-fv-ember">
              {allRecaps[0]?.in_game_day ?? '—'}
            </div>
          </div>
          <div className="w-px h-8 bg-fv-border" />
          <div>
            <div className="text-xs text-fv-text-dim uppercase tracking-wider mb-0.5">World Year</div>
            <div className="font-display text-2xl font-bold text-fv-moon">
              {world.in_game_year}
            </div>
          </div>
        </div>
      )}

      {/* Recap list */}
      {allRecaps.length === 0 ? (
        <Card variant="default" className="p-12 text-center">
          <div className="text-5xl mb-5">📜</div>
          <div className="font-display text-xl text-fv-moon mb-2">
            The valley is young
          </div>
          <div className="text-sm text-fv-text-muted max-w-xs mx-auto">
            Recaps are generated and published daily. Return after the first world day ends.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {allRecaps.map((recap) => (
            <RecapCard key={recap.id} recap={recap} />
          ))}
        </div>
      )}
    </div>
  )
}
