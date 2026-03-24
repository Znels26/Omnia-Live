import { NextRequest, NextResponse } from 'next/server'
import { seedWorld } from '@/lib/simulation/seed'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-simulation-secret')
  if (secret !== process.env.SIMULATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await seedWorld()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Seed]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
