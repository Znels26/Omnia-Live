'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/layout/Navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

interface Wallet {
  id: string
  user_id: string
  balance: number
  lifetime_purchased: number
  created_at: string
}

interface Transaction {
  id: string
  user_id: string
  amount: number
  balance_after: number
  type: string
  description: string | null
  created_at: string
}

export default function AdminTokensPage() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalCirculation, setTotalCirculation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [grantUserId, setGrantUserId] = useState('')
  const [grantAmount, setGrantAmount] = useState('')
  const [grantDesc, setGrantDesc] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)
  const [grantResult, setGrantResult] = useState<string | null>(null)
  const [grantError, setGrantError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: w }, { data: tx }] = await Promise.all([
      supabase.from('token_wallets').select('*').order('balance', { ascending: false }).limit(50),
      supabase.from('token_transactions').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    const walletList = (w ?? []) as Wallet[]
    setWallets(walletList)
    setTransactions((tx ?? []) as Transaction[])
    setTotalCirculation(walletList.reduce((s, wl) => s + wl.balance, 0))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    setGrantLoading(true)
    setGrantResult(null)
    setGrantError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('credit_tokens', {
        p_user_id: grantUserId.trim(),
        p_amount: parseInt(grantAmount, 10),
        p_description: grantDesc.trim() || 'Admin grant',
      })
      if (error) {
        setGrantError(error.message)
      } else {
        setGrantResult(`Granted ${grantAmount} tokens. New balance: ${data}`)
        setGrantUserId('')
        setGrantAmount('')
        setGrantDesc('')
        await load()
      }
    } catch (err) {
      setGrantError('Grant failed')
    }
    setGrantLoading(false)
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--fv-base)' }}>
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-1" style={{ color: 'var(--fv-moon)' }}>
            Token Economy
          </h1>
          <p style={{ color: 'var(--fv-text-muted)' }}>Manage Fate Tokens across the platform</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total In Circulation', value: loading ? '—' : totalCirculation.toLocaleString(), icon: '⚡', color: 'gold' as const },
            { label: 'Active Wallets', value: loading ? '—' : wallets.length.toLocaleString(), icon: '👛', color: 'default' as const },
            { label: 'Recent Transactions', value: loading ? '—' : transactions.length.toLocaleString(), icon: '📋', color: 'default' as const },
          ].map((s) => (
            <Card key={s.label} variant={s.color === 'gold' ? 'gold' : 'default'} className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span>{s.icon}</span>
                <span className="text-xs font-display uppercase tracking-wider" style={{ color: 'var(--fv-text-muted)' }}>{s.label}</span>
              </div>
              <div className="font-display text-3xl font-bold" style={{ color: 'var(--fv-moon)' }}>{s.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Grant tokens */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Grant Tokens to User</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGrant} className="space-y-4">
                <div>
                  <label className="block text-xs font-display uppercase tracking-wider mb-1.5" style={{ color: 'var(--fv-text-muted)' }}>
                    User ID (UUID)
                  </label>
                  <Input
                    value={grantUserId}
                    onChange={(e) => setGrantUserId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-display uppercase tracking-wider mb-1.5" style={{ color: 'var(--fv-text-muted)' }}>
                    Amount
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="100000"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    placeholder="e.g. 100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-display uppercase tracking-wider mb-1.5" style={{ color: 'var(--fv-text-muted)' }}>
                    Description (optional)
                  </label>
                  <Input
                    value={grantDesc}
                    onChange={(e) => setGrantDesc(e.target.value)}
                    placeholder="Admin grant — reason"
                  />
                </div>
                <Button type="submit" variant="primary" size="sm" disabled={grantLoading}>
                  {grantLoading ? '⏳ Granting…' : '⚡ Grant Tokens'}
                </Button>
                {grantResult && (
                  <p className="text-xs" style={{ color: 'var(--fv-success)' }}>{grantResult}</p>
                )}
                {grantError && (
                  <p className="text-xs" style={{ color: 'var(--fv-danger)' }}>{grantError}</p>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Top wallets */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Top Wallets by Balance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>Loading…</p>
              ) : wallets.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No wallets yet.</p>
              ) : (
                <div className="space-y-0">
                  {wallets.slice(0, 10).map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between py-2.5"
                      style={{ borderBottom: '1px solid var(--fv-border)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono truncate" style={{ color: 'var(--fv-text)' }}>
                          {w.user_id}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--fv-text-dim)' }}>
                          Lifetime: {w.lifetime_purchased.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                        <span style={{ color: 'var(--fv-gold)', fontSize: '12px' }}>⚡</span>
                        <span className="font-display font-bold" style={{ color: 'var(--fv-moon)' }}>
                          {w.balance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent transactions */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Recent Token Transactions (Last 50)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>Loading…</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--fv-text-muted)' }}>No transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fv-border)' }}>
                      {['User ID', 'Type', 'Amount', 'Balance After', 'Description', 'Date'].map((h) => (
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
                    {transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--fv-border)' }}>
                        <td className="py-2 pr-4 text-xs font-mono max-w-[100px] truncate" style={{ color: 'var(--fv-text-muted)' }}>
                          {tx.user_id.slice(0, 8)}…
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className="text-xs px-2 py-0.5 rounded capitalize"
                            style={{
                              background: tx.type === 'purchase' ? 'rgba(74,222,128,0.1)' : tx.type === 'admin_grant' ? 'rgba(201,160,80,0.1)' : 'rgba(201,113,74,0.1)',
                              color: tx.type === 'purchase' ? 'var(--fv-success)' : tx.type === 'admin_grant' ? 'var(--fv-gold)' : 'var(--fv-ember)',
                            }}
                          >
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: tx.amount > 0 ? 'var(--fv-success)' : 'var(--fv-danger)' }}
                          >
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs" style={{ color: 'var(--fv-text)' }}>
                          {tx.balance_after}
                        </td>
                        <td className="py-2 pr-4 text-xs max-w-[200px] truncate" style={{ color: 'var(--fv-text-muted)' }}>
                          {tx.description ?? '—'}
                        </td>
                        <td className="py-2 text-xs whitespace-nowrap" style={{ color: 'var(--fv-text-dim)' }}>
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
