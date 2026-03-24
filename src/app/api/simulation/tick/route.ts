import { NextRequest, NextResponse } from 'next/server'
import { runSimulationTick } from '@/lib/simulation/engine'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-simulation-secret')
  if (secret !== process.env.SIMULATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const worldSlug = (body.worldSlug as string) ?? 'first-valley'
    const result = await runSimulationTick(worldSlug)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Simulation Tick]', error)
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'simulation-ready' })
}
