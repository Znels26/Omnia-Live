'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TokenTransaction {
  id: string
  amount: number
  balance_after: number
  type: string
  description: string | null
  created_at: string
}

interface TokenWallet {
  balance: number
  lifetime_purchased: number
}

const TOKEN_PACKS = [
  {
    id: 'ember',
    name: 'Ember Pack',
    tokens: 100,
    priceCents: 499,
    priceLabel: '$4.99',
    description: 'A handful of ember tokens to get started.',
    badge: null,
  },
  {
    id: 'valley',
    name: 'Valley Pack',
    tokens: 300,
    priceCents: 999,
    priceLabel: '$9.99',
    description: 'The most popular choice for active voters.',
    badge: 'Popular',
  },
  {
    id: 'dynasty',
    name: 'Dynasty Pack',
    tokens: 750,
    priceCents: 1999,
    priceLabel: '$19.99',
    description: "Shape the valley's destiny with authority.",
    badge: 'Best Value',
  },
  {
    id: 'empire',
    name: 'Empire Pack',
    tokens: 2000,
    priceCents: 4499,
    priceLabel: '$44.99',
    description: 'For those who would rule the world entire.',
    badge: null,
  },
]

const TX_ICONS: Record<string, string> = {
  purchase: '⚡',
  spend: '↗',
  refund: '↩',
  admin_grant: '★',
}

const TX_COLORS: Record<string, string> = {
  purchase: 'text-green-400',
  refund: 'text-green-400',
  admin_grant: 'text-fv-gold',
  spend: 'text-red-400',
}

