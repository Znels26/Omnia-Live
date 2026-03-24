import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-fv-base text-fv-text overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-fv-base/80 backdrop-blur-md border-b border-fv-border-subtle">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center">
            <span className="text-white text-base">🔥</span>
          </div>
          <span className="font-display font-bold text-fv-moon text-lg tracking-wide">First Valley</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-fv-text-muted hover:text-fv-text text-sm transition-colors hidden md:block">
            Pricing
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">Watch Now</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 text-center">
        <Badge variant="ember" className="mb-6 text-xs">How It Works</Badge>
        <h1 className="font-display text-5xl md:text-6xl font-bold text-fv-moon mb-6 leading-tight">
          A World That Never<br />
          <span style={{ color: "var(--fv-ember)" }}>Stops Living</span>
        </h1>
        <p className="text-xl text-fv-text-muted max-w-2xl mx-auto leading-relaxed">
          First Valley is an always-on AI civilization. Whether you are watching or not,
          history is being made — births, wars, discoveries, and deaths happening in real time.
        </p>
      </section>

      {/* Three pillars */}
      <section className="py-20 px-4 bg-fv-surface border-y border-fv-border">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                number: "01",
                icon: "👁",
                title: "Watch",
                color: "var(--fv-ember)",
                steps: [
                  "Open the live world viewer — it loads instantly",
                  "See the terrain, clans, and characters rendered in real time",
                  "Watch day/night cycles, weather, and seasons change",
                  "Click any character to see their stats and current action",
                  "Events appear in the feed as they happen",
                ],
              },
              {
                number: "02",
                icon: "⭐",
                title: "Follow",
                color: "var(--fv-gold)",
                steps: [
                  "Browse the full character list — 100+ beings with histories",
                  "Hit Follow on any character or clan that interests you",
                  "Receive alerts when they face turning points",
                  "Get personalized daily and weekly recaps",
                  "Build your own story within the larger world",
                ],
              },
              {
                number: "03",
                icon: "⚡",
                title: "Influence",
                color: "#a78bfa",
                steps: [
                  "Vote on critical world events — free with subscription",
                  "Majority votes shape what actually happens next",
                  "Spend Fate Tokens for premium interventions",
                  "Inspire a character, send a gift, trigger an event",
                  "Every action is recorded permanently in world history",
                ],
              },
            ].map((pillar) => (
              <div key={pillar.title}>
                <div className="font-display text-5xl font-bold opacity-10 mb-4" style={{ color: pillar.color }}>
                  {pillar.number}
                </div>
                <div className="text-4xl mb-4">{pillar.icon}</div>
                <h2 className="font-display text-2xl font-bold text-fv-moon mb-5" style={{ color: pillar.color }}>
                  {pillar.title}
                </h2>
                <ul className="space-y-3">
                  {pillar.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-fv-text-muted leading-relaxed">
                      <span className="mt-0.5 flex-shrink-0" style={{ color: pillar.color }}>›</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The simulation explained */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold text-fv-moon mb-4">
              What Makes It Real
            </h2>
            <p className="text-fv-text-muted text-lg max-w-2xl mx-auto">
              First Valley is not scripted. Every character is driven by individual AI
              with memory, personality, goals, and emotion.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: "🧠",
                title: "Individual AI Minds",
                body: "Each being has unique personality traits — bravery, cunning, empathy, ambition. They remember past events, form opinions, make decisions based on their history. No two characters behave the same way.",
              },
              {
                icon: "⏱",
                title: "Continuous Time",
                body: "The simulation ticks forward around the clock. Characters age, relationships evolve, empires rise and fall. When you come back after being away, you get a recap of everything you missed.",
              },
              {
                icon: "🏕",
                title: "Civilization Progression",
                body: "The world moves through historical ages — from desperate survival to settled civilization to empire and potential collapse. Each transition brings new events, new conflicts, and new possibilities.",
              },
              {
                icon: "📜",
                title: "Permanent History",
                body: "Every major event is recorded. Battles, alliances, discoveries, deaths — all logged in the world timeline. Your votes and interventions are part of that history too, attributed to you forever.",
              },
              {
                icon: "⚔️",
                title: "Emergent Conflict",
                body: "Clans compete for food, land, and power. Wars are not scripted — they emerge from tension, distrust, resource scarcity, and ambition. You will witness betrayals no writer planned.",
              },
              {
                icon: "🌿",
                title: "Ecology & Seasons",
                body: "Weather, seasons, and resources affect the world. A drought can trigger famine. A flood can destroy a settlement. The environment is a character in the story.",
              },
            ].map((item) => (
              <Card key={item.title} variant="elevated" className="p-5">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-display text-base font-bold text-fv-moon mb-2">{item.title}</h3>
                <p className="text-sm text-fv-text-muted leading-relaxed">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4 bg-fv-surface border-y border-fv-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-4xl font-bold text-fv-moon mb-12 text-center">
            Common Questions
          </h2>
          <div className="space-y-6">
            {[
              {
                q: "Do I need to be watching constantly?",
                a: "Not at all. The world runs whether you are watching or not. When you return, you get a personalized recap covering everything that happened while you were away. You can watch for five minutes or five hours.",
              },
              {
                q: "Is this like a game?",
                a: "You cannot control a character. You are the audience — watching, following, voting. Think less game, more living television series that responds to viewer input. The drama is real, but your role is witness and occasional influencer.",
              },
              {
                q: "How much does my vote actually matter?",
                a: "Standard votes are decided by majority. If you want more influence, Fate Tokens let you cast weighted votes or trigger direct interventions. Every vote is recorded in world history with its outcome.",
              },
              {
                q: "What are Fate Tokens?",
                a: "Tokens are earned with your subscription and purchased separately. They can be spent on premium votes, interventions (directly affecting the world), or boosting outcomes you care about. They add a layer of participation beyond watching.",
              },
              {
                q: "Will characters I care about die?",
                a: "Yes. Death is permanent. Illness, battle, old age — characters you follow can and do die. Their history is preserved in the world timeline. This is what makes it matter.",
              },
              {
                q: "Can I start watching from the beginning?",
                a: "The timeline shows the full world history from tick one. You can catch up on everything that happened before you joined via the timeline, recaps, and character backstories.",
              },
            ].map((faq) => (
              <div key={faq.q} className="border-b border-fv-border pb-6">
                <h3 className="font-display font-bold text-fv-moon mb-2">{faq.q}</h3>
                <p className="text-fv-text-muted text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-xl mx-auto">
          <div className="text-5xl mb-6">🔥</div>
          <h2 className="font-display text-4xl font-bold text-fv-moon mb-4">
            Ready to Watch?
          </h2>
          <p className="text-fv-text-muted mb-8">
            $10/month. Cancel anytime. The world keeps going either way.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button variant="cinematic" size="xl">Start Watching — $10/month</Button>
            </Link>
            <Link href="/watch/preview">
              <Button variant="outline" size="xl">Free Preview</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-fv-border bg-fv-surface">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <span className="font-display text-fv-moon font-bold">First Valley</span>
          </div>
          <div className="flex gap-6 text-sm text-fv-text-muted">
            <Link href="/pricing" className="hover:text-fv-text transition-colors">Pricing</Link>
            <Link href="/how-it-works" className="hover:text-fv-text transition-colors">How It Works</Link>
            <Link href="/login" className="hover:text-fv-text transition-colors">Login</Link>
          </div>
          <p className="text-fv-text-dim text-xs">© {new Date().getFullYear()} First Valley</p>
        </div>
      </footer>
    </div>
  );
}
