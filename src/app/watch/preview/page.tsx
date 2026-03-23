import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";

export default async function PreviewPage() {
  // Load some public world data without auth
  const world = await db.world.findFirst({
    where: { slug: "first-valley" },
    select: { id: true, name: true, age: true, tick: true, worldTime: true },
  }).catch(() => null);

  const recentEvents = world
    ? await db.worldEvent.findMany({
        where: { worldId: world.id, importance: { gte: 60 } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, title: true, description: true, type: true, category: true, importance: true, tick: true },
      }).catch(() => [])
    : [];

  const clans = world
    ? await db.clan.findMany({
        where: { worldId: world.id },
        select: { id: true, name: true, color: true, population: true, power: true, status: true, emblem: true },
        orderBy: { power: "desc" },
      }).catch(() => [])
    : [];

  const coreBeings = world
    ? await db.being.findMany({
        where: { worldId: world.id, isCore: true, status: { not: "DEAD" } },
        select: { id: true, name: true, role: true, status: true, description: true, clan: { select: { name: true, color: true } } },
        take: 3,
      }).catch(() => [])
    : [];

  const categoryIcons: Record<string, string> = {
    MILITARY: "⚔️",
    POLITICAL: "👑",
    SOCIAL: "🤝",
    SURVIVAL: "🌿",
    SPIRITUAL: "✨",
    NATURAL: "🌊",
    CULTURAL: "🎭",
    ECONOMIC: "⚖️",
    GENERAL: "📌",
    VIEWER: "👁",
  };

  return (
    <div className="min-h-screen bg-fv-base text-fv-text">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-fv-base/80 backdrop-blur-md border-b border-fv-border-subtle">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center">
            <span className="text-white text-base">🔥</span>
          </div>
          <span className="font-display font-bold text-fv-moon text-lg tracking-wide">First Valley</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button variant="cinematic" size="sm">Subscribe — $10/mo</Button>
          </Link>
        </div>
      </nav>

      <div className="pt-20 px-4 max-w-5xl mx-auto pb-20">

        {/* Preview banner */}
        <div className="mt-6 mb-8 rounded-xl border border-fv-ember/30 bg-fv-ember/5 p-4 flex items-start gap-4">
          <span className="text-2xl flex-shrink-0">👁</span>
          <div className="flex-1">
            <div className="font-display font-bold text-fv-moon mb-1">Free Preview — Limited View</div>
            <p className="text-sm text-fv-text-muted">
              You are seeing a snapshot of First Valley. Subscribe for the live world viewer,
              full character access, voting, and personalized recaps.
            </p>
          </div>
          <Link href="/signup" className="flex-shrink-0">
            <Button variant="cinematic" size="sm">Watch Live</Button>
          </Link>
        </div>

        {/* World status */}
        {world && (
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-fv-text-muted uppercase tracking-wider font-display">Live</span>
            </div>
            <Badge variant="ember" className="text-xs">{world.age.replace("_", " ")}</Badge>
            <span className="text-xs text-fv-text-dim">Tick {world.tick}</span>
            <span className="text-xs text-fv-text-dim">·</span>
            <span className="text-xs text-fv-text-dim">{clans.reduce((s, c) => s + c.population, 0)} souls in the valley</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Events feed */}
          <div className="lg:col-span-2">
            <h2 className="font-display text-sm text-fv-ember uppercase tracking-wider mb-4">
              Recent Events
            </h2>
            <div className="space-y-3">
              {recentEvents.length === 0 ? (
                <div className="text-fv-text-muted text-sm p-6 text-center border border-fv-border rounded-lg">
                  No events yet — the world is just beginning.
                </div>
              ) : (
                recentEvents.map((event) => (
                  <Card key={event.id} variant="elevated" className="p-4 hover:border-fv-border-bright transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">
                        {categoryIcons[event.category] ?? "📌"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge
                            variant={event.importance >= 80 ? "ember" : "storm"}
                            className="text-xs"
                          >
                            {event.importance >= 80 ? "HIGH" : "MED"}
                          </Badge>
                          <span className="text-xs text-fv-text-dim">{event.category}</span>
                          <span className="text-xs text-fv-text-dim ml-auto">T{event.tick}</span>
                        </div>
                        <h3 className="font-medium text-fv-text text-sm mb-1">{event.title}</h3>
                        <p className="text-xs text-fv-text-muted leading-relaxed line-clamp-2">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Locked teaser */}
            <div className="mt-4 rounded-lg border border-fv-border bg-fv-card p-6 text-center">
              <div className="text-2xl mb-3">🔒</div>
              <div className="font-display font-bold text-fv-moon mb-2">
                The Live Feed Goes Deeper
              </div>
              <p className="text-sm text-fv-text-muted mb-4">
                Subscribers see every event in real time — births, battles, discoveries, and more — as they happen.
              </p>
              <Link href="/signup">
                <Button variant="cinematic" size="sm">Unlock Full Access</Button>
              </Link>
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-6">
            {/* Clans */}
            <div>
              <h2 className="font-display text-sm text-fv-ember uppercase tracking-wider mb-3">
                The Clans
              </h2>
              <div className="space-y-2">
                {clans.map((clan) => (
                  <Card key={clan.id} variant="elevated" className="p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg border-2 flex items-center justify-center text-base flex-shrink-0"
                        style={{ borderColor: clan.color, background: clan.color + "20" }}
                      >
                        {clan.emblem ?? "🛡"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-fv-moon text-sm">{clan.name}</div>
                        <div className="text-xs text-fv-text-dim">{clan.population} people · Power {clan.power}</div>
                      </div>
                      <Badge
                        variant={clan.status === "AT_WAR" ? "ember" : clan.status === "IN_ALLIANCE" ? "storm" : "forest"}
                        className="text-xs flex-shrink-0"
                      >
                        {clan.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Core characters */}
            {coreBeings.length > 0 && (
              <div>
                <h2 className="font-display text-sm text-fv-ember uppercase tracking-wider mb-3">
                  Key Characters
                </h2>
                <div className="space-y-2">
                  {coreBeings.map((being) => (
                    <Card key={being.id} variant="elevated" className="p-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{
                            borderColor: being.clan?.color ?? "#555",
                            background: (being.clan?.color ?? "#555") + "20",
                          }}
                        >
                          ★
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-bold text-fv-moon text-sm">{being.name}</div>
                          <div className="text-xs" style={{ color: being.clan?.color ?? "#888" }}>
                            {being.role} · {being.clan?.name}
                          </div>
                          {being.description && (
                            <p className="text-xs text-fv-text-muted mt-1 line-clamp-2 leading-relaxed">
                              {being.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Subscribe CTA */}
            <Card variant="ember" className="p-5 text-center">
              <div className="text-3xl mb-3">🔥</div>
              <div className="font-display font-bold text-fv-moon mb-2">Watch It Live</div>
              <p className="text-xs text-fv-text-muted mb-4 leading-relaxed">
                The full viewer, character following, voting, and token interventions.
                $10/month, cancel anytime.
              </p>
              <Link href="/signup">
                <Button variant="cinematic" size="sm" className="w-full">Subscribe Now</Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
