import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-fv-base text-fv-text overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-fv-base/80 backdrop-blur-md border-b border-fv-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center">
            <span className="text-white text-base">🔥</span>
          </div>
          <span className="font-display font-bold text-fv-moon text-lg tracking-wide">First Valley</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/how-it-works" className="text-fv-text-muted hover:text-fv-text text-sm transition-colors hidden md:block">
            How It Works
          </Link>
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

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 px-4 overflow-hidden">
        {/* Animated world preview */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at 30% 60%, rgba(45, 90, 58, 0.2) 0%, transparent 60%),
                radial-gradient(ellipse at 70% 40%, rgba(74, 106, 138, 0.2) 0%, transparent 60%),
                radial-gradient(ellipse at 50% 80%, rgba(201, 113, 74, 0.1) 0%, transparent 50%)
              `,
            }}
          />
          {/* Terrain silhouettes */}
          <div className="absolute bottom-0 left-0 right-0 h-48 opacity-30"
            style={{
              background: "linear-gradient(to top, #1a2a1a 0%, transparent 100%)",
            }}
          />
        </div>

        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <Badge variant="ember" className="mb-6 text-xs">
            🔴 LIVE · First Valley · Day 1, Year 1
          </Badge>

          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-fv-moon mb-6 leading-tight tracking-tight">
            Watch Civilization
            <br />
            <span className="text-glow-ember" style={{ color: "var(--fv-ember)" }}>Begin</span>
          </h1>

          <p className="text-xl md:text-2xl text-fv-text-muted max-w-2xl mx-auto mb-4 leading-relaxed">
            An always-on living world where AI beings form tribes, build empires,
            wage wars, and make history — in real time.
          </p>

          <p className="text-base text-fv-text-dim max-w-xl mx-auto mb-10">
            You are the audience. Watch. Follow. Vote. Shape fate.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button variant="cinematic" size="xl" className="px-10">
                🔥 Start Watching — $10/month
              </Button>
            </Link>
            <Link href="/watch/preview">
              <Button variant="outline" size="xl">
                👁 Free Preview
              </Button>
            </Link>
          </div>

          <p className="text-xs text-fv-text-dim mt-4">
            Cancel anytime · No hidden fees · The world never sleeps
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-fv-text-dim text-xs animate-bounce">
          <span>Scroll to explore</span>
          <div className="w-px h-8 bg-gradient-to-b from-fv-border to-transparent" />
        </div>
      </section>

      {/* ── LIVE TEASER ─────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-fv-surface border-y border-fv-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-fv-text-muted uppercase tracking-wider font-display">
              Happening Right Now in First Valley
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              {
                icon: "⚔️",
                title: "The Iron Clan declare war",
                body: "After weeks of border raids, the Iron Clan&apos;s warriors have crossed the River Basin. The River People scramble to defend their settlement.",
                importance: "HIGH",
                category: "MILITARY",
              },
              {
                icon: "🔥",
                title: "Mara discovers fire-making",
                body: "The shaman Mara has found a way to reliably create fire from flint. This knowledge will change what is possible for her people forever.",
                importance: "MED",
                category: "DISCOVERY",
              },
              {
                icon: "🤝",
                title: "Forest Clan alliance forms",
                body: "The Forest Clan and the Coastal People have signed a pact of mutual protection, united by fear of the growing Iron Clan power.",
                importance: "HIGH",
                category: "POLITICAL",
              },
            ].map((event) => (
              <Card key={event.title} variant="elevated" className="p-4 hover:border-fv-border-bright transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{event.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={event.importance === "HIGH" ? "ember" : "storm"}
                        className="text-xs"
                      >
                        {event.importance}
                      </Badge>
                      <span className="text-xs text-fv-text-dim">{event.category}</span>
                    </div>
                    <h3 className="font-medium text-fv-text text-sm mb-1.5">{event.title}</h3>
                    <p className="text-xs text-fv-text-muted leading-relaxed">{event.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Link href="/watch/preview">
              <Button variant="outline" size="md">
                See the live world →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-fv-moon mb-4">
              A World That Never Sleeps
            </h2>
            <p className="text-fv-text-muted text-lg max-w-2xl mx-auto">
              First Valley runs continuously. Whether you are watching or not,
              history is being made.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                number: "01",
                title: "Watch",
                icon: "👁",
                description:
                  "Open the live world viewer. See clans evolving, characters moving, seasons changing. Watch a real civilization in motion.",
                detail: "Day/night cycles · Weather · Real movement · Live events",
              },
              {
                number: "02",
                title: "Follow",
                icon: "⭐",
                description:
                  "Pick characters and clans to follow. Receive alerts when they face turning points. Build your own relationship with the world.",
                detail: "Character arcs · Clan histories · Personalized recaps",
              },
              {
                number: "03",
                title: "Influence",
                icon: "⚡",
                description:
                  "Vote on critical world events. Spend tokens to intervene directly. Your choices become part of First Valley permanent history.",
                detail: "Votes · Token interventions · Verified impact",
              },
            ].map((step) => (
              <div key={step.title} className="relative">
                <div className="font-display text-6xl font-bold text-fv-ember/15 mb-4">
                  {step.number}
                </div>
                <div className="text-3xl mb-3">{step.icon}</div>
                <h3 className="font-display text-xl font-bold text-fv-moon mb-3">
                  {step.title}
                </h3>
                <p className="text-fv-text-muted mb-3 leading-relaxed">{step.description}</p>
                <p className="text-xs text-fv-text-dim">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CIVILIZATION PROGRESSION ──────────────────────────────────── */}
      <section className="py-24 px-4 bg-fv-surface border-y border-fv-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-fv-moon mb-4">
              Every Age Changes Everything
            </h2>
            <p className="text-fv-text-muted text-lg max-w-2xl mx-auto">
              The world evolves through visible eras. From desperate survival
              to towering civilization — and perhaps collapse, and rebirth.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "Survival", icon: "🌿", desc: "Three clans. Hunger. Fire. Will they live?", current: true },
              { label: "Tribe Formation", icon: "🏕", desc: "Rituals emerge. Leaders rise. Culture begins." },
              { label: "Settlement", icon: "🏘", desc: "Huts become villages. Trade routes appear." },
              { label: "Early Politics", icon: "👑", desc: "Alliances form. Betrayals unfold." },
              { label: "Civilization", icon: "🏛", desc: "Roads. Walls. Religion. Art. War." },
              { label: "Expansion", icon: "⚔️", desc: "Empires push outward. Blood and glory." },
              { label: "Collapse", icon: "💀", desc: "Nothing lasts forever. The valley remembers." },
              { label: "Renewal", icon: "🌱", desc: "From the ruins, something new begins." },
            ].map((era) => (
              <div
                key={era.label}
                className={`relative p-4 rounded-lg border transition-all duration-300 cursor-default ${
                  era.current
                    ? "border-fv-ember bg-fv-ember/10 shadow-lg shadow-fv-ember/10"
                    : "border-fv-border bg-fv-card hover:border-fv-border-bright"
                }`}
                style={{ minWidth: 140 }}
              >
                {era.current && (
                  <div className="absolute -top-2 left-3">
                    <Badge variant="ember" className="text-xs">CURRENT</Badge>
                  </div>
                )}
                <div className="text-2xl mb-2">{era.icon}</div>
                <div className="font-display text-sm font-medium text-fv-moon">{era.label}</div>
                <div className="text-xs text-fv-text-dim mt-1 leading-tight">{era.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED CHARACTERS ──────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-fv-moon mb-4">
              Meet the Cast
            </h2>
            <p className="text-fv-text-muted text-lg max-w-2xl mx-auto">
              These are not NPCs. They have histories, fears, and ambitions.
              They remember. They change. They matter.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Doran",
                role: "Chieftain of the Iron Clan",
                clanColor: "#c9714a",
                traits: ["Bold", "Ambitious", "Feared"],
                status: "AT WAR",
                statusColor: "text-red-400",
                backstory: "Born during a storm that killed his father, Doran has fought for every inch of respect. He believes the valley was made for those strong enough to take it.",
                goal: "Unite the valley under one banner — or burn what will not bow",
                emoji: "⚔️",
              },
              {
                name: "Mara",
                role: "Shaman of the River People",
                clanColor: "#4a6a8a",
                traits: ["Wise", "Spiritual", "Keeper of Memory"],
                status: "INFLUENTIAL",
                statusColor: "text-blue-400",
                backstory: "Mara speaks with voices others cannot hear. She has seen the valley in visions stretching centuries forward. She alone knows what the first fire meant.",
                goal: "Preserve the old ways and prevent the darkness she has seen",
                emoji: "🔥",
              },
              {
                name: "Lyra",
                role: "Scout, Forest Clan",
                clanColor: "#2d5a3a",
                traits: ["Cunning", "Loyal", "Restless"],
                status: "EXPLORING",
                statusColor: "text-green-400",
                backstory: "Lyra moves faster than her shadows. She has seen things beyond the eastern forest that she has not told her clan yet.",
                goal: "Find what lies beyond the mountains before it finds them first",
                emoji: "🌿",
              },
            ].map((char) => (
              <Card key={char.name} variant="elevated" className="p-5 hover:border-fv-border-bright transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2"
                    style={{ borderColor: char.clanColor, background: char.clanColor + "20" }}
                  >
                    {char.emoji}
                  </div>
                  <span className={`text-xs font-medium ${char.statusColor}`}>
                    ● {char.status}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-fv-moon mb-0.5">{char.name}</h3>
                <p className="text-xs text-fv-text-muted mb-1" style={{ color: char.clanColor }}>
                  {char.role}
                </p>
                <div className="flex gap-1.5 my-3 flex-wrap">
                  {char.traits.map((t) => (
                    <Badge key={t} variant="default" className="text-xs">{t}</Badge>
                  ))}
                </div>
                <p className="text-sm text-fv-text-muted leading-relaxed mb-3">
                  {char.backstory}
                </p>
                <div className="border-t border-fv-border-subtle pt-3">
                  <p className="text-xs text-fv-text-dim">
                    <span className="text-fv-ember font-medium">Goal: </span>
                    {char.goal}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4 bg-fv-surface border-y border-fv-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-fv-moon mb-4">
            One Subscription. An Entire World.
          </h2>
          <p className="text-fv-text-muted text-lg mb-12">
            Less than the cost of one cup of coffee a month.
          </p>

          <div className="grid md:grid-cols-2 gap-6 text-left">
            <Card variant="default" className="p-6">
              <div className="font-display text-2xl font-bold text-fv-moon mb-1">Free</div>
              <p className="text-fv-text-muted text-sm mb-6">Limited preview access</p>
              <ul className="space-y-3 mb-8">
                {[
                  "Browse the world overview",
                  "Read public event highlights",
                  "See teaser character profiles",
                  "View the marketing site",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-fv-text-muted">
                    <span className="text-fv-border">○</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="outline" className="w-full">Create Free Account</Button>
              </Link>
            </Card>

            <Card variant="ember" className="p-6 relative">
              <div className="absolute -top-3 right-4">
                <Badge variant="ember" className="text-xs font-display">RECOMMENDED</Badge>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-display text-4xl font-bold text-fv-moon">$10</span>
                <span className="text-fv-text-muted">/month</span>
              </div>
              <p className="text-fv-text-muted text-sm mb-6">Full civilization access</p>
              <ul className="space-y-3 mb-8">
                {[
                  "Live world viewer — always on",
                  "Full character and clan access",
                  "Daily and weekly recaps",
                  "Standard votes on world events",
                  "Follow specific characters",
                  "World timeline and history",
                  "Notifications and alerts",
                  "Cancel anytime",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-fv-text">
                    <span className="text-fv-ember">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="cinematic" className="w-full">
                  Start Watching — $10/month
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, rgba(201, 113, 74, 0.08) 0%, transparent 70%)`,
          }}
        />
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <div className="text-5xl mb-6">🔥</div>
          <h2 className="font-display text-4xl md:text-6xl font-bold text-fv-moon mb-6 leading-tight">
            The Valley Has Been
            <br />
            <span style={{ color: "var(--fv-ember)" }}>Waiting for You</span>
          </h2>
          <p className="text-xl text-fv-text-muted mb-10 leading-relaxed">
            Three clans are already living, fighting, and dying. History is being made right now.
          </p>

          <Link href="/signup">
            <Button variant="cinematic" size="xl" className="px-12">
              🔥 Join First Valley — $10/month
            </Button>
          </Link>

          <p className="text-fv-text-dim text-sm mt-4">
            Cancel anytime. The world keeps going either way.
          </p>
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
          <p className="text-fv-text-dim text-xs">
            © {new Date().getFullYear()} First Valley
          </p>
        </div>
      </footer>
    </div>
  );
}