function TokenPackCard({
  pack,
  onBuy,
  buying,
}: {
  pack: typeof TOKEN_PACKS[0]
  onBuy: (id: string) => void
  buying: string | null
}) {
  const isPopular = pack.badge === 'Popular'
  const isBestValue = pack.badge === 'Best Value'

  return (
    <Card
      variant={isPopular ? 'gold' : isBestValue ? 'ember' : 'default'}
      className="p-5 relative flex flex-col"
    >
      {pack.badge && (
        <div className="absolute -top-3 right-4">
          <Badge variant={isPopular ? 'gold' : 'ember'} className="text-xs px-3">
            {pack.badge}
          </Badge>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-display font-bold text-fv-moon text-lg mb-0.5">{pack.name}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-bold text-fv-gold">
              {pack.tokens.toLocaleString()}
            </span>
            <span className="text-sm text-fv-text-muted">tokens</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-bold text-fv-moon">{pack.priceLabel}</div>
          <div className="text-xs text-fv-text-dim mt-0.5">
            {(pack.priceCents / pack.tokens).toFixed(1)}¢/token
          </div>
        </div>
      </div>

      <p className="text-xs text-fv-text-muted mb-4 flex-1">{pack.description}</p>

      <div className="flex items-center gap-2 text-xs text-fv-text-dim mb-4">
        <span>≈ {Math.floor(pack.tokens / 50)} votes</span>
        <span className="text-fv-border">·</span>
        <span>≈ {Math.floor(pack.tokens / 100)} interventions</span>
      </div>

      <Button
        variant={isPopular || isBestValue ? 'cinematic' : 'outline'}
        size="md"
        className="w-full"
        loading={buying === pack.id}
        disabled={buying !== null}
        onClick={() => onBuy(pack.id)}
      >
        Purchase {pack.name}
      </Button>
    </Card>
  )
}

export default function TokensPage() {
  const [wallet, setWallet] = useState<TokenWallet | null>(null)
  const [transactions, setTransactions] = useState<TokenTransaction[]>([])
  const [buying, setBuying] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [walletRes, txRes] = await Promise.all([
      supabase
        .from('token_wallets')
        .select('balance, lifetime_purchased')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('token_transactions')
        .select('id, amount, balance_after, type, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (walletRes.data) setWallet(walletRes.data)
    if (txRes.data) setTransactions(txRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleBuy(packId: string) {
    setError(null)
    setBuying(packId)
    try {
      const res = await fetch('/api/stripe/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error ?? 'Failed to initiate purchase.')
        setBuying(null)
        return
      }
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      } else {
        setError('No redirect URL returned. Please try again.')
        setBuying(null)
      }
    } catch {
      setError('Network error. Please try again.')
      setBuying(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-px h-8 bg-fv-gold" />
          <span className="font-display text-xs text-fv-gold uppercase tracking-widest">
            Fate Tokens
          </span>
        </div>
        <h1 className="font-display text-4xl font-bold text-fv-moon mb-3">
          Token Wallet
        </h1>
        <p className="text-fv-text-muted text-base max-w-xl">
          Use tokens to cast powerful votes, inspire characters, and intervene in the valley's fate.
        </p>
      </div>

      {/* Balance card */}
      <Card variant="gold" className="p-6 mb-8">
        <div className="flex items-center justify-between">
          {loading ? (
            <div className="skeleton w-32 h-12 rounded" />
          ) : (
            <div>
              <div className="text-xs text-fv-gold uppercase tracking-wider font-display mb-1">
                Your Balance
              </div>
              <div className="font-display text-5xl font-bold text-fv-moon tabular-nums">
                {(wallet?.balance ?? 0).toLocaleString()}
              </div>
              <div className="text-sm text-fv-text-muted mt-1">fate tokens</div>
            </div>
          )}
          <div className="text-right">
            <div className="text-5xl mb-1">⚡</div>
            {wallet && (
              <div className="text-xs text-fv-text-dim">
                {wallet.lifetime_purchased.toLocaleString()} total purchased
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Packs */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="font-display text-lg font-bold text-fv-moon">Purchase Tokens</h2>
          <div className="flex-1 h-px bg-fv-border" />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800/40 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {TOKEN_PACKS.map((pack) => (
            <TokenPackCard
              key={pack.id}
              pack={pack}
              onBuy={handleBuy}
              buying={buying}
            />
          ))}
        </div>
      </div>

      {/* What tokens do */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="font-display text-lg font-bold text-fv-moon">What Tokens Do</h2>
          <div className="flex-1 h-px bg-fv-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: '🗳️', action: 'Weighted Votes', cost: '1–50 tokens', desc: 'More tokens = more influence on fate.' },
            { icon: '⚡', action: 'Inspire a Character', cost: '50 tokens', desc: "Boost a person's confidence and drive." },
            { icon: '🎁', action: 'Gift Resources', cost: '75 tokens', desc: 'Send food or supplies to a struggling clan.' },
            { icon: '👑', action: 'Back a Leader', cost: '100 tokens', desc: "Elevate a character's political authority." },
            { icon: '⚔️', action: 'Gift Weapons', cost: '150 tokens', desc: "Strengthen a culture's military power." },
            { icon: '🌟', action: 'Trigger a Miracle', cost: '500 tokens', desc: 'A rare world-altering event. Use wisely.' },
          ].map((item) => (
            <div key={item.action} className="fv-card p-4 flex gap-3">
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-fv-text">{item.action}</span>
                  <Badge variant="gold" className="text-xs">{item.cost}</Badge>
                </div>
                <p className="text-xs text-fv-text-muted">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="font-display text-lg font-bold text-fv-moon">Purchase History</h2>
            <div className="flex-1 h-px bg-fv-border" />
          </div>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="fv-card p-4 flex items-center gap-3">
                <div className="text-lg flex-shrink-0">
                  {TX_ICONS[tx.type] ?? '·'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-fv-text truncate">
                    {tx.description ?? tx.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-fv-text-dim mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {' · '}
                    Balance after: {tx.balance_after.toLocaleString()}
                  </div>
                </div>
                <div className={`font-display font-bold tabular-nums ${TX_COLORS[tx.type] ?? 'text-fv-text-muted'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
