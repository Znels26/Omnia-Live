'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface VoteOption {
  id: string
  title: string
  description: string
  effect_summary: string | null
  votes_count: number
  token_votes_count: number
}

interface WorldVote {
  id: string
  title: string
  description: string
  vote_category: string
  status: 'upcoming' | 'open' | 'closed' | 'resolved'
  closes_at: string | null
  opens_at: string | null
  total_votes_cast: number
  winning_option_id: string | null
  vote_options: VoteOption[]
}

function useCountdown(closesAt: string | null): string {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!closesAt) return
    const tick = () => {
      const diff = new Date(closesAt).getTime() - Date.now()
      if (diff <= 0) { setLabel('Closed'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setLabel(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [closesAt])

  return label
}

function ActiveVoteCard({ vote }: { vote: WorldVote }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const countdown = useCountdown(vote.closes_at)
  const total = vote.vote_options.reduce((s, o) => s + o.votes_count + o.token_votes_count, 0)

  async function castVote() {
    if (!selected || voted) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteId: vote.id, optionId: selected }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error ?? 'Failed to cast vote. Try again.')
      } else {
        setVoted(true)
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  if (voted) {
    return (
      <Card variant="ember" className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🗳️</span>
          <h3 className="font-display font-bold text-fv-moon">{vote.title}</h3>
        </div>
        <div className="rounded-lg bg-green-900/20 border border-green-800/40 p-4 text-center">
          <div className="text-green-400 font-medium mb-1">Vote cast successfully</div>
          <div className="text-xs text-fv-text-muted">
            The valley has received your guidance. Results will be revealed when voting closes.
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card variant="ember" className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <Badge variant="forest" className="text-xs">Open</Badge>
            <Badge variant="default" className="text-xs capitalize">
              {vote.vote_category.replace(/_/g, ' ')}
            </Badge>
          </div>
          <h3 className="font-display text-xl font-bold text-fv-moon mt-2">
            {vote.title}
          </h3>
        </div>
        {vote.closes_at && (
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-fv-text-dim mb-0.5">Closes in</div>
            <div className="font-display text-sm font-bold text-fv-ember tabular-nums">
              {countdown}
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-fv-text-muted leading-relaxed mb-6">
        {vote.description}
      </p>

      {/* Options */}
      <div className="space-y-3 mb-5">
        {vote.vote_options.map((option) => {
          const optTotal = option.votes_count + option.token_votes_count
          const pct = total > 0 ? Math.round((optTotal / total) * 100) : 0
          const isSelected = selected === option.id

          return (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={`w-full p-4 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'border-fv-ember bg-fv-ember/10 shadow-md shadow-fv-ember/10'
                  : 'border-fv-border hover:border-fv-border-bright hover:bg-fv-card'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`font-medium text-sm ${isSelected ? 'text-fv-ember' : 'text-fv-text'}`}>
                  {option.title}
                </span>
                <span className="text-xs text-fv-text-dim tabular-nums">{pct}%</span>
              </div>
              {option.description && (
                <p className="text-xs text-fv-text-muted mb-2 leading-relaxed">
                  {option.description}
                </p>
              )}
              {option.effect_summary && (
                <div className="text-xs text-fv-gold italic mb-2">
                  Effect: {option.effect_summary}
                </div>
              )}
              <div className="stat-bar">
                <div
                  className="stat-bar-fill transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isSelected ? 'var(--fv-ember)' : 'var(--fv-border-bright)',
                  }}
                />
              </div>
              <div className="text-xs text-fv-text-dim mt-1">
                {optTotal} votes
                {option.token_votes_count > 0 && (
                  <span className="text-fv-gold ml-1">· {option.token_votes_count} token</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="text-xs text-red-400 mb-3 px-1">{error}</div>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!selected}
        loading={loading}
        onClick={castVote}
      >
        Cast Your Vote
      </Button>

      <div className="text-xs text-fv-text-dim text-center mt-3">
        {vote.total_votes_cast} total votes cast
      </div>
    </Card>
  )
}

function PastVoteCard({ vote }: { vote: WorldVote }) {
  const winner = vote.vote_options.find((o) => o.id === vote.winning_option_id)
  const total = vote.vote_options.reduce((s, o) => s + o.votes_count + o.token_votes_count, 0)

  return (
    <Card variant="default" className="p-5 opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <Badge variant="default" className="text-xs mb-1.5">
            {vote.status === 'resolved' ? 'Resolved' : 'Closed'}
          </Badge>
          <h3 className="font-medium text-fv-text text-sm">{vote.title}</h3>
        </div>
        {winner && (
          <Badge variant="gold" className="text-xs flex-shrink-0">Winner</Badge>
        )}
      </div>

      {winner && (
        <div className="p-3 rounded-md bg-fv-gold/5 border border-fv-gold/20 mb-3">
          <div className="text-xs text-fv-gold uppercase tracking-wider mb-0.5">Winning Choice</div>
          <div className="text-sm font-medium text-fv-text">{winner.title}</div>
          {winner.effect_summary && (
            <div className="text-xs text-fv-text-muted mt-1">{winner.effect_summary}</div>
          )}
        </div>
      )}

      {/* Mini option bars */}
      <div className="space-y-2">
        {vote.vote_options.map((opt) => {
          const optTotal = opt.votes_count + opt.token_votes_count
          const pct = total > 0 ? Math.round((optTotal / total) * 100) : 0
          const isWinner = opt.id === vote.winning_option_id
          return (
            <div key={opt.id}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className={isWinner ? 'text-fv-gold' : 'text-fv-text-dim'}>{opt.title}</span>
                <span className="text-fv-text-dim">{pct}%</span>
              </div>
              <div className="stat-bar">
                <div
                  className="stat-bar-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isWinner ? 'var(--fv-gold)' : 'var(--fv-border-bright)',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-xs text-fv-text-dim mt-3">{vote.total_votes_cast} total votes</div>
    </Card>
  )
}

export default function VotePage() {
  const [votes, setVotes] = useState<WorldVote[]>([])
  const [loading, setLoading] = useState(true)

  const loadVotes = useCallback(async () => {
    try {
      const res = await fetch('/api/votes')
      if (!res.ok) return
      const data = await res.json()
      setVotes(data.votes ?? [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVotes()
  }, [loadVotes])

  const activeVotes = votes.filter((v) => v.status === 'open')
  const pastVotes = votes.filter((v) => v.status === 'closed' || v.status === 'resolved')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-px h-8 bg-fv-ember" />
          <span className="font-display text-xs text-fv-ember uppercase tracking-widest">
            Community Intervention
          </span>
        </div>
        <h1 className="font-display text-4xl font-bold text-fv-moon mb-3">
          Vote &amp; Intervene
        </h1>
        <p className="text-fv-text-muted text-base max-w-xl">
          The valley listens. Your voice shapes its fate. Vote on the decisions that will change history.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-64 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Active votes */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="font-display text-sm text-fv-ember uppercase tracking-widest">
                Active Votes
              </h2>
              <span className="text-xs text-fv-text-dim">({activeVotes.length})</span>
            </div>

            {activeVotes.length === 0 ? (
              <Card variant="default" className="p-12 text-center">
                <div className="text-4xl mb-4">🗳️</div>
                <div className="font-display text-lg text-fv-moon mb-2">No Active Votes</div>
                <div className="text-sm text-fv-text-muted">
                  The valley is deciding its own course for now.
                  <br />
                  A new vote will open soon.
                </div>
              </Card>
            ) : (
              <div className="space-y-5">
                {activeVotes.map((vote) => (
                  <ActiveVoteCard key={vote.id} vote={vote} />
                ))}
              </div>
            )}
          </section>

          {/* How voting works */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-display text-sm text-fv-text-muted uppercase tracking-widest">
                How It Works
              </h2>
              <div className="flex-1 h-px bg-fv-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '🗳️', title: 'Standard Votes', desc: 'Included with your subscription. One vote per decision.' },
                { icon: '⚡', title: 'Token Votes', desc: 'Spend tokens for amplified influence on the outcome.' },
                { icon: '🌟', title: 'Interventions', desc: 'Direct actions that affect specific characters or cultures.' },
                { icon: '📜', title: 'Permanent Record', desc: 'Every vote is recorded in world history forever.' },
              ].map((item) => (
                <div key={item.title} className="fv-card p-4">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="text-sm font-medium text-fv-text mb-1">{item.title}</div>
                  <div className="text-xs text-fv-text-muted">{item.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Past votes */}
          {pastVotes.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-5">
                <h2 className="font-display text-sm text-fv-text-muted uppercase tracking-widest">
                  Past Votes
                </h2>
                <div className="flex-1 h-px bg-fv-border" />
                <span className="text-xs text-fv-text-dim">{pastVotes.length}</span>
              </div>
              <div className="space-y-4">
                {pastVotes.map((vote) => (
                  <PastVoteCard key={vote.id} vote={vote} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
