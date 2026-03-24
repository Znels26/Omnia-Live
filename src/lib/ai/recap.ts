import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface RecapContext {
  worldDay: number
  worldYear: number
  events: Array<{
    type: string
    title: string
    description: string
    importance: number
  }>
  settlements: Array<{ name: string; population: number; type: string }>
  activeConflicts: string[]
  notablePersons: string[]
  weatherSummary: string
  seasonName: string
}

export async function generateDailyRecap(ctx: RecapContext): Promise<string> {
  const prompt = `You are the narrator of First Valley — a living AI civilization world. Write a daily recap for Day ${ctx.worldDay}, Year ${ctx.worldYear}.

World state:
- Season: ${ctx.seasonName}
- Weather: ${ctx.weatherSummary}
- Active conflicts: ${ctx.activeConflicts.join(', ') || 'none'}
- Notable persons today: ${ctx.notablePersons.join(', ') || 'none'}

Key events today:
${ctx.events.map((e) => `- [${e.type}] ${e.title}: ${e.description}`).join('\n')}

Settlements:
${ctx.settlements.map((s) => `- ${s.name} (${s.type}, pop ${s.population})`).join('\n')}

Write a cinematic, immersive daily recap of 150-250 words. Write in present tense. Focus on what matters most. Make it feel like a documentary narrator describing real events. Do not use bullet points — write prose. Do not mention "AI" or "simulation".`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return ''
  return content.text
}

export async function generateSinceYouWereAway(
  ctx: RecapContext & { daysMissed: number }
): Promise<string> {
  const prompt = `You are the narrator of First Valley. The viewer has been away for ${ctx.daysMissed} in-game days (${Math.round(ctx.daysMissed * 12)} real hours).

Summarize what happened in First Valley while they were gone. Current state: Day ${ctx.worldDay}, Year ${ctx.worldYear}.

Key events while away:
${ctx.events.slice(0, 15).map((e) => `- ${e.title}: ${e.description}`).join('\n')}

Write a "Since you were away" summary of 100-180 words. Make it feel urgent and compelling — like they missed important things. Write in second person ("While you were away..."). Do not use bullet points.`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return ''
  return content.text
}

export async function generateBloodlineSummary(bloodline: {
  name: string
  founderName: string
  currentGeneration: number
  livingMembers: number
  notableEvents: string[]
  currentStatus: string
}): Promise<string> {
  const prompt = `You are the narrator of First Valley. Summarize the ${bloodline.name} bloodline.

Founded by: ${bloodline.founderName}
Current generation: ${bloodline.currentGeneration}
Living members: ${bloodline.livingMembers}
Current status: ${bloodline.currentStatus}
Notable events: ${bloodline.notableEvents.join('; ')}

Write a bloodline summary of 80-120 words. Make it feel like reading from a history book. Focus on legacy, drama, and significance.`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return ''
  return content.text
}
