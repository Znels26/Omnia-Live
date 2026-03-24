'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface WorldControlsProps {
  worldStatus: 'active' | 'paused' | 'reset'
}

export function WorldControls({ worldStatus }: WorldControlsProps) {
  const [status, setStatus] = useState(worldStatus)
  const [pauseLoading, setPauseLoading] = useState(false)
  const [tickLoading, setTickLoading] = useState(false)
  const [tickResult, setTickResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePause() {
    setPauseLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      })
      const data = await res.json()
      if (data.success) setStatus('paused')
      else setError(data.error ?? 'Failed to pause')
    } catch {
      setError('Request failed')
    }
    setPauseLoading(false)
  }

  async function handleResume() {
    setPauseLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      })
      const data = await res.json()
      if (data.success) setStatus('active')
      else setError(data.error ?? 'Failed to resume')
    } catch {
      setError('Request failed')
    }
    setPauseLoading(false)
  }

  async function handleRunTick() {
    setTickLoading(true)
    setError(null)
    setTickResult(null)
    try {
      const res = await fetch('/api/simulation/tick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-simulation-secret': process.env.NEXT_PUBLIC_SIMULATION_SECRET ?? '',
        },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        setTickResult('Tick completed successfully')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Tick failed (${res.status})`)
      }
    } catch {
      setError('Tick request failed')
    }
    setTickLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRunTick}
          disabled={tickLoading || pauseLoading}
        >
          {tickLoading ? '⏳ Running…' : '⏭ Run Tick'}
        </Button>

        {status === 'active' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            disabled={pauseLoading || tickLoading}
          >
            {pauseLoading ? '⏳ Pausing…' : '⏸ Pause World'}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleResume}
            disabled={pauseLoading || tickLoading}
          >
            {pauseLoading ? '⏳ Resuming…' : '▶ Resume World'}
          </Button>
        )}
      </div>

      {tickResult && (
        <p className="text-xs" style={{ color: 'var(--fv-success)' }}>{tickResult}</p>
      )}
      {error && (
        <p className="text-xs" style={{ color: 'var(--fv-danger)' }}>{error}</p>
      )}
    </div>
  )
}
